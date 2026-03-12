/**
 * HTTP / Web Backend Adapter
 *
 * Implements `BackendAPI` by talking to the Express REST server (`server/index.ts`)
 * over HTTP + WebSocket. This is used when the React UI is served as a regular
 * web app (cloud / enterprise mode) — no Electron required.
 *
 * For streaming (AI chat chunks, terminal I/O) it uses a WebSocket connection.
 */

import type { BackendAPI, Unsubscribe, BackendMode } from './types';

// ─── helpers ────────────────────────────────────────────────────────────────

function baseUrl(): string {
  // Allow override via env var injected at build time
  if ((import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL;
  }
  // In production (served by Express), use same origin.
  // In dev mode (Vite), use '' so that the Vite proxy handles /api → server.
  return '';
}

function wsUrl(): string {
  if ((import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL.replace(/^http/, 'ws') + '/ws';
  }
  // In both dev (Vite proxy) and production, use the page's origin
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── WebSocket event bus (for streaming) ────────────────────────────────────

type WsListener = (...args: any[]) => void;

class WsEventBus {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<WsListener>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.ws = new WebSocket(wsUrl());

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const handlers = this.listeners.get(msg.event);
        if (handlers) handlers.forEach((h) => h(...(msg.args ?? [])));
      } catch {
        /* ignore non-JSON frames */
      }
    };

    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };
  }

  on(event: string, fn: WsListener): Unsubscribe {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    this.connect(); // lazy connect
    return () => {
      this.listeners.get(event)?.delete(fn);
    };
  }

  send(event: string, ...args: any[]) {
    this.connect();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, args }));
    }
  }

  destroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

// ─── noop helper for features unsupported in web mode ───────────────────────

const noop: Unsubscribe = () => {};

// ─── Adapter factory ────────────────────────────────────────────────────────

