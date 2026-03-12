/**
 * Backend API Interface
 *
 * This is the **single** interface that all renderer code programs against.
 * In Electron mode the implementation delegates to `window.electronAPI` (IPC).
 * In Web/Cloud mode the implementation talks to the Express REST server.
 *
 * Every component/hook uses `useBackend()` to obtain an instance — never
 * `window.electronAPI` directly.
 */

import type { FolderResult, FileResult, SaveResult, TreeEntry, TextSearchResult, TextSearchOptions } from '../types/file.types';
import type { GitChange, GitFileChange, DiffResult, GitBranchInfo, GitOpResult } from '../types/git.types';
import type { NpmProject } from '../types/npm.types';
import type { AISettings, ChatMessage, AIChatResult } from '../types/ai.types';
import type { Conversation, WorkspaceHistory, AppHistory } from '../types/history.types';
import type { PromptSettings } from '../types/prompts.types';
import type {
  SupabaseConfig,
  SupabaseUsersResult,
  SupabaseStorageResult,
  SupabaseTablesResult,
  SqlQueryResult,
} from '../types/supabase.types';
import type {
  AtlassianConnection,
  AtlassianProjectsResult,
  AtlassianIssuesResult,
  AtlassianConnectionResult,
} from '../types/atlassian.types';
import type {
  GitHubRepoInfo,
  GitHubWorkflowsResult,
  GitHubRunsResult,
  GitHubJobsResult,
  GitHubLogsResult,
  GitHubIssuesResult,
  GitHubIssueFilterState,
} from '../types/github.types';
import type {
  McpServerConfig,
  McpServersResult,
  McpToolCallResult,
} from '../types/mcp.types';
import type {
  GhCliStatus,
  GhCopilotChatResult,
} from '../types/ghCli.types';
import type {
  CliProviderId,
  CliProviderStatus,
  CliChatResult,
} from '../types/cliProvider.types';
import type {
  SessionFolderResult,
  GitCloneResult,
  SessionFolderInfo,
} from '../types/session.types';

// ─── Runtime mode ───────────────────────────────────────────────────────────

export type BackendMode = 'electron' | 'web';

// ─── Event subscription helpers ─────────────────────────────────────────────

/** A function that unsubscribes the listener when called. */
export type Unsubscribe = () => void;

// ─── BackendAPI ─────────────────────────────────────────────────────────────

export interface BackendAPI {
  /** Which transport is active. */
  readonly mode: BackendMode;

  // ── Window management ──
  newWindow(): Promise<boolean>;
  selectFolder(): Promise<FolderResult | null>;
  openFolder(folderPath: string): Promise<FolderResult | null>;

  // ── File system ──
  readFile(filePath: string): Promise<FileResult>;
  saveFile(filePath: string, content: string): Promise<SaveResult>;
  createFile(filePath: string, content?: string): Promise<SaveResult>;
  createFolder(folderPath: string): Promise<SaveResult>;
  deleteFileOrFolder(targetPath: string): Promise<SaveResult>;
  renameFileOrFolder(oldPath: string, newPath: string): Promise<SaveResult>;
  refreshTree(folderPath: string): Promise<TreeEntry[]>;
  searchText(folderPath: string, query: string, options?: TextSearchOptions): Promise<TextSearchResult>;

  // ── Git ──
  gitStatus(folderPath: string): Promise<GitChange[]>;
  gitStatusSplit(folderPath: string): Promise<GitFileChange[]>;
  gitDiff(folderPath: string, filePath: string): Promise<DiffResult>;
  gitStage(folderPath: string, filePath: string): Promise<SaveResult>;
  gitUnstage(folderPath: string, filePath: string): Promise<SaveResult>;
  gitStageAll(folderPath: string): Promise<SaveResult>;
  gitUnstageAll(folderPath: string): Promise<SaveResult>;
  gitDiscard(folderPath: string, filePath: string): Promise<SaveResult>;
  gitCommit(folderPath: string, message: string): Promise<SaveResult>;
  gitBranchInfo(folderPath: string): Promise<GitBranchInfo>;
  gitListBranches(folderPath: string): Promise<string[]>;
  gitCheckout(folderPath: string, branch: string): Promise<SaveResult>;
  gitCreateBranch(folderPath: string, branch: string): Promise<SaveResult>;
  gitPull(folderPath: string): Promise<GitOpResult>;
  gitPush(folderPath: string): Promise<GitOpResult>;

