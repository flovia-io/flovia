/**
 * Event Bus — Cross-cutting event system for the agentic workspace.
 *
 * Hexagonal: this is a pure domain service, no transport dependency.
 * Adapters (Electron IPC, WebSocket, CLI stdout) subscribe and relay events.
 *
 * Events cover:
 *  • Workflow execution lifecycle (step start/complete/fail)
 *  • Agent trace steps (LLM calls, tool calls, decisions)
 *  • Connector state changes
 *  • User actions (approval, cancellation)
 */

// ─── Event Types ────────────────────────────────────────────────────────────

export type EventCategory =
  | 'workflow'     // workflow-level events
  | 'step'        // individual step events
  | 'agent'       // agent profile events
  | 'connector'   // connector state events
  | 'trace'       // execution trace events (for UI observability)
  | 'system';     // system-level events (errors, warnings)

export interface BusEvent<T = unknown> {
  /** Unique event ID */
  id: string;
  /** Event category for filtering */
  category: EventCategory;
  /** Specific event type within the category */
  type: string;
  /** Event payload */
  data: T;
  /** ISO timestamp */
  timestamp: string;
  /** Source identifier (e.g., workflow ID, agent ID) */
  source?: string;
  /** Correlation ID to link related events (e.g., all events from one run) */
  correlationId?: string;
}

// ─── Specific Event Payloads ────────────────────────────────────────────────

export interface WorkflowStartedEvent {
  workflowId: string;
  workflowName: string;
  totalSteps: number;
}

export interface WorkflowCompletedEvent {
  workflowId: string;
  status: 'completed' | 'failed' | 'paused';
  durationMs: number;
  stepsCompleted: number;
  stepsFailed: number;
}

export interface StepStartedEvent {
  workflowId: string;
  stepId: string;
  stepLabel: string;
  stepKind: string;
  dependsOn: string[];
}

export interface StepCompletedEvent {
  workflowId: string;
  stepId: string;
  stepLabel: string;
  stepKind: string;
  status: 'completed' | 'failed' | 'skipped';
  durationMs: number;
  artifactCount: number;
  error?: string;
}

export interface TraceStepEvent {
  traceId: string;
  agentId: string;
  stepId: string;
  nodeId: string;
  nodeLabel: string;
  category: string;
  type: 'llm-call' | 'tool-call' | 'file-read' | 'file-write' | 'file-search' | 'text-search' | 'integration-call' | 'decision';
  status: 'started' | 'completed' | 'failed';
  summary: string;
  input?: unknown;
  output?: unknown;
  durationMs?: number;
  tokens?: { prompt: number; completion: number; total: number };
  error?: string;
}

export interface AgentRunStartedEvent {
  runId: string;
  agentId: string;
  agentName: string;
  userRequest: string;
}

export interface AgentRunCompletedEvent {
  runId: string;
  agentId: string;
  status: 'success' | 'error';
  totalSteps: number;
  durationMs: number;
}

// ─── Listener Types ─────────────────────────────────────────────────────────

export type EventListener<T = unknown> = (event: BusEvent<T>) => void;
export type EventFilter = {
  category?: EventCategory;
  type?: string;
  source?: string;
  correlationId?: string;
};

// ─── Event Bus Implementation ───────────────────────────────────────────────

import { genId } from './utils';

export class EventBus {
  private listeners = new Map<string, Set<EventListener>>();
  private globalListeners = new Set<EventListener>();
  private history: BusEvent[] = [];
  private maxHistory: number;

  constructor(options?: { maxHistory?: number }) {
    this.maxHistory = options?.maxHistory ?? 1000;
  }

  /**
   * Emit an event to all matching listeners.
   */
  emit<T>(category: EventCategory, type: string, data: T, opts?: {
    source?: string;
    correlationId?: string;
  }): BusEvent<T> {
    const event: BusEvent<T> = {
      id: genId(),
      category,
      type,
      data,
      timestamp: new Date().toISOString(),
      source: opts?.source,
      correlationId: opts?.correlationId,
    };

    // Store in history
    this.history.push(event as BusEvent);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    // Notify category-specific listeners
    const key = `${category}:${type}`;
    const specific = this.listeners.get(key);
    if (specific) {
      for (const listener of specific) {
        try { listener(event as BusEvent); } catch { /* swallow listener errors */ }
      }
    }

    // Notify category-wide listeners
    const categoryWide = this.listeners.get(category);
    if (categoryWide) {
      for (const listener of categoryWide) {
        try { listener(event as BusEvent); } catch { /* swallow */ }
      }
    }

    // Notify global listeners
    for (const listener of this.globalListeners) {
      try { listener(event as BusEvent); } catch { /* swallow */ }
    }

    return event;
  }

  /**
   * Subscribe to a specific category:type combination.
   * Returns an unsubscribe function.
   */
  on<T = unknown>(category: EventCategory, type: string, listener: EventListener<T>): () => void {
    const key = `${category}:${type}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener as EventListener);
    return () => this.listeners.get(key)?.delete(listener as EventListener);
  }

  /**
   * Subscribe to all events in a category.
   */
  onCategory(category: EventCategory, listener: EventListener): () => void {
    if (!this.listeners.has(category)) {
      this.listeners.set(category, new Set());
    }
    this.listeners.get(category)!.add(listener);
    return () => this.listeners.get(category)?.delete(listener);
  }

  /**
   * Subscribe to ALL events (useful for debug/logging adapters).
   */
  onAll(listener: EventListener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  /**
   * Get recent event history, optionally filtered.
   */
  getHistory(filter?: EventFilter): BusEvent[] {
    let events = this.history;
    if (filter?.category) events = events.filter(e => e.category === filter.category);
    if (filter?.type) events = events.filter(e => e.type === filter.type);
    if (filter?.source) events = events.filter(e => e.source === filter.source);
    if (filter?.correlationId) events = events.filter(e => e.correlationId === filter.correlationId);
    return events;
  }

  /**
   * Get all events for a specific run/correlation.
   */
  getRunEvents(correlationId: string): BusEvent[] {
    return this.history.filter(e => e.correlationId === correlationId);
  }

  /**
   * Clear event history.
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Remove all listeners.
   */
  dispose(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _bus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!_bus) {
    _bus = new EventBus({ maxHistory: 2000 });
  }
  return _bus;
}

export function resetEventBus(): void {
  _bus?.dispose();
  _bus = null;
}
