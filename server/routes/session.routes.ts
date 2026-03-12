/**
 * Session folder routes (for web/Docker mode)
 */
import { Router } from 'express';
import {
  createSessionFolder,
  cloneGitHubRepo,
  listSessionFolders,
  deleteSessionFolder,
} from '@flovia/main/sessionFolder';
import { ok, fail } from '../helpers';

const router = Router();

// Create a new session folder
router.post('/create-folder', (req, res) => {
  try {
    const result = createSessionFolder(req.body.title);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
});

// Clone a GitHub repository into a session folder
router.post('/clone-github', async (req, res) => {
  try {
    const result = await cloneGitHubRepo(req.body.repoUrl, req.body.token);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
});

// List all session folders
router.get('/list-folders', (req, res) => {
  try {
    const folders = listSessionFolders();
    ok(res, folders);
  } catch (err) {
    fail(res, err);
  }
});

// Delete a session folder
router.post('/delete-folder', (req, res) => {
  try {
    const result = deleteSessionFolder(req.body.folderPath);
    ok(res, result);
  } catch (err) {
    fail(res, err);
  }
});

export default router;
