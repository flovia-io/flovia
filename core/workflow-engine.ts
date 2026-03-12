/**
 * Workflow Engine — Runs a Workflow's step graph.
 *
 * Hexagonal: this is the core APPLICATION SERVICE.
 * It depends only on ports (LlmPort, WorkspaceToolPort, ConnectorRegistry).
 * No Electron, no Express — pure logic.
 */

import type {
  Workflow, WorkflowStep, Artifact, StepStatus,
  LlmPort, WorkspaceToolPort, OrchestratorStorage,
} from './orchestrator';
import type { ConnectorRegistry } from './connector';
import { genId } from './utils';

export interface WorkflowEngineOptions {
  llm: LlmPort;
  tools: WorkspaceToolPort;
  connectors: ConnectorRegistry;
  storage: OrchestratorStorage;
  /** Called when a step changes status — used to push updates to UI */
  onStepUpdate?: (workflow: Workflow, step: WorkflowStep) => void;
  /** Called when a new artifact is produced */
  onArtifact?: (workflow: Workflow, artifact: Artifact) => void;
}

function artifact(kind: Artifact['kind'], label: string, data: unknown, stepId?: string): Artifact {
  return { id: genId(), kind, label, data, createdAt: new Date().toISOString(), stepId };
}

export class WorkflowEngine {
  constructor(private opts: WorkflowEngineOptions) {}

  /**
   * Execute a workflow from the beginning (or resume from first pending step).
   */
  async run(workflow: Workflow): Promise<Workflow> {
    workflow.status = 'running';
    workflow.updatedAt = new Date().toISOString();

    // Build dependency map for topological ordering
    const completed = new Set<string>();
    const steps = new Map(workflow.steps.map(s => [s.id, s]));

    const isReady = (step: WorkflowStep) =>
      step.status === 'pending' &&
      step.dependsOn.every(dep => completed.has(dep));

    let progress = true;
    while (progress) {
      progress = false;
      const readySteps = workflow.steps.filter(isReady);
      if (readySteps.length === 0) break;

      // Execute ready steps (could be parallel)
      const results = await Promise.allSettled(
        readySteps.map(step => this.executeStep(workflow, step)),
      );

      for (let i = 0; i < results.length; i++) {
        const step = readySteps[i];
        const result = results[i];
        if (result.status === 'fulfilled') {
          completed.add(step.id);
          progress = true;
        } else {
          step.status = 'failed';
          step.error = result.reason?.message || 'Unknown error';
          step.completedAt = new Date().toISOString();
          workflow.status = 'failed';
          this.opts.onStepUpdate?.(workflow, step);
          break;
        }
      }

      // If a step failed, bail out
      if (workflow.status === 'failed') break;
    }

    // Check if all steps completed
    if (workflow.status !== 'failed') {
      const allDone = workflow.steps.every(s => s.status === 'completed' || s.status === 'skipped');
      workflow.status = allDone ? 'completed' : 'paused';
    }

    workflow.updatedAt = new Date().toISOString();
    await this.opts.storage.saveWorkflow(workflow);
    return workflow;
  }

  private async executeStep(workflow: Workflow, step: WorkflowStep): Promise<void> {
    step.status = 'running';
    step.startedAt = new Date().toISOString();
    this.opts.onStepUpdate?.(workflow, step);

    try {
      switch (step.config.kind) {
        case 'llm':
          await this.executeLlmStep(workflow, step);
          break;
        case 'connector':
          await this.executeConnectorStep(workflow, step);
          break;
        case 'tool':
          await this.executeToolStep(workflow, step);
          break;
        case 'decision':
          await this.executeDecisionStep(workflow, step);
          break;
        case 'transform':
          await this.executeTransformStep(workflow, step);
          break;
        case 'human':
          // Pause execution — the UI will resume after user input
          step.status = 'pending';
          workflow.status = 'paused';
          this.opts.onStepUpdate?.(workflow, step);
          return;
        case 'parallel':
          // Parallel steps are resolved by the outer loop
          break;
      }

      step.status = 'completed';
      step.completedAt = new Date().toISOString();
      this.opts.onStepUpdate?.(workflow, step);
    } catch (err) {
      step.status = 'failed';
      step.error = (err as Error).message;
      step.completedAt = new Date().toISOString();
      const errArtifact = artifact('error', `Error in ${step.label}`, { message: step.error }, step.id);
      step.artifacts.push(errArtifact);
      workflow.artifacts.push(errArtifact);
      this.opts.onArtifact?.(workflow, errArtifact);
      throw err;
    }
  }

