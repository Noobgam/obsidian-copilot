import { LangChainParams } from '@/aiParams';
import { BaseChatMemory, BufferWindowMemory } from 'langchain/memory';

export default class MemoryManager {
  private static instance: MemoryManager;
  private memory: BaseChatMemory;

  private constructor(private langChainParams: LangChainParams) {
    this.initMemory();
  }

  static getInstance(langChainParams: LangChainParams): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager(langChainParams);
    }
    return MemoryManager.instance;
  }

  getMemory(): BaseChatMemory {
    return this.memory;
  }

  clearChatMemory(): void {
    console.log('clearing chat memory');
    this.memory.clear();
  }

  private initMemory(): void {
    this.memory = new BufferWindowMemory({
      k: this.langChainParams.chatContextTurns * 2,
      memoryKey: 'history',
      inputKey: 'input',
      returnMessages: true,
    });
  }
}
