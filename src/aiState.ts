import ChainManager from '@/LLMProviders/chainManager';
import { SetChainOptions } from '@/aiParams';
import { ChainType } from '@/chainFactory';
import { useState } from 'react';
import { ChatMessage } from '@/sharedState';
import { USER_SENDER } from '@/constants';

/**
 * React hook to manage state related to model, chain and memory in Chat component.
 */
export function useAIState(
  chainManager: ChainManager
): [
  string,
  (model: string) => void,
  ChainType,
  (chain: ChainType, options?: SetChainOptions) => void,
  (message: ChatMessage) => Promise<void>,
  () => void,
] {
  const { langChainParams } = chainManager;
  const [currentModel, setCurrentModel] = useState<string>(
    langChainParams.modelDisplayName
  );
  const [currentChain, setCurrentChain] = useState<ChainType>(
    langChainParams.chainType
  );

  const addChatMessage = async (message: ChatMessage) => {
    const memory = chainManager.memoryManager.getMemory();
    if (!message.isInChain) {
      return;
    }
    console.log(`Adding message back to chain: ${JSON.stringify(message)}`);
    if (message.sender === USER_SENDER) {
      await memory.chatHistory.addUserMessage(message.message);
    } else {
      await memory.chatHistory.addAIChatMessage(message.message);
    }
  };

  const clearChatMemory = async () => {
    await chainManager.memoryManager.clearChatMemory();
  };

  const setModel = async (newModelDisplayName: string) => {
    await chainManager.createChainWithNewModel(newModelDisplayName);
    setCurrentModel(newModelDisplayName);
  };

  const setChain = async (newChain: ChainType, options?: SetChainOptions) => {
    await chainManager.setChain(newChain, options);
    setCurrentChain(newChain);
  };

  return [
    currentModel,
    setModel,
    currentChain,
    setChain,
    addChatMessage,
    clearChatMemory,
  ];
}
