/**
 * AgentExecutionContext
 *
 * Provides agent trace state and config state to both the ChatPanel
 * (which runs the pipeline) and the AgentsPanel (which renders traces).
 *
 * This is the bridge between execution and observability.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAgentConfigs } from '../hooks/useAgentConfigs';
import { useAgentTrace } from '../hooks/useAgentTrace';
import type { AgentConfig, AgentTrace, TraceStep, PhaseCategory } from '../types/agent.types';

// ── Types ──

export interface AgentExecutionAPI {
  // Config state
  agents: AgentConfig[];
  activeAgent: AgentConfig;
  activeAgentId: string;
  setActiveAgentId: (id: string) => void;
  loading: boolean;
  createAgent: (name: string, description?: string) => Promise<AgentConfig>;
  updateAgent: (config: AgentConfig) => Promise<AgentConfig>;
  deleteAgent: (agentId: string) => Promise<void>;
  renameAgent: (agentId: string, newName: string) => Promise<void>;
  duplicateAgent: (agentId: string) => Promise<AgentConfig | undefined>;

  // Trace state
  traces: AgentTrace[];
  activeTrace: AgentTrace | null;
  activeTraceId: string | null;
  setActiveTraceId: (id: string | null) => void;
  startTrace: (agentId: string, agentName: string, userRequest: string) => string;
  addStep: (
    nodeId: string,
    nodeLabel: string,
    category: PhaseCategory,
    type: TraceStep['type'],
    summary: string,
    input?: unknown,
  ) => string;
  updateStep: (stepId: string, updates: Partial<TraceStep>) => void;
  completeStep: (stepId: string, output?: unknown, extras?: Partial<TraceStep>) => void;
  failStep: (stepId: string, error: string) => void;
  finishTrace: (status?: 'success' | 'error') => void;
}

// ── Context ──

const AgentExecCtx = createContext<AgentExecutionAPI | null>(null);

export function useAgentExecution(): AgentExecutionAPI {
  const ctx = useContext(AgentExecCtx);
  if (!ctx) throw new Error('useAgentExecution must be used within <AgentExecutionProvider>');
  return ctx;
}

// ── Provider ──

export function AgentExecutionProvider({ children }: { children: ReactNode }) {
  const configs = useAgentConfigs();
  const trace = useAgentTrace();

  const value = useMemo<AgentExecutionAPI>(() => ({
    // Configs
    agents: configs.agents,
    activeAgent: configs.activeAgent,
    activeAgentId: configs.activeAgentId,
    setActiveAgentId: configs.setActiveAgentId,
    loading: configs.loading,
    createAgent: configs.createAgent,
    updateAgent: configs.updateAgent,
    deleteAgent: configs.deleteAgent,
    renameAgent: configs.renameAgent,
    duplicateAgent: configs.duplicateAgent,

    // Traces
    traces: trace.traces,
    activeTrace: trace.activeTrace,
    activeTraceId: trace.activeTraceId,
    setActiveTraceId: trace.setActiveTraceId,
    startTrace: trace.startTrace,
    addStep: trace.addStep,
    updateStep: trace.updateStep,
    completeStep: trace.completeStep,
    failStep: trace.failStep,
    finishTrace: trace.finishTrace,
  }), [configs, trace]);

  return (
    <AgentExecCtx.Provider value={value}>
      {children}
    </AgentExecCtx.Provider>
  );
}
