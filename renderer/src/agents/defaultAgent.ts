/**
 * Default Agent Configuration
 *
 * This is the built-in "Base Agent" pipeline that matches the current hardcoded
 * agent flow. New agents start as a clone of this config.
 */
import type { AgentConfig, AgentNode, AgentEdge, AgentTool } from '../types/agent.types';
import { CORE_AGENT_TOOLS } from '../types/agent.types';

/** Clone the tool list with specific tools enabled */
function tools(...enabledIds: string[]): AgentTool[] {
  return CORE_AGENT_TOOLS.map(t => ({ ...t, enabled: enabledIds.includes(t.id) }));
}

const DEFAULT_NODES: AgentNode[] = [
  {
    id: 'user-input',
    label: 'User Message',
    description: 'The user sends a message or coding request via the chat panel.',
    category: 'entry',
    icon: '💬',
    outputs: ['message text', 'attached files', 'chat mode'],
    enabled: true,
    position: { x: 300, y: 0 },
  },
  {
    id: 'check-agent',
    label: 'Check Agent (Triage)',
    description: 'Classifies whether the request needs file changes or is just a question/explanation.',
    category: 'classification',
    icon: '🔍',
    promptKey: 'checkAgentPrompt',
    inputs: ['user message', 'recent chat history'],
    outputs: ['{ needsFileChanges: boolean }'],
    enabled: true,
    position: { x: 300, y: 140 },
  },
  {
    id: 'research-agent',
    label: 'Research Agent',
    description: 'Picks 4-9 relevant files from the workspace tree to build context for the response.',
    category: 'research',
    icon: '📚',
    promptKey: 'researchAgentPrompt',
    inputs: ['user question', 'workspace file list'],
    outputs: ['relevant file paths (JSON array)'],
    tools: tools('file-search', 'file-tree', 'file-read'),
    enabled: true,
    position: { x: 80, y: 300 },
  },
  {
    id: 'chat-response',
    label: 'Chat Response (Streaming)',
    description: 'When no file changes needed: streams a helpful response with workspace context.',
    category: 'output',
    icon: '💡',
    promptKey: 'systemPrompt',
    inputs: ['user message', 'researched file contents', 'system context'],
    outputs: ['streamed markdown response'],
    enabled: true,
    position: { x: 520, y: 300 },
  },
  {
    id: 'action-planner',
    label: 'Action Planner',
    description: 'Determines which files need to be created, updated, or deleted. Produces an action plan (max 10 files).',
    category: 'planning',
    icon: '📋',
    promptKey: 'actionPlannerPrompt',
    inputs: ['user message', 'chat history', 'workspace files'],
    outputs: ['FileActionPlan[] (file, action, description)'],
    tools: tools('file-tree', 'file-search'),
    enabled: true,
    position: { x: 80, y: 460 },
  },
  {
    id: 'file-reader',
    label: 'File Reader',
    description: 'Reads current content of each file targeted for update. Provides context to the code editor.',
    category: 'execution',
    icon: '📖',
    inputs: ['file paths from action plan'],
    outputs: ['file contents'],
    tools: tools('file-read'),
    enabled: true,
    position: { x: -120, y: 620 },
  },
  {
    id: 'code-editor',
    label: 'Code Editor Agent',
    description: 'Generates SEARCH/REPLACE blocks for updates, full content for creates, or delete markers. Runs per-file.',
    category: 'execution',
    icon: '✏️',
    promptKey: 'codeEditorPrompt',
    inputs: ['file content', 'action plan item', 'user request'],
    outputs: ['SEARCH/REPLACE blocks or new file content'],
    enabled: true,
    position: { x: 160, y: 620 },
  },
  {
    id: 'file-writer',
    label: 'File Writer',
    description: 'Applies the SEARCH/REPLACE edits, creates new files, or deletes files on disk. Records diffs.',
    category: 'execution',
    icon: '💾',
    inputs: ['SEARCH/REPLACE blocks', 'file path', 'action type'],
    outputs: ['diff { before, after }', 'success/error status'],
    tools: tools('file-write'),
    enabled: true,
    position: { x: 160, y: 780 },
  },
  {
    id: 'verification',
    label: 'Verification Agent',
    description: 'Evaluates if all changes satisfy the original request. If not, lists missing changes for another pass.',
    category: 'verification',
    icon: '✅',
    promptKey: 'verificationPrompt',
    inputs: ['user request', 'changed files summary'],
    outputs: ['{ satisfied, reason, missingChanges[] }'],
    enabled: true,
    position: { x: 160, y: 940 },
  },
  {
    id: 'commit-msg',
    label: 'Commit Message Generator',
    description: 'Generates a conventional commit message from the applied changes (optional, user-triggered).',
    category: 'output',
    icon: '📝',
    promptKey: 'commitMessagePrompt',
    inputs: ['file diffs', 'action descriptions'],
    outputs: ['commit message string'],
    enabled: true,
    position: { x: 420, y: 940 },
  },
];

const DEFAULT_EDGES: AgentEdge[] = [
  { id: 'e-user-check', source: 'user-input', target: 'check-agent' },
  { id: 'e-check-research', source: 'check-agent', target: 'research-agent', label: 'always' },
  { id: 'e-check-chat', source: 'check-agent', target: 'chat-response', label: 'no changes' },
  { id: 'e-research-planner', source: 'research-agent', target: 'action-planner', label: 'needs changes' },
  { id: 'e-research-chat', source: 'research-agent', target: 'chat-response', label: 'context' },
  { id: 'e-planner-reader', source: 'action-planner', target: 'file-reader' },
  { id: 'e-reader-editor', source: 'file-reader', target: 'code-editor' },
  { id: 'e-planner-editor', source: 'action-planner', target: 'code-editor', label: 'plan' },
  { id: 'e-editor-writer', source: 'code-editor', target: 'file-writer' },
  { id: 'e-writer-verify', source: 'file-writer', target: 'verification' },
  { id: 'e-verify-retry', source: 'verification', target: 'action-planner', label: 'not satisfied → retry' },
  { id: 'e-verify-commit', source: 'verification', target: 'commit-msg', label: 'satisfied' },
];

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  id: 'default',
  name: 'Base Agent',
  description: 'The built-in multi-phase agent pipeline with research, planning, execution, and verification.',
  nodes: DEFAULT_NODES,
  edges: DEFAULT_EDGES,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isDefault: true,
};

/** Create a new agent config cloned from the default */
export function createAgentFromDefault(name: string, description?: string): AgentConfig {
  return {
    ...structuredClone(DEFAULT_AGENT_CONFIG),
    id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    description: description || `Custom agent based on Base Agent`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: false,
  };
}
