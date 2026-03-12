/**
 * ChatPanel - Main chat interface component.
 * Orchestrates hooks and renders sub-components.
 * Supports Local AI and external CLI provider modes (e.g. Copilot).
 */
import { useState, useRef, useCallback, useMemo, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
import type { ChatMessage } from '../types';
import type { CliProviderId, CliProviderStatus } from '../types/cliProvider.types';
import { CLI_PROVIDERS } from '../types/cliProvider.types';
import SettingsModal from './SettingsModal';
import { flattenTree } from './Markdown';
import { useWorkspace } from '../context/WorkspaceContext';
import { useBackend } from '../context/BackendContext';
import ChatHistorySidebar from './ChatHistorySidebar';

import {
  useAttachedFiles,
  useChatHistory,
  useAISettings,
  useScrollToBottom,
  useAgentPipeline,
  useMessageStream,
} from '../hooks';
import {
  getFileIcon,
} from '../utils';
import { ChatHeader, ChatWelcome, ChatMessages } from './chat';
import {
  AddFileIcon,
  SendIcon,
  StopIcon,
  MicrophoneIcon,
  ClockIcon,
  KeyboardIcon,
  FolderIcon,
} from './icons';
import { isCliMode, getCliProviderId, type ChatMode } from '../types/ui.types';
import { useAgentExecution } from '../context/AgentExecutionContext';
import { useStreamingBridge } from '../context/StreamingBridgeContext';

interface ChatPanelProps {
  onCollapse?: () => void;
}

export default function ChatPanel({ onCollapse }: ChatPanelProps) {
  const { openTabs, activeTabPath, tree, folderPath, openFile, setActivePanel, gitIgnoredPaths, openDebugTraceTab } = useWorkspace();
  const backend = useBackend();
  
  // Use extracted hooks
  const {
    settings,
    models,
    selectedModel,
    setSelectedModel,
    ready,
    settingsOpen,
    setSettingsOpen,
    handleSettingsSaved,
  } = useAISettings();

  const [mode, setMode] = useState<ChatMode>('Agent');
  const [loading, setLoading] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [input, setInput] = useState('');
  const [planMode, setPlanMode] = useState(false);
  
  // ── CLI Provider state (generic — works for any registered CLI provider) ──
  const [cliProviders, setCliProviders] = useState<CliProviderStatus[]>([]);
  const [cliModel, setCliModel] = useState<Record<CliProviderId, string>>({} as any);
  const [cliDetecting, setCliDetecting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputBoxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    workspaceHistory,
    activeConversationId,
    messages,
    history,
    setMessages,
    setHistory,
    handleNewChat,
    handleSelectConversation,
    handleDeleteConversation,
    handleRenameConversation,
    ensureConversation,
    clearChat: clearChatHistory,
  } = useChatHistory(folderPath, mode);

  const {
    attachedFiles,
    setAttachedFiles,
    dragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    addFile,
    removeFile,
    clearFiles,
    handleFilePick,
  } = useAttachedFiles();

  const { endRef, scrollToBottom } = useScrollToBottom();

  // ── Detect CLI providers on mount ──
  useEffect(() => {
    let cancelled = false;
    setCliDetecting(true);
    backend.cliProviderDetectAll().then(statuses => {
      if (cancelled) return;
      setCliProviders(statuses);
      // Auto-select default model for each detected provider
      const models: Record<string, string> = {};
      for (const s of statuses) {
        if (s.installed && s.models.length > 0) {
          const defaultModel = s.models.find(m => m.toLowerCase().includes('sonnet')) || s.models[0];
          models[s.providerId] = defaultModel;
        }
      }
      setCliModel(prev => ({ ...prev, ...models }));
    }).catch(() => {
      if (!cancelled) setCliProviders([]);
    }).finally(() => {
      if (!cancelled) setCliDetecting(false);
    });
    return () => { cancelled = true; };
  }, [backend]);

  // ── Workspace file paths for clickable file references ──
  const workspaceFiles = useMemo(() => flattenTree(tree), [tree]);

  // ── Agent execution context (shared trace state) ──
  const agentExec = useAgentExecution();

  // ── Agent pipeline & streaming hooks ──
  const traceCallbacks = useMemo(() => ({
    startTrace: agentExec.startTrace,
    addStep: agentExec.addStep,
    completeStep: agentExec.completeStep,
    failStep: agentExec.failStep,
    finishTrace: agentExec.finishTrace,
  }), [agentExec]);

  const agentPipeline = useAgentPipeline({
    folderPath, workspaceFiles, gitIgnoredPaths,
    scrollToBottom, setMessages, setHistory,
    trace: traceCallbacks,
    agentParams: agentExec.activeAgent.parameters,
  });
  const { streamResponse, stopMessage } = useMessageStream({
    scrollToBottom, setMessages, setHistory, setLoading,
  });

  // ── Pick up streaming bridge from StartPageChat ──
  const streamingBridge = useStreamingBridge();

  useEffect(() => {
    const bridge = streamingBridge.consumeBridge();
    if (!bridge || bridge.folderPath !== folderPath) return;

    // Load the messages from the bridge into ChatPanel state
    if (bridge.messages.length > 0) {
      setMessages(bridge.messages);
    }
    if (bridge.chatHistory.length > 0) {
      setHistory(bridge.chatHistory);
    }

    // If the bridge is still streaming, show loading state and listen for updates
    if (bridge.active) {
      setLoading(true);

      // Subscribe to bridge updates — the StartPageChat's IPC listener
      // is still running and pushing updates to the bridge
      const interval = setInterval(() => {
        const latest = streamingBridge.getLatestMessages();
        if (latest && latest.length > 0) {
          setMessages(latest);
          scrollToBottom();
        }
        // Check if bridge is no longer active (stream finished)
        if (!streamingBridge.pending?.active) {
          // Final update
          const finalMsgs = streamingBridge.getLatestMessages();
          if (finalMsgs && finalMsgs.length > 0) {
            setMessages(finalMsgs);
          }
          setLoading(false);
          clearInterval(interval);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [folderPath]); // Only run when workspace changes

  // ── Suggested files from open editor tabs ──
  const suggestedFiles = openTabs
    .filter(t => !t.path.startsWith('diff:') && !attachedFiles.some(a => a.path === t.path))
    .map(t => ({ name: t.name, path: t.path, content: t.content }));

  const sortedSuggestions = [...suggestedFiles].sort((a, b) => {
    if (a.path === activeTabPath) return -1;
    if (b.path === activeTabPath) return 1;
    return 0;
  });

  const addSuggestedFile = useCallback(async (name: string, path: string, content?: string) => {
    const isSpecialTab = path.startsWith('supabase:');
    await addFile(name, path, isSpecialTab ? content : undefined);
    textareaRef.current?.focus();
  }, [addFile]);

  const handleMdFileClick = useCallback((relativePath: string) => {
    if (!folderPath) return;
    const fullPath = `${folderPath}/${relativePath}`;
    const name = relativePath.split('/').pop() ?? relativePath;
    openFile(name, fullPath);
    setActivePanel('explorer');
  }, [folderPath, openFile, setActivePanel]);

  // ── Send message ──
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const providerId = getCliProviderId(mode);

    // CLI provider mode
    if (providerId) {
      const providerStatus = cliProviders.find(p => p.providerId === providerId);
      if (!providerStatus?.installed) return;

      await ensureConversation();

      const prompt = planMode ? `/plan ${text}` : text;

      setMessages(prev => [...prev, {
        text,
        sender: 'user',
        isCliProvider: true,
        ...(planMode ? { badge: '📋 Plan' } : {}),
      }]);
      setInput('');
      clearFiles();
      scrollToBottom();
      setLoading(true);

      setMessages(prev => [...prev, { text: '', sender: 'bot', isCliProvider: true }]);

      let fullResponse = '';
      const chunkUnsub = backend.onCliProviderChatChunk((chunk: string) => {
        fullResponse += chunk;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { text: fullResponse, sender: 'bot', isCliProvider: true };
          return updated;
        });
        scrollToBottom();
      });
      const doneUnsub = backend.onCliProviderChatChunkDone(() => {
        setLoading(false);
        chunkUnsub();
        doneUnsub();
      });

      const selectedCliModel = cliModel[providerId] || undefined;

      try {
        const result = await backend.cliProviderChatStream(providerId, prompt, selectedCliModel);
        if (!result.success) {
          const meta = CLI_PROVIDERS[providerId];
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              text: `⚠️ ${meta.name} Error: ${result.error || 'Unknown error'}.\n\nMake sure \`${meta.binary}\` is installed and authenticated.`,
              sender: 'bot',
            };
            return updated;
          });
          setLoading(false);
          chunkUnsub();
          doneUnsub();
        }
      } catch (err: any) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            text: `⚠️ Error: ${err.message}`,
            sender: 'bot',
          };
          return updated;
        });
        setLoading(false);
        chunkUnsub();
        doneUnsub();
      }
      return;
    }

    // ── Local AI modes (Agent / Chat / Edit) ──
    if (!settings) return;
    const model = selectedModel || settings.selectedModel;
    if (!model) { setSettingsOpen(true); return; }

    await ensureConversation();

    const currentFiles = [...attachedFiles];
    setMessages(prev => [...prev, {
      text,
      sender: 'user',
      files: currentFiles.length > 0 ? currentFiles : undefined,
    }]);
    setInput('');
    clearFiles();
    scrollToBottom();

    const isFirstMessage = history.length === 0;
    setLoading(true);

    // Always run in agentic mode — every message goes through the full pipeline
    const isAgentMode = true;
    if (isAgentMode) {
      agentExec.startTrace(agentExec.activeAgentId, agentExec.activeAgent.name, text);
      // Trace: user input step
      const inputStepId = agentExec.addStep('user-input', 'User Message', 'entry', 'tool-call', `User: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`, { text, attachedFiles: currentFiles.length });
      agentExec.completeStep(inputStepId, { text });
    }

    const ai = { baseUrl: settings.baseUrl, apiKey: settings.apiKey, model };
    let researchedFiles: Array<{ name: string; path: string; content?: string; searchContext?: string }> = [];

    // Always run research step when a workspace is open
    if (folderPath && workspaceFiles.size > 0) {
      researchedFiles = await agentPipeline.runResearchStep(text, ai);
    }

    const allContextFiles = [...currentFiles, ...researchedFiles];
    let contextPrefix = '';
    if (allContextFiles.length > 0) {
      // Collect text search context if any
      const searchContext = researchedFiles
        .filter((f): f is typeof f & { searchContext: string } => !!f.searchContext)
        .map(f => f.searchContext)
        .join('\n');

      contextPrefix = allContextFiles
        .filter(f => f.content)
        .map(f => {
          const relPath = folderPath && f.path.startsWith(folderPath)
            ? f.path.slice(folderPath.length + 1)
            : f.name;
          return `--- File: ${relPath} ---\n${f.content}`;
        })
        .join('\n\n');

      if (searchContext) {
        contextPrefix += `\n\n--- Text Search Results ---\n${searchContext}`;
      }

      contextPrefix += '\n\n';
    }

    const userContent = contextPrefix + text;
    const systemContext = agentPipeline.getSystemContext();

    const newHistory: ChatMessage[] = isFirstMessage
      ? [systemContext, { role: 'user', content: userContent, displayText: text }]
      : [...history, { role: 'user', content: userContent, displayText: text }];

    setHistory(newHistory);

    // Always run check + file change steps in agentic mode when workspace is available
    let needsFileChanges = false;
    if (folderPath && workspaceFiles.size > 0) {
      needsFileChanges = await agentPipeline.runCheckStep(text, newHistory, ai);
    }

    if (needsFileChanges) {
      await agentPipeline.runFileChangeStep(text, newHistory, ai);
    }

    // Trace: streaming response LLM call
    const streamStepId = isAgentMode
      ? agentExec.addStep('chat-response', 'Chat Response', 'output', 'llm-call', 'Streaming response', { model })
      : undefined;

    await streamResponse(settings.baseUrl, settings.apiKey, model, newHistory);

    // Finish trace
    if (isAgentMode) {
      if (streamStepId) agentExec.completeStep(streamStepId, { status: 'streamed' }, { stopReason: 'end_turn' });
      agentExec.finishTrace('success');
    }
  }, [
    input, loading, settings, selectedModel, history, attachedFiles, scrollToBottom,
    folderPath, workspaceFiles, mode, gitIgnoredPaths, setMessages, setHistory,
    ensureConversation, clearFiles, agentPipeline, streamResponse, setSettingsOpen, backend,
    cliProviders, cliModel, planMode, agentExec,
  ]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    if (e.key === 'Tab' && e.shiftKey && isCliMode(mode)) {
      e.preventDefault();
      setPlanMode(prev => !prev);
    }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
  };

  const clearChat = () => {
    clearChatHistory();
    clearFiles();
  };

  const handleAddContext = () => fileInputRef.current?.click();

  // ── Derived CLI provider state ──
  const activeProviderId = getCliProviderId(mode);
  const activeProvider = activeProviderId ? cliProviders.find(p => p.providerId === activeProviderId) : null;
  const activeProviderAvailable = activeProvider?.installed === true;
  const activeProviderModels = activeProvider?.models ?? [];
  const activeProviderMeta = activeProviderId ? CLI_PROVIDERS[activeProviderId] : null;

  // Installed CLI providers (for the mode dropdown)
  const installedProviders = cliProviders.filter(p => p.installed);
  const unavailableProviders = Object.keys(CLI_PROVIDERS)
    .filter(id => !cliProviders.find(p => p.providerId === id && p.installed)) as CliProviderId[];

  const currentModelDisplay = isCliMode(mode)
    ? (cliModel[activeProviderId!] || 'Select model')
    : (selectedModel || 'Select model');

  return (
    <div className="chat-panel-container">
      {/* History Sidebar */}
      {historySidebarOpen && (
        <ChatHistorySidebar
          workspace={workspaceHistory}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onClose={() => setHistorySidebarOpen(false)}
        />
      )}

      <section className="chat-panel chat-panel-main">
        {/* Header */}
        <ChatHeader
          historySidebarOpen={historySidebarOpen}
          onToggleHistory={() => setHistorySidebarOpen(!historySidebarOpen)}
          onNewChat={handleNewChat}
          onDebugOpen={() => openDebugTraceTab()}
          onClearChat={clearChat}
          onOpenSettings={() => setSettingsOpen(true)}
          onCollapse={onCollapse}
          showClear={messages.length > 0}
        />

        {/* Messages */}
        {messages.length === 0 ? (
          <div className="chat-messages">
            <ChatWelcome
              ready={isCliMode(mode) ? activeProviderAvailable : ready}
              selectedModel={currentModelDisplay}
              onOpenSettings={() => {
                if (isCliMode(mode)) {
                  setActivePanel('copilot');
                } else {
                  setSettingsOpen(true);
                }
              }}
              cliProvider={activeProviderMeta}
              cliProviderInstalled={activeProviderAvailable}
            />
          </div>
        ) : (
          <ChatMessages
            messages={messages}
            loading={loading}
            workspaceFiles={workspaceFiles}
            onFileClick={handleMdFileClick}
            endRef={endRef as React.RefObject<HTMLDivElement>}
          />
        )}

        {/* Input Composer */}
        <div
          className={`chat-composer ${dragging ? 'drag-over' : ''}`}
          ref={inputBoxRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Plan mode indicator */}
          {isCliMode(mode) && planMode && (
            <div className="composer-plan-indicator">
              <span>📋 Plan Mode</span>
              <span className="plan-hint">{activeProviderMeta?.shortName ?? 'CLI'} will create a plan before coding. Press Shift+Tab to toggle.</span>
              <button className="plan-exit-btn" onClick={() => setPlanMode(false)}>×</button>
            </div>
          )}

          {/* File chips */}
          {attachedFiles.length > 0 && (
            <div className="composer-files">
              {attachedFiles.map(f => (
                <span key={f.path} className="file-chip">
                  {getFileIcon(f.name)}
                  <span className="file-chip-name">{f.name}</span>
                  <button className="file-chip-remove" onClick={() => removeFile(f.path)}>×</button>
                </span>
              ))}
            </div>
          )}

          {/* Add Context + Suggestions */}
          <div className="composer-top">
            <button className="composer-add-ctx" onClick={handleAddContext} title="Add Context...">
              <AddFileIcon />
              Add Context…
            </button>
            {sortedSuggestions.length > 0 && (
              <div className="composer-suggestions">
                {sortedSuggestions.map(f => (
                  <button
                    key={f.path}
                    className={`composer-suggestion-chip ${f.path === activeTabPath ? 'active-file' : ''}`}
                    onClick={() => addSuggestedFile(f.name, f.path, f.content)}
                    title={`Add ${f.name} as context`}
                  >
                    {getFileIcon(f.name)} {f.name}
                  </button>
                ))}
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFilePick} multiple hidden />
          </div>

          <textarea
            ref={textareaRef}
            className="composer-textarea"
            placeholder={
              isCliMode(mode)
                ? (planMode ? 'Describe what to plan…' : `Ask ${activeProviderMeta?.shortName ?? 'CLI'} anything…`)
                : (ready ? 'Ask anything, @ to mention…' : 'Configure AI first…')
            }
            rows={1}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={isCliMode(mode) ? (!activeProviderAvailable || loading) : (!ready || loading)}
          />

          {/* Bottom toolbar */}
          <div className="composer-toolbar">
            <div className="composer-toolbar-left">
              {/* Mode dropdown */}
              <div className="composer-dropdown-wrap">
                <button className="composer-dropdown-btn" onClick={() => setModeMenuOpen(p => !p)}>
                  {isCliMode(mode) && <span className="mode-copilot-dot" />}
                  {isCliMode(mode) ? (activeProviderMeta?.shortName ?? mode) : mode} <span className="caret">▾</span>
                </button>
                {modeMenuOpen && (
                  <div className="composer-dropdown-menu grouped-mode-menu">
                    {/* ── CLI Providers section (dynamic) ── */}
                    {installedProviders.map(provider => {
                      const meta = CLI_PROVIDERS[provider.providerId];
                      const modeId = `cli:${provider.providerId}` as ChatMode;
                      return (
                        <div key={provider.providerId}>
                          <div className="mode-group-label">
                            <span style={{ marginRight: 4 }}>{meta.icon}</span>
                            {meta.shortName}
                            <span className="mode-group-version">{provider.version ? `v${provider.version}` : ''}</span>
                          </div>
                          <button 
                            className={`composer-dropdown-item ${mode === modeId && !planMode ? 'active' : ''}`} 
                            onClick={() => { setMode(modeId); setPlanMode(false); setModeMenuOpen(false); }}
                          >
                            <span className="mode-item-icon">{meta.icon}</span> {meta.shortName} Chat
                          </button>
                          <button 
                            className={`composer-dropdown-item ${mode === modeId && planMode ? 'active' : ''}`} 
                            onClick={() => { setMode(modeId); setPlanMode(true); setModeMenuOpen(false); }}
                          >
                            <span className="mode-item-icon">📋</span> {meta.shortName} Plan
                          </button>
                          <div className="mode-group-divider" />
                        </div>
                      );
                    })}
                    {/* ── Show unavailable CLI providers ── */}
                    {!cliDetecting && unavailableProviders.map(id => {
                      const meta = CLI_PROVIDERS[id];
                      return (
                        <div key={id}>
                          <div className="mode-group-label mode-group-disabled">
                            <span style={{ marginRight: 4, opacity: 0.35 }}>{meta.icon}</span>
                            {meta.shortName} — not detected
                          </div>
                          <div className="mode-group-divider" />
                        </div>
                      );
                    })}
                    {/* ── Local models section ── */}
                    <div className="mode-group-label">Local AI</div>
                    {(['Agent', 'Chat', 'Edit'] as ChatMode[]).map(m => (
                      <button 
                        key={m} 
                        className={`composer-dropdown-item ${m === mode ? 'active' : ''}`} 
                        onClick={() => { setMode(m); setModeMenuOpen(false); }}
                      >
                        <span className="mode-item-icon">
                          {m === 'Agent' ? '🤖' : m === 'Chat' ? '💬' : '✏️'}
                        </span>
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Model dropdown — split Local vs CLI provider ── */}
              {isCliMode(mode) ? (
                activeProviderModels.length > 0 && (
                  <div className="composer-dropdown-wrap">
                    <select 
                      className="composer-model-select copilot-model-select" 
                      value={cliModel[activeProviderId!] || ''} 
                      onChange={e => setCliModel(prev => ({ ...prev, [activeProviderId!]: e.target.value }))}
                    >
                      {activeProviderModels.map((m: string) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )
              ) : (
                models.length > 0 && (
                  <div className="composer-dropdown-wrap">
                    <select 
                      className="composer-model-select" 
                      value={selectedModel} 
                      onChange={e => setSelectedModel(e.target.value)}
                    >
                      {models.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )
              )}

              {/* Plan mode toggle for CLI providers */}
              {isCliMode(mode) && (
                <button
                  className={`composer-plan-toggle ${planMode ? 'active' : ''}`}
                  onClick={() => setPlanMode(p => !p)}
                  title="Toggle Plan Mode (Shift+Tab)"
                >
                  📋
                </button>
              )}
            </div>

            <div className="composer-toolbar-right">
              <button className="composer-icon-btn" title="Tools">
                <FolderIcon />
              </button>
              <button className="composer-icon-btn" title="Keyboard shortcuts">
                <KeyboardIcon />
              </button>
              <button className="composer-icon-btn" title="History">
                <ClockIcon />
              </button>
              <button className="composer-icon-btn" title="Voice input">
                <MicrophoneIcon />
              </button>
              {/* Send / Stop */}
              {loading ? (
                <button className="composer-stop-btn" onClick={() => {
                  if (isCliMode(mode)) {
                    backend.cliProviderChatAbort();
                    setLoading(false);
                  } else {
                    stopMessage();
                  }
                }} title="Stop generating">
                  <StopIcon />
                </button>
              ) : (
                <button className="composer-send-btn" onClick={sendMessage} disabled={isCliMode(mode) ? !activeProviderAvailable : !ready} title="Send">
                  <SendIcon />
                  <span className="caret">▾</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={handleSettingsSaved} />
      </section>
    </div>
  );
}
