import { App } from 'obsidian';
import * as React from 'react';
import { ChatSharedContextProps } from '@/chatContext';

// App context
export const AppContext = React.createContext<App | undefined>(undefined);

export const ChatSharedContext = React.createContext<
  ChatSharedContextProps | undefined
>(undefined);
