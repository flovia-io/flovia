/**
 * Connector Plugin System
 * 
 * This is the core extensibility layer for flovia. Each integration
 * (GitHub, Atlassian, Supabase, Slack, Linear, etc.) implements the
 * Connector interface and registers itself with the ConnectorRegistry.
 * 
 * Third-party developers can add new connectors by:
 * 1. Creating a file in `connectors/` that implements Connector<TConfig, TActions>
 * 2. Registering it in the ConnectorRegistry
 * 3. The UI and backend automatically pick it up
 * 
 * Works identically in Electron (open source) and server (enterprise cloud).
 */

// ─── Base Types ───

export interface ConnectorMetadata {
  /** Unique identifier, e.g. 'github', 'atlassian', 'slack' */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description */
  description: string;
  /** Icon name or URL */
  icon: string;
  /** Category for grouping in UI */
  category: ConnectorCategory;
  /** Version of this connector */
  version: string;
  /** Author / maintainer */
  author?: string;
  /** Documentation URL */
  docsUrl?: string;
}

export type ConnectorCategory =
  | 'source-control'
  | 'project-management'
  | 'database'
  | 'ci-cd'
  | 'communication'
  | 'cloud'
  | 'monitoring'
  | 'ai'
  | 'other';

export interface ConnectorConfigField {
  /** Field key, e.g. 'apiToken' */
  key: string;
  /** Human-readable label */
  label: string;
  /** Input type */
  type: 'text' | 'password' | 'url' | 'email' | 'select' | 'boolean';
  /** Placeholder text */
  placeholder?: string;
  /** Whether this field is required */
  required: boolean;
  /** For 'select' type, the available options */
  options?: { label: string; value: string }[];
  /** Help text shown below the field */
  helpText?: string;
}

export interface ConnectorAction {
  /** Action identifier, e.g. 'list-projects', 'fetch-issues' */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this action does */
  description: string;
  /** JSON Schema for the action's input parameters */
  inputSchema?: Record<string, unknown>;
  /** JSON Schema for the action's output */
  outputSchema?: Record<string, unknown>;
}

export type ConnectorStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectorState {
  status: ConnectorStatus;
  error?: string;
  lastConnected?: string;
}

// ─── Connector Interface ───

/**
 * The main Connector interface that all integrations must implement.
 * 
 * @typeParam TConfig - The configuration shape for this connector
 * 
 * @example
 * ```ts
 * const slackConnector: Connector<SlackConfig> = {
 *   metadata: { id: 'slack', name: 'Slack', ... },
 *   configFields: [{ key: 'botToken', label: 'Bot Token', type: 'password', required: true }],
 *   actions: [{ id: 'send-message', name: 'Send Message', ... }],
 *   testConnection: async (config) => { ... },
 *   executeAction: async (actionId, config, params) => { ... },
 * };
 * ```
 */
export interface Connector<TConfig = Record<string, unknown>> {
  /** Connector metadata (id, name, category, etc.) */
  metadata: ConnectorMetadata;

  /** Fields needed to configure this connector */
  configFields: ConnectorConfigField[];

  /** Available actions this connector exposes */
  actions: ConnectorAction[];

  /** 
   * Test whether the given configuration can connect successfully.
   * Returns { success: true } or { success: false, error: string }.
   */
  testConnection(config: TConfig): Promise<{ success: boolean; error?: string }>;

  /**
   * Execute a specific action with the given parameters.
   * This is the main entry point for all connector operations.
   */
  executeAction(
    actionId: string,
    config: TConfig,
    params?: Record<string, unknown>,
  ): Promise<ConnectorActionResult>;

  /**
   * Optional: Called when the connector is first loaded.
   * Use for one-time setup (e.g., registering webhooks in cloud mode).
   */
  initialize?(): Promise<void>;

  /**
   * Optional: Called when the connector is being unloaded.
   * Use for cleanup.
   */
  dispose?(): Promise<void>;
}

export interface ConnectorActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ─── Connector Registry ───

export class ConnectorRegistry {
  private connectors = new Map<string, Connector>();
  private configs = new Map<string, unknown>();
  private states = new Map<string, ConnectorState>();
  private listeners = new Set<(event: ConnectorEvent) => void>();

