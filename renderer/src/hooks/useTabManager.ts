/**
 * useTabManager — Tab lifecycle hook extracted from WorkspaceContext.
 * Handles opening, closing, updating, and saving editor tabs.
 */
import { useState, useCallback } from 'react';
import type { Tab } from '../types';
import { useBackend } from '../context/BackendContext';

export interface TabManagerState {
  openTabs: Tab[];
  activeTabPath: string | null;
}

export interface TabManagerActions {
  openFile: (name: string, filePath: string, readOnly?: boolean) => Promise<void>;
  closeTab: (filePath: string) => void;
  closeOtherTabs: (filePath: string) => void;
  closeAllTabs: () => void;
  closeTabsToTheRight: (filePath: string) => void;
  updateTabContent: (filePath: string, content: string) => void;
  setTabData: (filePath: string, content: string) => void;
  setActiveTabPath: (path: string | null) => void;
  saveFile: (filePath: string) => Promise<void>;
  setOpenTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  openDiff: (filePath: string) => Promise<void>;
  openSupabaseTab: (tabType: 'users' | 'storage') => void;
  openSqlQueryTab: (query: string) => void;
  openAgentsTab: () => void;
  openHtmlPreview: (tabKey: string, name: string, html: string) => void;
  openWorkflowEditor: (workflowId?: string, workflowName?: string) => void;
  openDebugTraceTab: () => void;
}

