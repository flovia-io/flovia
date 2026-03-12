/**
 * Central type exports
 * Re-exports all types from the types/ directory for backward compatibility
 * 
 * For new code, prefer importing directly from types/:
 * import type { ChatMessage } from './types/ai.types';
 */

// File types
export type {
  TreeEntry,
  FolderResult,
  FileResult,
  SaveResult,
  Tab,
  TextSearchMatch,
  TextSearchResult,
  TextSearchOptions,
} from './types/file.types';

// Git types
export type {
  GitChange,
  GitFileChange,
  DiffResult,
  GitBranchInfo,
  GitOpResult,
} from './types/git.types';

// NPM types
export type { NpmProject } from './types/npm.types';

// AI and Chat types
export type {
  AISettings,
  ChatMessage,
  AIChatResult,
  FileActionPlan,
  FileActionStatus,
  FileActionProgress,
  DisplayMessage,
} from './types/ai.types';

// History types
export type {
  Conversation,
  WorkspaceHistory,
  AppHistory,
} from './types/history.types';

// Prompt types
export type { PromptSettings } from './types/prompts.types';
export { DEFAULT_PROMPTS } from './types/prompts.types';

// Supabase types
export type { SupabaseConfig } from './types/supabase.types';

// UI types
export type { SidePanel, ChatMode } from './types/ui.types';

// Atlassian types
export type {
  AtlassianConnection,
  AtlassianProject,
  AtlassianIssue,
  AtlassianProjectsResult,
  AtlassianIssuesResult,
  AtlassianConnectionResult,
} from './types/atlassian.types';

// Electron API types
export type { ElectronAPI } from './types/electron.types';

// GitHub CLI types
export type { GhCliStatus, GhCopilotChatResult } from './types/ghCli.types';

// Session types
export type { ActiveSession } from './types/session.types';
