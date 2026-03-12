/**
 * Built-in Workflow Templates
 *
 * These map to the sidebar chat modes (Chat, Agent, Edit).
 * They are read-only but can be cloned into new custom workflows.
 * Any custom workflow containing an AI/LLM node will also appear
 * as a selectable mode in the chat panel.
 */
import type { Node, Edge } from '@xyflow/react';
import type { WfNodeData, EditorWorkflow } from './workflow.types';

// ─── ID helpers ─────────────────────────────────────────────────────────────

let counter = 0;
const id = (prefix: string) => `${prefix}-${++counter}`;

// ─── Chat Workflow ──────────────────────────────────────────────────────────
// Simple: Chat Input → AI (streaming response)

const chatNodes: Node<WfNodeData>[] = [
  {
    id: 'chat-trigger',
    type: 'workflowNode',
    position: { x: 100, y: 200 },
    data: {
      label: 'Chat Input',
      icon: '💬',
      nodeType: 'trigger',
      config: { triggerType: 'chat-input' },
      subtitle: 'User sends a message',
    },
  },
  {
    id: 'chat-ai',
    type: 'workflowNode',
    position: { x: 380, y: 200 },
    data: {
      label: 'AI Response',
      icon: '🤖',
      nodeType: 'llm',
      config: {
        type: 'llm',
        prompt: '{{ $json.message }}',
        stream: true,
        systemPrompt: 'You are a helpful AI assistant. Answer the user\'s questions clearly and concisely.',
      },
      subtitle: 'Streaming AI response',
    },
  },
];

const chatEdges: Edge[] = [
  { id: 'e-chat-trigger-ai', source: 'chat-trigger', target: 'chat-ai', animated: true },
];

// ─── Agent Workflow ─────────────────────────────────────────────────────────
// Chat Input → Triage → Research → AI Agent (with tools) → Output

const agentNodes: Node<WfNodeData>[] = [
  {
    id: 'agent-trigger',
    type: 'workflowNode',
    position: { x: 60, y: 250 },
    data: {
      label: 'Chat Input',
      icon: '💬',
      nodeType: 'trigger',
      config: { triggerType: 'chat-input' },
      subtitle: 'User sends a request',
    },
  },
  {
    id: 'agent-triage',
    type: 'workflowNode',
    position: { x: 300, y: 150 },
    data: {
      label: 'Triage',
      icon: '🔍',
      nodeType: 'decision',
      config: {
        type: 'decision',
        mode: 'rules',
        condition: 'Classify if user needs code changes or just a chat response',
        evaluator: 'llm',
      },
      subtitle: 'Needs changes?',
    },
  },
  {
    id: 'agent-research',
    type: 'workflowNode',
    position: { x: 540, y: 100 },
    data: {
      label: 'Research',
      icon: '📚',
      nodeType: 'llm',
      config: {
        type: 'llm',
        prompt: 'Pick 4-9 relevant files from the workspace to build context for the response.',
        systemPrompt: 'You are a research agent. Given a user request and workspace file tree, identify the most relevant files.',
        stream: false,
      },
      subtitle: 'Find relevant files',
    },
  },
  {
    id: 'agent-developer',
    type: 'workflowNode',
    position: { x: 540, y: 300 },
    data: {
      label: 'Developer Agent',
      icon: '👨‍💻',
      nodeType: 'developer',
      config: {
        type: 'developer',
        agentMode: 'full',
        maxIterations: 10,
        tools: ['file-read', 'file-write', 'file-search', 'file-tree', 'terminal'],
        planFirst: true,
        verify: true,
      },
      subtitle: 'Plan → Edit → Verify',
    },
  },
  {
    id: 'agent-chat-response',
    type: 'workflowNode',
    position: { x: 300, y: 400 },
    data: {
      label: 'Chat Response',
      icon: '💡',
      nodeType: 'llm',
      config: {
        type: 'llm',
        prompt: '{{ $json.message }}',
        stream: true,
        systemPrompt: 'You are a helpful coding assistant. Provide clear, contextual answers using the workspace file contents.',
      },
      subtitle: 'Streaming response',
    },
  },
];

