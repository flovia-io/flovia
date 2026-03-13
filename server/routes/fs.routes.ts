/**
 * File System & Git routes.
 *
 * //TODO(security): Add path traversal protection — validate that all file paths
 * resolve within the workspace directory before performing any read/write/delete.
 * Currently req.body.filePath is used unsanitized, allowing ../../etc/passwd reads.
 *
 * //TODO(consistency): Standardize error handling — some routes return 200 with
 * { success: false } while others use fail() with proper HTTP status codes.
 * Pick one pattern and apply everywhere.
 */
import { Router } from 'express';
import fs from 'fs';
import * as fileSystem from '@flovia/main/fileSystem';
import { openFolder } from '@flovia/main/workspace';
import { ok, fail } from '../helpers';

const router = Router();

router.post('/fs/open-folder', (req, res) => {
  try {
    const result = openFolder(req.body.folderPath);
    if (!result) return fail(res, new Error('Folder not found'), 404);
    ok(res, result);
  } catch (err) { fail(res, err); }
});

// TODO(security): Validate filePath is within workspace before reading
router.post('/fs/read-file', (req, res) => {
  try {
    const content = fs.readFileSync(req.body.filePath, 'utf-8');
    ok(res, { success: true, content });
  } catch (err) {
    // TODO(consistency): Use fail(res, err) instead of ok() with error payload
    ok(res, { success: false, error: (err as Error).message });
  }
});

// TODO(security): Validate filePath is within workspace before writing
router.post('/fs/save-file', (req, res) => {
  try {
    fs.writeFileSync(req.body.filePath, req.body.content, 'utf-8');
    ok(res, { success: true });
  } catch (err) {
    // TODO(consistency): Use fail(res, err) instead of ok() with error payload
    ok(res, { success: false, error: (err as Error).message });
  }
});

router.post('/fs/create-file', (req, res) => {
  try { ok(res, fileSystem.createFile(req.body.filePath, req.body.content ?? '')); }
  catch (err) { fail(res, err); }
});

router.post('/fs/create-folder', (req, res) => {
  try { ok(res, fileSystem.createFolder(req.body.folderPath)); }
  catch (err) { fail(res, err); }
});

router.post('/fs/delete', (req, res) => {
  try { ok(res, fileSystem.deleteFileOrFolder(req.body.targetPath)); }
  catch (err) { fail(res, err); }
});

router.post('/fs/rename', (req, res) => {
  try { ok(res, fileSystem.renameFileOrFolder(req.body.oldPath, req.body.newPath)); }
  catch (err) { fail(res, err); }
});

router.post('/fs/refresh-tree', (req, res) => {
  try { ok(res, { tree: fileSystem.readDirectoryTree(req.body.folderPath) }); }
  catch (err) { fail(res, err); }
});

// ─── Git ─────────────────────────────────────────────────────────────────────

router.post('/git/status', (req, res) => {
  try { ok(res, fileSystem.getGitChangedFiles(req.body.folderPath)); }
  catch (err) { fail(res, err); }
});

router.post('/git/status-split', (req, res) => {
  try { ok(res, fileSystem.getGitChangedFilesSplit(req.body.folderPath)); }
  catch (err) { fail(res, err); }
});

router.post('/git/diff', (req, res) => {
  try { ok(res, fileSystem.getGitDiff(req.body.folderPath, req.body.filePath)); }
  catch (err) { fail(res, err); }
});

router.post('/git/stage', (req, res) => {
  try { fileSystem.gitStageFile(req.body.folderPath, req.body.filePath); ok(res); }
  catch (err) { fail(res, err); }
});

router.post('/git/unstage', (req, res) => {
  try { fileSystem.gitUnstageFile(req.body.folderPath, req.body.filePath); ok(res); }
  catch (err) { fail(res, err); }
});

router.post('/git/stage-all', (req, res) => {
  try { fileSystem.gitStageAll(req.body.folderPath); ok(res); }
  catch (err) { fail(res, err); }
});

router.post('/git/unstage-all', (req, res) => {
  try { fileSystem.gitUnstageAll(req.body.folderPath); ok(res); }
  catch (err) { fail(res, err); }
});

router.post('/git/discard', (req, res) => {
  try { ok(res, fileSystem.gitDiscardFile(req.body.folderPath, req.body.filePath)); }
  catch (err) { fail(res, err); }
});

router.post('/git/commit', (req, res) => {
  try { ok(res, fileSystem.gitCommit(req.body.folderPath, req.body.message)); }
  catch (err) { fail(res, err); }
});

router.post('/git/branch-info', (req, res) => {
  try { ok(res, fileSystem.gitGetBranchInfo(req.body.folderPath)); }
  catch (err) { fail(res, err); }
});

router.post('/git/list-branches', (req, res) => {
  try { ok(res, fileSystem.gitListBranches(req.body.folderPath)); }
  catch (err) { fail(res, err); }
});

router.post('/git/checkout', (req, res) => {
  try { ok(res, fileSystem.gitCheckout(req.body.folderPath, req.body.branch)); }
  catch (err) { fail(res, err); }
});

router.post('/git/create-branch', (req, res) => {
  try { ok(res, fileSystem.gitCreateBranch(req.body.folderPath, req.body.branch)); }
  catch (err) { fail(res, err); }
});

router.post('/git/pull', (req, res) => {
  try { ok(res, fileSystem.gitPull(req.body.folderPath)); }
  catch (err) { fail(res, err); }
});

router.post('/git/push', (req, res) => {
  try { ok(res, fileSystem.gitPush(req.body.folderPath)); }
  catch (err) { fail(res, err); }
});

export default router;
