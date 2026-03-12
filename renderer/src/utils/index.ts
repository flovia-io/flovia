// Utils barrel export
export { getFileIcon } from './fileIcons';
export {
  stripMarkdownFences,
  parseSearchReplaceBlocks,
  applySearchReplaceBlocks,
  type SearchReplaceBlock,
} from './searchReplace';
export {
  computeSimpleDiff,
  isDiffTruncated,
  countChangedLines,
  type SimpleDiff,
} from './diffUtils';
export {
  getFileIcon as getFileIconFromUtils,
  getFileExtension,
  getLanguageFromExtension,
  getRelativePath,
  getFilename,
  formatFileSize,
} from './fileUtils';
export {
  buildSystemContext,
  buildResearchPrompt,
  parseResearchResponse,
  buildSearchDecisionPrompt,
  parseSearchDecisionResponse,
  buildCheckAgentPrompt,
  parseCheckAgentResponse,
  buildActionPlanPrompt,
  parseActionPlanResponse,
  buildFileChangePrompt,
  buildVerifyPrompt,
  parseVerifyResponse,
  type PromptParameters,
} from './chatPrompts';
export {
  findLastIdx,
  groupBy,
  uniqueBy,
  sortBy,
  chunk,
} from './arrayUtils';
