/**
 * Active Session types
 * 
 * Tracks running AI sessions that persist across workspace switches
 * and new chat creation. Sessions remain "active" while the AI is
 * processing (research, file changes, streaming, etc.).
 */

export interface ActiveSession {
  /** Unique session ID (matches conversation ID) */
  id: string;
  /** Workspace folder path */
  folderPath: string;
  /** Workspace display name */
  folderName: string;
  /** Conversation ID this session belongs to */
  conversationId: string;
  /** Conversation title */
  title: string;
  /** Current status */
  status: 'researching' | 'planning' | 'executing' | 'streaming' | 'idle';
  /** Human-readable status message */
  statusText: string;
  /** When the session started */
  startedAt: string;
  /** Chat mode */
  mode: 'Agent' | 'Chat' | 'Edit';
}

/**
 * Session folder types (for web/Docker mode)
 * Manages temporary session folders for chat without workspace
 * and GitHub clone operations.
 */

export interface SessionFolderResult {
  success: boolean;
  folderPath?: string;
  folderName?: string;
  error?: string;
}

export interface GitCloneResult {
  success: boolean;
  folderPath?: string;
  folderName?: string;
  error?: string;
}

export interface SessionFolderInfo {
  folderPath: string;
  folderName: string;
  createdAt: string;
}
