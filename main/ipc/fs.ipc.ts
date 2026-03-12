/**
 * File System & Git IPC handlers
 */
import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  readDirectoryTree,
  getGitChangedFiles,
  getGitChangedFilesSplit,
  getGitDiff,
  getGitIgnoredPaths,
  gitStageFile,
  gitUnstageFile,
  gitStageAll,
  gitUnstageAll,
  gitDiscardFile,
  gitCommit,
  gitGetBranchInfo,
  gitListBranches,
  gitCheckout,
  gitCreateBranch,
  gitPull,
  gitPush,
  createFile,
  createFolder,
  deleteFileOrFolder,
  renameFileOrFolder,
  searchText,
} from '../fileSystem';
import { openFolder } from '../workspace';

export function registerFsIpc(): void {
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Import a Project' });
    if (result.canceled) return null;
    return openFolder(result.filePaths[0]);
  });

  ipcMain.handle('open-folder', async (_event, folderPath: string) => {
    return openFolder(folderPath);
  });

  ipcMain.handle('read-file', async (_event, filePath: string) => {
    try {
      return { success: true, content: fs.readFileSync(filePath, 'utf-8') };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('save-file', async (_event, filePath: string, content: string) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('create-file', async (_event, filePath: string, content?: string) => {
    return createFile(filePath, content || '');
  });

  ipcMain.handle('create-folder', async (_event, folderPath: string) => {
    return createFolder(folderPath);
  });

  ipcMain.handle('delete-file-or-folder', async (_event, targetPath: string) => {
    return deleteFileOrFolder(targetPath);
  });

  ipcMain.handle('rename-file-or-folder', async (_event, oldPath: string, newPath: string) => {
    return renameFileOrFolder(oldPath, newPath);
  });

  ipcMain.handle('refresh-tree', async (_event, folderPath: string) => {
    return readDirectoryTree(folderPath);
  });

  // ── Git ──
  ipcMain.handle('git-status', async (_event, folderPath: string) => getGitChangedFiles(folderPath));
  ipcMain.handle('git-status-split', async (_event, folderPath: string) => getGitChangedFilesSplit(folderPath));
  ipcMain.handle('git-diff', async (_event, folderPath: string, filePath: string) => getGitDiff(folderPath, filePath));

  ipcMain.handle('git-stage', async (_event, folderPath: string, filePath: string) => {
    try { gitStageFile(folderPath, filePath); return { success: true }; }
    catch (err: unknown) { return { success: false, error: (err as Error).message }; }
  });

  ipcMain.handle('git-unstage', async (_event, folderPath: string, filePath: string) => {
    try { gitUnstageFile(folderPath, filePath); return { success: true }; }
    catch (err: unknown) { return { success: false, error: (err as Error).message }; }
  });

  ipcMain.handle('git-stage-all', async (_event, folderPath: string) => {
    try { gitStageAll(folderPath); return { success: true }; }
    catch (err: unknown) { return { success: false, error: (err as Error).message }; }
  });

  ipcMain.handle('git-unstage-all', async (_event, folderPath: string) => {
    try { gitUnstageAll(folderPath); return { success: true }; }
    catch (err: unknown) { return { success: false, error: (err as Error).message }; }
  });

  ipcMain.handle('git-discard', async (_event, folderPath: string, filePath: string) => gitDiscardFile(folderPath, filePath));
  ipcMain.handle('git-commit', async (_event, folderPath: string, message: string) => gitCommit(folderPath, message));
  ipcMain.handle('git-branch-info', async (_event, folderPath: string) => gitGetBranchInfo(folderPath));
  ipcMain.handle('git-list-branches', async (_event, folderPath: string) => gitListBranches(folderPath));
  ipcMain.handle('git-checkout', async (_event, folderPath: string, branch: string) => gitCheckout(folderPath, branch));
  ipcMain.handle('git-create-branch', async (_event, folderPath: string, branch: string) => gitCreateBranch(folderPath, branch));
  ipcMain.handle('git-pull', async (_event, folderPath: string) => gitPull(folderPath));
  ipcMain.handle('git-push', async (_event, folderPath: string) => gitPush(folderPath));

  // ── Text Search ──
  ipcMain.handle('search-text', async (
    _event,
    folderPath: string,
    query: string,
    options?: { caseSensitive?: boolean; maxResults?: number; includePattern?: string; excludeDirs?: string[] },
  ) => {
    return searchText(folderPath, query, options);
  });
}
