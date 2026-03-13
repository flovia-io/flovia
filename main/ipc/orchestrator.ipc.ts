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
import { chatCompleteStream } from '../ai';

// ── Developer Agent Tools (Anthropic tool_use format) ──────────────────────

const DEVELOPER_TOOLS = [
  {
    name: 'read_file',
    description: 'Read the contents of a file in the workspace',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to workspace root' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file (creates or overwrites)',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to workspace root' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a directory',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Directory path relative to workspace root (defaults to ".")' },
      },
      required: [],
    },
  },
  {
    name: 'search_text',
    description: 'Search for text across workspace files using grep',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Text or regex pattern to search for' },
        path: { type: 'string', description: 'Directory to search in (defaults to workspace root)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'run_command',
    description: 'Run a shell command in the workspace directory',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        cwd: { type: 'string', description: 'Working directory (defaults to workspace root)' },
      },
      required: ['command'],
    },
  },
];

// ── Expression Resolver ─────────────────────────────────────────────────────

interface ExprCtx {
  nodeOutputs: Map<string, unknown>;
  triggerInput: unknown;
  currentInput: unknown;
}

function resolveExpr(val: unknown, ctx: ExprCtx): unknown {
  if (typeof val !== 'string') return val;
  return val.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    const parts = expr.trim().split('.');
    if (parts[0] === 'input') {
      const v = ctx.currentInput;
      return v == null ? '' : (typeof v === 'string' ? v : JSON.stringify(v));
    }
    if (parts[0] === 'nodes' && parts.length >= 3) {
      let v: any = ctx.nodeOutputs.get(parts[1]);
      // parts[2] is "output", parts[3+] are nested keys
      for (let i = 3; i < parts.length; i++) {
        if (v != null && typeof v === 'object') v = (v as any)[parts[i]];
      }
      return v == null ? '' : (typeof v === 'string' ? v : JSON.stringify(v));
    }
    return _;
  });
}

function resolveConfig(cfg: Record<string, unknown>, ctx: ExprCtx): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cfg)) {
    resolved[k] = resolveExpr(v, ctx);
  }
  return resolved;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function extractArray(input: unknown, dotPath?: string): unknown[] {
  if (!dotPath) {
    if (Array.isArray(input)) return input;
    if (input != null && typeof input === 'object') {
      for (const val of Object.values(input as Record<string, unknown>)) {
        if (Array.isArray(val)) return val;
      }
    }
    return input != null ? [input] : [];
  }
  const parts = dotPath.split('.');
  let val: any = input;
  for (const part of parts) {
    if (val != null && typeof val === 'object') val = val[part];
  }
  return Array.isArray(val) ? val : (val != null ? [val] : []);
}