  // ── NPM ──
  getAllNpmProjects(folderPath: string, gitIgnoredPaths: string[]): Promise<NpmProject[]>;

  // ── AI ──
  aiCheckOllama(): Promise<boolean>;
  aiListModels(baseUrl: string, apiKey: string): Promise<string[]>;
  aiChat(baseUrl: string, apiKey: string, model: string, messages: ChatMessage[]): Promise<AIChatResult>;
  aiChatStream(baseUrl: string, apiKey: string, model: string, messages: ChatMessage[]): Promise<AIChatResult>;
  onAiChatChunk(cb: (chunk: string) => void): Unsubscribe;
  onAiChatChunkDone(cb: () => void): Unsubscribe;
  aiChatAbort(): Promise<{ success: boolean }>;
  aiLoadSettings(): Promise<AISettings>;
  aiSaveSettings(settings: AISettings): Promise<{ success: boolean }>;
  aiGetEnvKeys(): Promise<Record<string, { apiKey: string; baseUrl: string }>>;

  // ── Prompt settings ──
  promptsLoad(): Promise<PromptSettings>;
  promptsSave(prompts: PromptSettings): Promise<{ success: boolean }>;
  promptsReset(): Promise<PromptSettings>;

  // ── Debug ──
  debugOpen(): Promise<{ success: boolean }>;
  debugClear(): Promise<{ success: boolean }>;

  // ── Terminal ──
  terminalCreate(cwd: string): Promise<{ id: string; shell: string }>;
  terminalInput(id: string, data: string): void;
  terminalResize(id: string, cols: number, rows: number): void;
  terminalKill(id: string): Promise<void>;
  onTerminalData(cb: (id: string, data: string) => void): Unsubscribe;
  onTerminalExit(cb: (id: string) => void): Unsubscribe;

  // ── Menu / window events (Electron-only, stubs in web mode) ──
  onToggleTerminal(cb: () => void): Unsubscribe;
  onOpenPrompts(cb: () => void): Unsubscribe;
  onOpenDebug(cb: () => void): Unsubscribe;
  onOpenAgents(cb: () => void): Unsubscribe;

  // ── Chat history ──
  historyLoad(): Promise<AppHistory>;
  historyGetRecentWorkspaces(limit?: number): Promise<WorkspaceHistory[]>;
  historyOpenWorkspace(folderPath: string): Promise<WorkspaceHistory>;
  historyRemoveWorkspace(folderPath: string): Promise<{ success: boolean }>;
  historyCreateConversation(folderPath: string, mode: string): Promise<Conversation>;
  historyGetConversation(folderPath: string, conversationId: string): Promise<Conversation | null>;
  historyGetActiveConversation(folderPath: string): Promise<Conversation | null>;
  historyUpdateConversation(
    folderPath: string,
    conversationId: string,
    messages: ChatMessage[],
    mode?: string,
  ): Promise<Conversation | null>;
  historyDeleteConversation(folderPath: string, conversationId: string): Promise<{ success: boolean; error?: string }>;
  historySetActiveConversation(folderPath: string, conversationId: string): Promise<{ success: boolean; error?: string }>;
  historyRenameConversation(
    folderPath: string,
    conversationId: string,
    newTitle: string,
  ): Promise<{ success: boolean; error?: string }>;
  historyGetWorkspace(folderPath: string): Promise<WorkspaceHistory | null>;

