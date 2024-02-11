import ChainManager from '@/LLMProviders/chainManager';
import { useAIState } from '@/aiState';
import { ChainType } from '@/chainFactory';
import ChatIcons from '@/components/ChatComponents/ChatIcons';
import ChatInput from '@/components/ChatComponents/ChatInput';
import ChatMessages from '@/components/ChatComponents/ChatMessages';
import { AI_SENDER, USER_SENDER } from '@/constants';
import { AppContext } from '@/context';
import { CustomPromptProcessor } from '@/customPromptProcessor';
import { getAIResponse } from '@/langchainStream';
import { CopilotSettings } from '@/settings/SettingsPage';
import SharedState, { ChatMessage, useSharedState, } from '@/sharedState';
import {
	createChangeToneSelectionPrompt,
	createTranslateSelectionPrompt,
	eli5SelectionPrompt,
	emojifyPrompt,
	fixGrammarSpellingSelectionPrompt,
	formatDateTime,
	getFileContent,
	getFileName,
	getNotesFromPath,
	glossaryPrompt,
	removeUrlsFromSelectionPrompt,
	rewriteLongerSelectionPrompt,
	rewritePressReleaseSelectionPrompt,
	rewriteShorterSelectionPrompt,
	rewriteTweetSelectionPrompt,
	rewriteTweetThreadSelectionPrompt,
	simplifyPrompt,
	summarizePrompt,
	tocPrompt
} from '@/utils';
import VectorDBManager from '@/vectorDBManager';
import { EventEmitter } from 'events';
import { Notice, TFile, Vault } from 'obsidian';
import React, { useContext, useEffect, useState, } from 'react';
import {
	ChatContext,
	combineChatContext,
	ContextNote,
	convertToPrompt,
	EMPTY_CHAT_CONTEXT
} from '@/context/contextProvider';

interface CreateEffectOptions {
	custom_temperature?: number;
	isVisible?: boolean;
	ignoreSystemMessage?: boolean;
}

interface ChatProps {
	sharedState: SharedState;
	settings: CopilotSettings;
	chainManager: ChainManager;
	emitter: EventEmitter;
	getChatVisibility: () => Promise<boolean>;
	defaultSaveFolder: string;
	vault: Vault;
	debug: boolean;
}