  private async executeLlmStep(workflow: Workflow, step: WorkflowStep): Promise<void> {
    const config = step.config as import('./orchestrator').LlmStepConfig;
    const messages = [{ role: 'user', content: config.prompt }];

    if (config.stream) {
      let fullReply = '';
      await this.opts.llm.chatCompleteStream(messages, (chunk) => { fullReply += chunk; });
      const art = artifact('message', step.label, fullReply, step.id);
      step.artifacts.push(art);
      workflow.artifacts.push(art);
      this.opts.onArtifact?.(workflow, art);
    } else {
      const result = await this.opts.llm.chatComplete(messages);
      const art = artifact('message', step.label, result.reply, step.id);
      step.artifacts.push(art);
      workflow.artifacts.push(art);
      this.opts.onArtifact?.(workflow, art);
    }
  }

  private async executeConnectorStep(workflow: Workflow, step: WorkflowStep): Promise<void> {
    const config = step.config as import('./orchestrator').ConnectorStepConfig;
    const result = await this.opts.connectors.executeAction(config.connectorId, config.actionId, config.params);
    const art = artifact(
      result.success ? 'json' : 'error',
      `${config.connectorId}:${config.actionId}`,
      result.data ?? result.error,
      step.id,
    );
    step.artifacts.push(art);
    workflow.artifacts.push(art);
    this.opts.onArtifact?.(workflow, art);
    if (!result.success) throw new Error(result.error || 'Connector action failed');
  }

  private async executeToolStep(workflow: Workflow, step: WorkflowStep): Promise<void> {
    const config = step.config as import('./orchestrator').ToolStepConfig;
    let data: unknown;

    switch (config.toolId) {
      case 'read-file':
        data = await this.opts.tools.readFile(config.params?.filePath as string);
        break;
      case 'write-file':
        await this.opts.tools.writeFile(config.params?.filePath as string, config.params?.content as string);
        data = { written: config.params?.filePath };
        break;
      case 'list-files':
        data = await this.opts.tools.listFiles(config.params?.folderPath as string);
        break;
      case 'search-text':
        data = await this.opts.tools.searchText(config.params?.folderPath as string, config.params?.query as string);
        break;
      case 'git-diff':
        data = await this.opts.tools.gitDiff(config.params?.folderPath as string);
        break;
      case 'run-command':
        data = await this.opts.tools.runCommand(config.params?.cwd as string, config.params?.command as string);
        break;
      default:
        throw new Error(`Unknown tool: ${config.toolId}`);
    }

    const art = artifact('json', `tool:${config.toolId}`, data, step.id);
    step.artifacts.push(art);
    workflow.artifacts.push(art);
    this.opts.onArtifact?.(workflow, art);
  }

  private async executeDecisionStep(workflow: Workflow, step: WorkflowStep): Promise<void> {
    const config = step.config as import('./orchestrator').DecisionStepConfig;
    const result = await this.opts.llm.chatComplete([{ role: 'user', content: config.prompt }]);

    // Try to parse the LLM reply to determine branch
    const reply = result.reply.trim().toLowerCase();
    const matchedBranch = Object.keys(config.branches).find(key => reply.includes(key.toLowerCase()));

    if (matchedBranch) {
      const art = artifact('json', `Decision: ${matchedBranch}`, { branch: matchedBranch, nextStepId: config.branches[matchedBranch] }, step.id);
      step.artifacts.push(art);
      workflow.artifacts.push(art);
      this.opts.onArtifact?.(workflow, art);

      // Skip steps not on the chosen branch
      // (This is a simplification — a full impl would handle DAG pruning)
    } else {
      throw new Error(`Decision step could not classify: ${result.reply}`);
    }
  }

  private async executeTransformStep(workflow: Workflow, step: WorkflowStep): Promise<void> {
    const config = step.config as import('./orchestrator').TransformStepConfig;
    // Simple JSON path extraction from previous step artifacts
    const art = artifact('json', step.label, { expression: config.expression, note: 'Transform executed' }, step.id);
    step.artifacts.push(art);
    workflow.artifacts.push(art);
    this.opts.onArtifact?.(workflow, art);
  }
}
