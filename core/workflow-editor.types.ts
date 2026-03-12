/**
 * Workflow Editor Types — Shared between core and renderer.
 *
 * These types define the visual workflow editor model (ReactFlow nodes/edges)
 * that map to the core Workflow/Step domain model.
 */

// ─── Visual Node Types ──────────────────────────────────────────────────────

export type WorkflowNodeType =
  | 'trigger'       // Entry point — webhook, schedule, manual, event
  | 'action'        // Execute a connector action or tool call
  | 'llm'           // Make an LLM call
  | 'decision'      // If/switch branching node
  | 'transform'     // Data transformation / mapping
  | 'human'         // Human approval / input gate
  | 'output'        // Terminal node — send result, write file, etc.
  | 'parallel'      // Fan-out into parallel branches
  | 'loop'          // Iterate over items
  | 'delay';        // Wait/sleep node

export type TriggerType = 'manual' | 'schedule' | 'webhook' | 'event' | 'on-chat' | 'on-commit';

export interface WorkflowEditorNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  description?: string;
  /** Icon identifier or emoji */
  icon?: string;
  /** Position on the canvas */
  position: { x: number; y: number };
  /** Whether the node is enabled */
  enabled: boolean;
  /** Node-specific configuration */
  config: WorkflowNodeConfig;
  /** Visual styling */
  style?: {
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
  };
}

export type WorkflowNodeConfig =
  | TriggerNodeConfig
  | ActionNodeConfig
  | LlmNodeConfig
  | DecisionNodeConfig
  | TransformNodeConfig
  | HumanNodeConfig
  | OutputNodeConfig
  | ParallelNodeConfig
  | LoopNodeConfig
  | DelayNodeConfig;

export interface TriggerNodeConfig {
  type: 'trigger';
  triggerType: TriggerType;
  /** Cron expression for schedule triggers */
  schedule?: string;
  /** Webhook path for webhook triggers */
  webhookPath?: string;
  /** Event name for event triggers */
  eventName?: string;
}

export interface ActionNodeConfig {
  type: 'action';
  connectorId: string;
  actionId: string;
  params?: Record<string, unknown>;
  /** Retry count */
  retries?: number;
  /** Timeout in ms */
  timeout?: number;
}

export interface LlmNodeConfig {
  type: 'llm';
  prompt: string;
  /** Agent profile to use */
  agentProfileId?: string;
  /** Whether to stream */
  stream?: boolean;
  /** System prompt override */
  systemPrompt?: string;
}

export interface DecisionNodeConfig {
  type: 'decision';
  /** 'if' for two branches, 'switch' for multiple */
  mode: 'if' | 'switch';
  /** Condition expression or LLM prompt */
  condition: string;
  /** Whether condition is evaluated by LLM or as JS expression */
  evaluator: 'llm' | 'expression';
  /** Branch definitions: key = branch label, value = target node ID */
  branches: Record<string, string>;
  /** Default branch if no condition matches */
  defaultBranch?: string;
}

export interface TransformNodeConfig {
  type: 'transform';
  /** Transform expression (JS/jq-like) */
  expression: string;
  /** Input mapping from previous nodes */
  inputMapping?: Record<string, string>;
}

export interface HumanNodeConfig {
  type: 'human';
  message: string;
  options?: string[];
  /** Timeout before auto-approve (0 = wait forever) */
  timeoutMs?: number;
}

export interface OutputNodeConfig {
  type: 'output';
  outputType: 'message' | 'file' | 'api-call' | 'notification';
  config?: Record<string, unknown>;
}

export interface ParallelNodeConfig {
  type: 'parallel';
  /** Branch node IDs to execute in parallel */
  branches: string[];
  /** Whether to wait for all branches or just one */
  waitMode: 'all' | 'any';
}

export interface LoopNodeConfig {
  type: 'loop';
  /** Expression to iterate over */
  iterable: string;
  /** Node ID of the loop body */
  bodyNodeId: string;
  /** Max iterations */
  maxIterations?: number;
}

export interface DelayNodeConfig {
  type: 'delay';
  /** Delay in ms */
  delayMs: number;
}

// ─── Visual Edge ────────────────────────────────────────────────────────────

export interface WorkflowEditorEdge {
  id: string;
  source: string;
  target: string;
  /** Edge label (for decision branches) */
  label?: string;
  /** Whether this is the "else" / default branch */
  isDefault?: boolean;
  /** Animation for active edges */
  animated?: boolean;
  /** Visual style */
  style?: Record<string, unknown>;
}

// ─── Workflow Template ──────────────────────────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  nodes: WorkflowEditorNode[];
  edges: WorkflowEditorEdge[];
}

// ─── Node Palette Item (for the add-node panel) ─────────────────────────────

export interface NodePaletteItem {
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: string;
  color: string;
  defaultConfig: WorkflowNodeConfig;
}

/** All available node types for the palette */
export const NODE_PALETTE: NodePaletteItem[] = [
  {
    type: 'trigger',
    label: 'Trigger',
    description: 'Start the workflow (manual, schedule, webhook, event)',
    icon: '⚡',
    color: '#f59e0b',
    defaultConfig: { type: 'trigger', triggerType: 'manual' },
  },
  {
    type: 'action',
    label: 'Action',
    description: 'Execute a connector action (GitHub, Jira, Supabase, etc.)',
    icon: '🔧',
    color: '#3b82f6',
    defaultConfig: { type: 'action', connectorId: '', actionId: '' },
  },
  {
    type: 'llm',
    label: 'AI / LLM',
    description: 'Make an AI call with a prompt',
    icon: '🤖',
    color: '#8b5cf6',
    defaultConfig: { type: 'llm', prompt: '', stream: false },
  },
  {
    type: 'decision',
    label: 'Decision',
    description: 'If/switch branching based on condition or AI classification',
    icon: '🔀',
    color: '#ef4444',
    defaultConfig: { type: 'decision', mode: 'if', condition: '', evaluator: 'expression', branches: { 'true': '', 'false': '' } },
  },
  {
    type: 'transform',
    label: 'Transform',
    description: 'Reshape or extract data between steps',
    icon: '🔄',
    color: '#06b6d4',
    defaultConfig: { type: 'transform', expression: '' },
  },
  {
    type: 'human',
    label: 'Human Input',
    description: 'Pause and wait for user approval or input',
    icon: '👤',
    color: '#10b981',
    defaultConfig: { type: 'human', message: 'Please approve this step' },
  },
  {
    type: 'output',
    label: 'Output',
    description: 'Send a result, write a file, or send a notification',
    icon: '📤',
    color: '#64748b',
    defaultConfig: { type: 'output', outputType: 'message' },
  },
  {
    type: 'parallel',
    label: 'Parallel',
    description: 'Fan-out into parallel branches',
    icon: '⚙️',
    color: '#0ea5e9',
    defaultConfig: { type: 'parallel', branches: [], waitMode: 'all' },
  },
  {
    type: 'loop',
    label: 'Loop',
    description: 'Iterate over a list of items',
    icon: '🔁',
    color: '#d946ef',
    defaultConfig: { type: 'loop', iterable: '', bodyNodeId: '', maxIterations: 100 },
  },
  {
    type: 'delay',
    label: 'Delay',
    description: 'Wait for a specified duration',
    icon: '⏱️',
    color: '#78716c',
    defaultConfig: { type: 'delay', delayMs: 1000 },
  },
];

// ─── Run Status Colors (for UI) ─────────────────────────────────────────────

export const RUN_STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8',
  running: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
  paused: '#f59e0b',
  cancelled: '#6b7280',
  skipped: '#a1a1aa',
};
