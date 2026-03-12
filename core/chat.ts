/**
 * core/chat.ts — Shared AI chat logic
 *
 * Used by: CLI, desktop renderer, and server.
 * Contains prompt builders, parsers, SEARCH/REPLACE utils, and shared types.
 * NO Electron or browser dependencies — pure Node/TS.
 */

// ─── Types ───

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  displayText?: string;
}

export interface FileActionPlan {
  file: string;
  action: 'create' | 'update' | 'delete';
  description: string;
}

export interface SearchReplaceBlock {
  search: string;
  replace: string;
}

export interface VerifyResult {
  satisfied: boolean;
  reason: string;
  missingChanges: FileActionPlan[];
}

/** Subset of AgentParameters that prompt builders need */
export interface PromptParameters {
  maxResearchFiles?: number;
  minResearchFiles?: number;
  maxSearchQueries?: number;
  maxFilePatterns?: number;
  maxActionPlanFiles?: number;
  chatHistoryDepth?: number;
  maxFileListDisplay?: number;
  systemContextPrompt?: string;
  researchAgentPrompt?: string;
  searchDecisionPrompt?: string;
  checkAgentPrompt?: string;
  actionPlanPrompt?: string;
  fileChangeCreatePrompt?: string;
  fileChangeUpdatePrompt?: string;
  verificationPrompt?: string;
}

// ─── SEARCH/REPLACE Block Utils ───

export function stripMarkdownFences(text: string): string {
  let s = text.trim();
  if (s.startsWith('```')) {
    const firstNewline = s.indexOf('\n');
    if (firstNewline !== -1) s = s.slice(firstNewline + 1);
  }
  if (s.endsWith('```')) {
    const lastNewline = s.lastIndexOf('\n', s.length - 4);
    if (lastNewline !== -1) s = s.slice(0, lastNewline);
    else s = s.slice(0, -3);
  }
  return s;
}

export function parseSearchReplaceBlocks(text: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) cleaned = stripMarkdownFences(cleaned);
  const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleaned)) !== null) {
    blocks.push({ search: match[1], replace: match[2] });
  }
  return blocks;
}

export function applySearchReplaceBlocks(content: string, blocks: SearchReplaceBlock[]): string {
  let result = content;
  for (const block of blocks) {
    const idx = result.indexOf(block.search);
    if (idx !== -1) {
      result = result.slice(0, idx) + block.replace + result.slice(idx + block.search.length);
    } else {
      // Fuzzy fallback — trimmed line matching
      const searchLines = block.search.split('\n').map(l => l.trimEnd());
      const resultLines = result.split('\n');
      let startIdx = -1;
      for (let i = 0; i <= resultLines.length - searchLines.length; i++) {
        let found = true;
        for (let j = 0; j < searchLines.length; j++) {
          if (resultLines[i + j].trimEnd() !== searchLines[j]) { found = false; break; }
        }
        if (found) { startIdx = i; break; }
      }
      if (startIdx !== -1) {
        const before = resultLines.slice(0, startIdx);
        const after = resultLines.slice(startIdx + searchLines.length);
        result = [...before, block.replace, ...after].join('\n');
      }
      // If still no match, skip this block silently
    }
  }
  return result;
}

// ─── Prompt Builders ───

/** Simple template interpolation: replaces {{key}} with values */
function interpolate(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    result = result.split(`{{${key}}}`).join(String(val));
  }
  return result;
}

/**
 * Build system context message with workspace file list.
 */
export function buildSystemContext(
  folderPath: string | null,
  fileList: string[],
  params?: PromptParameters,
): ChatMessage {
  const sorted = [...fileList].sort();
  const maxDisplay = params?.maxFileListDisplay ?? 303;

  if (params?.systemContextPrompt) {
    const listLines = sorted.slice(0, maxDisplay).map(f => `  - ${f}`).join('\n')
      + (sorted.length > maxDisplay ? `\n  ... and ${sorted.length - maxDisplay} more` : '');
    return {
      role: 'system',
      content: interpolate(params.systemContextPrompt, {
        folderPath: folderPath ?? 'No project open',
        fileCount: sorted.length,
        fileList: listLines,
      }),
    };
  }

  const lines = [
    `You are an expert coding assistant inside the "flovia" desktop IDE (flovia.io).`,
    ``,
    `## Workspace`,
    `- **Directory**: ${folderPath ?? 'No project open'}`,
    `- **Files** (${sorted.length} total):`,
    ...sorted.slice(0, maxDisplay).map(f => `  - ${f}`),
    ...(sorted.length > maxDisplay ? [`  ... and ${sorted.length - maxDisplay} more`] : []),
    ``,
    `Use this workspace context to give precise, file-aware answers. When referencing files, use the exact relative paths listed above.`,
  ];
  return { role: 'system', content: lines.join('\n') };
}

