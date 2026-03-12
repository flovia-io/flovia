/**
 * Chat History types
 */

import type { ChatMessage } from './ai.types';

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  mode: 'Agent' | 'Chat' | 'Edit';
}

export interface WorkspaceHistory {
  folderPath: string;
  folderName: string;
  lastOpened: string;
  conversations: Conversation[];
  activeConversationId: string | null;
}

export interface AppHistory {
  version: number;
  workspaces: WorkspaceHistory[];
  lastWorkspacePath: string | null;
}
