/**
 * Agent Builder & Execution types
 *
 * Defines the data model for custom agent pipelines: phases, nodes,
 * tool selectors, and execution traces for full observability.
 */

// ── Phase & Node Definitions ──

export type PhaseCategory =
  | 'entry'
  | 'classification'
  | 'research'
  | 'planning'
  | 'execution'
  | 'verification'
  | 'output';

/** A single tool that can be enabled/disabled per node */
export interface AgentTool {
  id: string;
  label: string;
  /** Icon emoji or short identifier */
  icon: string;
  /** Which sidebar integration this maps to (if any). Core integrations are predefined; connector plugins add their own. */
  integration?: string;
  /** Whether this tool is enabled for this node */
  enabled: boolean;
}

/** A single node in an agent pipeline phase */
export interface AgentNode {
  id: string;
  label: string;
  description: string;
  category: PhaseCategory;
  icon: string;
  /** Key into prompt settings (if this node uses an LLM call) */
  promptKey?: string;
  /** Custom prompt override (if set, overrides the promptKey default) */
  customPrompt?: string;
  inputs?: string[];
  outputs?: string[];
  /** Tools available to this node */
  tools?: AgentTool[];
  /** Whether this node is enabled (can be toggled off) */
  enabled: boolean;
  /** Position on the visual canvas */
  position: { x: number; y: number };
  /** Max retries for this node (0 = no retries, default follows agent params) */
  maxRetries?: number;
  /** Whether this node should ask the model if it wants to continue or stop */
  continueQuestion?: boolean;
  /** Custom continue question prompt (default: "Should we continue to the next step or stop?") */
  continueQuestionPrompt?: string;
}

/** An edge between two nodes */
export interface AgentEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: Record<string, unknown>;
}

/** All numeric limits & prompt templates that can be overridden per-agent */
export interface AgentParameters {
  // ─ Numeric Limits ─
  /** Max files returned by the research agent (default: 9) */
  maxResearchFiles: number;
  /** Min files the research agent should pick (default: 4) */
  minResearchFiles: number;
  /** Max files after merging research + text search (default: 12) */
  maxMergedContextFiles: number;
  /** Max results per text search query (default: 50) */
  maxTextSearchResults: number;
  /** Max text search matches shown in context (default: 30) */
  maxTextSearchDisplay: number;
  /** Max files discovered via text search to add (default: 5) */
  maxSearchDiscoveredFiles: number;
  /** Max search queries the search agent can issue (default: 3) */
  maxSearchQueries: number;
  /** Max file pattern filters for search (default: 3) */
  maxFilePatterns: number;
  /** Max verification retry attempts (default: 3) */
  maxVerificationAttempts: number;
  /** Max files in action plan (default: 10) */
  maxActionPlanFiles: number;
  /** How many recent chat history messages to include (default: 6) */
  chatHistoryDepth: number;
  /** Max workspace files shown in system context (default: 300) */
  maxFileListDisplay: number;
  /** Global max retries per node (default: 3) — individual nodes can override */
  maxNodeRetries: number;
  /** Whether to ask the model "should we continue or stop?" between nodes (default: true) */
  enableContinueQuestion: boolean;
  /** The default continue question prompt */
  continueQuestionPrompt: string;

  // ─ Prompt Templates ─
  /** System context prompt template. Placeholders: {{folderPath}}, {{fileCount}}, {{fileList}} */
  systemContextPrompt: string;
  /** Research agent system prompt. Placeholders: {{folderPath}}, {{fileCount}}, {{fileList}}, {{minFiles}}, {{maxFiles}} */
  researchAgentPrompt: string;
  /** Search decision agent prompt. Placeholders: {{folderPath}}, {{fileCount}}, {{maxQueries}} */
  searchDecisionPrompt: string;
  /** Check/triage agent prompt (no placeholders — plain instruction) */
  checkAgentPrompt: string;
  /** Action plan agent prompt. Placeholders: {{fileList}}, {{fileContexts}}, {{maxFiles}} */
  actionPlanPrompt: string;
  /** File change prompt for CREATE. Placeholders: {{file}}, {{description}} */
  fileChangeCreatePrompt: string;
  /** File change prompt for UPDATE (SEARCH/REPLACE). Placeholders: {{file}}, {{description}}, {{currentContent}} */
  fileChangeUpdatePrompt: string;
  /** Verification agent prompt. Placeholders: {{userRequest}}, {{changeSummary}} */
  verificationPrompt: string;
}

