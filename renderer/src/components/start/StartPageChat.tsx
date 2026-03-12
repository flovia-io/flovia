/**
 * StartPageChat - Full chat interface for the start page.
 * Uses the same AI settings/model selector as the main ChatPanel.
 * Includes Import + Clone buttons in the welcome state.
 * When opening as workspace, auto-generates a chat title via background AI call
 * and carries over the in-progress chat content.
 * Auto-detects HTML in responses → saves to session → opens workspace with preview.
 */
import { useState, useRef, useCallback, useEffect, useMemo, type ChangeEvent, type KeyboardEvent } from 'react';
import { useBackend } from '../../context/BackendContext';
import { useStreamingBridge } from '../../context/StreamingBridgeContext';
import { useAISettings } from '../../hooks';
import HtmlPreview, { isFullHtmlDocument, extractHtmlFromMarkdown, extractPreviewName } from '../HtmlPreview';
import { SendIcon, StopIcon, MessageCircleIcon } from '../icons';
import { GitHubClone } from '.';
import SettingsModal from '../SettingsModal';
import Markdown from '../Markdown';
import type { ChatMessage, DisplayMessage } from '../../types';

interface StartPageChatProps {
  importFolder: () => Promise<void>;
  onWorkspaceCreated?: (folderPath: string) => void;
}

/** Bot message content with stable HtmlPreview sibling (survives streaming re-renders) */
function StartBotContent({ text, isStreaming, sessionFolderPath }: { text: string; isStreaming?: boolean; sessionFolderPath?: string | null }) {
  const extractedHtml = useMemo(() => extractHtmlFromMarkdown(text), [text]);
  return (
    <>
      <div className="md-content">
        <Markdown>{text}</Markdown>
      </div>
      {extractedHtml && (
        <HtmlPreview
          html={extractedHtml}
          isStreaming={isStreaming}
          sessionFolderPath={sessionFolderPath}
        />
      )}
    </>
  );
}

