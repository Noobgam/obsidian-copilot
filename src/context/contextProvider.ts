import { ChatMessage, generateMessageId } from '@/sharedState';
import { USER_SENDER } from '@/constants';

export type ContextNote = {
  notePath: string;
  noteContent: string;
  tags: string[];
};

export type ChatContext = {
  additionalNotes: ContextNote[];
};

export const EMPTY_CHAT_CONTEXT: ChatContext = {
  additionalNotes: [],
};

function contextIsEmpty(chatContext: ChatContext) {
  return chatContext.additionalNotes.length == 0;
}

export function combineChatContext(
  oldValue: ChatContext | null,
  newValue: ChatContext
) {
  if (oldValue === null) {
    return newValue;
  }
  return {
    additionalNotes: [...oldValue.additionalNotes, ...newValue.additionalNotes],
  };
}

export function convertToPrompt(
  chatContext: ChatContext,
  userMessage: string
): {
  visibleMessage: ChatMessage;
  invisibleMessage?: ChatMessage;
} {
  if (contextIsEmpty(chatContext)) {
    return {
      visibleMessage: {
        sender: USER_SENDER,
        message: userMessage,
        isVisible: true,
        isInChain: true,
        id: generateMessageId(),
      },
    };
  }
  const invisibleMessageContent = `Here is additional helpful context from notes:
		\`\`\`
		${JSON.stringify(chatContext)}
		\`\`\`.
		
		${userMessage}
	`;

  return {
    visibleMessage: {
      sender: USER_SENDER,
      message: userMessage,
      isVisible: true,
      isInChain: false,
      id: generateMessageId(),
    },
    invisibleMessage: {
      sender: USER_SENDER,
      message: invisibleMessageContent,
      isVisible: false,
      isInChain: true,
      id: generateMessageId(),
    },
  };
}