  // ── Supabase ──
  detectSupabase(folderPath: string): Promise<SupabaseConfig>;
  supabaseGetUsers(projectUrl: string, serviceRoleKey: string): Promise<SupabaseUsersResult>;
  supabaseGetStorage(projectUrl: string, serviceRoleKey: string): Promise<SupabaseStorageResult>;
  supabaseGetTables(projectUrl: string, serviceRoleKey: string): Promise<SupabaseTablesResult>;
  supabaseExecuteQuery(projectUrl: string, serviceRoleKey: string, query: string): Promise<SqlQueryResult>;

  // ── GitHub ──
  githubExtractRepoInfo(remoteUrl: string): Promise<GitHubRepoInfo | null>;
  githubListWorkflows(owner: string, repo: string): Promise<GitHubWorkflowsResult>;
  githubListWorkflowRuns(owner: string, repo: string, workflowId?: number, perPage?: number): Promise<GitHubRunsResult>;
  githubListRunJobs(owner: string, repo: string, runId: number): Promise<GitHubJobsResult>;
  githubGetRunLogs(owner: string, repo: string, runId: number): Promise<GitHubLogsResult>;
  githubGetJobLogs(owner: string, repo: string, jobId: number): Promise<GitHubLogsResult>;
  githubRerunWorkflow(owner: string, repo: string, runId: number): Promise<{ success: boolean; error?: string }>;
  githubListIssues(owner: string, repo: string, state?: GitHubIssueFilterState, perPage?: number): Promise<GitHubIssuesResult>;

  // ── Atlassian / Jira ──
  atlassianLoadConnections(): Promise<AtlassianConnection[]>;
  atlassianSaveConnections(connections: AtlassianConnection[]): Promise<{ success: boolean }>;
  atlassianTestConnection(connection: AtlassianConnection): Promise<AtlassianConnectionResult>;
  atlassianFetchProjects(connection: AtlassianConnection): Promise<AtlassianProjectsResult>;
  atlassianFetchIssues(
    connection: AtlassianConnection,
    projectKey: string,
    maxResults?: number,
  ): Promise<AtlassianIssuesResult>;

  // ── Shell ──
  shellOpenExternal(url: string): Promise<void>;

  // ── MCP Servers ──
  mcpLoadServers(): Promise<McpServersResult>;
  mcpSaveServers(servers: McpServerConfig[]): Promise<{ success: boolean }>;
  mcpInstallServer(config: McpServerConfig): Promise<{ success: boolean; error?: string; server: McpServerConfig }>;
  mcpUninstallServer(serverId: string): Promise<{ success: boolean; error?: string }>;
  mcpConnectServer(serverId: string): Promise<{ success: boolean; error?: string; server?: McpServerConfig }>;
  mcpDisconnectServer(serverId: string): Promise<{ success: boolean; error?: string }>;
  mcpCallTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<{ success: boolean; error?: string; result?: McpToolCallResult }>;
  mcpReadResource(serverId: string, uri: string): Promise<{ success: boolean; error?: string; result?: any }>;

  // ── GitHub Copilot CLI (legacy — use CLI Provider API below) ──
  ghCliDetect(): Promise<GhCliStatus>;
  ghCliInstallCopilot(): Promise<{ success: boolean; error?: string }>;
  ghCopilotChat(prompt: string, model?: string): Promise<GhCopilotChatResult>;
  ghCopilotChatStream(prompt: string, model?: string): Promise<{ success: boolean; error?: string }>;
  onGhCopilotChatChunk(cb: (chunk: string) => void): Unsubscribe;
  onGhCopilotChatChunkDone(cb: () => void): Unsubscribe;
  ghCopilotChatAbort(): Promise<{ success: boolean }>;

