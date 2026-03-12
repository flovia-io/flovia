/**
 * Git related types
 */

export interface GitChange {
  file: string;
  status: string;
}

export interface GitFileChange {
  file: string;
  status: string;
  staged: boolean;
}

export interface DiffResult {
  oldContent: string;
  newContent: string;
}

export interface GitBranchInfo {
  current: string;
  branches: string[];
  ahead: number;
  behind: number;
  hasRemote: boolean;
}

export interface GitOpResult {
  success: boolean;
  output?: string;
  error?: string;
}
