/**
 * useAgentTrace — Manages execution traces for agent runs.
 *
 * Creates trace objects, appends steps in real time, and provides
 * the data needed to render the trace viewer in the UI.
 *
 * Also bridges to the orchestrator event bus so that agent runs
 * are visible in the WorkflowEditor execution log.
 *
 * NOTE: State updaters must be pure (no side effects inside setTraces callbacks)
 * because React 18 Strict Mode invokes them twice and discards the first result.
 * All ref mutations are done BEFORE calling the state updater.
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

    // Update ref BEFORE state update (so subsequent calls see current trace)
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
    const currentTraceId = traceRef.current?.id;
    if (!currentTraceId) return '';

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

    // Update ref synchronously BEFORE the state update (no mutation inside updater)
    if (traceRef.current) {
      traceRef.current = { ...traceRef.current, steps: [...traceRef.current.steps, step] };
    }

    setTraces(prev => prev.map(t =>
      t.id === currentTraceId
        ? { ...t, steps: [...t.steps, step] }
        : t
    ));

    return stepId;
  }, []);

  /** Update an existing step (e.g. when it completes) */
  const updateStep = useCallback((stepId: string, updates: Partial<TraceStep>) => {
    const currentTraceId = traceRef.current?.id;
    if (!currentTraceId) return;

    // Update ref synchronously BEFORE the state update
    if (traceRef.current) {
      traceRef.current = {
        ...traceRef.current,
        steps: traceRef.current.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
      };
    }

    setTraces(prev => prev.map(t =>
      t.id === currentTraceId
        ? { ...t, steps: t.steps.map(s => s.id === stepId ? { ...s, ...updates } : s) }
        : t
    ));
  }, []);

  /** Complete a step with success */
  const completeStep = useCallback((stepId: string, output?: unknown, extras?: Partial<TraceStep>) => {
    const stepTimestamp = traceRef.current?.steps.find(s => s.id === stepId)?.timestamp;
    updateStep(stepId, {
      status: 'success' as TraceStepStatus,
      output,
      durationMs: Date.now() - new Date(stepTimestamp || Date.now()).getTime(),
      ...extras,
    });
  }, [updateStep]);

  /** Fail a step */
  const failStep = useCallback((stepId: string, error: string) => {
    const stepTimestamp = traceRef.current?.steps.find(s => s.id === stepId)?.timestamp;
    updateStep(stepId, {
      status: 'error' as TraceStepStatus,
      error,
      durationMs: Date.now() - new Date(stepTimestamp || Date.now()).getTime(),
    });
  }, [updateStep]);

  /** Finish the entire trace */
  const finishTrace = useCallback((status: 'success' | 'error' = 'success') => {
    const currentTrace = traceRef.current;
    if (!currentTrace) return;

    // Clear the ref BEFORE the state update so re-invocations (React Strict Mode)
    // don't accidentally process the same trace twice with a nulled-out ref.
    traceRef.current = null;

    const finishedAt = new Date().toISOString();
    const totalDurationMs = Date.now() - new Date(currentTrace.startedAt).getTime();

    // Build the final steps (mark any still-running steps as done)
    const finalSteps = currentTrace.steps.map(s =>
      s.status === 'running'
        ? {
            ...s,
            status: (status === 'success' ? 'success' : 'error') as TraceStepStatus,
            durationMs: s.durationMs ?? (Date.now() - new Date(s.timestamp).getTime()),
            ...(status === 'error' ? { error: 'Agent run stopped' } : {}),
          }
        : s
    );

    // Pure state update — no side effects, uses captured values not the ref
    setTraces(prev => prev.map(t =>
      t.id === currentTrace.id
        ? { ...t, status, finishedAt, totalDurationMs, steps: finalSteps }
        : t
    ));

    // Bridge: update execution run with final status & steps (outside the updater)
    backend.orchestratorSaveRun({
      id: currentTrace.id,
      workflowId: `agent:${currentTrace.agentId}`,
      status: status === 'success' ? 'completed' : 'failed',
      startedAt: currentTrace.startedAt,
      finishedAt,
      steps: finalSteps.map(s => ({
        nodeId: s.nodeId,
        label: s.nodeLabel,
        status: s.status === 'success' ? 'completed' : s.status === 'error' ? 'failed' : s.status,
        durationMs: s.durationMs,
        input: s.input,
        output: s.output,
        error: s.error,
      })),
    }).catch(() => { /* ignore */ });
  }, [backend]);

  /** Clear all traces (optionally finishing any running trace first) */
  const clearTraces = useCallback(() => {
    // If there's a running trace, finish it first
    if (traceRef.current) {
      finishTrace('error');
    }
    setTraces([]);
    setActiveTraceId(null);
  }, [finishTrace]);

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
    clearTraces,
  };
}
