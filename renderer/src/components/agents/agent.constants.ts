/**
 * Agent panel constants — category colours, labels, and shared metadata.
 */
import type { AgentParameters } from '../../types/agent.types';

export const CATEGORY_COLORS: Record<string, { bg: string; border: string; accent: string }> = {
  entry:          { bg: '#e3f2fd', border: '#1976d2', accent: '#1565c0' },
  classification: { bg: '#fff8e1', border: '#f9a825', accent: '#f57f17' },
  research:       { bg: '#e8f5e9', border: '#43a047', accent: '#2e7d32' },
  planning:       { bg: '#f3e5f5', border: '#8e24aa', accent: '#6a1b9a' },
  execution:      { bg: '#ffebee', border: '#e53935', accent: '#c62828' },
  verification:   { bg: '#e0f2f1', border: '#00897b', accent: '#00695c' },
  output:         { bg: '#eceff1', border: '#546e7a', accent: '#37474f' },
};

export const CATEGORY_LABELS: Record<string, string> = {
  entry: 'Entry Point',
  classification: 'Classification',
  research: 'Research',
  planning: 'Planning',
  execution: 'Execution',
  verification: 'Verification',
  output: 'Output',
};

export function getCategoryColors(category: string) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.output;
}

export const NUMERIC_PARAM_META: {
  key: keyof AgentParameters;
  label: string;
  description: string;
  min: number;
  max: number;
}[] = [
  { key: 'maxResearchFiles', label: 'Max Research Files', description: 'Maximum files the research agent returns', min: 1, max: 30 },
  { key: 'minResearchFiles', label: 'Min Research Files', description: 'Minimum files the research agent should pick', min: 1, max: 20 },
  { key: 'maxMergedContextFiles', label: 'Max Context Files', description: 'Max files after merging research + search', min: 1, max: 50 },
  { key: 'maxTextSearchResults', label: 'Max Search Results', description: 'Max results per text search query', min: 10, max: 500 },
  { key: 'maxTextSearchDisplay', label: 'Max Search Display', description: 'Max search matches shown to model', min: 5, max: 200 },
  { key: 'maxSearchDiscoveredFiles', label: 'Max Search-Discovered Files', description: 'Max extra files from text search', min: 1, max: 20 },
  { key: 'maxSearchQueries', label: 'Max Search Queries', description: 'Max grep queries the search agent issues', min: 1, max: 10 },
  { key: 'maxFilePatterns', label: 'Max File Patterns', description: 'Max file type patterns for search', min: 1, max: 10 },
  { key: 'maxVerificationAttempts', label: 'Max Verification Retries', description: 'Max verification retry attempts', min: 1, max: 10 },
  { key: 'maxActionPlanFiles', label: 'Max Action Plan Files', description: 'Max files in a single action plan', min: 1, max: 30 },
  { key: 'chatHistoryDepth', label: 'Chat History Depth', description: 'Recent messages included as context', min: 2, max: 30 },
  { key: 'maxFileListDisplay', label: 'Max File List Display', description: 'Max workspace files in system prompt', min: 50, max: 2000 },
  { key: 'maxNodeRetries', label: 'Global Max Node Retries', description: 'Default max retries per node', min: 0, max: 10 },
];

export const PROMPT_PARAM_META: {
  key: keyof AgentParameters;
  label: string;
  description: string;
  placeholders: string;
}[] = [
  { key: 'systemContextPrompt', label: 'System Context', description: 'AI persona & workspace context', placeholders: '{{folderPath}}, {{fileCount}}, {{fileList}}' },
  { key: 'researchAgentPrompt', label: 'Research Agent', description: 'Instructs AI to pick relevant files', placeholders: '{{folderPath}}, {{fileCount}}, {{fileList}}, {{minFiles}}, {{maxFiles}}' },
  { key: 'searchDecisionPrompt', label: 'Search Decision', description: 'Decides if text search is needed', placeholders: '{{folderPath}}, {{fileCount}}, {{maxQueries}}' },
  { key: 'checkAgentPrompt', label: 'Check Agent', description: 'Classifies if request needs file changes', placeholders: '(none)' },
  { key: 'actionPlanPrompt', label: 'Action Planner', description: 'Creates file change action plan', placeholders: '{{fileCount}}, {{fileList}}, {{fileContexts}}, {{maxFiles}}' },
  { key: 'fileChangeCreatePrompt', label: 'File Create', description: 'Instructs AI to create a new file', placeholders: '{{file}}, {{description}}' },
  { key: 'fileChangeUpdatePrompt', label: 'File Update', description: 'SEARCH/REPLACE instructions', placeholders: '{{file}}, {{description}}, {{currentContent}}' },
  { key: 'verificationPrompt', label: 'Verification', description: 'Evaluates if changes satisfy request', placeholders: '{{userRequest}}, {{changeSummary}}' },
  { key: 'continueQuestionPrompt', label: 'Continue Question', description: 'Asked between nodes to decide continue/stop', placeholders: '(none)' },
];
