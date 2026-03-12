/**
 * useAgentTrace — Manages execution traces for agent runs.
 *
 * Creates trace objects, appends steps in real time, and provides
 * the data needed to render the trace viewer in the UI.
 *
 * Also bridges to the orchestrator event bus so that agent runs
 * are visible in the WorkflowEditor execution log.
 */
import { useState, useCallback, useRef } from 'react';
import { useBackend } from '../context/BackendContext';
import type { AgentTrace, TraceStep, TraceStepStatus, PhaseCategory } from '../types/agent.types';

let stepCounter = 0;
function nextStepId(): string {
  return `step-${++stepCounter}-${Date.now()}`;
}

export function useAgentTrace() {
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const traceRef = useRef<AgentTrace | null>(null);
  const backend = useBackend();

  const activeTrace = traces.find(t => t.id === activeTraceId) || null;

  /** Start a new trace for an agent run */
  const startTrace = useCallback((agentId: string, agentName: string, userRequest: string): string => {
    const id = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const trace: AgentTrace = {
      id,
      agentId,
      agentName,
      userRequest,
      steps: [],
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    traceRef.current = trace;
    setTraces(prev => [trace, ...prev]);
    setActiveTraceId(id);

    // Bridge: save as an execution run so it appears in WorkflowEditor logs
    backend.orchestratorSaveRun({
      id,
      workflowId: `agent:${agentId}`,
      status: 'running',
      startedAt: trace.startedAt,
      steps: [],
    }).catch(() => { /* ignore — non-critical */ });

    return id;
  }, [backend]);

  /** Add a step to the current trace */
  const addStep = useCallback((
    nodeId: string,
    nodeLabel: string,
    category: PhaseCategory,
    type: TraceStep['type'],
    summary: string,
    input?: unknown,
  ): string => {
    const stepId = nextStepId();
    const step: TraceStep = {
      id: stepId,
      nodeId,
      nodeLabel,
      category,
      type,
      summary,
      input,
      status: 'running',
      timestamp: new Date().toISOString(),
    };

    setTraces(prev => prev.map(t => {
      if (t.id !== traceRef.current?.id) return t;
      const updated = { ...t, steps: [...t.steps, step] };
      traceRef.current = updated;
      return updated;
    }));

    return stepId;
  }, []);

  /** Update an existing step (e.g. when it completes) */
  const updateStep = useCallback((stepId: string, updates: Partial<TraceStep>) => {
    setTraces(prev => prev.map(t => {
      if (t.id !== traceRef.current?.id) return t;
      const updated = {
        ...t,
        steps: t.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
      };
      traceRef.current = updated;
      return updated;
    }));
  }, []);

  /** Complete a step with success */
  const completeStep = useCallback((stepId: string, output?: unknown, extras?: Partial<TraceStep>) => {
    updateStep(stepId, {
      status: 'success' as TraceStepStatus,
      output,
      durationMs: Date.now() - new Date(
        traceRef.current?.steps.find(s => s.id === stepId)?.timestamp || Date.now()
      ).getTime(),
      ...extras,
    });
  }, [updateStep]);

  /** Fail a step */
  const failStep = useCallback((stepId: string, error: string) => {
    updateStep(stepId, {
      status: 'error' as TraceStepStatus,
      error,
      durationMs: Date.now() - new Date(
        traceRef.current?.steps.find(s => s.id === stepId)?.timestamp || Date.now()
      ).getTime(),
    });
  }, [updateStep]);

  /** Finish the entire trace */
  const finishTrace = useCallback((status: 'success' | 'error' = 'success') => {
    setTraces(prev => prev.map(t => {
      if (t.id !== traceRef.current?.id) return t;
      const finished = {
        ...t,
        status,
        finishedAt: new Date().toISOString(),
        totalDurationMs: Date.now() - new Date(t.startedAt).getTime(),
      };

      // Bridge: update execution run with final status & steps
      backend.orchestratorSaveRun({
        id: finished.id,
        workflowId: `agent:${finished.agentId}`,
        status: status === 'success' ? 'completed' : 'failed',
        startedAt: finished.startedAt,
        finishedAt: finished.finishedAt,
        steps: finished.steps.map(s => ({
          nodeId: s.nodeId,
          label: s.nodeLabel,
          status: s.status === 'success' ? 'completed' : s.status === 'error' ? 'failed' : s.status,
          durationMs: s.durationMs,
          input: s.input,
          output: s.output,
          error: s.error,
        })),
      }).catch(() => { /* ignore */ });

      traceRef.current = null;
      return finished;
    }));
  }, [backend]);

  return {
    traces,
    activeTrace,
    activeTraceId,
    setActiveTraceId,
    startTrace,
    addStep,
    updateStep,
    completeStep,
    failStep,
    finishTrace,
  };
}
