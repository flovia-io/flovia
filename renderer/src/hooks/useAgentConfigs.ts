/**
 * useAgentConfigs — Manages agent configurations with persistence.
 *
 * Loads saved agents on mount, provides CRUD operations, and merges
 * the built-in default agent so it always appears in the list.
 */
import { useState, useEffect, useCallback } from 'react';
import type { AgentConfig } from '../types/agent.types';
import { useBackend } from '../context/BackendContext';
import { DEFAULT_AGENT_CONFIG, createAgentFromDefault } from '../agents/defaultAgent';

export function useAgentConfigs() {
  const backend = useBackend();
  const [agents, setAgents] = useState<AgentConfig[]>([DEFAULT_AGENT_CONFIG]);
  const [activeAgentId, setActiveAgentId] = useState<string>('default');
  const [loading, setLoading] = useState(true);

  // Load saved configs on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = (await backend.agentLoadConfigs()) as AgentConfig[];
        // Merge: default always first, then saved custom agents
        const custom = saved.filter(c => c.id !== 'default');
        setAgents([DEFAULT_AGENT_CONFIG, ...custom]);
      } catch {
        setAgents([DEFAULT_AGENT_CONFIG]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeAgent = agents.find(a => a.id === activeAgentId) || DEFAULT_AGENT_CONFIG;

  const createAgent = useCallback(async (name: string, description?: string) => {
    const newAgent = createAgentFromDefault(name, description);
    setAgents(prev => [...prev, newAgent]);
    setActiveAgentId(newAgent.id);
    await backend.agentSaveConfig(newAgent);
    return newAgent;
  }, [backend]);

  const updateAgent = useCallback(async (config: AgentConfig) => {
    const updated = { ...config, updatedAt: new Date().toISOString() };
    setAgents(prev => prev.map(a => a.id === updated.id ? updated : a));
    if (!updated.isDefault) {
      await backend.agentSaveConfig(updated);
    }
    return updated;
  }, [backend]);

  const deleteAgent = useCallback(async (agentId: string) => {
    if (agentId === 'default') return; // Can't delete default
    setAgents(prev => prev.filter(a => a.id !== agentId));
    if (activeAgentId === agentId) setActiveAgentId('default');
    await backend.agentDeleteConfig(agentId);
  }, [activeAgentId, backend]);

  const renameAgent = useCallback(async (agentId: string, newName: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || agent.isDefault) return;
    const updated = { ...agent, name: newName, updatedAt: new Date().toISOString() };
    setAgents(prev => prev.map(a => a.id === agentId ? updated : a));
    await backend.agentSaveConfig(updated);
  }, [agents, backend]);

  const duplicateAgent = useCallback(async (agentId: string) => {
    const source = agents.find(a => a.id === agentId);
    if (!source) return;
    const copy: AgentConfig = {
      ...structuredClone(source),
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${source.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDefault: false,
    };
    setAgents(prev => [...prev, copy]);
    setActiveAgentId(copy.id);
    await backend.agentSaveConfig(copy);
    return copy;
  }, [agents, backend]);

  return {
    agents,
    activeAgent,
    activeAgentId,
    setActiveAgentId,
    loading,
    createAgent,
    updateAgent,
    deleteAgent,
    renameAgent,
    duplicateAgent,
  };
}
