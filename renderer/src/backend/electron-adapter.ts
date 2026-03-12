/**
 * Electron Backend Adapter
 *
 * Wraps `window.electronAPI` (Electron IPC preload bridge) so the
 * renderer code only ever depends on the `BackendAPI` interface.
 *
 * This is effectively a one-liner delegation layer — every method
 * just calls through to the preload bridge.
 */

import type { BackendAPI, Unsubscribe } from './types';

export function createElectronAdapter(): BackendAPI {
  const api = window.electronAPI;

  return {
    mode: 'electron',

    // ── Window management ──
    newWindow: () => api.newWindow(),
    selectFolder: () => api.selectFolder(),
    openFolder: (p) => api.openFolder(p),

    // ── File system ──
    readFile: (p) => api.readFile(p),
    saveFile: (p, c) => api.saveFile(p, c),
    createFile: (p, c) => api.createFile(p, c),
    createFolder: (p) => api.createFolder(p),
    deleteFileOrFolder: (p) => api.deleteFileOrFolder(p),
    renameFileOrFolder: (o, n) => api.renameFileOrFolder(o, n),
    refreshTree: (p) => api.refreshTree(p),
    searchText: (p, q, o) => api.searchText(p, q, o),

    // ── Git ──
    gitStatus: (f) => api.gitStatus(f),
    gitStatusSplit: (f) => api.gitStatusSplit(f),
    gitDiff: (f, p) => api.gitDiff(f, p),
    gitStage: (f, p) => api.gitStage(f, p),
    gitUnstage: (f, p) => api.gitUnstage(f, p),
    gitStageAll: (f) => api.gitStageAll(f),
    gitUnstageAll: (f) => api.gitUnstageAll(f),
    gitDiscard: (f, p) => api.gitDiscard(f, p),
    gitCommit: (f, m) => api.gitCommit(f, m),
    gitBranchInfo: (f) => api.gitBranchInfo(f),
    gitListBranches: (f) => api.gitListBranches(f),
    gitCheckout: (f, b) => api.gitCheckout(f, b),
    gitCreateBranch: (f, b) => api.gitCreateBranch(f, b),
    gitPull: (f) => api.gitPull(f),
    gitPush: (f) => api.gitPush(f),

    // ── NPM ──
    getAllNpmProjects: (f, g) => api.getAllNpmProjects(f, g),

    // ── AI ──
    aiCheckOllama: () => api.aiCheckOllama(),
    aiListModels: (b, k) => api.aiListModels(b, k),
    aiChat: (b, k, m, msgs) => api.aiChat(b, k, m, msgs),
    aiChatStream: (b, k, m, msgs) => api.aiChatStream(b, k, m, msgs),
    onAiChatChunk: (cb) => api.onAiChatChunk(cb),
    onAiChatChunkDone: (cb) => api.onAiChatChunkDone(cb),
    aiChatAbort: () => api.aiChatAbort(),
    aiLoadSettings: () => api.aiLoadSettings(),
    aiSaveSettings: (s) => api.aiSaveSettings(s),
    aiGetEnvKeys: () => api.aiGetEnvKeys(),

    // ── Prompt settings ──
    promptsLoad: () => api.promptsLoad(),
    promptsSave: (p) => api.promptsSave(p),
    promptsReset: () => api.promptsReset(),

    // ── Debug ──
    debugOpen: () => api.debugOpen(),
    debugClear: () => api.debugClear(),

    // ── Terminal ──
    terminalCreate: (cwd) => api.terminalCreate(cwd),
    terminalInput: (id, data) => api.terminalInput(id, data),
    terminalResize: (id, c, r) => api.terminalResize(id, c, r),
    terminalKill: (id) => api.terminalKill(id),
    onTerminalData: (cb) => api.onTerminalData(cb),
    onTerminalExit: (cb) => api.onTerminalExit(cb),

    // ── Menu / window events ──
    onToggleTerminal: (cb) => api.onToggleTerminal(cb),
    onOpenPrompts: (cb) => api.onOpenPrompts(cb),
    onOpenDebug: (cb) => api.onOpenDebug(cb),
    onOpenAgents: (cb) => api.onOpenAgents(cb),

    // ── Chat history ──
    historyLoad: () => api.historyLoad(),
    historyGetRecentWorkspaces: (l) => api.historyGetRecentWorkspaces(l),
    historyOpenWorkspace: (f) => api.historyOpenWorkspace(f),
    historyRemoveWorkspace: (f) => api.historyRemoveWorkspace(f),
    historyCreateConversation: (f, m) => api.historyCreateConversation(f, m),
    historyGetConversation: (f, c) => api.historyGetConversation(f, c),
    historyGetActiveConversation: (f) => api.historyGetActiveConversation(f),
    historyUpdateConversation: (f, c, m, mode) => api.historyUpdateConversation(f, c, m, mode),
    historyDeleteConversation: (f, c) => api.historyDeleteConversation(f, c),
    historySetActiveConversation: (f, c) => api.historySetActiveConversation(f, c),
    historyRenameConversation: (f, c, t) => api.historyRenameConversation(f, c, t),
    historyGetWorkspace: (f) => api.historyGetWorkspace(f),

    // ── Supabase ──
    detectSupabase: (f) => api.detectSupabase(f),
    supabaseGetUsers: (u, k) => api.supabaseGetUsers(u, k),
    supabaseGetStorage: (u, k) => api.supabaseGetStorage(u, k),
    supabaseGetTables: (u, k) => api.supabaseGetTables(u, k),
    supabaseExecuteQuery: (u, k, q) => api.supabaseExecuteQuery(u, k, q),

    // ── GitHub ──
    githubExtractRepoInfo: (r) => api.githubExtractRepoInfo(r),
    githubListWorkflows: (o, r) => api.githubListWorkflows(o, r),
    githubListWorkflowRuns: (o, r, w, p) => api.githubListWorkflowRuns(o, r, w, p),
    githubListRunJobs: (o, r, id) => api.githubListRunJobs(o, r, id),
    githubGetRunLogs: (o, r, id) => api.githubGetRunLogs(o, r, id),
    githubGetJobLogs: (o, r, id) => api.githubGetJobLogs(o, r, id),
    githubRerunWorkflow: (o, r, id) => api.githubRerunWorkflow(o, r, id),
    githubListIssues: (o, r, s, p) => api.githubListIssues(o, r, s, p),

    // ── Atlassian / Jira ──
    atlassianLoadConnections: () => api.atlassianLoadConnections(),
    atlassianSaveConnections: (c) => api.atlassianSaveConnections(c),
    atlassianTestConnection: (c) => api.atlassianTestConnection(c),
    atlassianFetchProjects: (c) => api.atlassianFetchProjects(c),
    atlassianFetchIssues: (c, p, m) => api.atlassianFetchIssues(c, p, m),

    // ── Shell ──
    shellOpenExternal: (u) => api.shellOpenExternal(u),

    // ── MCP Servers ──
    mcpLoadServers: () => api.mcpLoadServers(),
    mcpSaveServers: (s) => api.mcpSaveServers(s),
    mcpInstallServer: (c) => api.mcpInstallServer(c),
    mcpUninstallServer: (id) => api.mcpUninstallServer(id),
    mcpConnectServer: (id) => api.mcpConnectServer(id),
    mcpDisconnectServer: (id) => api.mcpDisconnectServer(id),
    mcpCallTool: (id, t, a) => api.mcpCallTool(id, t, a),
    mcpReadResource: (id, u) => api.mcpReadResource(id, u),

    // ── GitHub Copilot CLI (legacy) ──
    ghCliDetect: () => api.ghCliDetect(),
    ghCliInstallCopilot: () => api.ghCliInstallCopilot(),
    ghCopilotChat: (p, m) => api.ghCopilotChat(p, m),
    ghCopilotChatStream: (p, m) => api.ghCopilotChatStream(p, m),
    onGhCopilotChatChunk: (cb) => api.onGhCopilotChatChunk(cb),
    onGhCopilotChatChunkDone: (cb) => api.onGhCopilotChatChunkDone(cb),
    ghCopilotChatAbort: () => api.ghCopilotChatAbort(),

    // ── CLI Providers (generic) ──
    cliProviderDetectAll: () => api.cliProviderDetectAll(),
    cliProviderDetect: (id) => api.cliProviderDetect(id),
    cliProviderChat: (id, p, m) => api.cliProviderChat(id, p, m),
    cliProviderChatStream: (id, p, m) => api.cliProviderChatStream(id, p, m),
    onCliProviderChatChunk: (cb) => api.onCliProviderChatChunk(cb),
    onCliProviderChatChunkDone: (cb) => api.onCliProviderChatChunkDone(cb),
    cliProviderChatAbort: () => api.cliProviderChatAbort(),

    // ── Agent Configs ──
    agentLoadConfigs: () => api.agentLoadConfigs(),
    agentSaveConfig: (c) => api.agentSaveConfig(c),
    agentDeleteConfig: (id) => api.agentDeleteConfig(id),

    // ── Session Folder Management ──
    sessionCreateFolder: (t) => api.sessionCreateFolder(t),
    sessionCloneGitHub: (u, t) => api.sessionCloneGitHub(u, t),
    sessionListFolders: () => api.sessionListFolders(),
    sessionDeleteFolder: (p) => api.sessionDeleteFolder(p),

    // ── Connectors ──
    connectorList: () => api.connectorList(),
    connectorGet: (id) => api.connectorGet(id),
    connectorGetState: (id) => api.connectorGetState(id),
    connectorTest: (id, config) => api.connectorTest(id, config),
    connectorSaveConfig: (id, config) => api.connectorSaveConfig(id, config),
    connectorLoadConfig: (id) => api.connectorLoadConfig(id),
    connectorExecute: (id, actionId, params) => api.connectorExecute(id, actionId, params),

    // ── Orchestrator ──
    orchestratorListProfiles: () => api.orchestratorListProfiles(),
    orchestratorSaveProfile: (p) => api.orchestratorSaveProfile(p),
    orchestratorDeleteProfile: (id) => api.orchestratorDeleteProfile(id),
    orchestratorListWorkflows: () => api.orchestratorListWorkflows(),
    orchestratorGetWorkflow: (id) => api.orchestratorGetWorkflow(id),
    orchestratorSaveWorkflow: (w) => api.orchestratorSaveWorkflow(w),
    orchestratorDeleteWorkflow: (id) => api.orchestratorDeleteWorkflow(id),

    // ── Execution Runs & Event Bus ──
    orchestratorListRuns: () => api.orchestratorListRuns(),
    orchestratorGetRun: (id) => api.orchestratorGetRun(id),
    orchestratorGetRunEvents: (id) => api.orchestratorGetRunEvents(id),
    orchestratorGetEventHistory: (f) => api.orchestratorGetEventHistory(f),
    onOrchestratorEvent: (cb) => api.onOrchestratorEvent(cb),

    // ── Visual Workflow Editor ──
    orchestratorSaveEditorWorkflow: (d) => api.orchestratorSaveEditorWorkflow(d),
    orchestratorListEditorWorkflows: () => api.orchestratorListEditorWorkflows(),
    orchestratorDeleteEditorWorkflow: (id) => api.orchestratorDeleteEditorWorkflow(id),

    // ── Workflow Execution ──
    orchestratorExecuteWorkflow: (data) => api.orchestratorExecuteWorkflow(data),
    orchestratorSaveRun: (run) => api.orchestratorSaveRun(run),
  };
}