/** Default parameter values — increased by 3 from the original hardcoded behavior for deeper agent processing */
export const DEFAULT_AGENT_PARAMETERS: AgentParameters = {
  // Numeric (all increased by 3 from original defaults)
  maxResearchFiles: 12,
  minResearchFiles: 7,
  maxMergedContextFiles: 15,
  maxTextSearchResults: 53,
  maxTextSearchDisplay: 33,
  maxSearchDiscoveredFiles: 8,
  maxSearchQueries: 6,
  maxFilePatterns: 6,
  maxVerificationAttempts: 6,
  maxActionPlanFiles: 13,
  chatHistoryDepth: 9,
  maxFileListDisplay: 303,
  maxNodeRetries: 6,
  enableContinueQuestion: true,
  continueQuestionPrompt: [
    'You have just completed a step in the agent pipeline.',
    'Based on the results so far and the original user request, decide whether to continue to the next step or stop here.',
    '',
    'Reply with ONLY a valid JSON object:',
    '{ "shouldContinue": true | false, "reason": "<brief explanation>" }',
    '',
    'Continue if: there is more work to do, the task is incomplete, or the next step is needed.',
    'Stop if: the task is already fully satisfied, there is nothing more to do, or an unrecoverable error occurred.',
  ].join('\n'),

  // Prompts
  systemContextPrompt: [
    'You are an expert coding assistant inside the "flovia" desktop IDE (flovia.io).',
    '',
    '## Workspace',
    '- **Directory**: {{folderPath}}',
    '- **Files** ({{fileCount}} total):',
    '{{fileList}}',
    '',
    'Use this workspace context to give precise, file-aware answers. When referencing files, use the exact relative paths listed above.',
  ].join('\n'),

  researchAgentPrompt: [
    'You are a code research agent. Your job is to decide which files from the workspace are most relevant to the user\'s question.',
    '',
    '## Workspace: {{folderPath}}',
    '## Files ({{fileCount}} total):',
    '{{fileList}}',
    '',
    '## Instructions',
    'Based on the user\'s question below, choose between {{minFiles}} and {{maxFiles}} files that are most relevant to answering it.',
    'Return ONLY a valid JSON array of relative file paths. No explanation, no markdown fences, just the JSON array.',
    'Example: ["src/index.ts", "package.json", "README.md", "src/utils/helper.ts"]',
  ].join('\n'),

  searchDecisionPrompt: [
    'You are a search strategy agent inside a coding IDE.',
    'The user has asked a question about their codebase.',
    '',
    '## Workspace: {{folderPath}}',
    '## Total files: {{fileCount}}',
    '',
    '## Your Task',
    'Decide whether you need to search for specific text/code patterns inside the codebase to answer the question accurately.',
    '',
    'Text search (grep) is useful when:',
    '- The user mentions a specific function, variable, class, or symbol name',
    '- The user asks "where is X used" or "find all references to Y"',
    '- The user wants to find a specific string, error message, or configuration value',
    '- The user asks about imports, dependencies, or how something is connected',
    '',
    'Text search is NOT needed when:',
    '- The user asks a general question like "what is this repo" or "explain the architecture"',
    '- The question can be answered by looking at file names and structure alone',
    '- The user is asking for code generation without needing to find existing code first',
    '',
    '## Response Format',
    'Return ONLY a valid JSON object — no markdown fences, no explanation:',
    '{',
    '  "wantsTextSearch": true | false,',
    '  "searchQueries": ["term1", "term2"],',
    '  "filePatterns": ["*.ts", "*.config.*"]',
    '}',
    '',
    '- "searchQueries" should contain specific terms/symbols to grep for (1-{{maxQueries}} queries max)',
    '- "filePatterns" can optionally narrow the search to specific file types',
    '- If wantsTextSearch is false, return empty arrays',
  ].join('\n'),

  checkAgentPrompt: [
    'You are a triage agent inside a coding IDE. Your ONLY job is to decide whether the user\'s latest message requires creating, modifying, or deleting files in the workspace.',
    '',
    'Reply with ONLY a valid JSON object — no markdown fences, no explanation:',
    '{ "needsFileChanges": true | false }',
    '',
    'Examples that need file changes: "add a dark mode toggle", "fix the bug in auth.ts", "create a new component", "refactor the utils", "update the README".',
    'Examples that do NOT need file changes: "explain how X works", "what does this function do", "summarize the project", "how do I run this".',
  ].join('\n'),

  actionPlanPrompt: [
    'You are a code planning agent. The user wants to make changes to their codebase.',
    '',
    '## Workspace files ({{fileCount}}):',
    '{{fileList}}',
    '{{fileContexts}}',
    '',
    '## Instructions',
    'Based on the conversation and the user\'s latest request, determine which files need to be created, updated, or deleted.',
    'Return ONLY a valid JSON array of action objects. No explanation, no markdown fences.',
    'Each object: { "file": "<relative path>", "action": "create"|"update"|"delete", "description": "<brief description of what to change>" }',
    '',
    'Example: [{"file":"src/utils/auth.ts","action":"update","description":"Add password validation function"},{"file":"src/components/Login.tsx","action":"create","description":"Create login form component"}]',
    '',
    'Keep the list focused — only include files that truly need changes. Max {{maxFiles}} files.',
  ].join('\n'),

  fileChangeCreatePrompt: [
    'You are a code editor. Create the file "{{file}}".',
    'Task: {{description}}',
    '',
    'Return ONLY the file content. No markdown fences, no explanation.',
  ].join('\n'),

  fileChangeUpdatePrompt: [
    'You are a precise code editor. You must apply targeted changes to the file using SEARCH/REPLACE blocks.',
    '',
    '## Task: {{description}}',
    '## File: {{file}}',
    '',
    '## Current file content:',
    '```',
    '{{currentContent}}',
    '```',
    '',
    '## Instructions',
    'Return ONLY one or more SEARCH/REPLACE blocks. Each block looks like:',
    '',
    '<<<<<<< SEARCH',
    'exact lines from the current file to find',
    '=======',
    'replacement lines',
    '>>>>>>> REPLACE',
    '',
    'Rules:',
    '- The SEARCH section must match the current file EXACTLY (including whitespace).',
    '- Include 2-3 lines of unchanged context around each change for precision.',
    '- Use multiple blocks for multiple changes.',
    '- Do NOT return the whole file. Only return SEARCH/REPLACE blocks.',
    '- No markdown fences around the blocks, no explanation text.',
  ].join('\n'),

  verificationPrompt: [
    'You are a verification agent. The following file changes were just applied to fulfill the user\'s request.',
    '',
    '## User\'s request:',
    '{{userRequest}}',
    '',
    '## Changes made:',
    '{{changeSummary}}',
    '',
    '## Instructions',
    'Evaluate whether these changes fully satisfy the user\'s request.',
    'Reply with ONLY a valid JSON object:',
    '{ "satisfied": true | false, "reason": "<brief explanation>", "missingChanges": [] }',
    '',
    "If not satisfied, list the missing changes as objects: { \"file\": \"path\", \"action\": \"create|update|delete\", \"description\": \"what's missing\" }",
  ].join('\n'),
};

