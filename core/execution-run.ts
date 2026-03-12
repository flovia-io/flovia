/**
 * Execution Run — Wraps the WorkflowEngine with the EventBus for
 * full observability of every step, decision, and artifact.
 *
 * Each "run" is a recorded execution with a unique correlationId.
 * Past runs are stored and can be replayed in the UI.
 */

import type { Workflow, WorkflowStep, Artifact, AgentProfile } from './orchestrator';
import type { WorkflowEngineOptions } from './workflow-engine';
import { WorkflowEngine } from './workflow-engine';
import { getEventBus, type EventBus, type BusEvent } from './event-bus';
import type { OrchestratorStorage } from './orchestrator';

// ─── Run Types ──────────────────────────────────────────────────────────────

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';

export interface ExecutionRun {
  /** Unique run ID */
  id: string;
  /** Which workflow was executed */
  workflowId: string;
  /** Which agent profile was used */
  agentProfileId?: string;
  /** Human-readable label */
  label: string;
  /** Status */
  status: RunStatus;
  /** All events that occurred during this run */
  events: BusEvent[];
  /** Step-by-step log entries (for UI timeline) */
  stepLogs: StepLogEntry[];
  /** When the run started */
  startedAt: string;
  /** When the run finished */
  finishedAt?: string;
  /** Total duration in ms */
  durationMs?: number;
  /** Error if failed */
  error?: string;
  /** Snapshot of the workflow state after run */
  workflowSnapshot?: Workflow;
}

export interface StepLogEntry {
  /** Step ID */
  stepId: string;
  /** Step label */
  label: string;
  /** Step kind */
  kind: string;
  /** Status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  /** Summary text */
  summary: string;
  /** Input data (if any) */
  input?: unknown;
  /** Output data (if any) */
  output?: unknown;
  /** Artifacts produced */
  artifacts: Artifact[];
  /** Duration in ms */
  durationMs?: number;
  /** Error message */
  error?: string;
  /** Timestamp */
  timestamp: string;
  /** Decision branch taken (for decision steps) */
  branch?: string;
}

// ─── Run Manager ────────────────────────────────────────────────────────────

import { genId } from './utils';

export class RunManager {
  private runs: ExecutionRun[] = [];
  private activeRunId: string | null = null;
  private bus: EventBus;
  private storage: OrchestratorStorage;
  private maxRuns: number;

  constructor(opts: {
    bus?: EventBus;
    storage: OrchestratorStorage;
    maxRuns?: number;
  }) {
    this.bus = opts.bus ?? getEventBus();
    this.storage = opts.storage;
    this.maxRuns = opts.maxRuns ?? 100;
  }

