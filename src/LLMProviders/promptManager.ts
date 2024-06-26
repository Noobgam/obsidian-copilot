import { LangChainParams } from '@/aiParams';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';

export default class PromptManager {
  private static instance: PromptManager;
  private chatPrompt: ChatPromptTemplate;

  private constructor(private langChainParams: LangChainParams) {
    this.initChatPrompt();
  }

  static getInstance(langChainParams: LangChainParams): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager(langChainParams);
    }
    return PromptManager.instance;
  }

  getChatPrompt(): ChatPromptTemplate {
    return this.chatPrompt;
  }

  getAgentPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        this.langChainParams.systemMessage
      ),
      new MessagesPlaceholder('history'),
      HumanMessagePromptTemplate.fromTemplate('{input}'),
      new MessagesPlaceholder('agent_scratchpad'),
    ]);
  }

  private initChatPrompt(): void {
    this.chatPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        this.langChainParams.systemMessage
      ),
      new MessagesPlaceholder('history'),
      HumanMessagePromptTemplate.fromTemplate('{input}'),
    ]);
  }
}
