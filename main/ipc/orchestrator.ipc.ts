/**
 * Orchestrator IPC Handlers
 *
 * Bridges the Orchestrator (agent profiles, workflows) to Electron IPC
 * so the renderer can manage workflows and agent profiles.
 *
 * Also bridges the Event Bus and Execution Run system for real-time
 * step-by-step observability in the UI.
 *
 * Desktop (Electron) only. Cloud mode uses REST endpoints in server/.
 */

import { ipcMain, BrowserWindow } from 'electron';
import type { AgentProfile, Workflow } from '@flovia/core/orchestrator';
import { getStorage } from '@flovia/core/storage';
import { getEventBus, type BusEvent } from '@flovia/core/event-bus';
import type { ExecutionRun } from '@flovia/core/execution-run';
import { genId, upsertById, removeById, appendCapped } from '@flovia/core/utils';

export function registerOrchestratorIpc(): void {
  const storage = getStorage();
  const bus = getEventBus();

  // ── Forward event-bus events to all renderer windows ──
  bus.onAll((event: BusEvent) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('orchestrator-event', event);
      }
    }
  });

  // ── Agent Profiles ──

  ipcMain.handle('orchestrator-list-profiles', async () => {
    return storage.readJSON<AgentProfile[]>('agent-profiles', []);
  });

  ipcMain.handle('orchestrator-save-profile', async (_event, profile: AgentProfile) => {
    const all = await storage.readJSON<AgentProfile[]>('agent-profiles', []);
    await storage.writeJSON('agent-profiles', upsertById(all, profile));
    return { success: true };
  });

  ipcMain.handle('orchestrator-delete-profile', async (_event, profileId: string) => {
    const all = await storage.readJSON<AgentProfile[]>('agent-profiles', []);
    const { list, removed } = removeById(all, profileId);
    if (!removed) return { success: false, error: 'Profile not found' };
    await storage.writeJSON('agent-profiles', list);
    return { success: true };
  });

  // ── Workflows ──

  ipcMain.handle('orchestrator-list-workflows', async () => {
    return storage.readJSON<Workflow[]>('workflows', []);
  });

  ipcMain.handle('orchestrator-save-workflow', async (_event, workflow: Workflow) => {
    const all = await storage.readJSON<Workflow[]>('workflows', []);
    await storage.writeJSON('workflows', upsertById(all, workflow));
    return { success: true };
  });

  ipcMain.handle('orchestrator-delete-workflow', async (_event, workflowId: string) => {
    const all = await storage.readJSON<Workflow[]>('workflows', []);
    const { list, removed } = removeById(all, workflowId);
    if (!removed) return { success: false, error: 'Workflow not found' };
    await storage.writeJSON('workflows', list);
    return { success: true };
  });

  ipcMain.handle('orchestrator-get-workflow', async (_event, workflowId: string) => {
    const all = await storage.readJSON<Workflow[]>('workflows', []);
    return all.find(w => w.id === workflowId) ?? null;
  });

  // ── Execution Runs ──

  ipcMain.handle('orchestrator-list-runs', async () => {
    return storage.readJSON<ExecutionRun[]>('execution-runs', []);
  });

  ipcMain.handle('orchestrator-get-run', async (_event, runId: string) => {
    const all = await storage.readJSON<ExecutionRun[]>('execution-runs', []);
    return all.find(r => r.id === runId) ?? null;
  });

  ipcMain.handle('orchestrator-get-run-events', async (_event, correlationId: string) => {
    return bus.getRunEvents(correlationId);
  });

  ipcMain.handle('orchestrator-get-event-history', async (_event, filter?: Record<string, string>) => {
    return bus.getHistory(filter);
  });

  // ── Visual Workflow Editor (persist editor-specific workflow data) ──

  ipcMain.handle('orchestrator-save-editor-workflow', async (_event, editorData: unknown) => {
    const all = await storage.readJSON<Array<{ id: string }>>('editor-workflows', []);
    const data = editorData as { id: string };
    await storage.writeJSON('editor-workflows', upsertById(all, data));
    return { success: true };
  });

  ipcMain.handle('orchestrator-list-editor-workflows', async () => {
    return storage.readJSON<unknown[]>('editor-workflows', []);
  });

  ipcMain.handle('orchestrator-delete-editor-workflow', async (_event, workflowId: string) => {
    const all = await storage.readJSON<unknown[]>('editor-workflows', []);
    const filtered = all.filter((w: any) => w.id !== workflowId);
    await storage.writeJSON('editor-workflows', filtered);
    return { success: true };
  });

  // ── Execute Workflow (start a tracked run) ──

  ipcMain.handle('orchestrator-execute-workflow', async (_event, workflowData: {
    id: string;
    name: string;
    nodes: unknown[];
    edges: unknown[];
    triggerInput?: unknown;
  }) => {
    const runId = genId('run');
    const correlationId = runId;
    const registry = (await import('@flovia/connectors')).getConnectorRegistry();

    const nodes = workflowData.nodes as any[];
    const edges = workflowData.edges as any[];

    // Build adjacency map from edges (source → targets in order)
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      const list = adjacency.get(edge.source) || [];
      list.push(edge.target);
      adjacency.set(edge.source, list);
    }

    // Build reverse adjacency (who feeds into me)
    const reverseAdj = new Map<string, string[]>();
    for (const edge of edges) {
      const list = reverseAdj.get(edge.target) || [];
      list.push(edge.source);
      reverseAdj.set(edge.target, list);
    }

    // Topological sort following edges (BFS from nodes with no incoming edges)
    const inDegree = new Map<string, number>();
    for (const node of nodes) inDegree.set(node.id, 0);
    for (const edge of edges) {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }
    const executionOrder: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      executionOrder.push(current);
      for (const next of (adjacency.get(current) || [])) {
        const newDeg = (inDegree.get(next) || 1) - 1;
        inDegree.set(next, newDeg);
        if (newDeg === 0) queue.push(next);
      }
    }
    // Add any orphan nodes not reached by edges
    for (const node of nodes) {
      if (!executionOrder.includes(node.id)) executionOrder.push(node.id);
    }

    const nodeMap = new Map(nodes.map((n: any) => [n.id, n]));

    // Emit workflow-started event
    bus.emit('workflow', 'started', {
      workflowId: workflowData.id,
      workflowName: workflowData.name,
      totalSteps: nodes.length,
    }, { source: workflowData.id, correlationId });

    const steps: any[] = [];
    const nodeOutputs = new Map<string, unknown>(); // nodeId → output data
    let failed = false;

    // If there's trigger input, store it
    if (workflowData.triggerInput != null) {
      // Find trigger nodes and set their output
      for (const node of nodes) {
        if (node.data?.nodeType === 'trigger') {
          nodeOutputs.set(node.id, workflowData.triggerInput);
        }
      }
    }

    // Helper to count items in a result
    function countItems(data: unknown): number | undefined {
      if (data == null) return undefined;
      if (Array.isArray(data)) return data.length;
      if (typeof data === 'object') {
        for (const val of Object.values(data as Record<string, unknown>)) {
          if (Array.isArray(val)) return val.length;
        }
      }
      return undefined;
    }

    // Helper to get input for a node (output of parent nodes)
    function getNodeInput(nodeId: string): unknown {
      const parents = reverseAdj.get(nodeId) || [];
      if (parents.length === 0) return workflowData.triggerInput ?? undefined;
      if (parents.length === 1) return nodeOutputs.get(parents[0]);
      // Multiple parents: merge their outputs
      const merged: Record<string, unknown> = {};
      for (const p of parents) {
        const out = nodeOutputs.get(p);
        if (out != null) merged[p] = out;
      }
      return merged;
    }

    for (const nodeId of executionOrder) {
      if (failed) break;

      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const nodeType = node.data?.nodeType || 'unknown';
      const cfg = (node.data?.config || {}) as Record<string, unknown>;
      const stepStart = Date.now();
      const input = getNodeInput(nodeId);

      bus.emit('step', 'started', {
        workflowId: workflowData.id,
        stepId: node.id,
        stepLabel: node.data?.label || node.id,
        stepKind: nodeType,
        dependsOn: reverseAdj.get(nodeId) || [],
      }, { source: workflowData.id, correlationId });

      // Send status update to UI
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('orchestrator-event', {
            category: 'step',
            action: 'started',
            data: { stepId: node.id, status: 'running' },
          });
        }
      }

      let output: unknown = undefined;
      let error: string | undefined;
      let itemCount: number | undefined;

      try {
        switch (nodeType) {
          case 'trigger': {
            // Triggers produce their input as output (passthrough)
            output = workflowData.triggerInput ?? { triggered: true, type: cfg.triggerType || 'manual', timestamp: new Date().toISOString() };
            break;
          }

          case 'action': {
            const connectorId = cfg.connectorId as string;
            const actionId = cfg.actionId as string;
            if (!connectorId || !actionId) {
              throw new Error('Action node missing connectorId or actionId');
            }
            // Collect params (everything except connectorId/actionId)
            const params: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(cfg)) {
              if (k !== 'connectorId' && k !== 'actionId' && v !== '' && v != null) {
                params[k] = v;
              }
            }
            // Inject previous step output as context if params reference it
            if (input != null && Object.keys(params).length === 0) {
              // Auto-pass input if no explicit params
              if (typeof input === 'object' && input !== null) {
                Object.assign(params, input);
              }
            }
            const result = await registry.executeAction(connectorId, actionId, params);
            if (!result.success) throw new Error(result.error || 'Connector action failed');
            output = result.data;
            break;
          }

          case 'httpRequest': {
            const method = (cfg.method as string) || 'GET';
            const url = cfg.url as string;
            if (!url) throw new Error('HTTP Request node missing URL');
            // Use native fetch (Node 18+)
            const res = await (globalThis as any).fetch(url, { method });
            const body = await res.text();
            try { output = JSON.parse(body); } catch { output = body; }
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
            break;
          }

          case 'llm': {
            // Call AI via the existing AI IPC
            const prompt = cfg.prompt as string || '';
            const systemPrompt = cfg.systemPrompt as string || '';
            // Simple: use the LLM to generate a response
            output = { prompt, systemPrompt, note: 'LLM step executed (connect AI provider for real output)' };
            break;
          }

          case 'decision': {
            const condition = cfg.condition as string || '';
            // Simple expression evaluator against input
            const inputStr = JSON.stringify(input || {});
            const match = inputStr.toLowerCase().includes(condition.toLowerCase());
            output = { branch: match ? 'true' : 'false', condition, matched: match };
            break;
          }

          case 'transform': {
            const expression = cfg.expression as string || '';
            // Simple: pass input through, apply basic JSON path
            if (input != null && expression) {
              try {
                // Very basic: if expression looks like a key, extract it
                const parts = expression.split('.');
                let val: any = input;
                for (const part of parts) {
                  if (val != null && typeof val === 'object') val = (val as any)[part];
                }
                output = val ?? input;
              } catch {
                output = input;
              }
            } else {
              output = input;
            }
            break;
          }

          case 'delay': {
            const delayMs = (cfg.delayMs as number) || 1000;
            await new Promise<void>(resolve => { const t = Number(delayMs); const fn = () => resolve(); (globalThis as any).setTimeout(fn, t); });
            output = { delayed: delayMs, input };
            break;
          }

          case 'human': {
            output = { message: cfg.message || 'Human approval step', status: 'auto-approved', input };
            break;
          }

          case 'output': {
            output = { outputType: cfg.outputType || 'message', data: input };
            break;
          }

          case 'splitOut': {
            // Split an array input into individual items
            if (Array.isArray(input)) {
              output = input;
            } else if (input != null && typeof input === 'object') {
              for (const val of Object.values(input as Record<string, unknown>)) {
                if (Array.isArray(val)) { output = val; break; }
              }
            }
            if (output == null) output = [input];
            break;
          }

          default: {
            output = { message: `${nodeType} step completed`, input };
            break;
          }
        }

        itemCount = countItems(output);
        nodeOutputs.set(nodeId, output);

        const stepDuration = Date.now() - stepStart;

        bus.emit('step', 'completed', {
          workflowId: workflowData.id,
          stepId: node.id,
          stepLabel: node.data?.label || node.id,
          stepKind: nodeType,
          status: 'completed',
          durationMs: stepDuration,
          itemCount: itemCount ?? 0,
        }, { source: workflowData.id, correlationId });

        // Send status update to UI
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('orchestrator-event', {
              category: 'step',
              action: 'completed',
              data: { stepId: node.id, status: 'completed', itemCount, durationMs: stepDuration },
            });
          }
        }

        steps.push({
          nodeId: node.id,
          label: node.data?.label || node.id,
          status: 'completed',
          durationMs: stepDuration,
          itemCount,
          input: input != null ? (typeof input === 'string' ? input : JSON.parse(JSON.stringify(input)).toString !== undefined ? input : input) : undefined,
          output: output != null ? output : undefined,
        });

      } catch (err: any) {
        error = err?.message || 'Unknown error';
        const stepDuration = Date.now() - stepStart;

        bus.emit('step', 'failed', {
          workflowId: workflowData.id,
          stepId: node.id,
          stepLabel: node.data?.label || node.id,
          stepKind: nodeType,
          status: 'failed',
          error,
          durationMs: stepDuration,
        }, { source: workflowData.id, correlationId });

        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('orchestrator-event', {
              category: 'step',
              action: 'failed',
              data: { stepId: node.id, status: 'failed', error },
            });
          }
        }

        steps.push({
          nodeId: node.id,
          label: node.data?.label || node.id,
          status: 'failed',
          durationMs: stepDuration,
          error,
          input: input != null ? input : undefined,
        });

        failed = true;
      }
    }

    const totalDuration = steps.reduce((sum: number, s: any) => sum + (s.durationMs || 0), 0);
    const status = failed ? 'failed' : 'completed';

    // Emit workflow completion
    bus.emit('workflow', status, {
      workflowId: workflowData.id,
      status,
      durationMs: totalDuration,
      stepsCompleted: steps.filter((s: any) => s.status === 'completed').length,
      stepsFailed: steps.filter((s: any) => s.status === 'failed').length,
    }, { source: workflowData.id, correlationId });

    // Persist the run
    const run = {
      id: runId,
      workflowId: workflowData.id,
      status,
      startedAt: new Date(Date.now() - totalDuration).toISOString(),
      finishedAt: new Date().toISOString(),
      steps,
    };

    const allRuns = await storage.readJSON<unknown[]>('execution-runs', []);
    await storage.writeJSON('execution-runs', appendCapped(allRuns, run, 200));

    return { success: !failed, run };
  });

  // ── Save Run (manual save from renderer) ──

  ipcMain.handle('orchestrator-save-run', async (_event, run: unknown) => {
    const allRuns = await storage.readJSON<Array<{ id: string }>>('execution-runs', []);
    const data = run as { id: string };
    const updated = upsertById(allRuns, data);
    await storage.writeJSON('execution-runs', updated.length > 200 ? updated.slice(-200) : updated);
    return { success: true };
  });
}
