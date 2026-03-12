/**
 * Session folder IPC handlers
 */
import { ipcMain } from 'electron';
import {
  createSessionFolder,
  cloneGitHubRepo,
  listSessionFolders,
  deleteSessionFolder,
} from '../sessionFolder';

export function registerSessionIpc(): void {
  ipcMain.handle('session-create-folder', async (_event, title?: string) => {
    return createSessionFolder(title);
  });

  ipcMain.handle('session-clone-github', async (_event, repoUrl: string, token?: string) => {
    return cloneGitHubRepo(repoUrl, token);
  });

  ipcMain.handle('session-list-folders', async () => {
    return listSessionFolders();
  });

  ipcMain.handle('session-delete-folder', async (_event, folderPath: string) => {
    return deleteSessionFolder(folderPath);
  });
}
