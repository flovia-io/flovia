import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getUserDataDir } from '@flovia/core/dataDir';

// ── Types ──

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Original display text (for user messages, this is the text without embedded file context) */
  displayText?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  mode: 'Agent' | 'Chat' | 'Edit';
}

/** Workspace metadata stored in workspace.json (without full conversation data) */
export interface WorkspaceMeta {
  folderPath: string;
  folderName: string;
  lastOpened: string;
  activeConversationId: string | null;
  /** Just conversation IDs for reference - full data is in separate files */
  conversationIds: string[];
}

/** Full workspace data returned to the renderer */
export interface WorkspaceHistory {
  folderPath: string;
  folderName: string;
  lastOpened: string;
  conversations: Conversation[];
  activeConversationId: string | null;
}

/** Index of all workspaces */
export interface WorkspacesIndex {
  version: number;
  workspaces: { folderPath: string; hash: string; lastOpened: string }[];
  lastWorkspacePath: string | null;
}

export interface AppHistory {
  version: number;
  workspaces: WorkspaceHistory[];
  lastWorkspacePath: string | null;
}

// ── Cache Directory Structure ──
// _cache/
//   workspaces.json                    # Index of all workspaces
//   workspaces/
//     <workspace-hash>/
//       workspace.json                 # Workspace metadata
//       conversations/
//         <conversation-id>.json       # Individual conversation

const CACHE_VERSION = 1;

function getCacheDir(): string {
  return path.join(getUserDataDir(), '_cache');
}

function getWorkspacesIndexPath(): string {
  return path.join(getCacheDir(), 'workspaces.json');
}

function getWorkspacesDir(): string {
  return path.join(getCacheDir(), 'workspaces');
}

/** Create a hash from folder path for directory naming */
function hashFolderPath(folderPath: string): string {
  return crypto.createHash('sha256').update(folderPath).digest('hex').substring(0, 16);
}

function getWorkspaceDir(folderPath: string): string {
  const hash = hashFolderPath(folderPath);
  return path.join(getWorkspacesDir(), hash);
}

function getWorkspaceMetaPath(folderPath: string): string {
  return path.join(getWorkspaceDir(folderPath), 'workspace.json');
}

function getConversationsDir(folderPath: string): string {
  return path.join(getWorkspaceDir(folderPath), 'conversations');
}

function getConversationPath(folderPath: string, conversationId: string): string {
  return path.join(getConversationsDir(folderPath), conversationId + '.json');
}

// ── Ensure directories exist ──

