/**
 * AI and Chat related types
 */

export interface AISettings {
  provider: 'ollama' | 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Original display text (for user messages, this is the text without embedded file context) */
  displayText?: string;
}

export interface AIChatResult {
  success: boolean;
  reply?: string;
  error?: string;
}

/** A single planned file action from the check agent */
export interface FileActionPlan {
  file: string;          // relative path
  action: 'create' | 'update' | 'delete';
  description: string;   // what changes to make
}

/** Progress state for a file action */
export type FileActionStatus = 'pending' | 'reading' | 'updating' | 'done' | 'error';

export interface FileActionProgress {
  plan: FileActionPlan;
  status: FileActionStatus;
  diff?: { before: string; after: string };
  error?: string;
}

/** A message displayed in the chat UI */
export interface DisplayMessage {
  text: string;
  sender: 'user' | 'bot' | 'system';
  files?: Array<{ name: string; path: string; content?: string }>;
  isResearchStatus?: boolean;
  isAgentProgress?: boolean;
  agentActions?: FileActionProgress[];
  verifyAttempt?: number;
  /** True when this message is part of a CLI provider session */
  isCliProvider?: boolean;
  /** @deprecated Use isCliProvider instead */
  isCopilotCli?: boolean;
  badge?: string;
}
