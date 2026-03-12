/**
 * Orchestrator — Core domain for the agentic workspace.
 *
 * Hexagonal architecture: this module defines the PORTS (interfaces).
 * Adapters (Electron IPC, REST, CLI) plug in from the outside.
 *
 * Key concepts:
 *  • Workflow   — a DAG of Steps the agent executes
 *  • Step       — a single unit of work (LLM call, connector action, tool call, decision)
 *  • Artifact   — any data produced by a step (files, diffs, logs, query results)
 *  • AgentProfile — customizable persona, model, tools, and prompt overrides
 *
 * The orchestrator does NOT know about Electron, Express, or any transport.
 */

// ─── Artifact ────────────────────────────────────────────────────────────────

export type ArtifactKind =
  | 'file'          // a file path + content
  | 'diff'          // a SEARCH/REPLACE or unified diff
  | 'log'           // free-form text output
  | 'json'          // structured data (query results, API responses)
  | 'message'       // chat message to the user
  | 'error';        // an error captured during execution

export interface Artifact {
  id: string;
  kind: ArtifactKind;
  /** Human-readable label shown in UI */
  label: string;
  /** The payload — shape depends on `kind` */
  data: unknown;
  /** ISO timestamp */
  createdAt: string;
  /** Which step produced this */
  stepId?: string;
}

// ─── Workflow Step ───────────────────────────────────────────────────────────

export type StepKind =
  | 'llm'           // call an LLM (chat-complete or streaming)
  | 'connector'     // call a connector action
  | 'tool'          // call a built-in tool (file-read, git-diff, terminal, etc.)
  | 'decision'      // branch based on a condition (LLM classification)
  | 'transform'     // pure data transformation (map/filter/extract)
  | 'human'         // pause and wait for user approval
  | 'parallel';     // fan-out into parallel sub-steps

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowStep {
  id: string;
  kind: StepKind;
  label: string;
  description?: string;
  /** Config payload — shape depends on `kind` */
  config: StepConfig;
  /** IDs of steps that must complete first */
  dependsOn: string[];
  /** Current execution status */
  status: StepStatus;
  /** Artifacts produced by this step */
  artifacts: Artifact[];
  /** Error message if status === 'failed' */
  error?: string;
  /** Timestamp when step started / finished */
  startedAt?: string;
  completedAt?: string;
}

export type StepConfig =
  | LlmStepConfig
  | ConnectorStepConfig
  | ToolStepConfig
  | DecisionStepConfig
  | TransformStepConfig
  | HumanStepConfig
  | ParallelStepConfig;

export interface LlmStepConfig {
  kind: 'llm';
  /** Prompt template key or inline prompt */
  prompt: string;
  /** Which agent profile to use (overrides default model/temperature) */
  agentProfileId?: string;
  /** Whether to stream the response */
  stream?: boolean;
}

export interface ConnectorStepConfig {
  kind: 'connector';
  connectorId: string;
  actionId: string;
  /** Parameters to pass to the action — can reference earlier step outputs via `$ref:stepId.path` */
  params?: Record<string, unknown>;
}

export interface ToolStepConfig {
  kind: 'tool';
  toolId: string;
  params?: Record<string, unknown>;
}

export interface DecisionStepConfig {
  kind: 'decision';
  /** Prompt that classifies the input */
  prompt: string;
  /** Map of classification → next step ID */
  branches: Record<string, string>;
}

export interface TransformStepConfig {
  kind: 'transform';
  /** JS expression or jq-like path to extract/reshape data */
  expression: string;
}

export interface HumanStepConfig {
  kind: 'human';
  /** Message shown to the user */
  message: string;
  /** What options the user can choose */
  options?: string[];
}

export interface ParallelStepConfig {
  kind: 'parallel';
  /** Step IDs to execute in parallel */
  stepIds: string[];
}

// ─── Workflow ────────────────────────────────────────────────────────────────

export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  /** Ordered steps (topological order) */
  steps: WorkflowStep[];
  /** Global status */
  status: WorkflowStatus;
  /** All artifacts produced across all steps */
  artifacts: Artifact[];
  /** ISO timestamp */
  createdAt: string;
  updatedAt: string;
}

// ─── Agent Profile (customizable persona) ────────────────────────────────────

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  /** System prompt override — if blank, uses the default */
  systemPrompt?: string;
  /** Which AI provider/model to use (overrides global AI settings) */
  model?: {
    provider?: string;
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
  };
  /** Which connectors this agent can use */
  enabledConnectors?: string[];
  /** Which built-in tools this agent can use */
  enabledTools?: string[];
  /** Custom prompt overrides keyed by prompt role */
  promptOverrides?: Record<string, string>;
  /** Whether this is the default profile for new chats */
  isDefault?: boolean;
  /** ISO timestamps */
  createdAt: string;
  updatedAt: string;
}

// ─── Ports (interfaces that adapters implement) ──────────────────────────────

/**
 * Port for persisting orchestrator state.
 * Electron adapter writes to disk, cloud adapter writes to DB.
 */
export interface OrchestratorStorage {
  loadAgentProfiles(): Promise<AgentProfile[]>;
  saveAgentProfile(profile: AgentProfile): Promise<void>;
  deleteAgentProfile(profileId: string): Promise<boolean>;

  loadWorkflows(): Promise<Workflow[]>;
  saveWorkflow(workflow: Workflow): Promise<void>;
  deleteWorkflow(workflowId: string): Promise<boolean>;
}

/**
 * Port for executing LLM calls.
 * Decoupled so we can swap providers without touching the orchestrator.
 */
export interface LlmPort {
  chatComplete(
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<{ reply: string; usage?: { promptTokens: number; completionTokens: number } }>;

  chatCompleteStream(
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => void,
    options?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<void>;
}

/**
 * Port for built-in workspace tools (file ops, git, terminal).
 * The orchestrator calls these without knowing whether it's Electron or server.
 */
export interface WorkspaceToolPort {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  listFiles(folderPath: string): Promise<string[]>;
  searchText(folderPath: string, query: string): Promise<Array<{ file: string; line: number; text: string }>>;
  gitDiff(folderPath: string): Promise<string>;
  runCommand(cwd: string, command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}