/** Helper: merge partial params with defaults */
export function resolveAgentParameters(partial?: Partial<AgentParameters>): AgentParameters {
  if (!partial) return { ...DEFAULT_AGENT_PARAMETERS };
  return { ...DEFAULT_AGENT_PARAMETERS, ...partial };
}

/** A complete agent pipeline configuration */
export interface AgentConfig {
  /** Unique agent ID */
  id: string;
  /** User-chosen name */
  name: string;
  /** Description of what this agent does */
  description: string;
  /** Nodes in the pipeline */
  nodes: AgentNode[];
  /** Edges connecting nodes */
  edges: AgentEdge[];
  /** When this agent was created */
  createdAt: string;
  /** When this agent was last modified */
  updatedAt: string;
  /** Whether this is the built-in default (non-deletable) */
  isDefault?: boolean;
  /** Tunable parameters (numeric limits & prompt templates) */
  parameters?: Partial<AgentParameters>;
}

// ── Execution Trace Types ──

export type TraceStepStatus = 'running' | 'success' | 'error' | 'skipped';

/** A single trace entry — one LLM call or tool invocation */
export interface TraceStep {
  /** Unique step ID */
  id: string;
  /** Which node produced this step */
  nodeId: string;
  /** Node label for display */
  nodeLabel: string;
  /** Phase category for color coding */
  category: PhaseCategory;
  /** What kind of call this was */
  type: 'llm-call' | 'tool-call' | 'file-read' | 'file-write' | 'file-search' | 'text-search' | 'integration-call';
  /** Human-readable summary */
  summary: string;
  /** Input sent (prompt, tool args, etc.) */
  input?: unknown;
  /** Output received */
  output?: unknown;
  /** If it's a file-search, the files the model chose */
  chosenFiles?: string[];
  /** Why the model stopped (stop reason, token limit, etc.) */
  stopReason?: string;
  /** Token usage */
  tokens?: { prompt: number; completion: number; total: number };
  /** Duration in ms */
  durationMs?: number;
  /** Status */
  status: TraceStepStatus;
  /** Error message if failed */
  error?: string;
  /** Timestamp */
  timestamp: string;
}

