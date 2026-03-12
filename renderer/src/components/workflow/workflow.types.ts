/**
 * Shared types for the workflow editor UI components.
 */
import type { Node, Edge } from '@xyflow/react';

// ─── ReactFlow node data shape ──────────────────────────────────────────────

export interface WfNodeData {
  label: string;
  icon: string;
  nodeType: string;
  config: Record<string, unknown>;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  subtitle?: string;
  itemCount?: number;
  durationMs?: number;
  output?: unknown;
  error?: string;
  [key: string]: unknown;
}

// ─── Editor workflow (persisted blob) ───────────────────────────────────────

export interface EditorWorkflow {
  id: string;
  name: string;
  description?: string;
  nodes: Node<WfNodeData>[];
  edges: Edge[];
  createdAt: string;
  updatedAt: string;
}

// ─── Execution run log ──────────────────────────────────────────────────────

export interface RunLog {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt?: string;
  steps: RunStep[];
}

export interface RunStep {
  nodeId: string;
  label: string;
  status: string;
  durationMs?: number;
  itemCount?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
}
