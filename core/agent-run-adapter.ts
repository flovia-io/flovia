/**
 * Agent Run Adapter — Normalizes agent traces (from the AgentExecutionContext)
 * into the unified RunLog / RunStep shape used by the workflow execution UI.
 *
 * This lets the AI Debug panel reuse the exact same execution view components
 * as the workflow editor, while keeping agent-specific metadata accessible.
 *
 * Lives in core/ because it is pure data transformation with no UI dependency.
 */

// ─── Canonical Execution Types (mirrors renderer/workflow.types RunLog/RunStep) ────

export type UnifiedRunStatus = 'running' | 'completed' | 'failed';

export interface UnifiedRunStep {
  /** Original step ID */
  nodeId: string;
  /** Display label */
  label: string;
  /** Status normalized to workflow vocabulary */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  /** Duration in ms */
  durationMs?: number;
  /** Number of items produced (for counts badge) */
  itemCount?: number;
  /** Input payload */
  input?: unknown;
  /** Output payload */
  output?: unknown;
  /** Error message */
  error?: string;
  /** Phase category (agent-specific — for color coding) */
  category?: string;
  /** Step type (llm-call, tool-call, etc.) */
  type?: string;
  /** Token usage (agent-specific) */
  tokens?: { prompt: number; completion: number; total: number };
  /** Timestamp */
  timestamp?: string;
}

export interface UnifiedRun {
  /** Run / trace ID */
  id: string;
  /** Source identifier — workflow ID or agent:${agentId} */
  sourceId: string;
  /** Human-readable label */
  label: string;
  /** Status */
  status: UnifiedRunStatus;
  /** When the run started */
  startedAt: string;
  /** When the run finished */
  finishedAt?: string;
  /** Total duration in ms */
  durationMs?: number;
  /** Ordered steps */
  steps: UnifiedRunStep[];
  /** Original user request (agent runs only) */
  userRequest?: string;
  /** Error message */
  error?: string;
}

// ─── Agent Trace Types (subset — avoids importing renderer types into core) ──

export interface AgentTraceInput {
  id: string;
  agentId: string;
  agentName: string;
  userRequest: string;
  steps: AgentTraceStepInput[];
  status: 'running' | 'success' | 'error';
  totalDurationMs?: number;
  startedAt: string;
  finishedAt?: string;
}

export interface AgentTraceStepInput {
  id: string;
  nodeId: string;
  nodeLabel: string;
  category: string;
  type: string;
  summary: string;
  input?: unknown;
  output?: unknown;
  chosenFiles?: string[];
  tokens?: { prompt: number; completion: number; total: number };
  durationMs?: number;
  status: 'running' | 'success' | 'error' | 'skipped';
  error?: string;
  timestamp: string;
}

// ─── Conversion Functions ──────────────────────────────────────────────────

/**
 * Convert an agent trace step status to the unified step status vocabulary.
 */
function normalizeStepStatus(status: string): UnifiedRunStep['status'] {
  switch (status) {
    case 'success':   return 'completed';
    case 'error':     return 'failed';
    case 'running':   return 'running';
    case 'skipped':   return 'skipped';
    default:          return 'pending';
  }
}

/**
 * Convert an agent trace status to the unified run status vocabulary.
 */
function normalizeRunStatus(status: string): UnifiedRunStatus {
  switch (status) {
    case 'success':   return 'completed';
    case 'error':     return 'failed';
    case 'running':   return 'running';
    default:          return 'running';
  }
}

/**
 * Convert a single agent trace step into a UnifiedRunStep.
 */
export function agentStepToUnified(step: AgentTraceStepInput): UnifiedRunStep {
  return {
    nodeId: step.id,
    label: step.nodeLabel,
    status: normalizeStepStatus(step.status),
    durationMs: step.durationMs,
    input: step.input,
    output: step.output,
    error: step.error,
    category: step.category,
    type: step.type,
    tokens: step.tokens,
    timestamp: step.timestamp,
  };
}

/**
 * Convert a full agent trace into a UnifiedRun.
 */
export function agentTraceToUnifiedRun(trace: AgentTraceInput): UnifiedRun {
  return {
    id: trace.id,
    sourceId: `agent:${trace.agentId}`,
    label: `${trace.agentName} — ${trace.userRequest.length > 50 ? trace.userRequest.slice(0, 50) + '…' : trace.userRequest}`,
    status: normalizeRunStatus(trace.status),
    startedAt: trace.startedAt,
    finishedAt: trace.finishedAt,
    durationMs: trace.totalDurationMs,
    steps: trace.steps.map(agentStepToUnified),
    userRequest: trace.userRequest,
  };
}

/**
 * Convert an array of agent traces into an array of UnifiedRuns (newest first).
 */
export function agentTracesToUnifiedRuns(traces: AgentTraceInput[]): UnifiedRun[] {
  return traces.map(agentTraceToUnifiedRun);
}
