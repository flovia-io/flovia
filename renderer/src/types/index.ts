/**
 * Central type exports
 * Re-exports all types from domain-specific files for backward compatibility
 */

// File types
export type {
  TreeEntry,
  FolderResult,
  FileResult,
  SaveResult,
  Tab,
} from './file.types';

// Git types
export type {
  GitChange,
  GitFileChange,
  DiffResult,
  GitBranchInfo,
  GitOpResult,
} from './git.types';

// NPM types
export type { NpmProject } from './npm.types';

// AI and Chat types
export type {
  AISettings,
  ChatMessage,
  AIChatResult,
  FileActionPlan,
  FileActionStatus,
  FileActionProgress,
  DisplayMessage,
} from './ai.types';

// History types
export type {
  Conversation,
  WorkspaceHistory,
  AppHistory,
} from './history.types';

// Prompt types
export type { PromptSettings } from './prompts.types';
export { DEFAULT_PROMPTS } from './prompts.types';

// Supabase types
export type { SupabaseConfig } from './supabase.types';

// GitHub types
export type { 
  GitHubRepoInfo,
  GitHubWorkflow,
  GitHubWorkflowRun,
  GitHubJob,
  GitHubStep,
  GitHubWorkflowsResult,
  GitHubRunsResult,
  GitHubJobsResult,
  GitHubLogsResult,
} from './github.types';

// UI types
export type { SidePanel, ChatMode } from './ui.types';
export { isCliMode, getCliProviderId } from './ui.types';

// MCP types
export type {
  McpServerConfig,
  McpServerStatus,
  McpTool,
  McpResource,
  McpToolCallResult,
  McpRegistryEntry,
  McpServersResult,
} from './mcp.types';

// Electron API types
export type { ElectronAPI } from './electron.types';

// GitHub CLI types
export type { GhCliStatus, GhCopilotChatResult } from './ghCli.types';

// CLI Provider types (generic)
export type { CliProviderId, CliProviderMeta, CliProviderStatus, CliChatResult } from './cliProvider.types';
export { CLI_PROVIDERS } from './cliProvider.types';

// Agent types
export type {
  PhaseCategory,
  AgentTool,
  AgentNode,
  AgentEdge,
  AgentConfig,
  TraceStepStatus,
  TraceStep,
  AgentTrace,
} from './agent.types';
export { ALL_AGENT_TOOLS, CORE_AGENT_TOOLS, connectorActionsToAgentTools, buildAllAgentTools } from './agent.types';
export type { ConnectorToolSource } from './agent.types';

// Session types
export type {
  ActiveSession,
} from './session.types';
