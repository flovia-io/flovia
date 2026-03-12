/**
 * Shared workflow constants for the renderer.
 *
 * All palette / color / type data that is reused across
 * WorkflowEditor, AgentsPanel, and their sub-components.
 *
 * NOTE: These mirror the core/workflow-editor.types definitions.
 *       We keep a renderer-local copy to avoid cross-project imports
 *       (the renderer tsconfig only covers src/).
 */

export type WorkflowNodeType =
  | 'trigger' | 'action' | 'llm' | 'decision' | 'transform'
  | 'human' | 'output' | 'parallel' | 'loop' | 'delay'
  | 'httpRequest' | 'splitOut';

// ─── Node Palette (renderer-specific, includes visual hints) ────────────────

export const NODE_PALETTE = [
  { type: 'trigger', label: 'Trigger', icon: '⚡', color: '#f59e0b', description: 'Manual, Schedule, Webhook, Event' },
  { type: 'action', label: 'Action', icon: '🔧', color: '#3b82f6', description: 'Connector action (GitHub, Jira, etc.)' },
  { type: 'llm', label: 'AI Agent', icon: '🤖', color: '#8b5cf6', description: 'LLM call with prompt' },
  { type: 'decision', label: 'Switch / If', icon: '🔀', color: '#ef4444', description: 'Conditional branching' },
  { type: 'transform', label: 'Transform', icon: '🔄', color: '#06b6d4', description: 'Data transformation' },
  { type: 'human', label: 'Human Input', icon: '👤', color: '#10b981', description: 'Wait for user input' },
  { type: 'output', label: 'Output', icon: '📤', color: '#64748b', description: 'Send result' },
  { type: 'delay', label: 'Delay', icon: '⏱️', color: '#78716c', description: 'Wait/sleep' },
  { type: 'httpRequest', label: 'HTTP Request', icon: '🌐', color: '#2563eb', description: 'Make an HTTP request' },
  { type: 'splitOut', label: 'Split Out', icon: '⤴️', color: '#7c3aed', description: 'Split array into items' },
] as const;

export type NodePaletteEntry = typeof NODE_PALETTE[number];

// ─── Status Colors (single source of truth for renderer) ───────────────────

export const STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8',
  running: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
  skipped: '#a1a1aa',
};

/**
 * Look up the palette entry for a given node type string.
 */
export function getPaletteForType(nodeType: string): NodePaletteEntry | undefined {
  return NODE_PALETTE.find(p => p.type === nodeType);
}