export function createHttpAdapter(): BackendAPI {
  const ws = new WsEventBus();

  return {
    mode: 'web' as BackendMode,

    // ── Window management ──
    // In web mode, "new window" just opens a new tab
    newWindow: async () => { window.open(window.location.href, '_blank'); return true; },
    // In web mode, there's no native OS dialog – prompt the user for a path
    // then use openFolder to resolve it on the server.
    selectFolder: async () => {
      const folderPath = window.prompt('Enter the absolute path to your project folder:');
      if (!folderPath || !folderPath.trim()) return null;
      return post('/api/fs/open-folder', { folderPath: folderPath.trim() });
    },
    openFolder: (p) => post('/api/fs/open-folder', { folderPath: p }),

    // ── File system ──
    readFile: (p) => post('/api/fs/read-file', { filePath: p }),
    saveFile: (p, c) => post('/api/fs/save-file', { filePath: p, content: c }),
    createFile: (p, c) => post('/api/fs/create-file', { filePath: p, content: c }),
    createFolder: (p) => post('/api/fs/create-folder', { folderPath: p }),
    deleteFileOrFolder: (p) => post('/api/fs/delete', { targetPath: p }),
    renameFileOrFolder: (o, n) => post('/api/fs/rename', { oldPath: o, newPath: n }),
    refreshTree: (p) => post<any>('/api/fs/refresh-tree', { folderPath: p }).then((r) => r.tree ?? r),
    searchText: (p, q, o) => post('/api/fs/search-text', { folderPath: p, query: q, options: o }),

    // ── Git ──
    gitStatus: (f) => post('/api/git/status', { folderPath: f }),
    gitStatusSplit: (f) => post('/api/git/status-split', { folderPath: f }),
    gitDiff: (f, p) => post('/api/git/diff', { folderPath: f, filePath: p }),
    gitStage: (f, p) => post('/api/git/stage', { folderPath: f, filePath: p }),
    gitUnstage: (f, p) => post('/api/git/unstage', { folderPath: f, filePath: p }),
    gitStageAll: (f) => post('/api/git/stage-all', { folderPath: f }),
    gitUnstageAll: (f) => post('/api/git/unstage-all', { folderPath: f }),
    gitDiscard: (f, p) => post('/api/git/discard', { folderPath: f, filePath: p }),
    gitCommit: (f, m) => post('/api/git/commit', { folderPath: f, message: m }),
    gitBranchInfo: (f) => post('/api/git/branch-info', { folderPath: f }),
    gitListBranches: (f) => post('/api/git/list-branches', { folderPath: f }),
    gitCheckout: (f, b) => post('/api/git/checkout', { folderPath: f, branch: b }),
    gitCreateBranch: (f, b) => post('/api/git/create-branch', { folderPath: f, branch: b }),
    gitPull: (f) => post('/api/git/pull', { folderPath: f }),
    gitPush: (f) => post('/api/git/push', { folderPath: f }),

    // ── NPM ──
    getAllNpmProjects: (f, g) => post('/api/npm/projects', { folderPath: f, gitIgnoredPaths: g }),

    // ── AI ──
    aiCheckOllama: () => get('/api/ai/check-ollama'),
    aiListModels: (b, k) => post('/api/ai/list-models', { baseUrl: b, apiKey: k }),
    aiChat: (b, k, m, msgs) => post('/api/ai/chat', { baseUrl: b, apiKey: k, model: m, messages: msgs }),
    aiChatStream: (b, k, m, msgs) => {
      // Trigger streaming via WS, the response comes as chunks
      ws.send('ai-chat-stream', { baseUrl: b, apiKey: k, model: m, messages: msgs });
      // Return a promise that resolves when the stream is done
      return new Promise((resolve) => {
        const unsub = ws.on('ai-chat-chunk-done', () => {
          unsub();
          resolve({ success: true, reply: '' });
        });
      });
    },
    onAiChatChunk: (cb) => ws.on('ai-chat-chunk', cb),
    onAiChatChunkDone: (cb) => ws.on('ai-chat-chunk-done', cb),
    aiChatAbort: () => post('/api/ai/abort'),
    aiLoadSettings: () => get('/api/ai/settings'),
    aiSaveSettings: (s) => post('/api/ai/settings', s),
    aiGetEnvKeys: () => get('/api/ai/env-keys'),

    // ── Prompt settings ──
    promptsLoad: () => get('/api/prompts'),
    promptsSave: (p) => post('/api/prompts', p),
    promptsReset: () => post('/api/prompts/reset'),

    // ── Debug (no-op in web mode) ──
    debugOpen: async () => ({ success: false }),
    debugClear: async () => ({ success: false }),

    // ── Terminal (WebSocket-based in web mode) ──
    terminalCreate: (cwd) => post('/api/terminal/create', { cwd }),
    terminalInput: (id, data) => ws.send('terminal-input', id, data),
    terminalResize: (id, c, r) => ws.send('terminal-resize', id, c, r),
    terminalKill: (id) => post<void>('/api/terminal/kill', { id }),
    onTerminalData: (cb) => ws.on('terminal-data', (id: string, data: string) => cb(id, data)),
    onTerminalExit: (cb) => ws.on('terminal-exit', (id: string) => cb(id)),

    // ── Menu events (no native menu in web mode — stubs) ──
    onToggleTerminal: () => noop,
    onOpenPrompts: () => noop,
    onOpenDebug: () => noop,
    onOpenAgents: () => noop,

    // ── Chat history ──
    historyLoad: () => get('/api/history'),
    historyGetRecentWorkspaces: (l) => get(`/api/history/recent-workspaces${l ? `?limit=${l}` : ''}`),
    historyOpenWorkspace: (f) => post('/api/history/open-workspace', { folderPath: f }),
    historyRemoveWorkspace: (f) => post('/api/history/remove-workspace', { folderPath: f }),
    historyCreateConversation: (f, m) => post('/api/history/conversation/create', { folderPath: f, mode: m }),
    historyGetConversation: (f, c) => post('/api/history/conversation/get', { folderPath: f, conversationId: c }),
    historyGetActiveConversation: (f) => post('/api/history/conversation/active', { folderPath: f }),
    historyUpdateConversation: (f, c, m, mode) =>
      post('/api/history/conversation/update', { folderPath: f, conversationId: c, messages: m, mode }),
    historyDeleteConversation: (f, c) =>
      post('/api/history/conversation/delete', { folderPath: f, conversationId: c }),
    historySetActiveConversation: (f, c) =>
      post('/api/history/conversation/set-active', { folderPath: f, conversationId: c }),
    historyRenameConversation: (f, c, t) =>
      post('/api/history/conversation/rename', { folderPath: f, conversationId: c, newTitle: t }),
    historyGetWorkspace: (f) => post('/api/history/workspace', { folderPath: f }),

    // ── Supabase ──
    detectSupabase: (f) => post('/api/supabase/detect', { folderPath: f }),
    supabaseGetUsers: (u, k) => post('/api/supabase/users', { projectUrl: u, serviceRoleKey: k }),
    supabaseGetStorage: (u, k) => post('/api/supabase/storage', { projectUrl: u, serviceRoleKey: k }),
    supabaseGetTables: (u, k) => post('/api/supabase/tables', { projectUrl: u, serviceRoleKey: k }),
    supabaseExecuteQuery: (u, k, q) => post('/api/supabase/query', { projectUrl: u, serviceRoleKey: k, query: q }),

    // ── GitHub ──
    githubExtractRepoInfo: (r) => post('/api/github/extract-repo-info', { remoteUrl: r }),
    githubListWorkflows: (o, r) => get(`/api/github/${o}/${r}/workflows`),
    githubListWorkflowRuns: (o, r, w, p) => {
      const params = new URLSearchParams();
      if (w) params.set('workflowId', String(w));
      if (p) params.set('perPage', String(p));
      return get(`/api/github/${o}/${r}/runs?${params}`);
    },
    githubListRunJobs: (o, r, id) => get(`/api/github/${o}/${r}/runs/${id}/jobs`),
    githubGetRunLogs: (o, r, id) => get(`/api/github/${o}/${r}/runs/${id}/logs`),
    githubGetJobLogs: (o, r, id) => get(`/api/github/${o}/${r}/jobs/${id}/logs`),
    githubRerunWorkflow: (o, r, id) => post(`/api/github/${o}/${r}/runs/${id}/rerun`),
    githubListIssues: (o, r, s, p) => {
      const params = new URLSearchParams();
      if (s) params.set('state', s);
      if (p) params.set('perPage', String(p));
      return get(`/api/github/${o}/${r}/issues?${params}`);
    },

    // ── Atlassian / Jira ──
    atlassianLoadConnections: () => get('/api/atlassian/connections'),
    atlassianSaveConnections: (c) => post('/api/atlassian/connections', { connections: c }),
    atlassianTestConnection: (c) => post('/api/atlassian/test-connection', { connection: c }),
    atlassianFetchProjects: (c) => post('/api/atlassian/projects', { connection: c }),
    atlassianFetchIssues: (c, p, m) => post('/api/atlassian/issues', { connection: c, projectKey: p, maxResults: m }),

    // ── Shell ──
    shellOpenExternal: async (url) => { window.open(url, '_blank'); },

    // ── MCP Servers ──
    mcpLoadServers: () => get('/api/mcp/servers'),
    mcpSaveServers: (s) => post('/api/mcp/servers', { servers: s }),
    mcpInstallServer: (c) => post('/api/mcp/install', { config: c }),
    mcpUninstallServer: (id) => post('/api/mcp/uninstall', { serverId: id }),
    mcpConnectServer: (id) => post('/api/mcp/connect', { serverId: id }),
    mcpDisconnectServer: (id) => post('/api/mcp/disconnect', { serverId: id }),
    mcpCallTool: (id, t, a) => post('/api/mcp/call-tool', { serverId: id, toolName: t, args: a }),
    mcpReadResource: (id, u) => post('/api/mcp/read-resource', { serverId: id, uri: u }),

    // ── GitHub Copilot CLI (stubs — only works in Electron) ──
    ghCliDetect: async () => ({ installed: false, version: null, models: [], error: 'Not available in web mode' }),
    ghCliInstallCopilot: async () => ({ success: false, error: 'Not available in web mode' }),
    ghCopilotChat: async () => ({ success: false, response: '', error: 'Not available in web mode' }),
    ghCopilotChatStream: async () => ({ success: false, error: 'Not available in web mode' }),
    onGhCopilotChatChunk: () => () => {},
    onGhCopilotChatChunkDone: () => () => {},
    ghCopilotChatAbort: async () => ({ success: true }),

    // ── CLI Providers (stubs — only works in Electron) ──
    cliProviderDetectAll: async () => [],
    cliProviderDetect: async (providerId) => ({ providerId, installed: false, version: null, models: [], error: 'Not available in web mode' }),
    cliProviderChat: async () => ({ success: false, response: '', error: 'Not available in web mode' }),
    cliProviderChatStream: async () => ({ success: false, error: 'Not available in web mode' }),
    onCliProviderChatChunk: () => () => {},
    onCliProviderChatChunkDone: () => () => {},
    cliProviderChatAbort: async () => ({ success: true }),

    // ── Agent Configs ──
    agentLoadConfigs: () => get('/api/agents'),
    agentSaveConfig: (c) => post('/api/agents', c),
    agentDeleteConfig: (id) => post(`/api/agents/${id}/delete`),

    // ── Session Folder Management ──
    sessionCreateFolder: (t) => post('/api/session/create-folder', { title: t }),
    sessionCloneGitHub: (u, t) => post('/api/session/clone-github', { repoUrl: u, token: t }),
    sessionListFolders: () => get('/api/session/list-folders'),
    sessionDeleteFolder: (p) => post('/api/session/delete-folder', { folderPath: p }),

    // ── Connectors ──
    connectorList: async () => {
      const res = await get<{ connectors: any[] }>('/api/connectors');
      return res.connectors;
    },
    connectorGet: (id) => get(`/api/connectors/${id}`),
    connectorGetState: (id) => get(`/api/connectors/${id}/state`),
    connectorTest: (id, config) => post(`/api/connectors/${id}/test`, { config }),
    connectorSaveConfig: (id, config) => post(`/api/connectors/${id}/config`, { config }),
    connectorLoadConfig: (id) => get(`/api/connectors/${id}/config`),
    connectorExecute: (id, actionId, params) => post(`/api/connectors/${id}/actions/${actionId}`, { params }),

    // ── Orchestrator ──
    orchestratorListProfiles: () => get('/api/orchestrator/profiles'),
    orchestratorSaveProfile: (p) => post('/api/orchestrator/profiles', p),
    orchestratorDeleteProfile: async (id) => {
      const res = await fetch(`${baseUrl()}/api/orchestrator/profiles/${id}`, { method: 'DELETE' });
      return res.json();
    },
    orchestratorListWorkflows: () => get('/api/orchestrator/workflows'),
    orchestratorGetWorkflow: (id) => get(`/api/orchestrator/workflows/${id}`),
    orchestratorSaveWorkflow: (w) => post('/api/orchestrator/workflows', w),
    orchestratorDeleteWorkflow: async (id) => {
      const res = await fetch(`${baseUrl()}/api/orchestrator/workflows/${id}`, { method: 'DELETE' });
      return res.json();
    },

    // ── Execution Runs & Event Bus ──
    orchestratorListRuns: () => get('/api/orchestrator/runs'),
    orchestratorGetRun: (id) => get(`/api/orchestrator/runs/${id}`),
    orchestratorGetRunEvents: (id) => get(`/api/orchestrator/runs/${id}/events`),
    orchestratorGetEventHistory: (filter) => post('/api/orchestrator/events/history', filter),
    onOrchestratorEvent: (cb) => {
      // In web mode, orchestrator events come over WebSocket
      const handler = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'orchestrator-event') cb(msg.data);
        } catch { /* ignore parse errors */ }
      };
      // Attach to the existing WS or no-op
      return () => {};
    },

    // ── Visual Workflow Editor ──
    orchestratorSaveEditorWorkflow: (d) => post('/api/orchestrator/editor-workflows', d),
    orchestratorListEditorWorkflows: () => get('/api/orchestrator/editor-workflows'),
    orchestratorDeleteEditorWorkflow: async (id) => {
      const res = await fetch(`${baseUrl()}/api/orchestrator/editor-workflows/${id}`, { method: 'DELETE' });
      return res.json();
    },

    // ── Workflow Execution ──
    orchestratorExecuteWorkflow: (data) => post('/api/orchestrator/execute-workflow', data),
    orchestratorSaveRun: (run) => post('/api/orchestrator/runs', run),
  };
}
