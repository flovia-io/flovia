/**
 * useAgentPipeline — Orchestrates the multi-step AI agent flow:
 *   1. Research (file discovery)
 *   2. Check agent (does the follow-up need file changes?)
 *   3. Action plan + file execution
 *   4. Verification loop
 *
 * Each step emits execution trace events via the optional `trace` callbacks,
 * so the Agent Builder's trace viewer can display real-time observability.
 */
import { useCallback } from 'react';
import type { ChatMessage, FileActionPlan, FileActionProgress, DisplayMessage } from '../types';
import { useBackend } from '../context/BackendContext';
import {
  stripMarkdownFences,
  parseSearchReplaceBlocks,
  applySearchReplaceBlocks,
  findLastIdx,
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
} from '../utils';
import type { PromptParameters } from '../utils';
import type { TraceStep, PhaseCategory, AgentParameters } from '../types/agent.types';
import { resolveAgentParameters } from '../types/agent.types';

type SetMessages = React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
type SetHistory = React.Dispatch<React.SetStateAction<ChatMessage[]>>;

/** Optional trace callbacks — when provided, every AI/tool call is logged */
export interface TraceCallbacks {
  startTrace: (agentId: string, agentName: string, userRequest: string) => string;
  addStep: (nodeId: string, nodeLabel: string, category: PhaseCategory, type: TraceStep['type'], summary: string, input?: unknown) => string;
  completeStep: (stepId: string, output?: unknown, extras?: Partial<TraceStep>) => void;
  failStep: (stepId: string, error: string) => void;
  finishTrace: (status?: 'success' | 'error') => void;
}

interface AgentPipelineDeps {
  folderPath: string | null;
  workspaceFiles: Set<string>;
  gitIgnoredPaths: string[];
  scrollToBottom: () => void;
  setMessages: SetMessages;
  setHistory: SetHistory;
  trace?: TraceCallbacks;
  /** Agent tunable parameters — numeric limits + prompt templates */
  agentParams?: Partial<AgentParameters>;
}

interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function useAgentPipeline(deps: AgentPipelineDeps) {
  const { folderPath, workspaceFiles, gitIgnoredPaths, scrollToBottom, setMessages, setHistory, trace, agentParams } = deps;
  const backend = useBackend();
  const params = resolveAgentParameters(agentParams);

  /** Read multiple files for context */
  const readFilesForContext = useCallback(async (relativePaths: string[]) => {
    if (!folderPath) return [];
    const results: Array<{ name: string; path: string; content?: string }> = [];
    for (const rel of relativePaths) {
      const fullPath = `${folderPath}/${rel}`;
      const name = rel.split('/').pop() ?? rel;
      try {
        const result = await backend.readFile(fullPath);
        if (result.success && result.content) {
          results.push({ name: rel, path: fullPath, content: result.content });
        }
      } catch { /* skip */ }
    }
    return results;
  }, [folderPath]);

  /** Execute planned file actions (create / update / delete) */
  const executeFileActions = useCallback(async (
    actions: FileActionPlan[],
    userRequest: string,
    chatHistory: ChatMessage[],
    ai: AIConfig,
    statusMsgIndex: number,
  ): Promise<FileActionProgress[]> => {
    const progressList: FileActionProgress[] = actions.map(a => ({
      plan: a,
      status: 'pending' as const,
    }));

    const updateProgress = (statusText: string, list: FileActionProgress[]) => {
      setMessages(prev => {
        const updated = [...prev];
        if (statusMsgIndex < updated.length) {
          updated[statusMsgIndex] = {
            text: statusText,
            sender: 'system',
            isAgentProgress: true,
            agentActions: [...list],
          };
        }
        return updated;
      });
      scrollToBottom();
    };

    for (let i = 0; i < actions.length; i++) {
      const plan = actions[i];
      const fullPath = folderPath ? `${folderPath}/${plan.file}` : plan.file;

      progressList[i] = { ...progressList[i], status: 'reading' };
      updateProgress(`🔧 Applying changes (${i + 1}/${actions.length})…`, progressList);

      let currentContent: string | null = null;
      if (plan.action !== 'create') {
        // Trace: file read
        const readStepId = trace?.addStep('file-reader', 'File Reader', 'execution', 'file-read', `Reading ${plan.file}`, { path: fullPath });
        try {
          const result = await backend.readFile(fullPath);
          if (result.success) {
            currentContent = result.content ?? null;
            if (readStepId) trace?.completeStep(readStepId, { contentLength: currentContent?.length ?? 0 });
          } else if (readStepId) {
            trace?.failStep(readStepId, 'File not found');
          }
        } catch (err: unknown) {
          if (readStepId) trace?.failStep(readStepId, (err as Error).message);
          /* file might not exist */
        }
      }

      progressList[i] = { ...progressList[i], status: 'updating' };
      updateProgress(`🔧 Applying changes (${i + 1}/${actions.length})…`, progressList);

      if (plan.action === 'delete') {
        progressList[i] = {
          ...progressList[i],
          status: 'done',
          diff: { before: currentContent ?? '', after: '(deleted)' },
        };
        updateProgress(`🔧 Applying changes (${i + 1}/${actions.length})…`, progressList);
        continue;
      }

      try {
        const changeMessages = buildFileChangePrompt(plan, currentContent, userRequest, chatHistory, params);
        // Trace: LLM call for code editing
        const editStepId = trace?.addStep('code-editor', 'Code Editor Agent', 'execution', 'llm-call',
          `${plan.action === 'create' ? 'Creating' : 'Editing'} ${plan.file}`,
          { file: plan.file, action: plan.action, description: plan.description });
        const changeResult = await backend.aiChat(ai.baseUrl, ai.apiKey, ai.model, changeMessages);

        if (changeResult.success && changeResult.reply) {
          let newContent: string;
          if (plan.action === 'create') {
            newContent = stripMarkdownFences(changeResult.reply);
          } else {
            const blocks = parseSearchReplaceBlocks(changeResult.reply);
            if (blocks.length > 0 && currentContent !== null) {
              newContent = applySearchReplaceBlocks(currentContent, blocks);
            } else {
              newContent = stripMarkdownFences(changeResult.reply);
            }
          }
          if (editStepId) trace?.completeStep(editStepId, { newContentLength: newContent.length }, {
            stopReason: 'end_turn',
          });

          // Trace: file write
          const writeStepId = trace?.addStep('file-writer', 'File Writer', 'execution', 'file-write',
            `Writing ${plan.file}`, { path: fullPath, action: plan.action });
          await backend.saveFile(fullPath, newContent);
          if (writeStepId) trace?.completeStep(writeStepId, { bytesWritten: newContent.length });

          progressList[i] = {
            ...progressList[i],
            status: 'done',
            diff: { before: currentContent ?? '', after: newContent },
          };
        } else {
          if (editStepId) trace?.failStep(editStepId, changeResult.error ?? 'AI failed to generate changes');
          progressList[i] = {
            ...progressList[i],
            status: 'error',
            error: changeResult.error ?? 'AI failed to generate changes',
          };
        }
      } catch (err: unknown) {
        progressList[i] = {
          ...progressList[i],
          status: 'error',
          error: (err as Error).message,
        };
      }

      updateProgress(`🔧 Applying changes (${i + 1}/${actions.length})…`, progressList);
    }

    return progressList;
  }, [folderPath, scrollToBottom, setMessages]);

  /** Build the system context message */
  const getSystemContext = useCallback(() => {
    return buildSystemContext(folderPath, workspaceFiles, gitIgnoredPaths, params);
  }, [folderPath, workspaceFiles, gitIgnoredPaths, params]);

  /** Step 0.5: Search Decision — ask the agent if it wants to search for a specific term */
  const runSearchDecisionStep = useCallback(async (
    text: string,
    ai: AIConfig,
  ): Promise<{ searchResults: string; extraFiles: string[] }> => {
    if (!folderPath) return { searchResults: '', extraFiles: [] };

    try {
      const decisionMessages = buildSearchDecisionPrompt(text, folderPath, workspaceFiles.size, params);
      // Trace: search decision LLM call
      const decisionStepId = trace?.addStep('search-decision', 'Search Decision Agent', 'research', 'llm-call',
        'Deciding if text search is needed', { userQuery: text, totalFiles: workspaceFiles.size });
      const decisionResult = await backend.aiChat(ai.baseUrl, ai.apiKey, ai.model, decisionMessages);

      if (decisionResult.success && decisionResult.reply) {
        const decision = parseSearchDecisionResponse(decisionResult.reply, params);
        if (decisionStepId) trace?.completeStep(decisionStepId, decision, { stopReason: 'end_turn' });

        if (decision.wantsTextSearch && decision.searchQueries.length > 0) {
          // Perform text search for each query
          let combinedResults = '';
          const discoveredFiles = new Set<string>();

          for (const query of decision.searchQueries) {
            const searchStepId = trace?.addStep('text-search', 'Text Search', 'research', 'text-search',
              `Searching for "${query}"`, { query, filePatterns: decision.filePatterns });

            setMessages(prev => {
              const updated = [...prev];
              const statusIdx = findLastIdx(updated, m => !!m.isResearchStatus);
              if (statusIdx >= 0) {
                updated[statusIdx] = {
                  text: `🔎 Searching for "${query}"…`,
                  sender: 'system',
                  isResearchStatus: true,
                };
              }
              return updated;
            });
            scrollToBottom();

            try {
              const searchResult = await backend.searchText(folderPath, query, {
                maxResults: params.maxTextSearchResults,
                includePattern: decision.filePatterns.length > 0 ? decision.filePatterns[0] : undefined,
              });

              if (searchResult.success && searchResult.matches.length > 0) {
                const matchSummary = searchResult.matches.slice(0, params.maxTextSearchDisplay).map(m =>
                  `${m.file}:${m.line}: ${m.text}`
                ).join('\n');
                combinedResults += `\n## Search results for "${query}" (${searchResult.matches.length} matches${searchResult.truncated ? ', truncated' : ''}):\n${matchSummary}\n`;

                // Collect unique files that contain matches
                for (const m of searchResult.matches) {
                  discoveredFiles.add(m.file);
                }

                if (searchStepId) trace?.completeStep(searchStepId, {
                  matchCount: searchResult.matches.length,
                  truncated: searchResult.truncated,
                  uniqueFiles: discoveredFiles.size,
                  topMatches: searchResult.matches.slice(0, 5).map(m => `${m.file}:${m.line}`),
                });
              } else {
                if (searchStepId) trace?.completeStep(searchStepId, {
                  matchCount: 0, message: 'No matches found',
                });
              }
            } catch (err: unknown) {
              if (searchStepId) trace?.failStep(searchStepId, (err as Error).message);
            }
          }

          return {
            searchResults: combinedResults,
            extraFiles: Array.from(discoveredFiles).slice(0, params.maxSearchDiscoveredFiles),
          };
        }
      } else if (decisionStepId) {
        trace?.failStep(decisionStepId, decisionResult.error ?? 'Decision failed');
      }
    } catch { /* ignore search decision failures */ }

    return { searchResults: '', extraFiles: [] };
  }, [folderPath, workspaceFiles, scrollToBottom, setMessages, backend, trace]);

  /** Step 1: Research — discover relevant files and optionally perform text search */
  const runResearchStep = useCallback(async (
    text: string,
    ai: AIConfig,
  ): Promise<Array<{ name: string; path: string; content?: string; searchContext?: string }>> => {
    if (!folderPath || workspaceFiles.size === 0) return [];

    setMessages(prev => [...prev, {
      text: '🔍 Researching your codebase…',
      sender: 'system',
      isResearchStatus: true,
    }]);
    scrollToBottom();

    // Run search decision + file research in parallel
    const [searchInfo, fileResearchResult] = await Promise.all([
      runSearchDecisionStep(text, ai),
      (async () => {
        try {
          const researchMessages = buildResearchPrompt(text, folderPath, workspaceFiles, gitIgnoredPaths, params);
          const researchStepId = trace?.addStep('research-agent', 'Research Agent', 'research', 'llm-call',
            'Picking relevant files from workspace', { userQuery: text, totalFiles: workspaceFiles.size });
          const researchResult = await backend.aiChat(ai.baseUrl, ai.apiKey, ai.model, researchMessages);

          if (researchResult.success && researchResult.reply) {
            const chosenFiles = parseResearchResponse(researchResult.reply, workspaceFiles, params);
            if (researchStepId) trace?.completeStep(researchStepId, { chosenFiles }, {
              chosenFiles, stopReason: 'end_turn',
            });
            return chosenFiles;
          } else if (researchStepId) {
            trace?.failStep(researchStepId, researchResult.error ?? 'Research failed');
          }
        } catch { /* ignore */ }
        return [] as string[];
      })(),
    ]);

    // Merge files from research + files discovered by text search
    const mergedFiles = new Set(fileResearchResult);
    for (const f of searchInfo.extraFiles) {
      if (workspaceFiles.has(f)) mergedFiles.add(f);
    }
    const allChosenFiles = Array.from(mergedFiles).slice(0, params.maxMergedContextFiles);

    if (allChosenFiles.length > 0) {
      setMessages(prev => {
        const updated = [...prev];
        const statusIdx = findLastIdx(updated, m => !!m.isResearchStatus);
        if (statusIdx >= 0) {
          updated[statusIdx] = {
            text: `📂 Reading ${allChosenFiles.length} relevant file${allChosenFiles.length > 1 ? 's' : ''}…`,
            sender: 'system',
            isResearchStatus: true,
          };
        }
        return updated;
      });
      scrollToBottom();

      const researchedFiles = await readFilesForContext(allChosenFiles);
      const fileReadStepId = trace?.addStep('file-reader', 'File Reader', 'research', 'file-read',
        `Read ${researchedFiles.length} files for context`,
        { files: allChosenFiles, searchExtra: searchInfo.extraFiles.length });
      if (fileReadStepId) trace?.completeStep(fileReadStepId, {
        filesRead: researchedFiles.map(f => f.name),
        totalBytes: researchedFiles.reduce((s, f) => s + (f.content?.length ?? 0), 0),
      });

      // Attach text search results as extra context on the first file
      const result: Array<{ name: string; path: string; content?: string; searchContext?: string }> = researchedFiles;
      if (searchInfo.searchResults && result.length > 0) {
        result[0] = { ...result[0], searchContext: searchInfo.searchResults };
      }

      const searchNote = searchInfo.searchResults
        ? ` + text search results`
        : '';
      setMessages(prev => {
        const updated = [...prev];
        const statusIdx = findLastIdx(updated, m => !!m.isResearchStatus);
        if (statusIdx >= 0) {
          updated[statusIdx] = {
            text: `📎 Added ${researchedFiles.length} file${researchedFiles.length > 1 ? 's' : ''} as context${searchNote}`,
            sender: 'system',
            files: researchedFiles,
            isResearchStatus: false,
          };
        }
        return updated;
      });
      scrollToBottom();
      return result;
    }

    // Clean up status if no files found
    setMessages(prev => prev.filter(m => !m.isResearchStatus));
    return [];
  }, [folderPath, workspaceFiles, gitIgnoredPaths, scrollToBottom, setMessages, readFilesForContext, runSearchDecisionStep, backend, trace]);

  /** Step 2.5: Check if follow-up needs file changes */
  const runCheckStep = useCallback(async (
    text: string,
    history: ChatMessage[],
    ai: AIConfig,
  ): Promise<boolean> => {
    setMessages(prev => [...prev, {
      text: '🧠 Analyzing your request…',
      sender: 'system',
      isResearchStatus: true,
    }]);
    scrollToBottom();

    try {
      const checkMessages = buildCheckAgentPrompt(text, history, params);
      // Trace: classification LLM call
      const checkStepId = trace?.addStep('check-agent', 'Check Agent (Triage)', 'classification', 'llm-call',
        'Deciding if request needs file changes', { userMessage: text });
      const checkResult = await backend.aiChat(ai.baseUrl, ai.apiKey, ai.model, checkMessages);
      if (checkResult.success && checkResult.reply) {
        const needsChanges = parseCheckAgentResponse(checkResult.reply);
        if (checkStepId) trace?.completeStep(checkStepId, { needsFileChanges: needsChanges }, {
          stopReason: 'end_turn',
        });
        return needsChanges;
      } else if (checkStepId) {
        trace?.failStep(checkStepId, checkResult.error ?? 'Check agent failed');
      }
    } catch (err: unknown) {
      /* proceed without file changes */
    }

    setMessages(prev => prev.filter(m => !m.isResearchStatus));
    return false;
  }, [scrollToBottom, setMessages]);

  /** Step 2.6: Plan and execute file changes with verification loop */
  const runFileChangeStep = useCallback(async (
    text: string,
    history: ChatMessage[],
    ai: AIConfig,
  ): Promise<void> => {
    // Clean up any leftover research status
    setMessages(prev => prev.filter(m => !m.isResearchStatus));

    setMessages(prev => [...prev, {
      text: '📋 Planning file changes…',
      sender: 'system' as const,
      isAgentProgress: true,
      agentActions: [],
    }]);
    scrollToBottom();

    await new Promise(r => setTimeout(r, 0));
    const progressMsgIdx = await new Promise<number>(resolve => {
      setMessages(prev => { resolve(prev.length - 1); return prev; });
    });

    let actionPlan: FileActionPlan[] = [];
    try {
      const planMessages = buildActionPlanPrompt(text, history, folderPath, workspaceFiles, gitIgnoredPaths, params);
      // Trace: planning LLM call
      const planStepId = trace?.addStep('action-planner', 'Action Planner', 'planning', 'llm-call',
        'Creating action plan for file changes', { userRequest: text });
      const planResult = await backend.aiChat(ai.baseUrl, ai.apiKey, ai.model, planMessages);
      if (planResult.success && planResult.reply) {
        actionPlan = parseActionPlanResponse(planResult.reply, params);
        if (planStepId) trace?.completeStep(planStepId, { actionPlan }, {
          stopReason: 'end_turn',
        });
      } else if (planStepId) {
        trace?.failStep(planStepId, planResult.error ?? 'Planning failed');
      }
    } catch { /* no plan */ }

    if (actionPlan.length === 0) {
      setMessages(prev => prev.filter(m => !m.isAgentProgress));
      return;
    }

    let completedProgress: FileActionProgress[] = [];
    let attempt = 0;
    const MAX_ATTEMPTS = params.maxVerificationAttempts;
    let currentPlan = actionPlan;

    while (attempt < MAX_ATTEMPTS && currentPlan.length > 0) {
      attempt++;
      completedProgress = await executeFileActions(currentPlan, text, history, ai, progressMsgIdx);

      // Verify
      setMessages(prev => {
        const updated = [...prev];
        if (progressMsgIdx < updated.length) {
          updated[progressMsgIdx] = {
            text: `✅ Verifying changes… (attempt ${attempt}/${MAX_ATTEMPTS})`,
            sender: 'system',
            isAgentProgress: true,
            agentActions: completedProgress,
            verifyAttempt: attempt,
          };
        }
        return updated;
      });
      scrollToBottom();

      const changedForVerify = completedProgress
        .filter(p => p.status === 'done')
        .map(p => ({ file: p.plan.file, action: p.plan.action, diff: p.diff }));

      if (changedForVerify.length === 0) break;

      try {
        const verifyMessages = buildVerifyPrompt(text, changedForVerify, params);
        // Trace: verification LLM call
        const verifyStepId = trace?.addStep('verification', 'Verification Agent', 'verification', 'llm-call',
          `Verifying changes (attempt ${attempt}/${MAX_ATTEMPTS})`, { changedFiles: changedForVerify.length });
        const verifyResult = await backend.aiChat(ai.baseUrl, ai.apiKey, ai.model, verifyMessages);
        if (verifyResult.success && verifyResult.reply) {
          const verification = parseVerifyResponse(verifyResult.reply);
          if (verifyStepId) trace?.completeStep(verifyStepId, verification, {
            stopReason: verification.satisfied ? 'satisfied' : 'needs_retry',
          });
          if (verification.satisfied || verification.missingChanges.length === 0) break;
          currentPlan = verification.missingChanges;
        } else {
          if (verifyStepId) trace?.failStep(verifyStepId, verifyResult.error ?? 'Verification failed');
          break;
        }
      } catch { break; }
    }

    // Finalize progress
    const successCount = completedProgress.filter(p => p.status === 'done').length;
    const errorCount = completedProgress.filter(p => p.status === 'error').length;
    setMessages(prev => {
      const updated = [...prev];
      if (progressMsgIdx < updated.length) {
        updated[progressMsgIdx] = {
          text: `✅ Applied ${successCount} file change${successCount !== 1 ? 's' : ''}${errorCount > 0 ? ` (${errorCount} error${errorCount !== 1 ? 's' : ''})` : ''}`,
          sender: 'system',
          isAgentProgress: true,
          agentActions: completedProgress,
        };
      }
      return updated;
    });
    scrollToBottom();

    const changeSummary = completedProgress
      .filter(p => p.status === 'done')
      .map(p => `- ${p.plan.action.toUpperCase()} ${p.plan.file}: ${p.plan.description}`)
      .join('\n');

    if (changeSummary) {
      setHistory(prev => [...prev, {
        role: 'assistant',
        content: `I've made the following file changes:\n${changeSummary}`,
      }]);
    }
  }, [folderPath, workspaceFiles, gitIgnoredPaths, scrollToBottom, setMessages, setHistory, executeFileActions]);

  return {
    readFilesForContext,
    getSystemContext,
    runResearchStep,
    runCheckStep,
    runFileChangeStep,
  };
}
