/**
 * Backend Adapter Interface
 * 
 * This is the abstraction that decouples the renderer (React frontend)
 * from the backend transport. In desktop mode it uses Electron IPC.
 * In cloud/web mode it uses HTTP REST calls.
 * 
 * The renderer only ever imports `BackendAdapter` — it never directly
 * touches `window.electronAPI` or `fetch()`.
 */

import type { ConnectorMetadata, ConnectorState, ConnectorConfigField, ConnectorAction, ConnectorActionResult } from './connector';
import type { AgentProfile, Workflow } from './orchestrator';

// ─── Connector Operations ───

export interface ConnectorOperations {
  // ...existing code...
}

// ─── Orchestrator Operations ───

export interface OrchestratorOperations {
  /** List all agent profiles */
  listProfiles(): Promise<AgentProfile[]>;
  /** Save (create or update) an agent profile */
  saveProfile(profile: AgentProfile): Promise<void>;
  /** Delete an agent profile */
  deleteProfile(profileId: string): Promise<boolean>;

  /** List all workflows */
  listWorkflows(): Promise<Workflow[]>;
  /** Get a specific workflow */
  getWorkflow(workflowId: string): Promise<Workflow | null>;
  /** Save (create or update) a workflow */
  saveWorkflow(workflow: Workflow): Promise<void>;
  /** Delete a workflow */
  deleteWorkflow(workflowId: string): Promise<boolean>;
}

// ─── Full Backend Adapter ───

/**
 * The BackendAdapter combines connector operations, orchestrator operations,
 * and any other backend capabilities (file system, AI, terminal, etc.).
 * 
 * For open-source desktop: ElectronBackendAdapter (uses IPC)
 * For enterprise cloud: HttpBackendAdapter (uses REST API)
 */
export interface BackendAdapter {
  /** Connector plugin operations */
  connectors: ConnectorOperations;

  /** Orchestrator operations (agent profiles, workflows) */
  orchestrator: OrchestratorOperations;

  /** 
   * The mode this adapter is running in.
   * UI can use this to show/hide features (e.g., terminal is desktop-only).
   */
  mode: 'desktop' | 'cloud';

  /**
   * For desktop: the full ElectronAPI is available for file/git/terminal ops.
   * For cloud: these are null and the UI adapts accordingly.
   */
  electron?: unknown;
}