  // ── CLI Providers (generic) ──
  cliProviderDetectAll(): Promise<CliProviderStatus[]>;
  cliProviderDetect(providerId: CliProviderId): Promise<CliProviderStatus>;
  cliProviderChat(providerId: CliProviderId, prompt: string, model?: string): Promise<CliChatResult>;
  cliProviderChatStream(providerId: CliProviderId, prompt: string, model?: string): Promise<{ success: boolean; error?: string }>;
  onCliProviderChatChunk(cb: (chunk: string) => void): Unsubscribe;
  onCliProviderChatChunkDone(cb: () => void): Unsubscribe;
  cliProviderChatAbort(): Promise<{ success: boolean }>;

  // ── Agent Configs ──
  agentLoadConfigs(): Promise<unknown[]>;
  agentSaveConfig(config: unknown): Promise<{ success: boolean }>;
  agentDeleteConfig(agentId: string): Promise<{ success: boolean }>;

  // ── Session Folder Management (for web/Docker mode) ──
  sessionCreateFolder(title?: string): Promise<SessionFolderResult>;
  sessionCloneGitHub(repoUrl: string, token?: string): Promise<GitCloneResult>;
  sessionListFolders(): Promise<SessionFolderInfo[]>;
  sessionDeleteFolder(folderPath: string): Promise<{ success: boolean; error?: string }>;

  // ── Connectors ──
  connectorList(): Promise<Array<{ id: string; name: string; description: string; icon: string; category: string; version: string }>>;
  connectorGet(connectorId: string): Promise<{
    metadata: { id: string; name: string; description: string; icon: string; category: string; version: string };
    configFields: Array<{ key: string; label: string; type: string; placeholder?: string; required: boolean; helpText?: string }>;
    actions: Array<{ id: string; name: string; description: string; inputSchema?: Record<string, unknown> }>;
    state: { status: string; error?: string; lastConnected?: string };
  } | null>;
  connectorGetState(connectorId: string): Promise<{ status: string; error?: string; lastConnected?: string }>;
  connectorTest(connectorId: string, config: Record<string, unknown>): Promise<{ success: boolean; error?: string }>;
  connectorSaveConfig(connectorId: string, config: Record<string, unknown>): Promise<{ success: boolean }>;
  connectorLoadConfig(connectorId: string): Promise<Record<string, unknown> | null>;
  connectorExecute(connectorId: string, actionId: string, params?: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }>;

  // ── Orchestrator — Agent Profiles & Workflows ──
  orchestratorListProfiles(): Promise<unknown[]>;
  orchestratorSaveProfile(profile: unknown): Promise<{ success: boolean }>;
  orchestratorDeleteProfile(profileId: string): Promise<{ success: boolean; error?: string }>;
  orchestratorListWorkflows(): Promise<unknown[]>;
  orchestratorGetWorkflow(workflowId: string): Promise<unknown | null>;
  orchestratorSaveWorkflow(workflow: unknown): Promise<{ success: boolean }>;
  orchestratorDeleteWorkflow(workflowId: string): Promise<{ success: boolean; error?: string }>;

  // ── Execution Runs & Event Bus ──
  orchestratorListRuns(): Promise<unknown[]>;
  orchestratorGetRun(runId: string): Promise<unknown | null>;
  orchestratorGetRunEvents(correlationId: string): Promise<unknown[]>;
  orchestratorGetEventHistory(filter?: Record<string, string>): Promise<unknown[]>;
  onOrchestratorEvent(cb: (event: unknown) => void): Unsubscribe;

  // ── Visual Workflow Editor ──
  orchestratorSaveEditorWorkflow(data: unknown): Promise<{ success: boolean }>;
  orchestratorListEditorWorkflows(): Promise<unknown[]>;
  orchestratorDeleteEditorWorkflow(workflowId: string): Promise<{ success: boolean }>;

  // ── Workflow Execution ──
  orchestratorExecuteWorkflow(workflowData: { id: string; name: string; nodes: unknown[]; edges: unknown[]; triggerInput?: unknown }): Promise<{ success: boolean; run?: unknown }>;
  orchestratorSaveRun(run: unknown): Promise<{ success: boolean }>;
}
