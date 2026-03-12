/**
 * Search/Replace block utilities for AI code editing
 *
 * Re-exports from core/chat.ts — single source of truth.
 */

export {
  stripMarkdownFences,
  parseSearchReplaceBlocks,
  applySearchReplaceBlocks,
  type SearchReplaceBlock,
} from '../../../core/chat';
