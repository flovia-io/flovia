/**
 * Prompt settings routes.
 */
import { Router } from 'express';
import { loadPromptSettings, savePromptSettings, resetPromptSettings } from '@flovia/main/storage';
import { ok, fail } from '../helpers';

const router = Router();

router.get('/prompts', (_req, res) => {
  try { ok(res, loadPromptSettings()); }
  catch (err) { fail(res, err); }
});

router.post('/prompts', (req, res) => {
  try { savePromptSettings(req.body); ok(res, { success: true }); }
  catch (err) { fail(res, err); }
});

router.post('/prompts/reset', (_req, res) => {
  try { ok(res, resetPromptSettings()); }
  catch (err) { fail(res, err); }
});

export default router;
