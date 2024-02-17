import { ChainType } from '@/chainFactory';
import {
  DEFAULT_SETTINGS,
  DISPLAY_NAME_TO_MODEL,
  USER_SENDER,
} from '@/constants';
import { CopilotSettings } from '@/settings/SettingsPage';
import { ChatMessage } from '@/sharedState';
import { MemoryVariables } from '@langchain/core/memory';
import { RunnableSequence } from '@langchain/core/runnables';
import { BaseChain, RetrievalQAChain } from 'langchain/chains';
import moment from 'moment';
import { TFile, Vault, parseYaml } from 'obsidian';

export const isFolderMatch = (
  fileFullpath: string,
  inputPath: string
): boolean => {
  const fileSegments = fileFullpath
    .split('/')
    .map((segment) => segment.toLowerCase());
  return fileSegments.includes(inputPath.toLowerCase());
};

export const getNotesFromPath = async (
  vault: Vault,
  path: string
): Promise<TFile[]> => {
  const files = await vault.getMarkdownFiles();

  // Special handling for the root path '/'
  if (path === '/') {
    return files;
  }

  // Split the path to get the last folder name
  const pathSegments = path.split('/');
  const lastSegment = pathSegments[pathSegments.length - 1].toLowerCase();

  return files.filter((file) => {
    // Split the file path and get the last directory name
    return (
      isFolderMatch(file.path, lastSegment) || file.basename === lastSegment
    );
  });
};

export async function getTagsFromNote(
  file: TFile,
  vault: Vault
): Promise<string[]> {
  const fileContent = await vault.cachedRead(file);
  return getTagsFromContent(fileContent);
}

export async function getTagsFromContent(fileContent: string) {
  let allTags: string[] = [];
  if (fileContent.startsWith('---')) {
    const endOfYaml = fileContent.indexOf('---', 3);
    if (endOfYaml != -1) {
      const noteProperties =
        parseYaml(fileContent.substring(4, endOfYaml)) || {};
      const noteTags = noteProperties.tags || [];
      allTags = [...allTags, ...noteTags];
    }
  }
  // this regex might not exactly match obsidian behaviour.
  // Obsidian recognizes any alphanumeric sequence as well
  // see the tests for the examples of tags that I have found obsidian to recognize
  // keep in mind that in ui terms obsidian will also not recognize the tag '123' even if you put it into properties
  const regex = /#([\p{L}\p{Nd}_\-]*\p{L}[\p{L}\p{Nd}_\-]*)\b/gu;
  const regexTagMatches = fileContent.match(regex) || [];

  return [...allTags, ...regexTagMatches].map(cleanTag);
}

function cleanTag(tag: string) {
  if (tag.startsWith('#')) {
    return tag.substring(1);
  }
  return tag;
}

// TODO: this method is shit.
// obsidian can do this properly for you by using search.
// e.g. `tag:#unprocessed_obsidianki` or `tag:unprocessed_obsidianki` in the search
// that will remove the bizarre parsing from here and hand it over to obsidian
export async function getNotesFromTags(
  vault: Vault,
  tags: string[],
  noteFiles?: TFile[]
): Promise<TFile[]> {
  if (tags.length === 0) {
    return [];
  }

  // Strip any '#' from the tags set from the user
  tags = tags.map((tag) => tag.replace('#', ''));

  const files =
    noteFiles && noteFiles.length > 0
      ? noteFiles
      : await getNotesFromPath(vault, '/');
  const filesWithTag = [];

  for (const file of files) {
    const noteTags = await getTagsFromNote(file, vault);
    if (tags.some((tag) => noteTags.includes(tag))) {
      filesWithTag.push(file);
    }
  }

  return filesWithTag;
}

export const stringToChainType = (chain: string): ChainType => {
  switch (chain) {
    case 'llm_chain':
      return ChainType.LLM_CHAIN;
    case 'retrieval_qa':
      return ChainType.RETRIEVAL_QA_CHAIN;
    default:
      throw new Error(`Unknown chain type: ${chain}`);
  }
};

export const isLLMChain = (
  chain: RunnableSequence
): chain is RunnableSequence => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (chain as any).last.bound.modelName || (chain as any).last.bound.model;
};

