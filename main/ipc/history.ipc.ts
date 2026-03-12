/**
 * Chat History IPC handlers
 */
import { ipcMain } from 'electron';
import {
  loadAppHistory,
  saveAppHistory,
  getOrCreateWorkspace,
  getRecentWorkspaces,
  removeWorkspace,
  createConversation,
  getConversation,
  getActiveConversation,
  updateConversation,
  deleteConversation,
  setActiveConversation,
  renameConversation,
  type ChatMessage as HistoryChatMessage,
} from '../chatHistory';

export function registerHistoryIpc(): void {
  ipcMain.handle('history-load', async () => loadAppHistory());

  ipcMain.handle('history-get-recent-workspaces', async (_event, limit?: number) => {
    const history = loadAppHistory();
    return getRecentWorkspaces(history, limit);
  });

  ipcMain.handle('history-open-workspace', async (_event, folderPath: string) => {
    const history = loadAppHistory();
    const workspace = getOrCreateWorkspace(history, folderPath);
    saveAppHistory(history);
    return workspace;
  });

  ipcMain.handle('history-remove-workspace', async (_event, folderPath: string) => {
    const history = loadAppHistory();
    removeWorkspace(history, folderPath);
    saveAppHistory(history);
    return { success: true };
  });

  ipcMain.handle('history-create-conversation', async (_event, folderPath: string, mode: 'Agent' | 'Chat' | 'Edit') => {
    const history = loadAppHistory();
    const workspace = getOrCreateWorkspace(history, folderPath);
    const conversation = createConversation(workspace, mode);
    saveAppHistory(history);
    return conversation;
  });

  ipcMain.handle('history-get-conversation', async (_event, folderPath: string, conversationId: string) => {
    const history = loadAppHistory();
    const workspace = history.workspaces.find(w => w.folderPath === folderPath);
    if (!workspace) return null;
    return getConversation(workspace, conversationId);
  });

  ipcMain.handle('history-get-active-conversation', async (_event, folderPath: string) => {
    const history = loadAppHistory();
    const workspace = history.workspaces.find(w => w.folderPath === folderPath);
    if (!workspace) return null;
    return getActiveConversation(workspace);
  });

  ipcMain.handle('history-update-conversation', async (
    _event,
    folderPath: string,
    conversationId: string,
    messages: HistoryChatMessage[],
    mode?: 'Agent' | 'Chat' | 'Edit',
  ) => {
    const history = loadAppHistory();
    const workspace = history.workspaces.find(w => w.folderPath === folderPath);
    if (!workspace) return null;
    const conv = updateConversation(workspace, conversationId, messages, mode);
    saveAppHistory(history);
    return conv;
  });

  ipcMain.handle('history-delete-conversation', async (_event, folderPath: string, conversationId: string) => {
    const history = loadAppHistory();
    const workspace = history.workspaces.find(w => w.folderPath === folderPath);
    if (!workspace) return { success: false, error: 'Workspace not found' };
    deleteConversation(workspace, conversationId);
    saveAppHistory(history);
    return { success: true };
  });

  ipcMain.handle('history-set-active-conversation', async (_event, folderPath: string, conversationId: string) => {
    const history = loadAppHistory();
    const workspace = history.workspaces.find(w => w.folderPath === folderPath);
    if (!workspace) return { success: false, error: 'Workspace not found' };
    setActiveConversation(workspace, conversationId);
    saveAppHistory(history);
    return { success: true };
  });

  ipcMain.handle('history-rename-conversation', async (_event, folderPath: string, conversationId: string, newTitle: string) => {
    const history = loadAppHistory();
    const workspace = history.workspaces.find(w => w.folderPath === folderPath);
    if (!workspace) return { success: false, error: 'Workspace not found' };
    renameConversation(workspace, conversationId, newTitle);
    saveAppHistory(history);
    return { success: true };
  });

  ipcMain.handle('history-get-workspace', async (_event, folderPath: string) => {
    const history = loadAppHistory();
    return history.workspaces.find(w => w.folderPath === folderPath) ?? null;
  });
}
