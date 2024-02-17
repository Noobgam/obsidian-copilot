import {
  BotIcon,
  CheckIcon,
  CopyClipboardIcon, EditIcon,
  UserIcon,
} from '@/components/Icons';
import ReactMarkdown from '@/components/Markdown/MemoizedReactMarkdown';
import { USER_SENDER } from '@/constants';
import { ChatMessage } from '@/sharedState';
import React, { useState } from 'react';
import remarkGfm from 'remark-gfm';

interface ChatSingleMessageProps {
  message: ChatMessage;
}

const ChatSingleMessage: React.FC<ChatSingleMessageProps> = ({ message }) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const editMessage = (id: string) => {
    // TODO: implement
    console.log(`Doing edit ${id}`);
  }

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

  return (
    <div className="message-container">
      <div
        className={`message ${
          message.sender === USER_SENDER ? 'user-message' : 'bot-message'
        }`}
      >
        <div className="message-icon">
          {message.sender === USER_SENDER ? <UserIcon /> : <BotIcon />}
        </div>
        <div className="message-content">
          {message.sender === USER_SENDER ? (
            <span>{message.message}</span>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.message}
            </ReactMarkdown>
          )}
        </div>
      </div>
      {
        message.sender === USER_SENDER ? (
          <button onClick={() => editMessage("stub_id")} className="chat-message-button">
            <EditIcon/>
          </button>
        ): <></>
      }
      <button onClick={copyToClipboard} className="chat-message-button">
        {isCopied ? <CheckIcon /> : <CopyClipboardIcon />}
      </button>
    </div>
  );
};

export default ChatSingleMessage;
