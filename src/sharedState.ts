import { useEffect, useState } from 'react';
import { ALL_SENDERS } from '@/constants';
import { v4 } from 'uuid';

export interface ChatMessage {
  message: string;
  sender: ALL_SENDERS;
  isVisible: boolean;
  isInChain: boolean;
  // for now the id is just a local, to be able to distinguish between them
  id: string;
}

export function generateMessageId() {
  return v4();
}

class SharedState {
  chatHistory: ChatMessage[] = [];

  addMessage(message: ChatMessage): void {
    this.chatHistory.push(message);
  }

  getMessages(): ChatMessage[] {
    return this.chatHistory;
  }

  clearChatHistory(): void {
    this.chatHistory = [];
  }
}

export function useSharedState(
  sharedState: SharedState
): [ChatMessage[], (message: ChatMessage) => void, () => void] {
  // Initializes the local chatHistory state with the current
  // sharedState chatHistory using the useState hook
  // setChatHistory is used to update the *local* state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(
    sharedState.getMessages()
  );

  // The useEffect hook ensures that the local state is synchronized
  // with the shared state when the component is mounted.
  // [] is the dependency array. The effect will only run if one of
  // the dependencies has changed since the last render.
  // When there are no dependencies, the effect will only run once,
  // *right after the initial render* (similar to componentDidMount in class components).
  useEffect(() => {
    setChatHistory(sharedState.getMessages());
  }, []);

  const addMessage = (message: ChatMessage) => {
    sharedState.addMessage(message);
    console.log(`Adding message: ${JSON.stringify(message)}`);
    setChatHistory([...sharedState.getMessages()]);
  };

  const clearMessages = () => {
    sharedState.clearChatHistory();
    setChatHistory([]);
  };

  return [chatHistory, addMessage, clearMessages];
}

export default SharedState;