const agentEdges: Edge[] = [
  { id: 'e-agent-trigger-triage', source: 'agent-trigger', target: 'agent-triage', animated: true },
  { id: 'e-triage-research', source: 'agent-triage', target: 'agent-research', animated: true, sourceHandle: 'true', label: 'needs changes' },
  { id: 'e-triage-chat', source: 'agent-triage', target: 'agent-chat-response', animated: true, sourceHandle: 'false', label: 'question only' },
  { id: 'e-research-developer', source: 'agent-research', target: 'agent-developer', animated: true },
  { id: 'e-developer-chat', source: 'agent-developer', target: 'agent-chat-response', animated: true, label: 'done' },
];

// ─── Edit Workflow ──────────────────────────────────────────────────────────
// Chat Input → Developer Agent (edit-only mode, no triage)

const editNodes: Node<WfNodeData>[] = [
  {
    id: 'edit-trigger',
    type: 'workflowNode',
    position: { x: 100, y: 200 },
    data: {
      label: 'Chat Input',
      icon: '✏️',
      nodeType: 'trigger',
      config: { triggerType: 'chat-input' },
      subtitle: 'User sends an edit request',
    },
  },
  {
    id: 'edit-developer',
    type: 'workflowNode',
    position: { x: 380, y: 200 },
    data: {
      label: 'Code Editor',
      icon: '👨‍💻',
      nodeType: 'developer',
      config: {
        type: 'developer',
        agentMode: 'edit-only',
        maxIterations: 5,
        tools: ['file-read', 'file-write', 'file-search'],
        planFirst: false,
        verify: false,
      },
      subtitle: 'Direct file editing',
    },
  },
];

const editEdges: Edge[] = [
  { id: 'e-edit-trigger-dev', source: 'edit-trigger', target: 'edit-developer', animated: true },
];

// ─── Template Definitions ───────────────────────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** The chat mode this maps to (if any) */
  chatMode?: string;
  /** Whether this template is a built-in (read-only) */
  builtIn: boolean;
  workflow: EditorWorkflow;
}

const now = new Date().toISOString();

export const BUILTIN_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'builtin:chat',
    name: 'Chat',
    description: 'Simple AI chat — user sends a message, AI responds.',
    icon: '💬',
    chatMode: 'Chat',
    builtIn: true,
    workflow: {
      id: 'builtin:chat',
      name: 'Chat',
      description: 'Simple streaming AI chat',
      nodes: chatNodes,
      edges: chatEdges,
      createdAt: now,
      updatedAt: now,
    },
  },
  {
    id: 'builtin:agent',
    name: 'Agent',
    description: 'Full developer agent — triage, research, plan, edit, verify.',
    icon: '🤖',
    chatMode: 'Agent',
    builtIn: true,
    workflow: {
      id: 'builtin:agent',
      name: 'Agent',
      description: 'Multi-phase developer agent with planning and verification',
      nodes: agentNodes,
      edges: agentEdges,
      createdAt: now,
      updatedAt: now,
    },
  },
  {
    id: 'builtin:edit',
    name: 'Edit',
    description: 'Quick edit mode — directly modifies files without planning.',
    icon: '✏️',
    chatMode: 'Edit',
    builtIn: true,
    workflow: {
      id: 'builtin:edit',
      name: 'Edit',
      description: 'Direct code editing without triage or verification',
      nodes: editNodes,
      edges: editEdges,
      createdAt: now,
      updatedAt: now,
    },
  },
];

/**
 * Clone a built-in template into a new custom workflow.
 */
export function cloneTemplate(template: WorkflowTemplate, newName?: string): EditorWorkflow {
  const cloned = structuredClone(template.workflow);
  const ts = Date.now();
  cloned.id = `wf-${ts}-${Math.random().toString(36).slice(2, 8)}`;
  cloned.name = newName || `${template.name} (copy)`;
  cloned.createdAt = new Date().toISOString();
  cloned.updatedAt = new Date().toISOString();
  return cloned;
}

/**
 * Check if a workflow contains an AI/LLM or developer node
 * (meaning it can be used as a chat mode).
 */
export function workflowHasAINode(workflow: EditorWorkflow): boolean {
  return workflow.nodes.some(n =>
    n.data.nodeType === 'llm' || n.data.nodeType === 'developer'
  );
}