// ── Main IPC Registration ────────────────────────────────────────────────────

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

  /** Broadcast a raw event object to all renderer windows */
  function broadcast(event: Record<string, unknown>): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('orchestrator-event', event);
      }
    }
  }

  /** Broadcast a live output chunk for a specific step */
  function broadcastChunk(stepId: string, chunk: string, accumulated: string): void {
    broadcast({ category: 'step', type: 'chunk', data: { stepId, chunk, accumulated } });
  }

  // ── Core workflow execution (extracted for subWorkflow reuse) ──

  async function executeWorkflowInline(
    workflowData: {
      id: string;
      name: string;
      nodes: unknown[];
      edges: unknown[];
      triggerInput?: unknown;
      workspacePath?: string;
    },
    correlationId: string,
  ): Promise<{ success: boolean; steps: any[]; output: unknown }> {
    const registry = (await import('@flovia/connectors')).getConnectorRegistry();
    const aiSettings = await storage.readJSON<{ baseUrl?: string; apiKey?: string; selectedModel?: string }>('ai-settings', {});
    const baseUrl = aiSettings.baseUrl || 'anthropic';
    const apiKey = aiSettings.apiKey || '';
    const model = aiSettings.selectedModel || 'claude-haiku-4-20250514';
    const workspacePath = workflowData.workspacePath || process.cwd();

    const nodes = workflowData.nodes as any[];
    const edges = workflowData.edges as any[];

    // Build adjacency maps from edges
    const adjacency = new Map<string, string[]>();
    const reverseAdj = new Map<string, string[]>();
    for (const edge of edges) {
      const fwd = adjacency.get(edge.source) || [];
      fwd.push(edge.target);
      adjacency.set(edge.source, fwd);
      const rev = reverseAdj.get(edge.target) || [];
      rev.push(edge.source);
      reverseAdj.set(edge.target, rev);
    }

    // Topological sort (BFS / Kahn's algorithm)
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
    const nodeOutputs = new Map<string, unknown>();
    const steps: any[] = [];
    let failed = false;
    let lastOutput: unknown = undefined;

    // Pre-populate trigger node outputs
    if (workflowData.triggerInput != null) {
      for (const node of nodes) {
        if (node.data?.nodeType === 'trigger') {
          nodeOutputs.set(node.id, workflowData.triggerInput);
        }
      }
    }

    function getNodeInput(nodeId: string): unknown {
      const parents = reverseAdj.get(nodeId) || [];
      if (parents.length === 0) return workflowData.triggerInput ?? undefined;
      if (parents.length === 1) return nodeOutputs.get(parents[0]);
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

      // Resolve expressions in config
      const resolvedCfg = resolveConfig(cfg, {
        nodeOutputs,
        triggerInput: workflowData.triggerInput,
        currentInput: input,
      });

      bus.emit('step', 'started', {
        workflowId: workflowData.id,
        stepId: node.id,
        stepLabel: node.data?.label || node.id,
        stepKind: nodeType,
        dependsOn: reverseAdj.get(nodeId) || [],
      }, { source: workflowData.id, correlationId });

      broadcast({
        category: 'step',
        action: 'started',
        data: { stepId: node.id, status: 'running' },
      });

      let output: unknown = undefined;
      let error: string | undefined;
      let itemCount: number | undefined;

      try {
        switch (nodeType) {
          // ── Trigger ──────────────────────────────────────────────────────
          case 'trigger': {
            output = workflowData.triggerInput ?? {
              triggered: true,
              type: resolvedCfg.triggerType || 'manual',
              timestamp: new Date().toISOString(),
            };
            break;
          }

          // ── Connector Action ──────────────────────────────────────────────
          case 'action': {
            const connectorId = resolvedCfg.connectorId as string;
            const actionId = resolvedCfg.actionId as string;
            if (!connectorId || !actionId) {
              throw new Error('Action node missing connectorId or actionId');
            }
            const params: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(resolvedCfg)) {
              if (k !== 'connectorId' && k !== 'actionId' && v !== '' && v != null) {
                params[k] = v;
              }
            }
            if (input != null && Object.keys(params).length === 0 && typeof input === 'object') {
              Object.assign(params, input);
            }
            const result = await registry.executeAction(connectorId, actionId, params);
            if (!result.success) throw new Error(result.error || 'Connector action failed');
            output = result.data;
            break;
          }

          // ── HTTP Request ──────────────────────────────────────────────────
          case 'httpRequest': {
            const method = (resolvedCfg.method as string) || 'GET';
            const url = resolvedCfg.url as string;
            if (!url) throw new Error('HTTP Request node missing URL');
            const res = await (globalThis as any).fetch(url, { method });
            const body = await res.text();
            try { output = JSON.parse(body); } catch { output = body; }
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
            break;
          }

          // ── LLM (with real streaming) ─────────────────────────────────────
          case 'llm': {
            const prompt = (resolvedCfg.prompt as string) || '';
            const systemPrompt = (resolvedCfg.systemPrompt as string) || '';
            const inputContext = input != null
              ? (typeof input === 'string' ? input : JSON.stringify(input, null, 2))
              : '';

            const userMessage = inputContext
              ? `${prompt}\n\n<context>\n${inputContext}\n</context>`
              : prompt;

            const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];
            if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
            messages.push({ role: 'user', content: userMessage || 'Hello' });

            let accumulated = '';
            const fullReply = await chatCompleteStream(
              baseUrl,
              apiKey,
              model,
              messages,
              (chunk) => {
                accumulated += chunk;
                broadcastChunk(node.id, chunk, accumulated);
              },
            );

            output = { text: fullReply || accumulated };
            break;
          }

          // ── Decision / Branch ─────────────────────────────────────────────
          case 'decision': {
            const condition = (resolvedCfg.condition as string) || '';
            const inputStr = JSON.stringify(input || {});
            const match = inputStr.toLowerCase().includes(condition.toLowerCase());
            output = { branch: match ? 'true' : 'false', condition, matched: match };
            break;
          }

          // ── Transform ────────────────────────────────────────────────────
          case 'transform': {
            const expression = (resolvedCfg.expression as string) || '';
            if (input != null && expression) {
              try {
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

          // ── Delay ─────────────────────────────────────────────────────────
          case 'delay': {
            const delayMs = (resolvedCfg.delayMs as number) || 1000;
            await new Promise<void>(resolve => {
              const t = Number(delayMs);
              (globalThis as any).setTimeout(resolve, t);
            });
            output = { delayed: delayMs, input };
            break;
          }

          // ── Human Input ───────────────────────────────────────────────────
          case 'human': {
            output = { message: resolvedCfg.message || 'Human approval step', status: 'auto-approved', input };
            break;
          }

          // ── Output ────────────────────────────────────────────────────────
          case 'output': {
            output = { outputType: resolvedCfg.outputType || 'message', data: input };
            break;
          }

          // ── Split Out ─────────────────────────────────────────────────────
          case 'splitOut': {
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

          // ── Code Runner ───────────────────────────────────────────────────
          case 'codeRunner': {
            const lang = (resolvedCfg.language as string) || 'shell';
            const code = (resolvedCfg.code as string) || '';
            const cwd = (resolvedCfg.cwd as string) || workspacePath;
            const timeoutMs = (resolvedCfg.timeout as number) || 30000;

            if (!code.trim()) throw new Error('Code Runner node has no code to execute');

            const { spawn } = await import('child_process');
            const fs = await import('fs');
            const path = await import('path');
            const os = await import('os');

            let command: string;
            let args: string[] = [];
            let tmpFile: string | null = null;

            if (lang === 'javascript') {
              tmpFile = path.join(os.tmpdir(), `wf-code-${Date.now()}.mjs`);
              fs.writeFileSync(tmpFile, code, 'utf-8');
              command = 'node';
              args = [tmpFile];
            } else if (lang === 'python') {
              tmpFile = path.join(os.tmpdir(), `wf-code-${Date.now()}.py`);
              fs.writeFileSync(tmpFile, code, 'utf-8');
              command = 'python3';
              args = [tmpFile];
            } else {
              // shell: run via sh -c
              command = 'sh';
              args = ['-c', code];
            }

            let stdout = '';
            let stderr = '';
            let accumulated = '';

            await new Promise<void>((resolve, reject) => {
              const proc = spawn(command, args, {
                cwd,
                timeout: timeoutMs,
                env: { ...process.env },
              });

              proc.stdout?.on('data', (data: Buffer) => {
                const chunk = data.toString();
                stdout += chunk;
                accumulated += chunk;
                broadcastChunk(node.id, chunk, accumulated);
              });

              proc.stderr?.on('data', (data: Buffer) => {
                const chunk = data.toString();
                stderr += chunk;
                accumulated += chunk;
                broadcastChunk(node.id, chunk, accumulated);
              });

              proc.on('close', (exitCode: number | null) => {
                if (tmpFile) {
                  try { fs.unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
                }
                if ((exitCode ?? 0) !== 0) {
                  reject(new Error(`Exit code ${exitCode}: ${stderr.slice(0, 500)}`));
                } else {
                  resolve();
                }
              });

              proc.on('error', reject);
            });

            output = { stdout, stderr, exitCode: 0 };
            break;
          }

          // ── Sub-Workflow ──────────────────────────────────────────────────
          case 'subWorkflow': {
            const subWorkflowId = resolvedCfg.workflowId as string;
            if (!subWorkflowId) throw new Error('Sub-Workflow node missing workflowId');

            const allWfs = await storage.readJSON<Array<{ id: string; name?: string; nodes?: unknown[]; edges?: unknown[] }>>('editor-workflows', []);
            const subWf = allWfs.find(w => w.id === subWorkflowId);
            if (!subWf) throw new Error(`Sub-workflow "${subWorkflowId}" not found`);

            const triggerInputForSub = resolvedCfg.triggerInput != null
              ? resolvedCfg.triggerInput
              : input;

            const nestedCorrelationId = `${correlationId}:sub:${node.id}`;

            broadcastChunk(node.id, `[Sub-Workflow] Starting "${subWf.name || subWorkflowId}"...\n`, `[Sub-Workflow] Starting...`);

            const subResult = await executeWorkflowInline(
              {
                id: subWf.id,
                name: subWf.name || subWorkflowId,
                nodes: subWf.nodes || [],
                edges: subWf.edges || [],
                triggerInput: triggerInputForSub,
                workspacePath,
              },
              nestedCorrelationId,
            );

            output = subResult.output ?? { subWorkflowCompleted: true, success: subResult.success };
            if (!subResult.success) throw new Error('Sub-workflow failed');
            break;
          }

          // ── Batch AI ──────────────────────────────────────────────────────
          case 'batchProcessor': {
            const promptTemplate = (resolvedCfg.prompt as string) || '{{item}}';
            const systemPrompt = (resolvedCfg.systemPrompt as string) || '';
            const concurrency = Math.max(1, Math.min(10, (resolvedCfg.concurrency as number) || 3));
            const inputPath = resolvedCfg.inputPath as string | undefined;

            const items = extractArray(input, inputPath);
            if (items.length === 0) {
              output = { results: [], total: 0, processed: 0 };
              break;
            }

            const results: unknown[] = new Array(items.length).fill(null);
            let processed = 0;
            let accumulatedProgress = '';

            // Process in batches of `concurrency`
            for (let i = 0; i < items.length; i += concurrency) {
              const batch = items.slice(i, i + concurrency);
              await Promise.all(batch.map(async (item, batchIdx) => {
                const idx = i + batchIdx;
                const itemStr = typeof item === 'string' ? item : JSON.stringify(item);

                const itemPrompt = promptTemplate
                  .replace(/\{\{item\}\}/g, itemStr)
                  .replace(/\{\{index\}\}/g, String(idx));

                const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];
                if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
                messages.push({ role: 'user', content: itemPrompt });

                const reply = await chatCompleteStream(baseUrl, apiKey, model, messages, () => {});
                results[idx] = { item, result: reply, index: idx };

                processed++;
                const progressLine = `[${processed}/${items.length}] Item ${idx} processed\n`;
                accumulatedProgress += progressLine;
                broadcastChunk(node.id, progressLine, accumulatedProgress);
              }));
            }

            output = { results, total: items.length, processed };
            break;
          }

          // ── Developer Agent ───────────────────────────────────────────────
          case 'developer': {
            const Anthropic = (await import('@anthropic-ai/sdk')).default;

            const userRequest = typeof input === 'object' && input !== null
              ? (input as any).message || (input as any).text || JSON.stringify(input)
              : String(input || resolvedCfg.prompt || 'Help with this task');

            const systemPrompt = (resolvedCfg.systemPrompt as string)
              || `You are an expert developer agent with access to workspace tools.
Workspace root: ${workspacePath}
Think step by step, use tools to explore and modify files, then provide a clear summary of what you did.`;

            const client = new Anthropic({ apiKey });
            const messages: any[] = [{ role: 'user', content: userRequest }];
            const traceLines: string[] = [];
            const filesChanged: string[] = [];
            const maxIterations = (resolvedCfg.maxIterations as number) || 10;

            let accumulated = '';
            let finalReply = '';

            for (let iter = 0; iter < maxIterations; iter++) {
              const response = await client.messages.create({
                model,
                max_tokens: 8192,
                system: systemPrompt,
                tools: DEVELOPER_TOOLS as any,
                messages,
              });

              // Stream text content
              for (const block of response.content) {
                if (block.type === 'text') {
                  finalReply += block.text;
                  accumulated += block.text;
                  broadcastChunk(node.id, block.text, accumulated);
                }
              }

              // Check stop reason
              if (response.stop_reason === 'end_turn' || !response.content.some(b => b.type === 'tool_use')) {
                break;
              }

              messages.push({ role: 'assistant', content: response.content });

              // Execute tool calls
              const toolResults: any[] = [];
              for (const block of response.content) {
                if (block.type !== 'tool_use') continue;

                const traceLine = `[Tool] ${block.name}(${JSON.stringify(block.input)})\n`;
                traceLines.push(traceLine.trim());
                accumulated += traceLine;
                broadcastChunk(node.id, traceLine, accumulated);

                let toolResult: unknown;
                try {
                  const inp = block.input as any;
                  switch (block.name) {
                    case 'read_file': {
                      const fs = await import('fs');
                      const path = await import('path');
                      const fullPath = path.isAbsolute(inp.path)
                        ? inp.path
                        : path.join(workspacePath, inp.path);
                      toolResult = fs.readFileSync(fullPath, 'utf-8');
                      break;
                    }
                    case 'write_file': {
                      const fs = await import('fs');
                      const path = await import('path');
                      const fullPath = path.isAbsolute(inp.path)
                        ? inp.path
                        : path.join(workspacePath, inp.path);
                      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                      fs.writeFileSync(fullPath, inp.content, 'utf-8');
                      if (!filesChanged.includes(inp.path)) filesChanged.push(inp.path);
                      toolResult = `File written: ${inp.path}`;
                      break;
                    }
                    case 'list_files': {
                      const fs = await import('fs');
                      const path = await import('path');
                      const dir = inp.path
                        ? (path.isAbsolute(inp.path) ? inp.path : path.join(workspacePath, inp.path))
                        : workspacePath;
                      const entries = fs.readdirSync(dir, { withFileTypes: true });
                      toolResult = entries.map((e: any) => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`).join('\n');
                      break;
                    }
                    case 'search_text': {
                      const { exec } = await import('child_process');
                      const { promisify } = await import('util');
                      const path = await import('path');
                      const execAsync = promisify(exec);
                      const searchDir = inp.path
                        ? (inp.path.startsWith('/') ? inp.path : path.join(workspacePath, inp.path))
                        : workspacePath;
                      try {
                        const { stdout } = await execAsync(
                          `grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" -l "${inp.query.replace(/"/g, '\\"')}" "${searchDir}"`,
                          { timeout: 10000 }
                        );
                        toolResult = stdout.trim() || '(no matches)';
                      } catch {
                        toolResult = '(no matches)';
                      }
                      break;
                    }
                    case 'run_command': {
                      const { exec } = await import('child_process');
                      const { promisify } = await import('util');
                      const path = await import('path');
                      const execAsync = promisify(exec);
                      const cwd = inp.cwd
                        ? (path.isAbsolute(inp.cwd) ? inp.cwd : path.join(workspacePath, inp.cwd))
                        : workspacePath;
                      const { stdout, stderr } = await execAsync(inp.command, { cwd, timeout: 30000 });
                      toolResult = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
                      break;
                    }
                    default:
                      toolResult = `Unknown tool: ${block.name}`;
                  }
                } catch (err: any) {
                  toolResult = `Error: ${err.message}`;
                }

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
                });
              }

              messages.push({ role: 'user', content: toolResults });
            }

            output = {
              reply: finalReply,
              iterations: messages.filter((m: any) => m.role === 'assistant').length,
              trace: traceLines,
              filesChanged,
            };
            break;
          }

          // ── Default / Parallel / Loop ─────────────────────────────────────
          default: {
            output = { message: `${nodeType} step completed`, input };
            break;
          }
        }

        itemCount = countItems(output);
        nodeOutputs.set(nodeId, output);
        lastOutput = output;

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

        broadcast({
          category: 'step',
          action: 'completed',
          data: { stepId: node.id, status: 'completed', itemCount, durationMs: stepDuration, output },
        });

        steps.push({
          nodeId: node.id,
          label: node.data?.label || node.id,
          status: 'completed',
          durationMs: stepDuration,
          itemCount,
          input: input != null ? input : undefined,
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

        broadcast({
          category: 'step',
          action: 'failed',
          data: { stepId: node.id, status: 'failed', error },
        });

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

    return { success: !failed, steps, output: lastOutput };
  }

  // ── Agent Profiles ──────────────────────────────────────────────────────

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

  // ── Workflows ─────────────────────────────────────────────────────────

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

  // ── Execution Runs ────────────────────────────────────────────────────

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

  // ── Visual Workflow Editor ──────────────────────────────────────────────

  ipcMain.handle('orchestrator-save-editor-workflow', async (_event, editorData: unknown, workspacePath?: string) => {
    const all = await storage.readJSON<Array<{ id: string }>>('editor-workflows', []);
    const data = editorData as { id: string };
    await storage.writeJSON('editor-workflows', upsertById(all, data));

    if (workspacePath) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const wfDir = path.join(workspacePath, '.flovia', 'workflows');
        fs.mkdirSync(wfDir, { recursive: true });
        const filePath = path.join(wfDir, `${data.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      } catch (err) {
        console.error('[Orchestrator] Failed to save workflow JSON to workspace:', err);
      }
    }

    return { success: true };
  });

  ipcMain.handle('orchestrator-list-editor-workflows', async (_event, workspacePath?: string) => {
    const stored = await storage.readJSON<unknown[]>('editor-workflows', []);

    if (workspacePath) {
      try {
        const fs = await import('fs');
        const pathMod = await import('path');
        const wfDir = pathMod.join(workspacePath, '.flovia', 'workflows');
        if (fs.existsSync(wfDir)) {
          const files = fs.readdirSync(wfDir).filter((f: string) => f.endsWith('.json'));
          for (const file of files) {
            try {
              const raw = JSON.parse(fs.readFileSync(pathMod.join(wfDir, file), 'utf-8'));
              if (raw && raw.id && !stored.some((s: any) => s.id === raw.id)) {
                stored.push(raw);
              }
            } catch { /* skip invalid files */ }
          }
        }
      } catch { /* ignore */ }
    }

    return stored;
  });

  ipcMain.handle('orchestrator-delete-editor-workflow', async (_event, workflowId: string) => {
    const all = await storage.readJSON<unknown[]>('editor-workflows', []);
    const filtered = all.filter((w: any) => w.id !== workflowId);
    await storage.writeJSON('editor-workflows', filtered);
    return { success: true };
  });

  // ── Execute Workflow (start a tracked run) ─────────────────────────────

  ipcMain.handle('orchestrator-execute-workflow', async (_event, workflowData: {
    id: string;
    name: string;
    nodes: unknown[];
    edges: unknown[];
    triggerInput?: unknown;
    workspacePath?: string;
  }) => {
    const runId = genId('run');
    const correlationId = runId;

    bus.emit('workflow', 'started', {
      workflowId: workflowData.id,
      workflowName: workflowData.name,
      totalSteps: workflowData.nodes.length,
    }, { source: workflowData.id, correlationId });

    const { success, steps } = await executeWorkflowInline(workflowData, correlationId);
    const failed = !success;
    const totalDuration = steps.reduce((sum: number, s: any) => sum + (s.durationMs || 0), 0);
    const status = failed ? 'failed' : 'completed';

    bus.emit('workflow', status, {
      workflowId: workflowData.id,
      status,
      durationMs: totalDuration,
      stepsCompleted: steps.filter((s: any) => s.status === 'completed').length,
      stepsFailed: steps.filter((s: any) => s.status === 'failed').length,
    }, { source: workflowData.id, correlationId });

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

  // ── Save Run (manual save from renderer) ───────────────────────────────

  ipcMain.handle('orchestrator-save-run', async (_event, run: unknown) => {
    const allRuns = await storage.readJSON<Array<{ id: string }>>('execution-runs', []);
    const data = run as { id: string };
    const updated = upsertById(allRuns, data);
    await storage.writeJSON('execution-runs', updated.length > 200 ? updated.slice(-200) : updated);
    return { success: true };
  });
}
