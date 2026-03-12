/**
 * useGitOps — Git operations hook extracted from WorkspaceContext.
 * Handles staging, unstaging, committing, pushing, pulling, branching.
 */
import { useState, useCallback, useRef } from 'react';
import type { GitChange, GitFileChange, GitBranchInfo } from '../types';
import { useBackend } from '../context/BackendContext';

export interface GitOpsState {
  gitChanges: GitChange[];
  gitSplitChanges: GitFileChange[];
  gitBranchInfo: GitBranchInfo | null;
  gitIgnoredPaths: string[];
}

export interface GitOpsActions {
  refreshGitStatus: () => Promise<void>;
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
  setGitChanges: (v: GitChange[]) => void;
  setGitSplitChanges: (v: GitFileChange[]) => void;
  setGitBranch: (v: GitBranchInfo | null) => void;
  setGitIgnoredPaths: (v: string[]) => void;
}

export function useGitOps(folderPath: string | null): GitOpsState & GitOpsActions {
  const backend = useBackend();
  const [gitChanges, setGitChanges] = useState<GitChange[]>([]);
  const [gitSplitChanges, setGitSplitChanges] = useState<GitFileChange[]>([]);
  const [gitBranch, setGitBranch] = useState<GitBranchInfo | null>(null);
  const [gitIgnoredPaths, setGitIgnoredPaths] = useState<string[]>([]);
  const gitLockRef = useRef(false);

  const refreshGitStatus = useCallback(async () => {
    if (!folderPath) return;
    if (gitLockRef.current) return;
    gitLockRef.current = true;
    try {
      const changes = await backend.gitStatus(folderPath);
      setGitChanges(changes);
      const split = await backend.gitStatusSplit(folderPath);
      setGitSplitChanges(split);
      const branch = await backend.gitBranchInfo(folderPath);
      setGitBranch(branch);
    } finally {
      gitLockRef.current = false;
    }
  }, [folderPath]);

  const stageFile = useCallback(async (filePath: string) => {
    if (!folderPath) return;
    await backend.gitStage(folderPath, filePath);
    await refreshGitStatus();
  }, [folderPath, refreshGitStatus]);

  const unstageFile = useCallback(async (filePath: string) => {
    if (!folderPath) return;
    await backend.gitUnstage(folderPath, filePath);
    await refreshGitStatus();
  }, [folderPath, refreshGitStatus]);

  const stageAll = useCallback(async () => {
    if (!folderPath) return;
    await backend.gitStageAll(folderPath);
    await refreshGitStatus();
  }, [folderPath, refreshGitStatus]);

  const unstageAll = useCallback(async () => {
    if (!folderPath) return;
    await backend.gitUnstageAll(folderPath);
    await refreshGitStatus();
  }, [folderPath, refreshGitStatus]);

  const discardFile = useCallback(async (filePath: string) => {
    if (!folderPath) return;
    await backend.gitDiscard(folderPath, filePath);
    await refreshGitStatus();
  }, [folderPath, refreshGitStatus]);

  const commitChanges = useCallback(async (message: string) => {
    if (!folderPath) return { success: false, error: 'No folder open' };
    const result = await backend.gitCommit(folderPath, message);
    await refreshGitStatus();
    return result;
  }, [folderPath, refreshGitStatus]);

  const pushChanges = useCallback(async () => {
    if (!folderPath) return { success: false, error: 'No folder open' };
    const result = await backend.gitPush(folderPath);
    await refreshGitStatus();
    return result;
  }, [folderPath, refreshGitStatus]);

  const pullChanges = useCallback(async () => {
    if (!folderPath) return { success: false, error: 'No folder open' };
    const result = await backend.gitPull(folderPath);
    await refreshGitStatus();
    return result;
  }, [folderPath, refreshGitStatus]);

  const checkoutBranch = useCallback(async (branch: string) => {
    if (!folderPath) return { success: false, error: 'No folder open' };
    const result = await backend.gitCheckout(folderPath, branch);
    await refreshGitStatus();
    return result;
  }, [folderPath, refreshGitStatus]);

  const createBranch = useCallback(async (branchName: string) => {
    if (!folderPath) return { success: false, error: 'No folder open' };
    const result = await backend.gitCreateBranch(folderPath, branchName);
    await refreshGitStatus();
    return result;
  }, [folderPath, refreshGitStatus]);

  return {
    gitChanges,
    gitSplitChanges,
    gitBranchInfo: gitBranch,
    gitIgnoredPaths,
    refreshGitStatus,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    discardFile,
    gitCommit: commitChanges,
    gitPush: pushChanges,
    gitPull: pullChanges,
    gitCheckout: checkoutBranch,
    gitCreateBranch: createBranch,
    setGitChanges,
    setGitSplitChanges,
    setGitBranch,
    setGitIgnoredPaths,
  };
}
