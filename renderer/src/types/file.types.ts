/**
 * File and folder related types
 */

export interface TreeEntry {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeEntry[];
}

export interface FolderResult {
  folderPath: string;
  tree: TreeEntry[];
  hasGit: boolean;
  hasPackageJson: boolean;
  packageName: string | null;
  gitIgnoredPaths: string[];
}

export interface FileResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface SaveResult {
  success: boolean;
  error?: string;
}

export interface Tab {
  name: string;
  path: string;
  content: string;
  modified: boolean;
  readOnly?: boolean;
}

// ── Text Search ──

export interface TextSearchMatch {
  file: string;
  line: number;
  column: number;
  text: string;
  matchLength: number;
}

export interface TextSearchOptions {
  caseSensitive?: boolean;
  maxResults?: number;
  includePattern?: string;
  excludeDirs?: string[];
}

export interface TextSearchResult {
  success: boolean;
  query: string;
  matches: TextSearchMatch[];
  truncated: boolean;
  error?: string;
}