function ensureCacheStructure(): void {
  const dirs = [getCacheDir(), getWorkspacesDir()];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function ensureWorkspaceStructure(folderPath: string): void {
  const dirs = [getWorkspaceDir(folderPath), getConversationsDir(folderPath)];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// ── Workspaces Index Operations ──

function loadWorkspacesIndex(): WorkspacesIndex {
  ensureCacheStructure();
  const indexPath = getWorkspacesIndexPath();
  try {
    if (fs.existsSync(indexPath)) {
      const data = fs.readFileSync(indexPath, 'utf-8');
      const index = JSON.parse(data) as WorkspacesIndex;
      if (index.version === CACHE_VERSION) {
        return index;
      }
    }
  } catch (err) {
    console.error('[ChatHistory] Failed to load workspaces index:', err);
  }
  return { version: CACHE_VERSION, workspaces: [], lastWorkspacePath: null };
}

function saveWorkspacesIndex(index: WorkspacesIndex): void {
  ensureCacheStructure();
  try {
    fs.writeFileSync(getWorkspacesIndexPath(), JSON.stringify(index, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ChatHistory] Failed to save workspaces index:', err);
  }
}

// ── Workspace Meta Operations ──

function loadWorkspaceMeta(folderPath: string): WorkspaceMeta | null {
  const metaPath = getWorkspaceMetaPath(folderPath);
  try {
    if (fs.existsSync(metaPath)) {
      const data = fs.readFileSync(metaPath, 'utf-8');
      return JSON.parse(data) as WorkspaceMeta;
    }
  } catch (err) {
    console.error('[ChatHistory] Failed to load workspace meta:', err);
  }
  return null;
}

function saveWorkspaceMeta(meta: WorkspaceMeta): void {
  ensureWorkspaceStructure(meta.folderPath);
  try {
    fs.writeFileSync(getWorkspaceMetaPath(meta.folderPath), JSON.stringify(meta, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ChatHistory] Failed to save workspace meta:', err);
  }
}

// ── Conversation Operations ──

function loadConversation(folderPath: string, conversationId: string): Conversation | null {
  const convPath = getConversationPath(folderPath, conversationId);
  try {
    if (fs.existsSync(convPath)) {
      const data = fs.readFileSync(convPath, 'utf-8');
      return JSON.parse(data) as Conversation;
    }
  } catch (err) {
    console.error('[ChatHistory] Failed to load conversation:', err);
  }
  return null;
}

function saveConversationFile(folderPath: string, conversation: Conversation): void {
  ensureWorkspaceStructure(folderPath);
  try {
    const convPath = getConversationPath(folderPath, conversation.id);
    fs.writeFileSync(convPath, JSON.stringify(conversation, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ChatHistory] Failed to save conversation:', err);
  }
}

function deleteConversationFile(folderPath: string, conversationId: string): void {
  const convPath = getConversationPath(folderPath, conversationId);
  try {
    if (fs.existsSync(convPath)) {
      fs.unlinkSync(convPath);
    }
  } catch (err) {
    console.error('[ChatHistory] Failed to delete conversation file:', err);
  }
}

function loadAllConversations(folderPath: string): Conversation[] {
  const meta = loadWorkspaceMeta(folderPath);
  if (!meta) return [];

  const conversations: Conversation[] = [];
  for (const convId of meta.conversationIds) {
    const conv = loadConversation(folderPath, convId);
    if (conv) {
      conversations.push(conv);
    }
  }

  // Sort by updatedAt descending (newest first)
  return conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/** Load conversation summaries (without full messages) for listing */
function loadConversationSummaries(folderPath: string): Conversation[] {
  const meta = loadWorkspaceMeta(folderPath);
  if (!meta) return [];

  const conversations: Conversation[] = [];
  for (const convId of meta.conversationIds) {
    const conv = loadConversation(folderPath, convId);
    if (conv) {
      // Return summary without full message content for efficiency
      conversations.push({
        ...conv,
        messages: [], // Don't include full messages in list
      });
    }
  }

  return conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// ── Public API ──

export function loadAppHistory(): AppHistory {
  const index = loadWorkspacesIndex();
  const workspaces: WorkspaceHistory[] = [];

  for (const ws of index.workspaces) {
    const meta = loadWorkspaceMeta(ws.folderPath);
    if (meta) {
      const conversations = loadConversationSummaries(ws.folderPath);
      workspaces.push({
        folderPath: meta.folderPath,
        folderName: meta.folderName,
        lastOpened: meta.lastOpened,
        conversations,
        activeConversationId: meta.activeConversationId,
      });
    }
  }

  return {
    version: CACHE_VERSION,
    workspaces,
    lastWorkspacePath: index.lastWorkspacePath,
  };
}

export function saveAppHistory(_history: AppHistory): void {
  // No-op - we save incrementally now via individual save functions
  // The history object is no longer used as the source of truth
}

export function getOrCreateWorkspace(_history: AppHistory, folderPath: string): WorkspaceHistory {
  const index = loadWorkspacesIndex();
  const hash = hashFolderPath(folderPath);

  // Check if workspace exists in index
  let wsEntry = index.workspaces.find((w) => w.folderPath === folderPath);

  if (!wsEntry) {
    wsEntry = { folderPath, hash, lastOpened: new Date().toISOString() };
    index.workspaces.push(wsEntry);
  } else {
    wsEntry.lastOpened = new Date().toISOString();
  }

  index.lastWorkspacePath = folderPath;
  saveWorkspacesIndex(index);

  // Load or create workspace meta
  let meta = loadWorkspaceMeta(folderPath);
  if (!meta) {
    const parts = folderPath.split('/');
    const folderName = parts[parts.length - 1] || folderPath;
    meta = {
      folderPath,
      folderName,
      lastOpened: new Date().toISOString(),
      activeConversationId: null,
      conversationIds: [],
    };
    saveWorkspaceMeta(meta);
  } else {
    meta.lastOpened = new Date().toISOString();
    saveWorkspaceMeta(meta);
  }

  // Load all conversations (with summaries for listing)
  const conversations = loadConversationSummaries(folderPath);

  return {
    folderPath: meta.folderPath,
    folderName: meta.folderName,
    lastOpened: meta.lastOpened,
    conversations,
    activeConversationId: meta.activeConversationId,
  };
}

export function getRecentWorkspaces(_history: AppHistory, limit = 10): WorkspaceHistory[] {
  const index = loadWorkspacesIndex();

  const sorted = [...index.workspaces].sort(
    (a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()
  );

  const result: WorkspaceHistory[] = [];
  for (const ws of sorted.slice(0, limit)) {
    const meta = loadWorkspaceMeta(ws.folderPath);
    if (meta) {
      const conversations = loadConversationSummaries(ws.folderPath);
      result.push({
        folderPath: meta.folderPath,
        folderName: meta.folderName,
        lastOpened: meta.lastOpened,
        conversations,
        activeConversationId: meta.activeConversationId,
      });
    }
  }

  return result;
}

export function removeWorkspace(_history: AppHistory, folderPath: string): void {
  const index = loadWorkspacesIndex();
  index.workspaces = index.workspaces.filter((w) => w.folderPath !== folderPath);

  if (index.lastWorkspacePath === folderPath) {
    index.lastWorkspacePath = index.workspaces[0]?.folderPath ?? null;
  }

  saveWorkspacesIndex(index);

  // Delete workspace folder entirely
  const wsDir = getWorkspaceDir(folderPath);
  try {
    if (fs.existsSync(wsDir)) {
      fs.rmSync(wsDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('[ChatHistory] Failed to delete workspace directory:', err);
  }
}

// ── Conversation Public API ──

function generateId(): string {
  return 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

function generateTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === 'user');
  if (firstUserMsg) {
    const text = firstUserMsg.content.replace(/\n/g, ' ').trim();
    return text.length > 50 ? text.substring(0, 47) + '...' : text;
  }
  return 'New Chat';
}

export function createConversation(
  workspace: WorkspaceHistory,
  mode: 'Agent' | 'Chat' | 'Edit' = 'Agent'
): Conversation {
  const now = new Date().toISOString();
  const conv: Conversation = {
    id: generateId(),
    title: 'New Chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
    mode,
  };

  // Save conversation file
  saveConversationFile(workspace.folderPath, conv);

  // Update workspace meta
  const meta = loadWorkspaceMeta(workspace.folderPath);
  if (meta) {
    meta.conversationIds.unshift(conv.id);
    meta.activeConversationId = conv.id;
    saveWorkspaceMeta(meta);
  }

  // Update in-memory workspace
  workspace.conversations.unshift(conv);
  workspace.activeConversationId = conv.id;

  return conv;
}

export function getConversation(
  workspace: WorkspaceHistory,
  conversationId: string
): Conversation | null {
  // Load full conversation with messages
  return loadConversation(workspace.folderPath, conversationId);
}

export function getActiveConversation(workspace: WorkspaceHistory): Conversation | null {
  if (!workspace.activeConversationId) return null;
  return loadConversation(workspace.folderPath, workspace.activeConversationId);
}

export function updateConversation(
  workspace: WorkspaceHistory,
  conversationId: string,
  messages: ChatMessage[],
  mode?: 'Agent' | 'Chat' | 'Edit'
): Conversation | null {
  const conv = loadConversation(workspace.folderPath, conversationId);
  if (!conv) return null;

  conv.messages = messages;
  conv.updatedAt = new Date().toISOString();
  conv.title = generateTitle(messages);
  if (mode) conv.mode = mode;

  // Save updated conversation
  saveConversationFile(workspace.folderPath, conv);

  return conv;
}

export function deleteConversation(workspace: WorkspaceHistory, conversationId: string): void {
  // Delete conversation file
  deleteConversationFile(workspace.folderPath, conversationId);

  // Update workspace meta
  const meta = loadWorkspaceMeta(workspace.folderPath);
  if (meta) {
    meta.conversationIds = meta.conversationIds.filter((id) => id !== conversationId);
    if (meta.activeConversationId === conversationId) {
      meta.activeConversationId = meta.conversationIds[0] ?? null;
    }
    saveWorkspaceMeta(meta);
  }

  // Update in-memory workspace
  workspace.conversations = workspace.conversations.filter((c) => c.id !== conversationId);
  if (workspace.activeConversationId === conversationId) {
    workspace.activeConversationId = workspace.conversations[0]?.id ?? null;
  }
}

export function setActiveConversation(
  workspace: WorkspaceHistory,
  conversationId: string
): void {
  const conv = loadConversation(workspace.folderPath, conversationId);
  if (conv) {
    workspace.activeConversationId = conversationId;

    // Update workspace meta
    const meta = loadWorkspaceMeta(workspace.folderPath);
    if (meta) {
      meta.activeConversationId = conversationId;
      saveWorkspaceMeta(meta);
    }
  }
}

export function renameConversation(
  workspace: WorkspaceHistory,
  conversationId: string,
  newTitle: string
): void {
  const conv = loadConversation(workspace.folderPath, conversationId);
  if (conv) {
    conv.title = newTitle;
    conv.updatedAt = new Date().toISOString();
    saveConversationFile(workspace.folderPath, conv);
  }
}
