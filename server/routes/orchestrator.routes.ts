/**
 * Orchestrator REST Routes — Agent Profiles, Workflows, Editor Workflows,
 * Execution Runs, and Workflow Execution.
 *
 * Cloud-mode equivalent of `main/ipc/orchestrator.ipc.ts`.
 * Exposes the same operations over HTTP REST.
 */
import { Router } from 'express';
import type { AgentProfile, Workflow } from '@flovia/core/orchestrator';
import { getStorage } from '@flovia/core/storage';
import { getEventBus } from '@flovia/core/event-bus';
import type { ExecutionRun } from '@flovia/core/execution-run';
import { genId, upsertById, removeById, appendCapped } from '@flovia/core/utils';
import { ok, fail } from '../helpers';

const router = Router();
const storage = getStorage();

// ─── Agent Profiles ─────────────────────────────────────────────────────────

router.get('/profiles', async (_req, res) => {
  try {
    const profiles = await storage.readJSON<AgentProfile[]>('agent-profiles', []);
    ok(res, profiles);
  } catch (err) { fail(res, err); }
});

router.post('/profiles', async (req, res) => {
  try {
    const profile: AgentProfile = req.body;
    const all = await storage.readJSON<AgentProfile[]>('agent-profiles', []);
    await storage.writeJSON('agent-profiles', upsertById(all, profile));
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

router.delete('/profiles/:id', async (req, res) => {
  try {
    const all = await storage.readJSON<AgentProfile[]>('agent-profiles', []);
    const { list, removed } = removeById(all, req.params.id);
    if (!removed) return res.status(404).json({ success: false, error: 'Profile not found' });
    await storage.writeJSON('agent-profiles', list);
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

// ─── Workflows ──────────────────────────────────────────────────────────────

router.get('/workflows', async (_req, res) => {
  try {
    const workflows = await storage.readJSON<Workflow[]>('workflows', []);
    ok(res, workflows);
  } catch (err) { fail(res, err); }
});

router.get('/workflows/:id', async (req, res) => {
  try {
    const all = await storage.readJSON<Workflow[]>('workflows', []);
    const workflow = all.find(w => w.id === req.params.id);
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
    ok(res, workflow);
  } catch (err) { fail(res, err); }
});

router.post('/workflows', async (req, res) => {
  try {
    const workflow: Workflow = req.body;
    const all = await storage.readJSON<Workflow[]>('workflows', []);
    await storage.writeJSON('workflows', upsertById(all, workflow));
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

router.delete('/workflows/:id', async (req, res) => {
  try {
    const all = await storage.readJSON<Workflow[]>('workflows', []);
    const { list, removed } = removeById(all, req.params.id);
    if (!removed) return res.status(404).json({ success: false, error: 'Workflow not found' });
    await storage.writeJSON('workflows', list);
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

// ─── Editor Workflows (visual workflow editor persistence) ──────────────────

router.get('/editor-workflows', async (_req, res) => {
  try {
    const workflows = await storage.readJSON<unknown[]>('editor-workflows', []);
    ok(res, workflows);
  } catch (err) { fail(res, err); }
});

router.post('/editor-workflows', async (req, res) => {
  try {
    const data = req.body as { id: string };
    const all = await storage.readJSON<Array<{ id: string }>>('editor-workflows', []);
    await storage.writeJSON('editor-workflows', upsertById(all, data));
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

router.delete('/editor-workflows/:id', async (req, res) => {
  try {
    const all = await storage.readJSON<unknown[]>('editor-workflows', []);
    const filtered = (all as any[]).filter((w: any) => w.id !== req.params.id);
    await storage.writeJSON('editor-workflows', filtered);
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

// ─── Execution Runs ─────────────────────────────────────────────────────────

router.get('/runs', async (_req, res) => {
  try {
    const runs = await storage.readJSON<ExecutionRun[]>('execution-runs', []);
    ok(res, runs);
  } catch (err) { fail(res, err); }
});

router.get('/runs/:id', async (req, res) => {
  try {
    const all = await storage.readJSON<ExecutionRun[]>('execution-runs', []);
    const run = all.find(r => r.id === req.params.id);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });
    ok(res, run);
  } catch (err) { fail(res, err); }
});

router.post('/runs', async (req, res) => {
  try {
    const run = req.body as { id: string };
    const allRuns = await storage.readJSON<Array<{ id: string }>>('execution-runs', []);
    const updated = upsertById(allRuns, run);
    await storage.writeJSON('execution-runs', updated.length > 200 ? updated.slice(-200) : updated);
    ok(res, { success: true });
  } catch (err) { fail(res, err); }
});

// ─── Event Bus (read-only) ──────────────────────────────────────────────────

router.get('/events/history', async (req, res) => {
  try {
    const bus = getEventBus();
    const filter = (req.query as Record<string, string>) ?? undefined;
    ok(res, bus.getHistory(Object.keys(filter).length > 0 ? filter : undefined));
  } catch (err) { fail(res, err); }
});

router.get('/events/run/:correlationId', async (req, res) => {
  try {
    const bus = getEventBus();
    ok(res, bus.getRunEvents(req.params.correlationId));
  } catch (err) { fail(res, err); }
});

// ─── Execute Workflow ───────────────────────────────────────────────────────

router.post('/execute', async (req, res) => {
  try {
    const bus = getEventBus();
    const workflowData = req.body as { id: string; name: string; nodes: any[]; edges: any[] };

    const runId = genId('run');
    const correlationId = runId;

    bus.emit('workflow', 'started', {
      workflowId: workflowData.id,
      workflowName: workflowData.name,
      totalSteps: workflowData.nodes.length,
    }, { source: workflowData.id, correlationId });

    const steps: any[] = [];

    for (const node of workflowData.nodes) {
      const stepStart = Date.now();

      bus.emit('step', 'started', {
        workflowId: workflowData.id,
        stepId: node.id,
        stepLabel: node.data?.label || node.id,
        stepKind: node.data?.nodeType || 'unknown',
        dependsOn: [],
      }, { source: workflowData.id, correlationId });

      await new Promise(resolve => setTimeout(resolve, 200));

      const stepDuration = Date.now() - stepStart;

      bus.emit('step', 'completed', {
        workflowId: workflowData.id,
        stepId: node.id,
        stepLabel: node.data?.label || node.id,
        stepKind: node.data?.nodeType || 'unknown',
        status: 'completed',
        durationMs: stepDuration,
        artifactCount: 0,
      }, { source: workflowData.id, correlationId });

      steps.push({
        nodeId: node.id,
        label: node.data?.label || node.id,
        status: 'completed',
        durationMs: stepDuration,
      });
    }

    bus.emit('workflow', 'completed', {
      workflowId: workflowData.id,
      status: 'completed',
      durationMs: steps.reduce((sum: number, s: any) => sum + (s.durationMs || 0), 0),
      stepsCompleted: steps.length,
      stepsFailed: 0,
    }, { source: workflowData.id, correlationId });

    const run = {
      id: runId,
      workflowId: workflowData.id,
      status: 'completed',
      startedAt: new Date(Date.now() - steps.reduce((sum: number, s: any) => sum + (s.durationMs || 0), 0)).toISOString(),
      finishedAt: new Date().toISOString(),
      steps,
    };

    const allRuns = await storage.readJSON<unknown[]>('execution-runs', []);
    await storage.writeJSON('execution-runs', appendCapped(allRuns, run, 200));

    ok(res, { success: true, run });
  } catch (err) { fail(res, err); }
});

export default router;