/**
 * Build research agent prompt to pick relevant files.
 */
export function buildResearchPrompt(
  userQuestion: string,
  folderPath: string | null,
  fileList: string[],
  params?: PromptParameters,
): ChatMessage[] {
  const sorted = [...fileList].sort();
  const minFiles = params?.minResearchFiles ?? 7;
  const maxFiles = params?.maxResearchFiles ?? 12;

  let systemContent: string;
  if (params?.researchAgentPrompt) {
    systemContent = interpolate(params.researchAgentPrompt, {
      folderPath: folderPath ?? 'unknown',
      fileCount: sorted.length,
      fileList: sorted.map(f => `- ${f}`).join('\n'),
      minFiles,
      maxFiles,
    });
  } else {
    systemContent = [
      `You are a code research agent. Your job is to decide which files from the workspace are most relevant to the user's question.`,
      ``,
      `## Workspace: ${folderPath ?? 'unknown'}`,
      `## Files (${sorted.length} total):`,
      ...sorted.map(f => `- ${f}`),
      ``,
      `## Instructions`,
      `Based on the user's question below, choose between ${minFiles} and ${maxFiles} files that are most relevant to answering it.`,
      `Return ONLY a valid JSON array of relative file paths. No explanation, no markdown fences, just the JSON array.`,
      `Example: ["src/index.ts", "package.json", "README.md", "src/utils/helper.ts"]`,
    ].join('\n');
  }

  return [{ role: 'system', content: systemContent }, { role: 'user', content: userQuestion }];
}

/**
 * Parse research agent response into validated file paths.
 */
export function parseResearchResponse(raw: string, validFiles: Set<string>, params?: PromptParameters): string[] {
  const maxFiles = params?.maxResearchFiles ?? 12;
  try {
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.every((x: unknown) => typeof x === 'string')) {
      return (parsed as string[]).filter(f => validFiles.has(f)).slice(0, maxFiles);
    }
  } catch { /* fallback */ }
  return [];
}

// ── Search Decision ──

export interface SearchDecision {
  wantsTextSearch: boolean;
  searchQueries: string[];
  filePatterns: string[];
}

export function buildSearchDecisionPrompt(
  userQuestion: string,
  folderPath: string | null,
  fileCount: number,
  params?: PromptParameters,
): ChatMessage[] {
  const maxQueries = params?.maxSearchQueries ?? 6;
  const maxPatterns = params?.maxFilePatterns ?? 6;

  let systemContent: string;
  if (params?.searchDecisionPrompt) {
    systemContent = interpolate(params.searchDecisionPrompt, {
      folderPath: folderPath ?? 'unknown',
      fileCount,
      maxQueries,
    });
  } else {
    systemContent = [
      `You are a search strategy agent inside a coding IDE.`,
      `The user has asked a question about their codebase.`,
      ``,
      `## Workspace: ${folderPath ?? 'unknown'}`,
      `## Total files: ${fileCount}`,
      ``,
      `## Your Task`,
      `Decide whether you need to search for specific text/code patterns inside the codebase to answer the question accurately.`,
      ``,
      `Text search (grep) is useful when:`,
      `- The user mentions a specific function, variable, class, or symbol name`,
      `- The user asks "where is X used" or "find all references to Y"`,
      `- The user wants to find a specific string, error message, or configuration value`,
      `- The user asks about imports, dependencies, or how something is connected`,
      ``,
      `Text search is NOT needed when:`,
      `- The user asks a general question like "what is this repo" or "explain the architecture"`,
      `- The question can be answered by looking at file names and structure alone`,
      `- The user is asking for code generation without needing to find existing code first`,
      ``,
      `## Response Format`,
      `Return ONLY a valid JSON object — no markdown fences, no explanation:`,
      `{`,
      `  "wantsTextSearch": true | false,`,
      `  "searchQueries": ["term1", "term2"],`,
      `  "filePatterns": ["*.ts", "*.config.*"]`,
      `}`,
      ``,
      `- "searchQueries" should contain specific terms/symbols to grep for (1-${maxQueries} queries max)`,
      `- "filePatterns" can optionally narrow the search to specific file types`,
      `- If wantsTextSearch is false, return empty arrays`,
    ].join('\n');
  }

  return [{ role: 'system', content: systemContent }, { role: 'user', content: userQuestion }];
}

