import { ChatMessage } from '@/sharedState';

export interface ChatSharedContextProps {
  currentlyEditedMessageId?: string;

  setCurrentlyEditedMessageId: (messageId: string | undefined) => void;

  addMessage: (message: ChatMessage) => void;
  editMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
}