export const isRetrievalQAChain = (
  chain: BaseChain
): chain is RetrievalQAChain => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (chain as any).last.bound.retriever !== undefined;
};

export const isSupportedChain = (
  chain: RunnableSequence
): chain is RunnableSequence => {
  return isLLMChain(chain) || isRetrievalQAChain(chain);
};

export const getModelName = (modelDisplayName: string): string => {
  return DISPLAY_NAME_TO_MODEL[modelDisplayName];
};

// Returns the last N messages from the chat history,
// last one being the newest ai message
export const getChatContext = (
  chatHistory: ChatMessage[],
  contextSize: number
) => {
  if (chatHistory.length === 0) {
    return [];
  }
  const lastAiMessageIndex = chatHistory
    .slice()
    .reverse()
    .findIndex((msg) => msg.sender !== USER_SENDER);
  if (lastAiMessageIndex === -1) {
    // No ai messages found, return an empty array
    return [];
  }

  const lastIndex = chatHistory.length - 1 - lastAiMessageIndex;
  const startIndex = Math.max(0, lastIndex - contextSize + 1);
  return chatHistory.slice(startIndex, lastIndex + 1);
};

export const formatDateTime = (
  now: Date,
  timezone: 'local' | 'utc' = 'local'
) => {
  const formattedDateTime = moment(now);

  if (timezone === 'utc') {
    formattedDateTime.utc();
  }

  return formattedDateTime.format('YYYY_MM_DD-HH_mm_ss');
};

export async function getFileContent(
  file: TFile,
  vault: Vault
): Promise<string | null> {
  if (file.extension != 'md') return null;
  return await vault.cachedRead(file);
}

export function getFileName(file: TFile): string {
  return file.basename;
}

export function sanitizeSettings(settings: CopilotSettings): CopilotSettings {
  const sanitizedSettings: CopilotSettings = { ...settings };

  // Stuff in settings are string even when the interface has number type!
  const temperature = Number(settings.temperature);
  sanitizedSettings.temperature = isNaN(temperature)
    ? DEFAULT_SETTINGS.temperature
    : temperature;

  const maxTokens = Number(settings.maxTokens);
  sanitizedSettings.maxTokens = isNaN(maxTokens)
    ? DEFAULT_SETTINGS.maxTokens
    : maxTokens;

  const contextTurns = Number(settings.contextTurns);
  sanitizedSettings.contextTurns = isNaN(contextTurns)
    ? DEFAULT_SETTINGS.contextTurns
    : contextTurns;

  return sanitizedSettings;
}

function getNoteTitleAndTags(noteWithTag: {
  name: string;
  content: string;
  tags?: string[];
}): string {
  return (
    `[[${noteWithTag.name}]]` +
    (noteWithTag.tags ? `\ntags: ${noteWithTag.tags.join(',')}` : '')
  );
}

function getChatContextStr(
  chatNoteContextPath: string,
  chatNoteContextTags: string[]
): string {
  const pathStr = chatNoteContextPath
    ? `\nChat context by path: ${chatNoteContextPath}`
    : '';
  const tagsStr = chatNoteContextTags
    ? `\nChat context by tags: ${chatNoteContextTags}`
    : '';
  return pathStr + tagsStr;
}

export function getSendChatContextNotesPrompt(
  notes: { name: string; content: string }[],
  chatNoteContextPath: string,
  chatNoteContextTags: string[]
): string {
  const noteTitles = notes
    .map((note) => getNoteTitleAndTags(note))
    .join('\n\n');
  return (
    `Please read the notes below and be ready to answer questions about them. ` +
    getChatContextStr(chatNoteContextPath, chatNoteContextTags) +
    `\n\n${noteTitles}`
  );
}

export function fixGrammarSpellingSelectionPrompt(
  selectedText: string
): string {
  return (
    `Please fix the grammar and spelling of the following text and return it without any other changes:\n\n` +
    `${selectedText}`
  );
}

export function summarizePrompt(selectedText: string): string {
  return (
    `Please summarize the following text into bullet points and return it without any other changes. Output in the same language as the source, do not output English if it is not English:\n\n` +
    `${selectedText}`
  );
}

export function tocPrompt(selectedText: string): string {
  return (
    `Please generate a table of contents for the following text and return it without any other changes. Output in the same language as the source, do not output English if it is not English:\n\n` +
    `${selectedText}`
  );
}