export function parseSearchDecisionResponse(raw: string, params?: PromptParameters): SearchDecision {
  const maxQueries = params?.maxSearchQueries ?? 6;
  const maxPatterns = params?.maxFilePatterns ?? 6;
  try {
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      wantsTextSearch: !!parsed.wantsTextSearch,
      searchQueries: Array.isArray(parsed.searchQueries)
        ? (parsed.searchQueries as string[]).filter((s: unknown) => typeof s === 'string' && s.length > 0).slice(0, maxQueries)
        : [],
      filePatterns: Array.isArray(parsed.filePatterns)
        ? (parsed.filePatterns as string[]).filter((s: unknown) => typeof s === 'string' && s.length > 0).slice(0, maxPatterns)
        : [],
    };
  } catch {
    return { wantsTextSearch: false, searchQueries: [], filePatterns: [] };
  }
}

/**
 * Build check agent prompt to decide whether the message needs file changes.
 */
export function buildCheckAgentPrompt(
  userMessage: string,
  chatHistory: ChatMessage[],
  params?: PromptParameters,
): ChatMessage[] {
  const historyDepth = params?.chatHistoryDepth ?? 9;

  let systemContent: string;
  if (params?.checkAgentPrompt) {
    systemContent = params.checkAgentPrompt;
  } else {
    systemContent = [
      `You are a triage agent inside a coding IDE. Your ONLY job is to decide whether the user's latest message requires creating, modifying, or deleting files in the workspace.`,
      ``,
      `Reply with ONLY a valid JSON object — no markdown fences, no explanation:`,
      `{ "needsFileChanges": true | false }`,
      ``,
      `Examples that need file changes: "add a dark mode toggle", "fix the bug in auth.ts", "create a new component", "refactor the utils", "update the README".`,
      `Examples that do NOT need file changes: "explain how X works", "what does this function do", "summarize the project", "how do I run this".`,
    ].join('\n');
  }

  const recent = chatHistory.slice(-historyDepth);
  return [{ role: 'system', content: systemContent }, ...recent, { role: 'user', content: userMessage }];
}

/**
 * Parse check agent response.
 */
export function parseCheckAgentResponse(raw: string): boolean {
  try {
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return !!parsed.needsFileChanges;
  } catch {
    const lower = raw.toLowerCase();
    return lower.includes('"needsfilechanges": true') || lower.includes('"needsfilechanges":true');
  }
}

/**
 * Build action plan prompt.
 */
export function buildActionPlanPrompt(
  userMessage: string,
  chatHistory: ChatMessage[],
  folderPath: string | null,
  fileList: string[],
  fileContexts?: { path: string; content: string }[],
  params?: PromptParameters,
): ChatMessage[] {
  const sorted = [...fileList].sort();
  const historyDepth = params?.chatHistoryDepth ?? 9;
  const maxFiles = params?.maxActionPlanFiles ?? 13;

  const contextBlock = fileContexts && fileContexts.length > 0
    ? '\n\n## File contents already loaded:\n' + fileContexts.map(f => `--- File: ${f.path} ---\n${f.content}`).join('\n\n')
    : '';

  let systemContent: string;
  if (params?.actionPlanPrompt) {
    systemContent = interpolate(params.actionPlanPrompt, {
      fileCount: sorted.length,
      fileList: sorted.map(f => `- ${f}`).join('\n'),
      fileContexts: contextBlock,
      maxFiles,
    });
  } else {
    systemContent = [
      `You are a code planning agent. The user wants to make changes to their codebase.`,
      ``,
      `## Workspace files (${sorted.length}):`,
      ...sorted.map(f => `- ${f}`),
      contextBlock,
      ``,
      `## Instructions`,
      `Based on the conversation and the user's latest request, determine which files need to be created, updated, or deleted.`,
      `Return ONLY a valid JSON array of action objects. No explanation, no markdown fences.`,
      `Each object: { "file": "<relative path>", "action": "create"|"update"|"delete", "description": "<brief description of what to change>" }`,
      ``,
      `Example: [{"file":"src/utils/auth.ts","action":"update","description":"Add password validation function"},{"file":"src/components/Login.tsx","action":"create","description":"Create login form component"}]`,
      ``,
      `Keep the list focused — only include files that truly need changes. Max ${maxFiles} files.`,
    ].join('\n');
  }

  const recent = chatHistory.slice(-historyDepth);
  return [{ role: 'system', content: systemContent }, ...recent, { role: 'user', content: userMessage }];
}

/**
 * Parse action plan response.
 */
export function parseActionPlanResponse(raw: string, params?: PromptParameters): FileActionPlan[] {
  const maxFiles = params?.maxActionPlanFiles ?? 13;
  try {
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x: any) => x.file && x.action && x.description)
        .map((x: any) => ({
          file: x.file as string,
          action: (x.action === 'create' || x.action === 'delete') ? x.action : 'update' as const,
          description: x.description as string,
        }))
        .slice(0, maxFiles);
    }
  } catch { /* fallback */ }
  return [];
}

