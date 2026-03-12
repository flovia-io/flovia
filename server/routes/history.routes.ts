/**
 * Chat history routes.
 */
import { Router } from 'express';
import * as chatHistory from '@flovia/main/chatHistory';
import { ok, fail } from '../helpers';

const router = Router();

let appHistory: chatHistory.AppHistory | null = null;
function getHistory(): chatHistory.AppHistory {
  if (!appHistory) appHistory = chatHistory.loadAppHistory();
  return appHistory;
}
function save() { chatHistory.saveAppHistory(getHistory()); }

router.get('/history', (_req, res) => {
  try { ok(res, getHistory()); } catch (err) { fail(res, err); }
});

router.get('/history/recent-workspaces', (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    ok(res, chatHistory.getRecentWorkspaces(getHistory(), limit));
  } catch (err) { fail(res, err); }
});

router.post('/history/open-workspace', (req, res) => {
  try {
    const ws = chatHistory.getOrCreateWorkspace(getHistory(), req.body.folderPath);
    save();
    ok(res, ws);
  } catch (err) { fail(res, err); }
});

router.post('/history/remove-workspace', (req, res) => {
  try {
    chatHistory.removeWorkspace(getHistory(), req.body.folderPath);
    save();
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

router.post('/history/conversation/create', (req, res) => {
  try {
    const ws = chatHistory.getOrCreateWorkspace(getHistory(), req.body.folderPath);
    const conv = chatHistory.createConversation(ws, req.body.mode);
    save();
    ok(res, conv);
  } catch (err) { fail(res, err); }
});

router.post('/history/conversation/get', (req, res) => {
  try {
    const ws = chatHistory.getOrCreateWorkspace(getHistory(), req.body.folderPath);
    ok(res, chatHistory.getConversation(ws, req.body.conversationId));
  } catch (err) { fail(res, err); }
});

router.post('/history/conversation/active', (req, res) => {
  try {
    const ws = chatHistory.getOrCreateWorkspace(getHistory(), req.body.folderPath);
    ok(res, chatHistory.getActiveConversation(ws));
  } catch (err) { fail(res, err); }
});

router.post('/history/conversation/update', (req, res) => {
  try {
    const ws = chatHistory.getOrCreateWorkspace(getHistory(), req.body.folderPath);
    const conv = chatHistory.updateConversation(ws, req.body.conversationId, req.body.messages, req.body.mode);
    save();
    ok(res, conv);
  } catch (err) { fail(res, err); }
});

router.post('/history/conversation/delete', (req, res) => {
  try {
    const ws = chatHistory.getOrCreateWorkspace(getHistory(), req.body.folderPath);
    chatHistory.deleteConversation(ws, req.body.conversationId);
    save();
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

router.post('/history/conversation/set-active', (req, res) => {
  try {
    const ws = chatHistory.getOrCreateWorkspace(getHistory(), req.body.folderPath);
    chatHistory.setActiveConversation(ws, req.body.conversationId);
    save();
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

router.post('/history/conversation/rename', (req, res) => {
  try {
    const ws = chatHistory.getOrCreateWorkspace(getHistory(), req.body.folderPath);
    chatHistory.renameConversation(ws, req.body.conversationId, req.body.newTitle);
    save();
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

router.post('/history/workspace', (req, res) => {
  try {
    const h = getHistory();
    ok(res, h.workspaces[req.body.folderPath] ?? null);
  } catch (err) { fail(res, err); }
});

export default router;
