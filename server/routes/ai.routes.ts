/**
 * AI routes.
 */
import { Router } from 'express';
import * as ai from '@flovia/main/ai';
import { loadAISettings, saveAISettings, loadEnvApiKeys } from '@flovia/main/storage';
import { ok, fail } from '../helpers';

const router = Router();

router.get('/ai/check-ollama', async (_req, res) => {
  try { ok(res, await ai.checkOllama()); }
  catch (err) { fail(res, err); }
});

router.post('/ai/list-models', async (req, res) => {
  try { ok(res, await ai.listModels(req.body.baseUrl, req.body.apiKey)); }
  catch (err) { fail(res, err); }
});

router.post('/ai/chat', async (req, res) => {
  try {
    const { baseUrl, apiKey, model, messages } = req.body;
    const reply = await ai.chatComplete(baseUrl, apiKey, model, messages);
    ok(res, { success: true, reply });
  } catch (err) { fail(res, err); }
});

router.post('/ai/abort', (_req, res) => {
  ok(res, { success: true });
});

router.get('/ai/settings', (_req, res) => {
  try { ok(res, loadAISettings()); }
  catch (err) { fail(res, err); }
});

router.post('/ai/settings', (req, res) => {
  try { saveAISettings(req.body); ok(res, { success: true }); }
  catch (err) { fail(res, err); }
});

router.get('/ai/env-keys', (_req, res) => {
  try { ok(res, loadEnvApiKeys()); }
  catch (err) { fail(res, err); }
});

export default router;
