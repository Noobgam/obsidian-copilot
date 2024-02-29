import ChainManager from '@/LLMProviders/chainManager';
import { useAIState } from '@/aiState';
import { ChainType } from '@/chainFactory';
import ChatIcons from '@/components/ChatComponents/ChatIcons';
import ChatInput from '@/components/ChatComponents/ChatInput';
import ChatMessages from '@/components/ChatComponents/ChatMessages';
import { AI_SENDER, USER_SENDER } from '@/constants';
import { AppContext, ChatSharedContext } from '@/context';
import { CustomPromptProcessor } from '@/customPromptProcessor';
import { getAIResponse, GetAiResponseOptions } from '@/langchainStream';
import { CopilotSettings } from '@/settings/settings';
import SharedState, {
  ChatMessage,
  generateMessageId,
  useSharedState,
} from '@/sharedState';
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
  getNotesFromTags,
  getTagsFromNote,
  glossaryPrompt,
  removeUrlsFromSelectionPrompt,
  rewriteLongerSelectionPrompt,
  rewritePressReleaseSelectionPrompt,
  rewriteShorterSelectionPrompt,
  rewriteTweetSelectionPrompt,
  rewriteTweetThreadSelectionPrompt,
  simplifyPrompt,
  summarizePrompt,
  tocPrompt,
} from '@/utils';
import VectorDBManager from '@/vectorDBManager';
import { EventEmitter } from 'events';
import { Notice, TFile, Vault } from 'obsidian';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ChatContext,
  combineChatContext,
  ContextNote,
  convertToPrompt,
  EMPTY_CHAT_CONTEXT,
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
  debug,
}) => {
  const [chatHistory, addMessage, clearMessages] = useSharedState(sharedState);
  const [
    currentModel,
    setModel,
    currentChain,
    setChain,
    addChatMessage,
    clearChatMemory,
  ] = useAIState(chainManager);
  const [currentAiMessage, setCurrentAiMessage] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [storedContext, setStoredContext] =
    useState<ChatContext>(EMPTY_CHAT_CONTEXT);

  const app = useContext(AppContext);
  const [currentlyEditedMessageId, setCurrentlyEditedMessageId] = useState<
    string | undefined
  >(undefined);
  const [toolsEnabled, setToolsEnabledRaw] = useState(false);
  const setToolsEnabled = useCallback(
    async (toolsEnabled: boolean) => {
      // because tools use separate chain we just make sure the memory is set correctly.
      // TODO: remake this, `addChatMessage` and `addMessage` should not be separate hooks.
      clearMessages();
      clearChatMemory();
      for (const chatMessage of chatHistory) {
        addMessage(chatMessage);
        await addChatMessage(chatMessage);
      }
      setToolsEnabledRaw(toolsEnabled);
    },
    [setToolsEnabledRaw, addChatMessage, clearChatMemory, clearMessages]
  );

  const launchAIResponse = useCallback(
    async ({
      userMessage,
      extraOptions,
    }: {
      userMessage: ChatMessage;
      extraOptions?: Partial<GetAiResponseOptions>;
    }) => {
      setLoading(true);
      await getAIResponse(
        userMessage,
        chainManager,
        addMessage,
        setCurrentAiMessage,
        setAbortController,
        {
          debug,
          useTools: toolsEnabled,
          ...(extraOptions ? extraOptions : {}),
        }
      );
      setLoading(false);
    },
    [
      chainManager,
      setLoading,
      addMessage,
      setCurrentAiMessage,
      setAbortController,
      toolsEnabled,
      debug,
    ]
  );

  const editMessage = useCallback(
    async (message: ChatMessage) => {
      // invalidates everything that happened past that message in conv
      const idx = chatHistory.findIndex((c) => c.id == message.id);
      if (idx === -1) {
        new Notice('Failed to find appropriate message');
      }
      const newHistory = chatHistory.slice(0, idx);
      newHistory.push(message);

      clearMessages();
      clearChatMemory();
      let userMessage = undefined;
      for (const chatMessage of newHistory) {
        // since we don't edit invisible messages, how do we deal with context?
        addMessage(chatMessage);
        if (chatMessage.sender === USER_SENDER) {
          userMessage = chatMessage;
        }
        await addChatMessage(chatMessage);
      }
      if (userMessage) {
        // intentional skip of await.
        // eslint-disable-next-line  @typescript-eslint/no-floating-promises
        launchAIResponse({ userMessage });
      } else {
        new Notice("Couldn't find last user message");
      }
    },
    [chainManager, addMessage, setCurrentAiMessage, setAbortController]
  );

  const handleSendMessage = async () => {
    if (!inputMessage) return;

    let userMessage: ChatMessage;

    if (!storedContext) {
      userMessage = {
        message: inputMessage,
        sender: USER_SENDER,
        isVisible: true,
        isInChain: true,
        id: generateMessageId(),
      };

      addMessage(userMessage);
    } else {
      const { visibleMessage, invisibleMessage } = convertToPrompt(
        storedContext,
        inputMessage
      );
      setStoredContext(EMPTY_CHAT_CONTEXT);
      userMessage = invisibleMessage ?? visibleMessage;
      addMessage(visibleMessage);
      if (invisibleMessage) {
        addMessage(invisibleMessage);
      }
    }

    setInputMessage('');

    // intentional skip of await.
    // eslint-disable-next-line  @typescript-eslint/no-floating-promises
    launchAIResponse({ userMessage });
  };

  const handleKeyDown = async (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevents adding a newline to the textarea
      await handleSendMessage();
    }
  };

  const handleSaveAsNote = async () => {
    if (!app) {
      console.error('App instance is not available.');
      return;
    }
    // Save the chat history as a new note in the vault
    const chatContent = chatHistory
      .map((message) => `**${message.sender}**: ${message.message}`)
      .join('\n\n');

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
      await leaf.openFile(newNote);
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
      console.log(`Chat note context tags: '${settings.chatNoteContextTags}'`);
    }
    if (settings.chatNoteContextPath) {
      // Recursively get all note TFiles in the path
      noteFiles = [
        ...noteFiles,
        ...(await getNotesFromPath(vault, settings.chatNoteContextPath)),
      ];
    }
    if (settings.chatNoteContextTags?.length > 0) {
      // Get all notes with the specified tags
      // If path is provided, get all notes with the specified tags in the path
      // If path is not provided, get all notes with the specified tags
      noteFiles = [
        ...noteFiles,
        ...(await getNotesFromTags(
          vault,
          settings.chatNoteContextTags,
          noteFiles
        )),
      ];
    }
    const file = app.workspace.getActiveFile();
    // If no note context provided, default to the active note
    if (noteFiles.length === 0) {
      if (!file) {
        new Notice('No active note found.');
        console.error('No active note found.');
        return;
      }
      new Notice(
        'No valid Chat context provided. Defaulting to the active note.'
      );
      noteFiles = [file];
    }

    const notes: ContextNote[] = [];
    for (const file of noteFiles) {
      // Get the content of the note
      const content = await getFileContent(file, vault);
      const tags = await getTagsFromNote(file, app);
      // this is a relative path, right?
      const filePath = file.path;
      if (content) {
        if (notes.find((s) => s.notePath === filePath) === undefined) {
          notes.push({ notePath: filePath, noteContent: content, tags });
        }
      }
    }

    setStoredContext((prevState) => {
      const newContext = combineChatContext(prevState, {
        additionalNotes: notes,
      });
      console.log(`New context: ${JSON.stringify(newContext)}`);
      return newContext;
    });
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
    const noteContent = await getFileContent(file, vault);
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
      isInChain: true,
      id: generateMessageId(),
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
      const tokenCount =
        await chainManager.chatModelManager.countTokens(selectedText);
      const tokenCountMessage: ChatMessage = {
        sender: AI_SENDER,
        message: `The selected text contains ${wordCount} words and ${tokenCount} tokens.`,
        isVisible: true,
        isInChain: true,
        id: generateMessageId(),
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
    promptFn: (
      selectedText: string,
      eventSubtype?: string
    ) => string | Promise<string>,
    options: CreateEffectOptions = {}
  ) => {
    return () => {
      const {
        custom_temperature,
        isVisible = false,
        ignoreSystemMessage = true, // Ignore system message by default for commands
      } = options;
      const handleSelection = async (
        selectedText: string,
        eventSubtype?: string
      ) => {
        const messageWithPrompt = await promptFn(selectedText, eventSubtype);
        // Create a user message with the selected text
        const promptMessage: ChatMessage = {
          message: messageWithPrompt,
          sender: USER_SENDER,
          isVisible: isVisible,
          isInChain: true,
          id: generateMessageId(),
        };

        addMessage(promptMessage);

        // Have a hardcoded custom temperature for some commands that need more strictness
        chainManager.langChainParams = {
          ...chainManager.langChainParams,
          ...(custom_temperature && {
            temperature: custom_temperature,
          }),
        };

        await launchAIResponse({
          userMessage: promptMessage,
          extraOptions: { ignoreSystemMessage },
        });
      };

      emitter.on(eventType, handleSelection);

      // Cleanup function to remove the event listener when the component unmounts
      return () => {
        emitter.removeListener(eventType, handleSelection);
      };
    };
  };

  useEffect(
    createEffect(
      'fixGrammarSpellingSelection',
      fixGrammarSpellingSelectionPrompt
    ),
    []
  );
  useEffect(createEffect('summarizeSelection', summarizePrompt), []);
  useEffect(createEffect('tocSelection', tocPrompt), []);
  useEffect(createEffect('glossarySelection', glossaryPrompt), []);
  useEffect(createEffect('simplifySelection', simplifyPrompt), []);
  useEffect(createEffect('emojifySelection', emojifyPrompt), []);
  useEffect(
    createEffect('removeUrlsFromSelection', removeUrlsFromSelectionPrompt),
    []
  );
  useEffect(
    createEffect('rewriteTweetSelection', rewriteTweetSelectionPrompt, {
      custom_temperature: 0.2,
    }),
    []
  );
  useEffect(
    createEffect(
      'rewriteTweetThreadSelection',
      rewriteTweetThreadSelectionPrompt,
      { custom_temperature: 0.2 }
    ),
    []
  );
  useEffect(
    createEffect('rewriteShorterSelection', rewriteShorterSelectionPrompt),
    []
  );
  useEffect(
    createEffect('rewriteLongerSelection', rewriteLongerSelectionPrompt),
    []
  );
  useEffect(createEffect('eli5Selection', eli5SelectionPrompt), []);
  useEffect(
    createEffect(
      'rewritePressReleaseSelection',
      rewritePressReleaseSelectionPrompt
    ),
    []
  );
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
        return await customPromptProcessor.processCustomPrompt(
          customPrompt,
          selectedText
        );
      },
      {
        isVisible: debug,
        ignoreSystemMessage: true,
        custom_temperature: 0.1,
      }
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
        return await customPromptProcessor.processCustomPrompt(
          customPrompt,
          selectedText
        );
      },
      {
        isVisible: debug,
        ignoreSystemMessage: true,
        custom_temperature: 0.1,
      }
    ),
    []
  );

  return (
    <ChatSharedContext.Provider
      value={{
        currentlyEditedMessageId: currentlyEditedMessageId,
        setCurrentlyEditedMessageId: setCurrentlyEditedMessageId,
        addMessage: addMessage,
        editMessage: editMessage,
        clearMessages: clearMessages,
      }}
    >
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
            onNewChat={() => {
              clearMessages();
              clearChatMemory();
              clearCurrentAiMessage();
            }}
            onSaveAsNote={handleSaveAsNote}
            onSendActiveNoteToPrompt={handleSendActiveNoteToPrompt}
            onForceRebuildActiveNoteContext={forceRebuildActiveNoteContext}
            addMessage={addMessage}
            vault={vault}
            toolsEnabled={toolsEnabled}
            setToolsEnabled={setToolsEnabled}
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
    </ChatSharedContext.Provider>
  );
};

export default Chat;