const Chat: React.FC<ChatProps> = ({
	sharedState,
	settings,
	chainManager,
	emitter,
	getChatVisibility,
	defaultSaveFolder,
	vault,
	debug
}) => {
	const [
		chatHistory, addMessage, clearMessages,
	] = useSharedState(sharedState);
	const [
		currentModel, setModel, currentChain, setChain, clearChatMemory,
	] = useAIState(chainManager);
	const [currentAiMessage, setCurrentAiMessage] = useState('');
	const [inputMessage, setInputMessage] = useState('');
	const [abortController, setAbortController] = useState<AbortController | null>(null);
	const [loading, setLoading] = useState(false);
	const [storedContext, setStoredContext] = useState<ChatContext>(EMPTY_CHAT_CONTEXT);

	const app = useContext(AppContext);

	const handleSendMessage = async () => {
		if (!inputMessage) return;

		let userMessage: ChatMessage;

		if (!storedContext) {
			userMessage = {
				message: inputMessage,
				sender: USER_SENDER,
				isVisible: true,
			};

			addMessage(userMessage);
		} else {
			const { visibleMessage, invisibleMessage} = convertToPrompt(storedContext, inputMessage);
			setStoredContext(EMPTY_CHAT_CONTEXT);
			userMessage = invisibleMessage;
			addMessage(visibleMessage);
		}

		setInputMessage('');

		setLoading(true);
		await getAIResponse(
			userMessage,
			chainManager,
			addMessage,
			setCurrentAiMessage,
			setAbortController,
			{ debug },
		);
		setLoading(false);
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.nativeEvent.isComposing) return;
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault(); // Prevents adding a newline to the textarea
			handleSendMessage();
		}
	};

	const handleSaveAsNote = async () => {
		if (!app) {
			console.error('App instance is not available.');
			return;
		}
		// Save the chat history as a new note in the vault
		const chatContent = chatHistory.map((message) => `**${message.sender}**: ${message.message}`).join('\n\n');

		try {
			// Check if the default folder exists or create it
			const folder = app.vault.getAbstractFileByPath(defaultSaveFolder);
			if (!folder) {
				await app.vault.createFolder(defaultSaveFolder);
			}

			const now = new Date();
			const noteFileName = `${defaultSaveFolder}/Chat-${formatDateTime(now)}.md`;
			const newNote: TFile = await app.vault.create(noteFileName, chatContent);
			const leaf = app.workspace.getLeaf();
			leaf.openFile(newNote);
		} catch (error) {
			console.error('Error saving chat as note:', error);
		}
	};

	const handleSendActiveNoteToPrompt = async () => {
		if (!app) {
			console.error('App instance is not available.');
			return;
		}

		let noteFiles: TFile[] = [];

		if (debug) {
			console.log('Chat note context path:', settings.chatNoteContextPath);
			console.log(`Chat note context tags: '${settings.chatNoteContextTags}'`);
		}
		if (settings.chatNoteContextPath) {
			// Recursively get all note TFiles in the path
			noteFiles = [...noteFiles, ...(await getNotesFromPath(vault, settings.chatNoteContextPath))];
		}
		if (settings.chatNoteContextTags) {
			const tags = settings.chatNoteContextTags.split(',');
			// TODO: there should probably be a better way, obsidian has native link support.
			const allFiles = app.vault.getFiles();
			for (const file of allFiles) {
				const content = await getFileContent(file);
				if (!content) {
					continue;
				}
				for (const tag of tags) {
					if (content.includes(tag)) {
						noteFiles.push(file);
						break;
					}
				}
			}
		}

		const file = app.workspace.getActiveFile();
		// If no note context provided, default to the active note
		if (noteFiles.length === 0) {
			if (!file) {
				new Notice('No active note found.');
				console.error('No active note found.');
				return;
			}
			new Notice('No valid Chat context provided. Defaulting to the active note.');
			noteFiles = [file];
		}

		const notes: ContextNote[] = [];
		for (const file of noteFiles) {
			const content = await getFileContent(file);
			// this is a relative path, right?
			const filePath = file.path;
			if (content) {
				if (notes.find(s => s.notePath === filePath) === undefined) {
					notes.push({ notePath: filePath, noteContent: content });
				}
			}
		}

		setStoredContext((prevState) => {
			const newContext = combineChatContext(prevState, { additionalNotes: notes });
			console.log(`New context: ${JSON.stringify(newContext)}`);
			return newContext;
		})

		// setLoading(true);
		// await getAIResponse(
		// 	promptMessageHidden,
		// 	chainManager,
		// 	addMessage,
		// 	setCurrentAiMessage,
		// 	setAbortController,
		// 	{ debug },
		// );
		// setLoading(false);
	};

	const forceRebuildActiveNoteContext = async () => {
		if (!app) {
			console.error('App instance is not available.');
			return;
		}

		const file = app.workspace.getActiveFile();
		if (!file) {
			new Notice('No active note found.');
			console.error('No active note found.');
			return;
		}
		const noteContent = await getFileContent(file);
		const noteName = getFileName(file);
		if (!noteContent) {
			new Notice('No note content found.');
			console.error('No note content found.');
			return;
		}

		const docHash = VectorDBManager.getDocumentHash(noteContent);
		await chainManager.buildIndex(noteContent, docHash);
		const activeNoteOnMessage: ChatMessage = {
			sender: AI_SENDER,
			message: `Indexing [[${noteName}]]...\n\n Please switch to "QA" in Mode Selection to ask questions about it.`,
			isVisible: true,
		};

		if (currentChain === ChainType.RETRIEVAL_QA_CHAIN) {
			setChain(ChainType.RETRIEVAL_QA_CHAIN, { noteContent });
		}

		addMessage(activeNoteOnMessage);
	};

	const clearCurrentAiMessage = () => {
		setCurrentAiMessage('');
	};

	const handleStopGenerating = () => {
		if (abortController) {
			console.log('User stopping generation...');
			abortController.abort();
		}
	};

	useEffect(() => {
		async function handleSelection(selectedText: string) {
			const wordCount = selectedText.split(' ').length;
			const tokenCount = await chainManager.chatModelManager.countTokens(selectedText);
			const tokenCountMessage: ChatMessage = {
				sender: AI_SENDER,
				message: `The selected text contains ${wordCount} words and ${tokenCount} tokens.`,
				isVisible: true,
			};
			addMessage(tokenCountMessage);
		}

		emitter.on('countTokensSelection', handleSelection);

		// Cleanup function to remove the event listener when the component unmounts
		return () => {
			emitter.removeListener('countTokensSelection', handleSelection);
		};
	}, []);

	// Create an effect for each event type (Copilot command on selected text)
	const createEffect = (
		eventType: string,
		promptFn: (selectedText: string, eventSubtype?: string) => string | Promise<string>,
		options: CreateEffectOptions = {},
	) => {
		return () => {
			const {
				custom_temperature,
				isVisible = false,
				ignoreSystemMessage = true,  // Ignore system message by default for commands
			} = options;
			const handleSelection = async (selectedText: string, eventSubtype?: string) => {
				const messageWithPrompt = await promptFn(selectedText, eventSubtype);
				// Create a user message with the selected text
				const promptMessage: ChatMessage = {
					message: messageWithPrompt,
					sender: USER_SENDER,
					isVisible: isVisible,
				};

				if (isVisible) {
					addMessage(promptMessage);
				}

				// Have a hardcoded custom temperature for some commands that need more strictness
				chainManager.langChainParams = {
					...chainManager.langChainParams,
					...(custom_temperature && { temperature: custom_temperature }),
				};

				setLoading(true);
				await getAIResponse(
					promptMessage,
					chainManager,
					addMessage,
					setCurrentAiMessage,
					setAbortController,
					{
						debug,
						ignoreSystemMessage,
					}
				);
				setLoading(false);
			};

			emitter.on(eventType, handleSelection);

			// Cleanup function to remove the event listener when the component unmounts
			return () => {
				emitter.removeListener(eventType, handleSelection);
			};
		};
	};

	useEffect(createEffect('fixGrammarSpellingSelection', fixGrammarSpellingSelectionPrompt), []);
	useEffect(createEffect('summarizeSelection', summarizePrompt), []);
	useEffect(createEffect('tocSelection', tocPrompt), []);
	useEffect(createEffect('glossarySelection', glossaryPrompt), []);
	useEffect(createEffect('simplifySelection', simplifyPrompt), []);
	useEffect(createEffect('emojifySelection', emojifyPrompt), []);
	useEffect(createEffect('removeUrlsFromSelection', removeUrlsFromSelectionPrompt), []);
	useEffect(
		createEffect(
			'rewriteTweetSelection', rewriteTweetSelectionPrompt, { custom_temperature: 0.2 },
		),
		[]
	);
	useEffect(
		createEffect(
			'rewriteTweetThreadSelection', rewriteTweetThreadSelectionPrompt, { custom_temperature: 0.2 },
		),
		[]
	);
	useEffect(createEffect('rewriteShorterSelection', rewriteShorterSelectionPrompt), []);
	useEffect(createEffect('rewriteLongerSelection', rewriteLongerSelectionPrompt), []);
	useEffect(createEffect('eli5Selection', eli5SelectionPrompt), []);
	useEffect(createEffect('rewritePressReleaseSelection', rewritePressReleaseSelectionPrompt), []);
	useEffect(
		createEffect('translateSelection', (selectedText, language) =>
			createTranslateSelectionPrompt(language)(selectedText)
		),
		[]
	);
	useEffect(
		createEffect('changeToneSelection', (selectedText, tone) =>
			createChangeToneSelectionPrompt(tone)(selectedText)
		),
		[]
	);

	const customPromptProcessor = CustomPromptProcessor.getInstance(vault);
	useEffect(
		createEffect(
			'applyCustomPrompt',
			async (selectedText, customPrompt) => {
				if (!customPrompt) {
					return selectedText;
				}
				return await customPromptProcessor.processCustomPrompt(customPrompt, selectedText);
			},
			{ isVisible: debug, ignoreSystemMessage: true, custom_temperature: 0.1 },
		),
		[]
	);

	useEffect(
		createEffect(
			'applyAdhocPrompt',
			async (selectedText, customPrompt) => {
				if (!customPrompt) {
					return selectedText;
				}
				return await customPromptProcessor.processCustomPrompt(customPrompt, selectedText);
			},
			{ isVisible: debug, ignoreSystemMessage: true, custom_temperature: 0.1 },
		),
		[]
	);

	return (
		<div className="chat-container">
			<ChatMessages
				chatHistory={chatHistory}
				currentAiMessage={currentAiMessage}
				loading={loading}
			/>
			<div className="bottom-container">
				<ChatIcons
					currentModel={currentModel}
					setCurrentModel={setModel}
					currentChain={currentChain}
					setCurrentChain={setChain}
					onStopGenerating={handleStopGenerating}
					onNewChat={
						() => {
							clearMessages();
							clearChatMemory();
							clearCurrentAiMessage();
						}
					}
					onSaveAsNote={handleSaveAsNote}
					onSendActiveNoteToPrompt={handleSendActiveNoteToPrompt}
					onForceRebuildActiveNoteContext={forceRebuildActiveNoteContext}
					addMessage={addMessage}
				/>
				<ChatInput
					inputMessage={inputMessage}
					setInputMessage={setInputMessage}
					handleSendMessage={handleSendMessage}
					handleKeyDown={handleKeyDown}
					getChatVisibility={getChatVisibility}
				/>
			</div>
		</div>
	);
};

export default Chat;
