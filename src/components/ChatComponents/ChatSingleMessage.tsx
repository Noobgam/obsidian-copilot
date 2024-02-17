import {
  BotIcon,
  CheckIcon,
  CopyClipboardIcon,
  EditIcon,
  UserIcon,
} from '@/components/Icons';
import ReactMarkdown from '@/components/Markdown/MemoizedReactMarkdown';
import { USER_SENDER } from '@/constants';
import { ChatMessage } from '@/sharedState';
import React, { useCallback, useContext, useState } from 'react';
import remarkGfm from 'remark-gfm';
import { ChatSharedContext } from '@/context';

interface ChatSingleMessageProps {
  message: ChatMessage;
}

const ChatSingleMessage: React.FC<ChatSingleMessageProps> = ({ message }) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const chatSharedContext = useContext(ChatSharedContext);
  const startEditingMessage = useCallback(
    (messageId: string) => {
      if (chatSharedContext) {
        chatSharedContext.setCurrentlyEditedMessageId(messageId);
      }
    },
    [chatSharedContext]
  );

  const [editedMessageContent, setEditedMessageContent] = useState<string>('');
  const submitChanges = useCallback(() => {
    console.log(`Will submit ${editedMessageContent}`);
    if (chatSharedContext) {
      chatSharedContext.editMessage({
        ...message,
        message: editedMessageContent,
      });
      chatSharedContext.setCurrentlyEditedMessageId(undefined);
    }
  }, [editedMessageContent]);

  const copyToClipboard = () => {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      return;
    }

    navigator.clipboard.writeText(message.message).then(() => {
      setIsCopied(true);

      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    });
  };

  const messageIsEditedNow =
    chatSharedContext?.currentlyEditedMessageId == message.id;
  const isFromUser = message.sender === USER_SENDER;

  return (
    <div className="message-container">
      <div className={`message ${isFromUser ? 'user-message' : 'bot-message'}`}>
        <div className="message-icon">
          {isFromUser ? <UserIcon /> : <BotIcon />}
        </div>
        {messageIsEditedNow ? (
          <input
            defaultValue={message.message}
            onChange={(e) => setEditedMessageContent(e.target.value)}
          />
        ) : (
          <>
            <div className="message-content">
              {isFromUser ? (
                <span>{message.message}</span>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.message}
                </ReactMarkdown>
              )}
            </div>
          </>
        )}
      </div>
      {messageIsEditedNow ? (
        <>
          <button onClick={submitChanges} className="chat-message-button">
            <CheckIcon />
          </button>
        </>
      ) : (
        <>
          {isFromUser ? (
            <button
              disabled={!message.isInChain}
              onClick={() => startEditingMessage(message.id)}
              className="chat-message-button"
            >
              <EditIcon stroke={!message.isInChain ? '#890000' : undefined} />
            </button>
          ) : (
            <></>
          )}
          <button onClick={copyToClipboard} className="chat-message-button">
            {isCopied ? <CheckIcon /> : <CopyClipboardIcon />}
          </button>
        </>
      )}
    </div>
  );
};

export default ChatSingleMessage;