export function useTabManager(folderPath: string | null): TabManagerState & TabManagerActions {
  const backend = useBackend();
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  const openFile = useCallback(async (name: string, filePath: string, readOnly = false) => {
    const existing = openTabs.find(t => t.path === filePath);
    if (existing) { setActiveTabPath(filePath); return; }
    const result = await backend.readFile(filePath);
    if (!result.success || !result.content) return;
    setOpenTabs(prev => [...prev, { name, path: filePath, content: result.content!, modified: false, readOnly }]);
    setActiveTabPath(filePath);
  }, [openTabs]);

  const openDiff = useCallback(async (filePath: string) => {
    if (!folderPath) return;
    const diffKey = `diff:${filePath}`;
    const existing = openTabs.find(t => t.path === diffKey);
    if (existing) { setActiveTabPath(diffKey); return; }
    const diff = await backend.gitDiff(folderPath, filePath);
    const name = filePath.split('/').pop() ?? filePath;
    setOpenTabs(prev => [...prev, {
      name: `Δ ${name}`,
      path: diffKey,
      content: JSON.stringify(diff),
      modified: false,
      readOnly: true,
    }]);
    setActiveTabPath(diffKey);
  }, [folderPath, openTabs]);

  const openSupabaseTab = useCallback((tabType: 'users' | 'storage') => {
    const tabKey = `supabase:${tabType}`;
    const existing = openTabs.find(t => t.path === tabKey);
    if (existing) { setActiveTabPath(tabKey); return; }
    const tabNames: Record<string, string> = { users: 'Supabase: Users', storage: 'Supabase: Storage' };
    setOpenTabs(prev => [...prev, {
      name: tabNames[tabType] || tabType,
      path: tabKey,
      content: '',
      modified: false,
      readOnly: true,
    }]);
    setActiveTabPath(tabKey);
  }, [openTabs]);

  const openSqlQueryTab = useCallback((query: string) => {
    const queryId = Date.now().toString();
    const tabKey = `sql-result:${queryId}`;
    setOpenTabs(prev => [...prev, {
      name: 'Query Results',
      path: tabKey,
      content: JSON.stringify({ query, result: null }),
      modified: false,
      readOnly: true,
    }]);
    setActiveTabPath(tabKey);
  }, []);

  const openAgentsTab = useCallback(() => {
    const tabKey = 'agents:flow';
    const existing = openTabs.find(t => t.path === tabKey);
    if (existing) { setActiveTabPath(tabKey); return; }
    setOpenTabs(prev => [...prev, {
      name: '🤖 Agents',
      path: tabKey,
      content: '',
      modified: false,
      readOnly: true,
    }]);
    setActiveTabPath(tabKey);
  }, [openTabs]);

  const openHtmlPreview = useCallback((tabKey: string, name: string, html: string) => {
    const existing = openTabs.find(t => t.path === tabKey);
    if (existing) { setActiveTabPath(tabKey); return; }
    setOpenTabs(prev => [...prev, {
      name: `🌐 ${name}`,
      path: tabKey,
      content: html,
      modified: false,
      readOnly: true,
    }]);
    setActiveTabPath(tabKey);
  }, [openTabs]);

  const openWorkflowEditor = useCallback((workflowId?: string, workflowName?: string) => {
    const tabKey = workflowId ? `workflow:${workflowId}` : 'workflow:new';
    const existing = openTabs.find(t => t.path === tabKey);
    if (existing) { setActiveTabPath(tabKey); return; }
    setOpenTabs(prev => [...prev, {
      name: `⚡ ${workflowName || 'Workflow Editor'}`,
      path: tabKey,
      content: workflowId || '',
      modified: false,
      readOnly: true,
    }]);
    setActiveTabPath(tabKey);
  }, [openTabs]);

  const openDebugTraceTab = useCallback(() => {
    const tabKey = 'debug:trace';
    const existing = openTabs.find(t => t.path === tabKey);
    if (existing) { setActiveTabPath(tabKey); return; }
    setOpenTabs(prev => [...prev, {
      name: '🐛 AI Debug',
      path: tabKey,
      content: '',
      modified: false,
      readOnly: true,
    }]);
    setActiveTabPath(tabKey);
  }, [openTabs]);

  const closeTab = useCallback((filePath: string) => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t.path !== filePath);
      if (activeTabPath === filePath) setActiveTabPath(next.length > 0 ? next[next.length - 1].path : null);
      return next;
    });
  }, [activeTabPath]);

  const closeOtherTabs = useCallback((filePath: string) => {
    setOpenTabs(prev => {
      const kept = prev.filter(t => t.path === filePath);
      setActiveTabPath(kept.length > 0 ? kept[0].path : null);
      return kept;
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    setOpenTabs([]);
    setActiveTabPath(null);
  }, []);

  const closeTabsToTheRight = useCallback((filePath: string) => {
    setOpenTabs(prev => {
      const idx = prev.findIndex(t => t.path === filePath);
      if (idx === -1) return prev;
      const kept = prev.slice(0, idx + 1);
      if (activeTabPath && !kept.some(t => t.path === activeTabPath)) {
        setActiveTabPath(kept[kept.length - 1]?.path ?? null);
      }
      return kept;
    });
  }, [activeTabPath]);

  const updateTabContent = useCallback((filePath: string, content: string) => {
    setOpenTabs(prev => prev.map(t => (t.path === filePath ? { ...t, content, modified: true } : t)));
  }, []);

  const setTabData = useCallback((filePath: string, content: string) => {
    setOpenTabs(prev => prev.map(t => (t.path === filePath ? { ...t, content } : t)));
  }, []);

  const saveFile = useCallback(async (filePath: string) => {
    const tab = openTabs.find(t => t.path === filePath);
    if (!tab || tab.readOnly) return;
    const result = await backend.saveFile(filePath, tab.content);
    if (result.success) setOpenTabs(prev => prev.map(t => (t.path === filePath ? { ...t, modified: false } : t)));
  }, [openTabs]);

  return {
    openTabs,
    activeTabPath,
    openFile,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    closeTabsToTheRight,
    updateTabContent,
    setTabData,
    setActiveTabPath,
    saveFile,
    setOpenTabs,
    openDiff,
    openSupabaseTab,
    openSqlQueryTab,
    openAgentsTab,
    openHtmlPreview,
    openWorkflowEditor,
    openDebugTraceTab,
  };
}