/** Full execution trace for one agent run */
export interface AgentTrace {
  /** Trace ID (matches the conversation message) */
  id: string;
  /** Agent config ID used */
  agentId: string;
  /** Agent name */
  agentName: string;
  /** User's original request */
  userRequest: string;
  /** Ordered list of steps */
  steps: TraceStep[];
  /** Overall status */
  status: 'running' | 'success' | 'error';
  /** Total duration */
  totalDurationMs?: number;
  /** Started at */
  startedAt: string;
  /** Finished at */
  finishedAt?: string;
}

// ── Core tools (non-plugin) ──
// Plugin-specific tools (GitHub, Atlassian, Supabase, etc.) are derived from
// their connector definitions at runtime via connectorActionsToAgentTools().

export const CORE_AGENT_TOOLS: AgentTool[] = [
  // ── Filesystem ──
  { id: 'file-read',       label: 'Read Files',          icon: '📖', integration: 'filesystem', enabled: true },
  { id: 'file-write',      label: 'Write Files',         icon: '💾', integration: 'filesystem', enabled: true },
  { id: 'file-search',     label: 'File Search',         icon: '🔍', integration: 'search',     enabled: true },
  { id: 'text-search',     label: 'Text Search (Grep)',   icon: '🔎', integration: 'search',     enabled: true },
  { id: 'file-tree',       label: 'Workspace Tree',      icon: '🌳', integration: 'filesystem', enabled: true },
  { id: 'file-create',     label: 'Create File/Folder',  icon: '📄', integration: 'filesystem', enabled: false },
  { id: 'file-delete',     label: 'Delete File/Folder',  icon: '🗑️', integration: 'filesystem', enabled: false },
  { id: 'file-rename',     label: 'Rename/Move',         icon: '✏️', integration: 'filesystem', enabled: false },
  // ── Git ──
  { id: 'git-status',      label: 'Git Status',          icon: '📊', integration: 'git',        enabled: false },
  { id: 'git-diff',        label: 'Git Diff',            icon: '📝', integration: 'git',        enabled: false },
  { id: 'git-stage',       label: 'Git Stage/Unstage',   icon: '📌', integration: 'git',        enabled: false },
  { id: 'git-commit',      label: 'Git Commit',          icon: '✅', integration: 'git',        enabled: false },
  { id: 'git-branch',      label: 'Git Branch Ops',      icon: '🌿', integration: 'git',        enabled: false },
  { id: 'git-push-pull',   label: 'Git Push/Pull',       icon: '🔄', integration: 'git',        enabled: false },
  // ── MCP Servers ──
  { id: 'mcp-tools',       label: 'MCP Tool Call',       icon: '🔌', integration: 'mcp',        enabled: false },
  { id: 'mcp-resources',   label: 'MCP Resources',       icon: '📚', integration: 'mcp',        enabled: false },
  // ── Terminal & NPM ──
  { id: 'terminal',        label: 'Terminal Command',     icon: '🖥️', integration: 'terminal',   enabled: false },
  { id: 'npm-scripts',     label: 'NPM Scripts',         icon: '📦', integration: 'npm',        enabled: false },
  { id: 'npm-install',     label: 'NPM Install',         icon: '📦', integration: 'npm',        enabled: false },
];

/** @deprecated Use CORE_AGENT_TOOLS + connectorActionsToAgentTools() instead */
export const ALL_AGENT_TOOLS = CORE_AGENT_TOOLS;

/** Default icon map for known connectors */
const CONNECTOR_ICONS: Record<string, string> = {
  github: '⚡',
  atlassian: '🔵',
  supabase: '🗄️',
};

/** Connector data needed to derive agent tools */
export interface ConnectorToolSource {
  id: string;
  name: string;
  actions: Array<{ id: string; name: string; description: string }>;
}

/** Convert a connector's actions into AgentTool entries so they appear in the agent builder */
export function connectorActionsToAgentTools(connector: ConnectorToolSource): AgentTool[] {
  const icon = CONNECTOR_ICONS[connector.id] || '🔌';
  return connector.actions.map(action => ({
    id: `${connector.id}:${action.id}`,
    label: `${connector.name}: ${action.name}`,
    icon,
    integration: connector.id,
    enabled: false,
  }));
}

/** Build the full agent tool list by merging core tools with connector-provided tools */
export function buildAllAgentTools(connectors: ConnectorToolSource[] = []): AgentTool[] {
  const connectorTools = connectors.flatMap(c => connectorActionsToAgentTools(c));
  return [...CORE_AGENT_TOOLS, ...connectorTools];
}
