import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { TreeEntry, Tab, GitChange, GitFileChange, GitBranchInfo, SidePanel, NpmProject, SupabaseConfig } from '../types';
import { useBackend } from './BackendContext';
import { useGitOps } from '../hooks/useGitOps';
import { useTabManager } from '../hooks/useTabManager';

interface WorkspaceContextValue {
  folderPath: string | null;
  folderName: string;
  tree: TreeEntry[];
  hasGit: boolean;
  hasPackageJson: boolean;
  packageName: string | null;
  openTabs: Tab[];
  activeTabPath: string | null;
  activePanel: SidePanel;
  gitChanges: GitChange[];
  gitSplitChanges: GitFileChange[];
  gitBranchInfo: GitBranchInfo | null;
  gitIgnoredPaths: string[];
  supabaseConfig: SupabaseConfig | null;
  setActivePanel: (p: SidePanel) => void;
  importFolder: () => Promise<void>;
  closeWorkspace: () => void;
  openFile: (name: string, filePath: string, readOnly?: boolean) => Promise<void>;
  closeTab: (filePath: string) => void;
  closeOtherTabs: (filePath: string) => void;
  closeAllTabs: () => void;
  closeTabsToTheRight: (filePath: string) => void;
  updateTabContent: (filePath: string, content: string) => void;
  setTabData: (filePath: string, content: string) => void;
  setActiveTabPath: (path: string | null) => void;
  saveFile: (filePath: string) => Promise<void>;
  refreshGitStatus: () => Promise<void>;
  refreshTree: () => Promise<void>;
  createFile: (parentPath: string, fileName: string) => Promise<{ success: boolean; error?: string; filePath?: string }>;
  createFolder: (parentPath: string, folderName: string) => Promise<{ success: boolean; error?: string }>;
  deleteItem: (itemPath: string) => Promise<{ success: boolean; error?: string }>;
  renameItem: (oldPath: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  openDiff: (filePath: string) => Promise<void>;
  stageFile: (filePath: string) => Promise<void>;
  unstageFile: (filePath: string) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  discardFile: (filePath: string) => Promise<void>;
  gitCommit: (message: string) => Promise<{ success: boolean; error?: string }>;
  gitPush: () => Promise<{ success: boolean; error?: string }>;
  gitPull: () => Promise<{ success: boolean; error?: string }>;
  gitCheckout: (branch: string) => Promise<{ success: boolean; error?: string }>;
  gitCreateBranch: (branchName: string) => Promise<{ success: boolean; error?: string }>;
  npmProjects: NpmProject[];
  runNpmScript: (projectPath: string, scriptName: string) => void;
  openSupabaseTab: (tabType: 'users' | 'storage') => void;
  openSqlQueryTab: (query: string) => void;
  openAgentsTab: () => void;
  openWorkflowEditor: (workflowId?: string, workflowName?: string) => void;
  openDebugTraceTab: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();

  // ── Core workspace state ──
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [hasGit, setHasGit] = useState(false);
  const [hasPackageJson, setHasPackageJson] = useState(false);
  const [packageName, setPackageName] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<SidePanel>('explorer');
  const [npmProjects, setNpmProjects] = useState<NpmProject[]>([]);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | null>(null);

  // ── Composed hooks ──
  const gitOps = useGitOps(folderPath);
  const tabManager = useTabManager(folderPath);

  // ── Tree & file operations ──
  const refreshTree = useCallback(async () => {
    if (!folderPath) return;
    const newTree = await backend.refreshTree(folderPath);
    setTree(newTree);
  }, [folderPath]);

  const createFile = useCallback(async (parentPath: string, fileName: string) => {
    const filePath = `${parentPath}/${fileName}`;
    const result = await backend.createFile(filePath);
    if (result.success) {
      await refreshTree();
      return { success: true, filePath };
    }
    return { success: false, error: result.error };
  }, [refreshTree]);

  const createFolder = useCallback(async (parentPath: string, folderName: string) => {
    const folderFullPath = `${parentPath}/${folderName}`;
    const result = await backend.createFolder(folderFullPath);
    if (result.success) await refreshTree();
    return result;
  }, [refreshTree]);

  const deleteItem = useCallback(async (itemPath: string) => {
    const result = await backend.deleteFileOrFolder(itemPath);
    if (result.success) {
      tabManager.setOpenTabs(prev => prev.filter(t => !t.path.startsWith(itemPath)));
      await refreshTree();
      await gitOps.refreshGitStatus();
    }
    return result;
  }, [refreshTree, gitOps.refreshGitStatus, tabManager.setOpenTabs]);

  const renameItem = useCallback(async (oldPath: string, newName: string) => {
    const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = `${parentDir}/${newName}`;
    const result = await backend.renameFileOrFolder(oldPath, newPath);
    if (result.success) {
      tabManager.setOpenTabs(prev => prev.map(t => {
        if (t.path === oldPath) return { ...t, name: newName, path: newPath };
        if (t.path.startsWith(oldPath + '/')) {
          const newTabPath = t.path.replace(oldPath, newPath);
          return { ...t, path: newTabPath };
        }
        return t;
      }));
      await refreshTree();
    }
    return result;
  }, [refreshTree, tabManager.setOpenTabs]);

  // ── Workspace loading ──
  const loadWorkspaceResult = useCallback(async (result: { folderPath: string; tree: TreeEntry[]; hasGit: boolean; hasPackageJson: boolean; packageName: string | null; gitIgnoredPaths: string[] }) => {
    setFolderPath(result.folderPath);
    setFolderName(result.folderPath.split('/').pop() ?? result.folderPath.split('\\').pop() ?? '');
    setTree(result.tree);
    setHasGit(result.hasGit);
    setHasPackageJson(result.hasPackageJson);
    setPackageName(result.packageName);
    const ignoredPaths = result.gitIgnoredPaths ?? [];
    gitOps.setGitIgnoredPaths(ignoredPaths);

    if (result.hasGit) {
      const changes = await backend.gitStatus(result.folderPath);
      gitOps.setGitChanges(changes);
    }

    const projects = await backend.getAllNpmProjects(result.folderPath, ignoredPaths);
    setNpmProjects(projects);

    const supabase = await backend.detectSupabase(result.folderPath);
    setSupabaseConfig(supabase);

    // Auto-open: prefer .html files (shown as preview), then README, then first file
    const rootFiles = result.tree.filter(e => e.type === 'file');
    const htmlFile = rootFiles.find(f => f.name.toLowerCase().endsWith('.html'));
    const readme = rootFiles.find(f => f.name.toLowerCase().startsWith('readme'));
    const toOpen = htmlFile ?? readme ?? rootFiles[0];
    if (toOpen) {
      const res = await backend.readFile(toOpen.path);
      if (res.success && res.content) {
        tabManager.setOpenTabs([{ name: toOpen.name, path: toOpen.path, content: res.content, modified: false }]);
        tabManager.setActiveTabPath(toOpen.path);
      }
    }
  }, []);

  const importFolder = useCallback(async () => {
    const result = await backend.selectFolder();
    if (!result) return;
    await loadWorkspaceResult(result);
  }, [loadWorkspaceResult]);

  const closeWorkspace = useCallback(() => {
    setFolderPath(null);
    setFolderName('');
    setTree([]);
    setHasGit(false);
    setHasPackageJson(false);
    setPackageName(null);
    tabManager.setOpenTabs([]);
    tabManager.setActiveTabPath(null);
    gitOps.setGitChanges([]);
    gitOps.setGitSplitChanges([]);
    gitOps.setGitBranch(null);
    gitOps.setGitIgnoredPaths([]);
    setNpmProjects([]);
    setSupabaseConfig(null);
  }, []);

  const openWorkspaceByPath = useCallback(async (path: string) => {
    const result = await backend.openFolder(path);
    if (!result) return;
    await loadWorkspaceResult(result);
  }, [loadWorkspaceResult]);

  // Listen for open-workspace events from Welcome component
  useEffect(() => {
    const handler = async (e: Event) => {
      const customEvent = e as CustomEvent<{
        folderPath: string;
        openPreview?: boolean;
        previewHtml?: string;
        previewName?: string;
      }>;
      const detail = customEvent.detail;
      if (detail?.folderPath) {
        await openWorkspaceByPath(detail.folderPath);

        // After workspace loads, auto-open HTML preview tab if requested
        if (detail.openPreview && detail.previewHtml) {
          const tabKey = `html-preview:${Date.now()}`;
          const name = detail.previewName || 'Preview';
          // Small delay to ensure workspace state has settled
          setTimeout(() => {
            tabManager.openHtmlPreview(tabKey, name, detail.previewHtml!);
          }, 100);
        }
      }
    };
    window.addEventListener('open-workspace', handler);
    return () => window.removeEventListener('open-workspace', handler);
  }, [openWorkspaceByPath]);

  // Listen for custom event to open GitHub logs tab
  useEffect(() => {
    const handler = (e: CustomEvent<{ jobName: string; jobId: number; logs: string }>) => {
      const tabKey = `github-logs:${e.detail.jobId}`;
      const existing = tabManager.openTabs.find(t => t.path === tabKey);
      if (existing) { tabManager.setActiveTabPath(tabKey); return; }
      tabManager.setOpenTabs(prev => [...prev, {
        name: `Logs: ${e.detail.jobName}`,
        path: tabKey,
        content: e.detail.logs,
        modified: false,
        readOnly: true,
      }]);
      tabManager.setActiveTabPath(tabKey);
    };
    window.addEventListener('open-github-logs-tab', handler as EventListener);
    return () => window.removeEventListener('open-github-logs-tab', handler as EventListener);
  }, [tabManager.openTabs]);

  // Listen for custom event to open HTML preview tab
  useEffect(() => {
    const handler = (e: CustomEvent<{ name: string; tabKey: string; html: string }>) => {
      tabManager.openHtmlPreview(e.detail.tabKey, e.detail.name, e.detail.html);
    };
    window.addEventListener('open-html-preview-tab', handler as EventListener);
    return () => window.removeEventListener('open-html-preview-tab', handler as EventListener);
  }, [tabManager.openHtmlPreview]);

  // Listen for custom event to open Workflow Editor tab
  useEffect(() => {
    const handler = (e: CustomEvent<{ workflowId?: string; workflowName?: string }>) => {
      tabManager.openWorkflowEditor(e.detail?.workflowId, e.detail?.workflowName);
    };
    window.addEventListener('open-workflow-editor-tab', handler as EventListener);
    return () => window.removeEventListener('open-workflow-editor-tab', handler as EventListener);
  }, [tabManager.openWorkflowEditor]);

  const runNpmScript = useCallback((projectPath: string, scriptName: string) => {
    window.dispatchEvent(new CustomEvent('show-terminal'));
    const projectName = projectPath.split('/').pop() || projectPath;
    window.dispatchEvent(new CustomEvent('run-terminal-command', {
      detail: { cwd: projectPath, command: `npm run ${scriptName}`, label: `${projectName}: ${scriptName}` },
    }));
  }, []);

  return (
    <WorkspaceContext.Provider value={{
      folderPath, folderName, tree, hasGit, hasPackageJson, packageName,
      openTabs: tabManager.openTabs, activeTabPath: tabManager.activeTabPath,
      activePanel,
      gitChanges: gitOps.gitChanges,
      gitSplitChanges: gitOps.gitSplitChanges,
      gitBranchInfo: gitOps.gitBranchInfo,
      gitIgnoredPaths: gitOps.gitIgnoredPaths,
      supabaseConfig,
      setActivePanel, importFolder, closeWorkspace,
      openFile: tabManager.openFile, closeTab: tabManager.closeTab,
      closeOtherTabs: tabManager.closeOtherTabs, closeAllTabs: tabManager.closeAllTabs,
      closeTabsToTheRight: tabManager.closeTabsToTheRight,
      updateTabContent: tabManager.updateTabContent, setTabData: tabManager.setTabData,
      setActiveTabPath: tabManager.setActiveTabPath, saveFile: tabManager.saveFile,
      refreshGitStatus: gitOps.refreshGitStatus, refreshTree,
      createFile, createFolder, deleteItem, renameItem,
      openDiff: tabManager.openDiff,
      stageFile: gitOps.stageFile, unstageFile: gitOps.unstageFile,
      stageAll: gitOps.stageAll, unstageAll: gitOps.unstageAll,
      discardFile: gitOps.discardFile, gitCommit: gitOps.gitCommit,
      gitPush: gitOps.gitPush, gitPull: gitOps.gitPull,
      gitCheckout: gitOps.gitCheckout, gitCreateBranch: gitOps.gitCreateBranch,
      npmProjects, runNpmScript,
      openSupabaseTab: tabManager.openSupabaseTab,
      openSqlQueryTab: tabManager.openSqlQueryTab,
      openAgentsTab: tabManager.openAgentsTab,
      openWorkflowEditor: tabManager.openWorkflowEditor,
      openDebugTraceTab: tabManager.openDebugTraceTab,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