/**
 * Build file change prompt for a single file.
 */
export function buildFileChangePrompt(
  plan: FileActionPlan,
  currentContent: string | null,
  userRequest: string,
  chatHistory?: ChatMessage[],
  params?: PromptParameters,
): ChatMessage[] {
  let systemContent: string;

  if (plan.action === 'delete') {
    systemContent = `You are a code editor. Respond with exactly: __DELETE_FILE__`;
  } else if (plan.action === 'create') {
    if (params?.fileChangeCreatePrompt) {
      systemContent = interpolate(params.fileChangeCreatePrompt, {
        file: plan.file,
        description: plan.description,
      });
    } else {
      systemContent = [
        `You are a code editor. Create the file "${plan.file}".`,
        `Task: ${plan.description}`,
        ``,
        `Return ONLY the file content. No markdown fences, no explanation.`,
      ].join('\n');
    }
  } else {
    if (params?.fileChangeUpdatePrompt) {
      systemContent = interpolate(params.fileChangeUpdatePrompt, {
        file: plan.file,
        description: plan.description,
        currentContent: currentContent ?? '',
      });
    } else {
      systemContent = [
        `You are a precise code editor. You must apply targeted changes to the file using SEARCH/REPLACE blocks.`,
        ``,
        `## Task: ${plan.description}`,
        `## File: ${plan.file}`,
        ``,
        `## Current file content:`,
        '```',
        currentContent ?? '',
        '```',
        ``,
        `## Instructions`,
        `Return ONLY one or more SEARCH/REPLACE blocks. Each block looks like:`,
        ``,
        `<<<<<<< SEARCH`,
        `exact lines from the current file to find`,
        `=======`,
        `replacement lines`,
        `>>>>>>> REPLACE`,
        ``,
        `Rules:`,
        `- The SEARCH section must match the current file EXACTLY (including whitespace).`,
        `- Include 2-3 lines of unchanged context around each change for precision.`,
        `- Use multiple blocks for multiple changes.`,
        `- Do NOT return the whole file. Only return SEARCH/REPLACE blocks.`,
        `- No markdown fences around the blocks, no explanation text.`,
      ].join('\n');
    }
  }

  const lastAssistant = chatHistory
    ? chatHistory.filter(m => m.role === 'assistant').slice(-1)
    : [];
  return [{ role: 'system', content: systemContent }, ...lastAssistant, { role: 'user', content: userRequest }];
}

/**
 * Build verification prompt.
 */
export function buildVerifyPrompt(
  userRequest: string,
  changedFiles: { file: string; action: string; diff?: { before: string; after: string } }[],
  params?: PromptParameters,
): ChatMessage[] {
  const summary = changedFiles.map(f => {
    if (f.action === 'delete') return `- **DELETED** ${f.file}`;
    if (f.action === 'create') return `- **CREATED** ${f.file}`;
    if (f.diff) {
      const added = f.diff.after.split('\n').length - f.diff.before.split('\n').length;
      return `- **UPDATED** ${f.file} (${added >= 0 ? '+' : ''}${added} lines net)`;
    }
    return `- **UPDATED** ${f.file}`;
  }).join('\n');

  let systemContent: string;
  if (params?.verificationPrompt) {
    systemContent = interpolate(params.verificationPrompt, {
      userRequest,
      changeSummary: summary,
    });
  } else {
    systemContent = [
      `You are a verification agent. The following file changes were just applied to fulfill the user's request.`,
      ``,
      `## User's request:`,
      `${userRequest}`,
      ``,
      `## Changes made:`,
      summary,
      ``,
      `## Instructions`,
      `Evaluate whether these changes fully satisfy the user's request.`,
      `Reply with ONLY a valid JSON object:`,
      `{ "satisfied": true | false, "reason": "<brief explanation>", "missingChanges": [] }`,
      ``,
      `If not satisfied, list the missing changes as objects: { "file": "path", "action": "create|update|delete", "description": "what's missing" }`,
    ].join('\n');
  }

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userRequest },
  ];
}

/**
 * Parse verification response.
 */
export function parseVerifyResponse(raw: string): VerifyResult {
  try {
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      satisfied: !!parsed.satisfied,
      reason: parsed.reason ?? '',
      missingChanges: Array.isArray(parsed.missingChanges)
        ? parsed.missingChanges.map((x: any) => ({
            file: x.file,
            action: x.action ?? 'update',
            description: x.description ?? '',
          }))
        : [],
    };
  } catch {
    return { satisfied: true, reason: 'Unable to parse verification response', missingChanges: [] };
  }
}
