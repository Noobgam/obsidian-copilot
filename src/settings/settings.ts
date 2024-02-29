interface MainSettings {
  azureOpenAIApiInstanceName: string;
  azureOpenAIApiDeploymentName: string;
  azureOpenAIApiVersion: string;
  azureOpenAIApiEmbeddingDeploymentName: string;
  openRouterModel: string;
  defaultModel: string;
  defaultModelDisplayName: string;
  embeddingModel: string;
  temperature: number;
  maxTokens: number;
  contextTurns: number;
  userSystemPrompt: string;
  openAIProxyBaseUrl: string;
  openAIProxyModelName: string;
  openAIEmbeddingProxyBaseUrl: string;
  openAIEmbeddingProxyModelName: string;
  ollamaModel: string;
  ollamaBaseUrl: string;
  lmStudioBaseUrl: string;
  ttlDays: number;
  stream: boolean;
  embeddingProvider: string;
  defaultSaveFolder: string;
  debug: boolean;
  enableEncryption: boolean;
}

interface ChatNoteContextSettings {
  chatNoteContextPath: string;
  chatNoteContextTags: string[];
  debug: boolean;
}

export const API_KEY_SETTINGS = [
  'openAIApiKey',
  'huggingfaceApiKey',
  'cohereApiKey',
  'anthropicApiKey',
  'azureOpenAIApiKey',
  'googleApiKey',
  'openRouterAiApiKey',
] as const;

export type ApiKeySettings = {
  [K in (typeof API_KEY_SETTINGS)[number]]: string;
};

export type EncryptionSettings = { enableEncryption: boolean } & ApiKeySettings;

export type CopilotSettings = MainSettings &
  EncryptionSettings &
  ApiKeySettings &
  ChatNoteContextSettings;