  /**
   * Execute a workflow as a tracked run.
   */
  async execute(
    workflow: Workflow,
    engineOpts: Omit<WorkflowEngineOptions, 'onStepUpdate' | 'onArtifact'>,
    profile?: AgentProfile,
  ): Promise<ExecutionRun> {
    const runId = genId();
    const run: ExecutionRun = {
      id: runId,
      workflowId: workflow.id,
      agentProfileId: profile?.id,
      label: `${workflow.name} — Run ${this.runs.length + 1}`,
      status: 'running',
      events: [],
      stepLogs: workflow.steps.map(s => ({
        stepId: s.id,
        label: s.label,
        kind: s.config.kind,
        status: 'pending',
        summary: s.description || s.label,
        artifacts: [],
        timestamp: new Date().toISOString(),
      })),
      startedAt: new Date().toISOString(),
    };

    this.runs.unshift(run);
    this.activeRunId = runId;

    // Trim old runs
    if (this.runs.length > this.maxRuns) {
      this.runs = this.runs.slice(0, this.maxRuns);
    }

    // Track events for this run
    const unsub = this.bus.onAll((event) => {
      if (event.correlationId === runId) {
        run.events.push(event);
      }
    });

    // Emit run started
    this.bus.emit('workflow', 'run-started', {
      runId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      totalSteps: workflow.steps.length,
      agentProfileId: profile?.id,
    }, { source: runId, correlationId: runId });

    // Create engine with event-emitting callbacks
    const engine = new WorkflowEngine({
      ...engineOpts,
      onStepUpdate: (wf, step) => {
        // Update step log
        const logEntry = run.stepLogs.find(l => l.stepId === step.id);
        if (logEntry) {
          logEntry.status = step.status;
          logEntry.error = step.error;
          logEntry.durationMs = step.startedAt && step.completedAt
            ? new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()
            : undefined;
          logEntry.artifacts = [...step.artifacts];
        }

        // Emit step event
        this.bus.emit('step', `step-${step.status}`, {
          runId,
          workflowId: wf.id,
          stepId: step.id,
          stepLabel: step.label,
          stepKind: step.config.kind,
          status: step.status,
          durationMs: logEntry?.durationMs,
          error: step.error,
        }, { source: runId, correlationId: runId });
      },
      onArtifact: (wf, artifact) => {
        // Update step log with artifact
        const logEntry = run.stepLogs.find(l => l.stepId === artifact.stepId);
        if (logEntry) {
          logEntry.artifacts.push(artifact);
          if (artifact.kind === 'message' || artifact.kind === 'json') {
            logEntry.output = artifact.data;
          }
        }

        // Emit artifact event
        this.bus.emit('trace', 'artifact-produced', {
          runId,
          workflowId: wf.id,
          stepId: artifact.stepId,
          artifactId: artifact.id,
          artifactKind: artifact.kind,
          artifactLabel: artifact.label,
        }, { source: runId, correlationId: runId });
      },
    });

    try {
      const result = await engine.run(workflow);
      run.status = result.status === 'completed' ? 'completed' : result.status === 'failed' ? 'failed' : 'paused';
      run.workflowSnapshot = result;
    } catch (err) {
      run.status = 'failed';
      run.error = (err as Error).message;
    } finally {
      run.finishedAt = new Date().toISOString();
      run.durationMs = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
      unsub();

      // Emit run completed
      this.bus.emit('workflow', 'run-completed', {
        runId,
        workflowId: workflow.id,
        status: run.status,
        durationMs: run.durationMs,
        stepsCompleted: run.stepLogs.filter(l => l.status === 'completed').length,
        stepsFailed: run.stepLogs.filter(l => l.status === 'failed').length,
      }, { source: runId, correlationId: runId });

      // Persist run data
      await this.persistRuns();
    }

    return run;
  }

  /** Get all runs */
  getRuns(): ExecutionRun[] {
    return this.runs;
  }

  /** Get a specific run */
  getRun(runId: string): ExecutionRun | undefined {
    return this.runs.find(r => r.id === runId);
  }

  /** Get active run */
  getActiveRun(): ExecutionRun | undefined {
    return this.activeRunId ? this.runs.find(r => r.id === this.activeRunId) : undefined;
  }

  /** Get runs for a specific workflow */
  getRunsForWorkflow(workflowId: string): ExecutionRun[] {
    return this.runs.filter(r => r.workflowId === workflowId);
  }

  /** Cancel the active run (best-effort) */
  cancelActiveRun(): void {
    const run = this.getActiveRun();
    if (run && run.status === 'running') {
      run.status = 'cancelled';
      run.finishedAt = new Date().toISOString();
      run.durationMs = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
      this.bus.emit('workflow', 'run-cancelled', { runId: run.id }, {
        source: run.id,
        correlationId: run.id,
      });
    }
  }

  /** Load persisted runs */
  async loadRuns(): Promise<void> {
    try {
      const saved = await this.storage.loadWorkflows();
      // Runs are stored separately from workflows
      // Use generic storage for run data
    } catch { /* ignore load errors */ }
  }

  /** Persist runs to storage */
  private async persistRuns(): Promise<void> {
    // We store runs as a separate JSON blob via the storage port
    // Only persist the last N runs to avoid unbounded growth
    try {
      const serializable = this.runs.slice(0, 50).map(r => ({
        ...r,
        // Don't persist full event arrays (too large) — keep step logs
        events: [],
      }));
      // Use the generic writeJSON on the underlying storage
      const storage = this.storage as any;
      if (typeof storage.writeJSON === 'function') {
        await storage.writeJSON('execution-runs', serializable);
      }
    } catch { /* ignore persist errors */ }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _manager: RunManager | null = null;

export function getRunManager(storage: OrchestratorStorage): RunManager {
  if (!_manager) {
    _manager = new RunManager({ storage });
  }
  return _manager;
}

export function resetRunManager(): void {
  _manager = null;
}