export default function StartPageChat({ importFolder, onWorkspaceCreated }: StartPageChatProps) {
  const backend = useBackend();
  const streamingBridge = useStreamingBridge();
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

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionFolderPath, setSessionFolderPath] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const autoOpenedRef = useRef(false); // prevent double auto-open
  const mountedRef = useRef(true); // track if component is still mounted
  const streamingRef = useRef(false); // track if we're currently streaming

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Intercept open-workspace events (e.g. from HtmlPreview's Preview button)
  // to set up the streaming bridge if currently streaming
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.folderPath || !streamingRef.current || !sessionFolderPath) return;
      // Only intercept if it's our session folder
      if (detail.folderPath !== sessionFolderPath) return;

      // Set up bridge so ChatPanel picks up the active stream
      streamingBridge.startBridge({
        folderPath: sessionFolderPath,
        messages: [...messages],
        chatHistory: [...chatHistory],
        active: true,
        openPreview: !!detail.openPreview,
        previewHtml: detail.previewHtml,
        previewName: detail.previewName,
      });
    };
    window.addEventListener('open-workspace', handler);
    return () => window.removeEventListener('open-workspace', handler);
  }, [sessionFolderPath, messages, chatHistory, streamingBridge]);

  // Scroll messages container to bottom (without scrolling the whole page)
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }, []);

  /** Extract the first full HTML document from a markdown response (inside ```html blocks) */
  const extractHtmlFromResponse = useCallback((text: string): string | null => {
    // Match ```html ... ``` code blocks
    const codeBlockRegex = /```html\s*\n([\s\S]*?)```/gi;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const code = match[1].trim();
      if (isFullHtmlDocument(code)) return code;
    }
    // Also check if the entire response is a raw HTML document
    if (isFullHtmlDocument(text.trim())) return text.trim();
    return null;
  }, []);

  /** Save HTML to session folder and open the workspace with preview */
  const autoSaveAndOpenWorkspace = useCallback(async (
    htmlContent: string,
    folderPath: string,
    allMessages: DisplayMessage[],
    history: ChatMessage[]
  ) => {
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;

    try {
      // Extract a nice filename from <title>
      const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/is);
      const titleSlug = titleMatch?.[1]
        ? titleMatch[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
        : 'preview';
      const fileName = `${titleSlug}.html`;
      const filePath = `${folderPath}/${fileName}`;

      // Save the HTML file
      await backend.createFile(filePath, htmlContent);

      // Persist chat history to workspace
      try {
        const ws = await backend.historyOpenWorkspace(folderPath);
        let conversationId = ws.activeConversationId;
        if (!conversationId) {
          const conv = await backend.historyCreateConversation(folderPath, 'Chat');
          conversationId = conv.id;
        }
        const fullHistory: ChatMessage[] = [
          { role: 'system', content: 'You are a helpful assistant.' },
          ...history
        ];
        await backend.historyUpdateConversation(folderPath, conversationId, fullHistory, 'Chat');
      } catch {
        // best-effort
      }

      // Use streaming bridge if stream is still in progress
      const isStreaming = streamingRef.current;
      if (isStreaming) {
        const previewName = extractPreviewName(htmlContent);
        streamingBridge.startBridge({
          folderPath,
          messages: allMessages,
          chatHistory: history,
          active: true,
          openPreview: true,
          previewHtml: htmlContent,
          previewName,
        });
      }

      // Open workspace — with preview flag
      window.dispatchEvent(new CustomEvent('open-workspace', {
        detail: {
          folderPath,
          openPreview: true,
          previewHtml: htmlContent,
          previewName: extractPreviewName(htmlContent),
        }
      }));
      onWorkspaceCreated?.(folderPath);

      // Background: generate title
      if (settings?.apiKey && settings?.baseUrl && allMessages.length > 0) {
        const model = selectedModel || settings.selectedModel;
        if (model) {
          try {
            const titleMessages: ChatMessage[] = [
              { role: 'system', content: 'Generate a very short title (3-6 words, no quotes) summarizing this conversation. Reply with ONLY the title.' },
              ...allMessages.slice(0, 6).map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text } as ChatMessage)),
            ];
            const titleResult = await backend.aiChat(settings.baseUrl, settings.apiKey, model, titleMessages);
            if (titleResult.success && titleResult.reply) {
              const title = titleResult.reply.trim().replace(/^["']|["']$/g, '').slice(0, 60);
              const ws2 = await backend.historyGetWorkspace(folderPath);
              if (ws2?.activeConversationId) {
                await backend.historyRenameConversation(folderPath, ws2.activeConversationId, title);
              }
            }
          } catch { /* best-effort */ }
        }
      }
    } catch (err) {
      console.error('[StartPageChat] Auto-save HTML failed:', err);
      autoOpenedRef.current = false;
    }
  }, [backend, onWorkspaceCreated, settings, selectedModel, streamingBridge]);

  // Create session folder if needed and stream response
  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setLoading(true);

    try {
      // Create session folder if not exists
      let folderPath = sessionFolderPath;
      if (!folderPath) {
        const result = await backend.sessionCreateFolder(userMessage.slice(0, 30));
        if (result.success && result.folderPath) {
          folderPath = result.folderPath;
          setSessionFolderPath(folderPath);
        } else {
          setMessages(prev => [...prev, {
            text: `Failed to create session: ${result.error || 'Unknown error'}`,
            sender: 'bot'
          }]);
          setLoading(false);
          return;
        }
      }

      if (!settings || !settings.apiKey || !settings.baseUrl) {
        setMessages(prev => [...prev, {
          text: 'Please configure your AI settings first. Click the ⚙️ button to add your API key and select a model.',
          sender: 'bot'
        }]);
        setLoading(false);
        return;
      }

      const model = selectedModel || settings.selectedModel;
      if (!model) {
        setMessages(prev => [...prev, {
          text: 'No model selected. Please choose a model from the dropdown or configure one in Settings.',
          sender: 'bot'
        }]);
        setLoading(false);
        return;
      }

      // Build chat history for API
      const history: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant. The user is asking a general question without a specific workspace context. Be helpful and informative.'
        },
        ...chatHistory,
        { role: 'user', content: userMessage }
      ];

      // Add empty bot message for streaming
      setMessages(prev => [...prev, { text: '', sender: 'bot' }]);

      // Stream the response
      streamingRef.current = true;
      let streamedText = '';
      const cleanupChunk = backend.onAiChatChunk((chunk: string) => {
        streamedText += chunk;
        const currentText = streamedText;

        // Update local state only if still mounted
        if (mountedRef.current) {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { text: currentText, sender: 'bot' };
            return updated;
          });
          scrollToBottom();
        }

        // Also update the streaming bridge if active (workspace is loading)
        if (streamingBridge.pending?.active) {
          const latest = streamingBridge.getLatestMessages();
          if (latest) {
            const updated = [...latest];
            updated[updated.length - 1] = { text: currentText, sender: 'bot' };
            streamingBridge.updateMessages(updated);
          }
        }
      });

      try {
        const result = await backend.aiChatStream(
          settings.baseUrl,
          settings.apiKey,
          model,
          history
        );
        cleanupChunk();
        streamingRef.current = false;

        if (result.success && result.reply) {
          const finalMessages: DisplayMessage[] = [];
          if (mountedRef.current) {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { text: result.reply!, sender: 'bot' };
              finalMessages.push(...updated);
              return updated;
            });
          }
          const newHistory = [
            ...chatHistory,
            { role: 'user' as const, content: userMessage },
            { role: 'assistant' as const, content: result.reply! }
          ];
          if (mountedRef.current) {
            setChatHistory(newHistory);
          }

          // Signal bridge that streaming is done
          streamingBridge.finishBridge();

          // Auto-detect HTML and open workspace with preview
          const htmlContent = extractHtmlFromResponse(result.reply!);
          if (htmlContent && folderPath) {
            // Small delay so state settles
            setTimeout(() => {
              autoSaveAndOpenWorkspace(htmlContent, folderPath, finalMessages, newHistory);
            }, 300);
          }
        } else if (result.error === 'aborted') {
          streamingBridge.finishBridge();
          if (streamedText) {
            if (mountedRef.current) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { text: streamedText + '\n\n⏹ *Response stopped.*', sender: 'bot' };
                return updated;
              });
              setChatHistory(prev => [
                ...prev,
                { role: 'user', content: userMessage },
                { role: 'assistant', content: streamedText }
              ]);
            }
          } else {
            if (mountedRef.current) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { text: '⏹ Response stopped.', sender: 'bot' };
                return updated;
              });
            }
          }
        } else {
          streamingBridge.finishBridge();
          if (mountedRef.current) {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { text: `⚠️ ${result.error ?? 'Unknown error'}`, sender: 'bot' };
              return updated;
            });
          }
        }
      } catch (streamErr: unknown) {
        cleanupChunk();
        streamingRef.current = false;
        streamingBridge.finishBridge();
        const errMsg = (streamErr as Error).message;
        if (errMsg?.includes('abort') && streamedText) {
          if (mountedRef.current) {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { text: streamedText + '\n\n⏹ *Response stopped.*', sender: 'bot' };
              return updated;
            });
            setChatHistory(prev => [
              ...prev,
              { role: 'user', content: userMessage },
              { role: 'assistant', content: streamedText }
            ]);
          }
        } else {
          if (mountedRef.current) {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { text: `⚠️ ${errMsg || 'Unknown error'}`, sender: 'bot' };
              return updated;
            });
          }
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setMessages(prev => [...prev, {
          text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          sender: 'bot'
        }]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [input, loading, chatHistory, sessionFolderPath, backend, settings, selectedModel, scrollToBottom, streamingBridge]);

  // Handle Enter key
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Stop streaming
  const handleStop = useCallback(async () => {
    try { await backend.aiChatAbort(); } catch { /* ignore */ }
  }, [backend]);

  // Start a new chat session (clears current messages)
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setChatHistory([]);
    setSessionFolderPath(null);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, []);

  // Open as workspace — carry over chat content and generate a title in background
  // IMPORTANT: Does NOT abort streaming — the stream continues via IPC and the bridge.
  const handleOpenWorkspace = useCallback(async () => {
    if (!sessionFolderPath) return;

    const isCurrentlyStreaming = loading;

    // First, persist the current chat history to the workspace so ChatPanel can pick it up
    try {
      // Ensure workspace history entry exists
      const ws = await backend.historyOpenWorkspace(sessionFolderPath);
      
      // Create a conversation with the current messages
      let conversationId = ws.activeConversationId;
      if (!conversationId) {
        const conv = await backend.historyCreateConversation(sessionFolderPath, 'Chat');
        conversationId = conv.id;
      }

      // Build the full message history (system + user/assistant pairs)
      const fullHistory: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant. The user is asking a general question without a specific workspace context. Be helpful and informative.'
        },
        ...chatHistory
      ];

      // If there's a streaming message in progress, include it
      if (isCurrentlyStreaming && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.sender === 'bot' && lastMsg.text) {
          const lastUserMsg = messages.filter(m => m.sender === 'user').pop();
          if (lastUserMsg && !chatHistory.some(m => m.role === 'user' && m.content === lastUserMsg.text)) {
            fullHistory.push({ role: 'user', content: lastUserMsg.text });
          }
          fullHistory.push({ role: 'assistant', content: lastMsg.text });
        }
      }

      // Save the conversation
      await backend.historyUpdateConversation(
        sessionFolderPath,
        conversationId,
        fullHistory,
        'Chat'
      );
    } catch (err) {
      console.error('[StartPageChat] Failed to persist chat before opening workspace:', err);
    }

    // If streaming, set up the bridge so ChatPanel can pick up the live stream
    if (isCurrentlyStreaming) {
      // Check if there's HTML being streamed — detect for preview
      const lastBot = messages.filter(m => m.sender === 'bot').pop();
      const partialHtml = lastBot ? extractHtmlFromMarkdown(lastBot.text) : null;
      const previewName = partialHtml ? extractPreviewName(partialHtml) : undefined;

      streamingBridge.startBridge({
        folderPath: sessionFolderPath,
        messages: [...messages],
        chatHistory: [...chatHistory],
        active: true,
        openPreview: !!partialHtml,
        previewHtml: partialHtml || undefined,
        previewName,
      });
    }

    // Open workspace — the ChatPanel will load persisted conversation + pick up bridge
    window.dispatchEvent(new CustomEvent('open-workspace', { detail: { folderPath: sessionFolderPath } }));
    onWorkspaceCreated?.(sessionFolderPath);

    // Background: generate a short title for the conversation
    if (settings && settings.apiKey && settings.baseUrl && messages.length > 0) {
      const model = selectedModel || settings.selectedModel;
      if (!model) return;
      try {
        const titleMessages: ChatMessage[] = [
          {
            role: 'system',
            content: 'Generate a very short title (3-6 words, no quotes) summarizing this conversation. Reply with ONLY the title, nothing else.'
          },
          ...messages.slice(0, 6).map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
          } as ChatMessage)),
        ];
        const titleResult = await backend.aiChat(settings.baseUrl, settings.apiKey, model, titleMessages);
        if (titleResult.success && titleResult.reply) {
          const title = titleResult.reply.trim().replace(/^["']|["']$/g, '').slice(0, 60);
          try {
            const ws = await backend.historyGetWorkspace(sessionFolderPath);
            if (ws && ws.activeConversationId) {
              await backend.historyRenameConversation(sessionFolderPath, ws.activeConversationId, title);
            }
          } catch {
            // best-effort
          }
        }
      } catch {
        // best-effort, don't block workspace opening
      }
    }
  }, [sessionFolderPath, onWorkspaceCreated, settings, selectedModel, messages, chatHistory, loading, backend, streamingBridge]);

  return (
    <div className="start-page-chat">
      {/* Header */}
      <div className="start-page-chat-header">
        <div className="start-page-chat-title">
          <MessageCircleIcon />
          <span>mydev.flovia.io</span>
        </div>
        <div className="start-page-chat-header-actions">
          {messages.length > 0 && (
            <button
              className="start-page-chat-new-btn"
              onClick={handleNewChat}
              title="New Chat"
            >
              ＋
            </button>
          )}
          <button
            className="start-page-chat-settings-btn"
            onClick={() => setSettingsOpen(true)}
            title="AI Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Workspace info badge */}
      {sessionFolderPath && (
        <div className="start-page-chat-workspace-badge">
          <span className="workspace-badge-icon">📁</span>
          <span className="workspace-badge-path" title={sessionFolderPath}>
            {sessionFolderPath.split('/').pop() || sessionFolderPath}
          </span>
          <span className="workspace-badge-label">Local Session</span>
        </div>
      )}

      {/* Messages area */}
      <div className="start-page-chat-messages" ref={messagesContainerRef}>
        {messages.length === 0 && (
          <div className="start-page-chat-empty">
            <div className="start-page-chat-welcome-actions">
              <button className="btn-import" onClick={importFolder}>📂 Import a Project</button>
              <GitHubClone />
            </div>
            <div className="start-page-chat-divider">
              <span>or start a conversation</span>
            </div>
            {!ready && (
              <p className="start-page-chat-hint">
                <button className="start-page-chat-configure-link" onClick={() => setSettingsOpen(true)}>
                  ⚙️ Configure AI provider
                </button>{' '}
                to start chatting
              </p>
            )}
            {ready && (
              <p className="start-page-chat-hint">
                Ask me anything! <span className="agent-disabled">Agent mode</span> is available after you select a workspace.
              </p>
            )}
          </div>
        )}
        {messages.map((msg, idx) => {
          const isLastBot = msg.sender === 'bot' && idx === messages.length - 1;
          const isStreaming = isLastBot && loading;
          const isEmpty = isStreaming && !msg.text;
          return (
            <div key={idx} className={`start-page-chat-message ${msg.sender}`}>
              <div className="message-content">
                {isEmpty ? (
                  <div className="loading">
                    <span className="dot">•</span>
                    <span className="dot">•</span>
                    <span className="dot">•</span>
                  </div>
                ) : msg.sender === 'bot' ? (
                  <StartBotContent
                    text={msg.text}
                    isStreaming={isStreaming}
                    sessionFolderPath={sessionFolderPath}
                  />
                ) : (
                  msg.text
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Session bar — always accessible, even during streaming */}
      {sessionFolderPath && (
        <div className={`start-page-chat-session-bar${loading ? ' streaming' : ''}`}>
          <span>{loading ? 'Streaming…' : 'Session created'}</span>
          <button onClick={handleOpenWorkspace}>
            {loading ? '⚡ View in Workspace →' : 'Open as Workspace →'}
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="start-page-chat-composer">
        <textarea
          ref={textareaRef}
          placeholder={ready ? 'Ask anything…' : 'Configure AI first…'}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading || !ready}
        />
        {loading ? (
          <button
            className="start-page-chat-send"
            onClick={handleStop}
            title="Stop generating"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            className="start-page-chat-send"
            onClick={handleSend}
            disabled={!input.trim() || !ready}
            title="Send"
          >
            <SendIcon />
          </button>
        )}
      </div>

      {/* Model selector toolbar */}
      <div className="start-page-chat-toolbar">
        {models.length > 0 ? (
          <select
            className="start-page-model-select"
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
          >
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        ) : (
          <button className="start-page-configure-btn" onClick={() => setSettingsOpen(true)}>
            Connect a model…
          </button>
        )}
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={handleSettingsSaved} />
    </div>
  );
}