export function glossaryPrompt(selectedText: string): string {
  return (
    `Please generate a glossary for the following text and return it without any other changes. Output in the same language as the source, do not output English if it is not English:\n\n` +
    `${selectedText}`
  );
}

export function simplifyPrompt(selectedText: string): string {
  return (
    `Please simplify the following text so that a 6th-grader can understand. Output in the same language as the source, do not output English if it is not English:\n\n` +
    `${selectedText}`
  );
}

export function emojifyPrompt(selectedText: string): string {
  return (
    `Please insert emojis to the following content without changing the text.` +
    `Insert at as many places as possible, but don't have any 2 emojis together. The original text must be returned.\n` +
    `Content: ${selectedText}`
  );
}

export function removeUrlsFromSelectionPrompt(selectedText: string): string {
  return (
    `Please remove all URLs from the following text and return it without any other changes:\n\n` +
    `${selectedText}`
  );
}

export function rewriteTweetSelectionPrompt(selectedText: string): string {
  return `Please rewrite the following content to under 280 characters using simple sentences. Output in the same language as the source, do not output English if it is not English. Please follow the instruction strictly. Content:\n
    + ${selectedText}`;
}

export function rewriteTweetThreadSelectionPrompt(
  selectedText: string
): string {
  return (
    `Please follow the instructions closely step by step and rewrite the content to a thread. ` +
    `1. Each paragraph must be under 240 characters. ` +
    `2. The starting line is \`THREAD START\n\`, and the ending line is \`\nTHREAD END\`. ` +
    `3. You must use \`\n\n---\n\n\` to separate each paragraph! Then return it without any other changes. ` +
    `4. Make it as engaging as possible.` +
    `5. Output in the same language as the source, do not output English if it is not English.\n The original content:\n\n` +
    `${selectedText}`
  );
}

export function rewriteShorterSelectionPrompt(selectedText: string): string {
  return (
    `Please rewrite the following text to make it half as long while keeping the meaning as much as possible. Output in the same language as the source, do not output English if it is not English:\n` +
    `${selectedText}`
  );
}

export function rewriteLongerSelectionPrompt(selectedText: string): string {
  return (
    `Please rewrite the following text to make it twice as long while keeping the meaning as much as possible. Output in the same language as the source, do not output English if it is not English:\n` +
    `${selectedText}`
  );
}

export function eli5SelectionPrompt(selectedText: string): string {
  return (
    `Please explain the following text like I'm 5 years old. Output in the same language as the source, do not output English if it is not English:\n\n` +
    `${selectedText}`
  );
}

export function rewritePressReleaseSelectionPrompt(
  selectedText: string
): string {
  return (
    `Please rewrite the following text to make it sound like a press release. Output in the same language as the source, do not output English if it is not English:\n\n` +
    `${selectedText}`
  );
}

export function createTranslateSelectionPrompt(language?: string) {
  return (selectedText: string): string => {
    return (
      `Please translate the following text to ${language}:\n\n` +
      `${selectedText}`
    );
  };
}

export function createChangeToneSelectionPrompt(tone?: string) {
  return (selectedText: string): string => {
    return (
      `Please change the tone of the following text to ${tone}. Output in the same language as the source, do not output English if it is not English:\n\n` +
      `${selectedText}`
    );
  };
}

export function extractChatHistory(
  memoryVariables: MemoryVariables
): [string, string][] {
  const chatHistory: [string, string][] = [];
  const { history } = memoryVariables;

  for (let i = 0; i < history.length; i += 2) {
    const userMessage = history[i]?.content || '';
    const aiMessage = history[i + 1]?.content || '';
    chatHistory.push([userMessage, aiMessage]);
  }

  return chatHistory;
}

export function processVariableNameForNotePath(variableName: string): string {
  variableName = variableName.trim();
  // Check if the variable name is enclosed in double brackets indicating it's a note
  if (variableName.startsWith('[[') && variableName.endsWith(']]')) {
    // It's a note, so we remove the brackets and append '.md'
    return `${variableName.slice(2, -2).trim()}.md`;
  }
  // It's a path, so we just return it as is
  return variableName;
}
