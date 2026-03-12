/**
 * Diff computation utilities
 */

export interface SimpleDiff {
  added: string[];
  removed: string[];
}

/**
 * Compute a simple diff showing added and removed lines
 * @param before Original content
 * @param after Modified content
 * @param maxLines Maximum lines to show (default 12)
 */
export function computeSimpleDiff(before: string, after: string, maxLines = 12): SimpleDiff {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  const removed = beforeLines.filter(l => !afterSet.has(l)).slice(0, maxLines);
  const added = afterLines.filter(l => !beforeSet.has(l)).slice(0, maxLines);
  return { added, removed };
}

/**
 * Check if diff is truncated
 */
export function isDiffTruncated(before: string, after: string, maxLines = 12): boolean {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  return beforeLines.length > maxLines || afterLines.length > maxLines;
}

/**
 * Count changed lines
 */
export function countChangedLines(before: string, after: string): { added: number; removed: number } {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  return {
    removed: beforeLines.filter(l => !afterSet.has(l)).length,
    added: afterLines.filter(l => !beforeSet.has(l)).length,
  };
}