  /**
   * Register a new connector. This is the main entry point for plugins.
   */
  register(connector: Connector): void {
    if (this.connectors.has(connector.metadata.id)) {
      throw new Error(`Connector "${connector.metadata.id}" is already registered`);
    }
    this.connectors.set(connector.metadata.id, connector);
    this.states.set(connector.metadata.id, { status: 'disconnected' });
    this.emit({ type: 'registered', connectorId: connector.metadata.id });
  }

  /**
   * Unregister a connector by ID.
   */
  async unregister(connectorId: string): Promise<void> {
    const connector = this.connectors.get(connectorId);
    if (connector?.dispose) {
      await connector.dispose();
    }
    this.connectors.delete(connectorId);
    this.configs.delete(connectorId);
    this.states.delete(connectorId);
    this.emit({ type: 'unregistered', connectorId });
  }

  /**
   * Get a registered connector by ID.
   */
  get(connectorId: string): Connector | undefined {
    return this.connectors.get(connectorId);
  }

  /**
   * Get all registered connectors.
   */
  getAll(): Connector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Get connectors filtered by category.
   */
  getByCategory(category: ConnectorCategory): Connector[] {
    return this.getAll().filter(c => c.metadata.category === category);
  }

  /**
   * List metadata for all registered connectors (lightweight, for UI).
   */
  listConnectors(): ConnectorMetadata[] {
    return this.getAll().map(c => c.metadata);
  }

  /**
   * Store configuration for a connector.
   */
  setConfig(connectorId: string, config: unknown): void {
    this.configs.set(connectorId, config);
    this.emit({ type: 'config-changed', connectorId });
  }

  /**
   * Get stored configuration for a connector.
   */
  getConfig<T = unknown>(connectorId: string): T | undefined {
    return this.configs.get(connectorId) as T | undefined;
  }

  /**
   * Get the current state of a connector.
   */
  getState(connectorId: string): ConnectorState {
    return this.states.get(connectorId) ?? { status: 'disconnected' };
  }

  /**
   * Directly set the state of a connector (used to restore persisted state on startup).
   */
  setState(connectorId: string, state: ConnectorState): void {
    this.states.set(connectorId, state);
    this.emit({ type: 'state-changed', connectorId });
  }

  /**
   * Test connection for a connector with the given config.
   */
  async testConnection(connectorId: string, config: unknown): Promise<{ success: boolean; error?: string }> {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      return { success: false, error: `Connector "${connectorId}" not found` };
    }

    this.states.set(connectorId, { status: 'connecting' });
    this.emit({ type: 'state-changed', connectorId });

    try {
      const result = await connector.testConnection(config as Record<string, unknown>);
      const newState: ConnectorState = result.success
        ? { status: 'connected', lastConnected: new Date().toISOString() }
        : { status: 'error', error: result.error };
      this.states.set(connectorId, newState);
      if (result.success) {
        this.configs.set(connectorId, config);
      }
      this.emit({ type: 'state-changed', connectorId });
      return result;
    } catch (err) {
      const error = (err as Error).message;
      this.states.set(connectorId, { status: 'error', error });
      this.emit({ type: 'state-changed', connectorId });
      return { success: false, error };
    }
  }

  /**
   * Execute an action on a connector.
   */
  async executeAction(
    connectorId: string,
    actionId: string,
    params?: Record<string, unknown>,
  ): Promise<ConnectorActionResult> {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      return { success: false, error: `Connector "${connectorId}" not found` };
    }

    const config = this.configs.get(connectorId);
    if (!config) {
      return { success: false, error: `Connector "${connectorId}" is not configured` };
    }

    try {
      return await connector.executeAction(actionId, config as Record<string, unknown>, params);
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Subscribe to connector events.
   */
  onEvent(listener: (event: ConnectorEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ConnectorEvent): void {
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* swallow listener errors */ }
    }
  }
}

export type ConnectorEvent =
  | { type: 'registered'; connectorId: string }
  | { type: 'unregistered'; connectorId: string }
  | { type: 'config-changed'; connectorId: string }
  | { type: 'state-changed'; connectorId: string };

// ─── Global singleton ───

let globalRegistry: ConnectorRegistry | null = null;

export function getConnectorRegistry(): ConnectorRegistry {
  if (!globalRegistry) {
    globalRegistry = new ConnectorRegistry();
  }
  return globalRegistry;
}

export function resetConnectorRegistry(): void {
  globalRegistry = null;
}
