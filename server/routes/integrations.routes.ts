/**
 * NPM, Terminal, Supabase, GitHub, Atlassian routes.
 *
 * NOTE: The per-connector routes below are LEGACY — they exist for backward
 * compatibility. New code should use the generic connector REST API
 * (`/api/connectors/:id/actions/:actionId`) in `server/index.ts`.
 */
import { Router } from 'express';
import { findNpmProjects } from '@flovia/main/workspace';
import type { GitHubIssueFilterState } from '@flovia/connectors/github/api';
import { ok, fail } from '../helpers';

const router = Router();

// ─── NPM ─────────────────────────────────────────────────────────────────────

router.post('/npm/projects', (req, res) => {
  try {
    ok(res, findNpmProjects(req.body.folderPath, req.body.gitIgnoredPaths));
  } catch (err) { fail(res, err); }
});

// ─── Terminal ────────────────────────────────────────────────────────────────

router.post('/terminal/create', (_req, res) => {
  ok(res, { id: `term-${Date.now()}`, shell: process.env.SHELL || '/bin/bash' });
});

router.post('/terminal/kill', (_req, res) => {
  ok(res, { success: true });
});

// ─── Supabase ────────────────────────────────────────────────────────────────

router.post('/supabase/detect', (req, res) => {
  try {
    const { detectSupabaseConfig } = require('../../connectors/supabase/api');
    ok(res, detectSupabaseConfig(req.body.folderPath));
  } catch { ok(res, { detected: false }); }
});

router.post('/supabase/users', async (req, res) => {
  try {
    const { fetchSupabaseUsers } = await import('../../connectors/supabase/api');
    ok(res, await fetchSupabaseUsers(req.body.projectUrl, req.body.serviceRoleKey));
  } catch (err) { fail(res, err); }
});

router.post('/supabase/storage', async (req, res) => {
  try {
    const { fetchSupabaseStorage } = await import('../../connectors/supabase/api');
    ok(res, await fetchSupabaseStorage(req.body.projectUrl, req.body.serviceRoleKey));
  } catch (err) { fail(res, err); }
});

router.post('/supabase/tables', async (req, res) => {
  try {
    const { fetchSupabaseTables } = await import('../../connectors/supabase/api');
    ok(res, await fetchSupabaseTables(req.body.projectUrl, req.body.serviceRoleKey));
  } catch (err) { fail(res, err); }
});

router.post('/supabase/query', async (req, res) => {
  try {
    const { executeSupabaseQuery } = await import('../../connectors/supabase/api');
    ok(res, await executeSupabaseQuery(req.body.projectUrl, req.body.serviceRoleKey, req.body.query));
  } catch (err) { fail(res, err); }
});

// ─── GitHub ──────────────────────────────────────────────────────────────────

router.post('/github/extract-repo-info', async (req, res) => {
  try {
    const { extractRepoInfo } = await import('../../connectors/github/api');
    ok(res, extractRepoInfo(req.body.remoteUrl));
  } catch (err) { fail(res, err); }
});

router.get('/github/:owner/:repo/workflows', async (req, res) => {
  try {
    const { listWorkflows } = await import('../../connectors/github/api');
    ok(res, await listWorkflows(req.params.owner, req.params.repo));
  } catch (err) { fail(res, err); }
});

router.get('/github/:owner/:repo/runs', async (req, res) => {
  try {
    const { listWorkflowRuns } = await import('../../connectors/github/api');
    const workflowId = req.query.workflowId ? Number(req.query.workflowId) : undefined;
    const perPage = req.query.perPage ? Number(req.query.perPage) : undefined;
    ok(res, await listWorkflowRuns(req.params.owner, req.params.repo, workflowId, perPage));
  } catch (err) { fail(res, err); }
});

router.get('/github/:owner/:repo/runs/:runId/jobs', async (req, res) => {
  try {
    const { listRunJobs } = await import('../../connectors/github/api');
    ok(res, await listRunJobs(req.params.owner, req.params.repo, Number(req.params.runId)));
  } catch (err) { fail(res, err); }
});

router.get('/github/:owner/:repo/runs/:runId/logs', async (req, res) => {
  try {
    const { getRunLogs } = await import('../../connectors/github/api');
    ok(res, await getRunLogs(req.params.owner, req.params.repo, Number(req.params.runId)));
  } catch (err) { fail(res, err); }
});

router.get('/github/:owner/:repo/jobs/:jobId/logs', async (req, res) => {
  try {
    const { getJobLogs } = await import('../../connectors/github/api');
    ok(res, await getJobLogs(req.params.owner, req.params.repo, Number(req.params.jobId)));
  } catch (err) { fail(res, err); }
});

router.post('/github/:owner/:repo/runs/:runId/rerun', async (req, res) => {
  try {
    const { rerunWorkflow } = await import('../../connectors/github/api');
    ok(res, await rerunWorkflow(req.params.owner, req.params.repo, Number(req.params.runId)));
  } catch (err) { fail(res, err); }
});

router.get('/github/:owner/:repo/issues', async (req, res) => {
  try {
    const { listIssues } = await import('../../connectors/github/api');
    const state = (req.query.state as GitHubIssueFilterState) || 'open';
    const perPage = req.query.perPage ? Number(req.query.perPage) : undefined;
    ok(res, await listIssues(req.params.owner, req.params.repo, state, perPage));
  } catch (err) { fail(res, err); }
});

// ─── Atlassian ───────────────────────────────────────────────────────────────

router.get('/atlassian/connections', async (_req, res) => {
  try {
    // Read from generic connector config (if available), fall back to legacy storage
    const { getStorage } = await import('../../core/storage');
    const storage = getStorage();
    const connectorConfig = await Promise.resolve(storage.loadSingleConnectorConfig('atlassian')) as Record<string, unknown> | null;
    if (connectorConfig && connectorConfig.domain && connectorConfig.email && connectorConfig.apiToken) {
      ok(res, [{ domain: connectorConfig.domain, email: connectorConfig.email, apiToken: connectorConfig.apiToken }]);
    } else {
      // Fallback to legacy storage
      const { loadAtlassianConnections } = await import('../../main/storage');
      ok(res, loadAtlassianConnections());
    }
  } catch (err) { fail(res, err); }
});

router.post('/atlassian/connections', async (req, res) => {
  try {
    const { saveAtlassianConnections } = await import('../../main/storage');
    saveAtlassianConnections(req.body.connections);
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

router.post('/atlassian/test-connection', async (req, res) => {
  try {
    const { testConnection } = await import('../../connectors/atlassian/api');
    ok(res, await testConnection(req.body.connection));
  } catch (err) { fail(res, err); }
});

router.post('/atlassian/projects', async (req, res) => {
  try {
    const { fetchProjects } = await import('../../connectors/atlassian/api');
    ok(res, await fetchProjects(req.body.connection));
  } catch (err) { fail(res, err); }
});

router.post('/atlassian/issues', async (req, res) => {
  try {
    const { fetchProjectIssues } = await import('../../connectors/atlassian/api');
    ok(res, await fetchProjectIssues(req.body.connection, req.body.projectKey, req.body.maxResults));
  } catch (err) { fail(res, err); }
});

export default router;
