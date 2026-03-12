/**
 * StreamingBridgeContext — Persists streaming state across the Welcome → Workspace transition.
 *
 * When a user clicks "Open as Workspace" or "Preview" on the start page while streaming,
 * this context captures the in-progress stream so the ChatPanel in the workspace can pick
 * it up and continue showing live progress without interruption.
 */
import { createContext, useContext, useRef, useCallback, useState, type ReactNode } from 'react';
import type { ChatMessage, DisplayMessage } from '../types';

export interface PendingStream {
  /** Session folder path that becomes the workspace */
  folderPath: string;
  /** Messages accumulated so far (user + partial bot) */
  messages: DisplayMessage[];
  /** Chat history (role/content pairs) for continuation */
  chatHistory: ChatMessage[];
  /** Whether the stream is still in progress */
  active: boolean;
  /** If we should auto-open an HTML preview tab on workspace load */
  openPreview?: boolean;
  /** The HTML content to preview (may grow during streaming) */
  previewHtml?: string;
  /** A title extracted from the HTML */
  previewName?: string;
}

interface StreamingBridgeValue {
  /** The pending stream that should be picked up by ChatPanel */
  pending: PendingStream | null;
  /** Start a pending bridge (called by StartPageChat before opening workspace) */
  startBridge: (stream: PendingStream) => void;
  /** Called by ChatPanel once it has consumed the pending stream */
  consumeBridge: () => PendingStream | null;
  /** Update the messages in the pending bridge (called by ongoing streaming) */
  updateMessages: (messages: DisplayMessage[]) => void;
  /** Mark streaming as finished */
  finishBridge: () => void;
  /** Ref-based getter for latest messages (avoids stale closures in IPC callbacks) */
  getLatestMessages: () => DisplayMessage[] | null;
}

const StreamingBridgeContext = createContext<StreamingBridgeValue | null>(null);

export function useStreamingBridge(): StreamingBridgeValue {
  const ctx = useContext(StreamingBridgeContext);
  if (!ctx) throw new Error('useStreamingBridge must be inside StreamingBridgeProvider');
  return ctx;
}

export function StreamingBridgeProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingStream | null>(null);
  const messagesRef = useRef<DisplayMessage[] | null>(null);

  const startBridge = useCallback((stream: PendingStream) => {
    messagesRef.current = stream.messages;
    setPending(stream);
  }, []);

  const consumeBridge = useCallback((): PendingStream | null => {
    const current = pending;
    // Don't clear yet — the stream may still be active.
    // ChatPanel will call finishBridge when done.
    return current;
  }, [pending]);

  const updateMessages = useCallback((messages: DisplayMessage[]) => {
    messagesRef.current = messages;
    setPending(prev => prev ? { ...prev, messages } : null);
  }, []);

  const finishBridge = useCallback(() => {
    setPending(prev => prev ? { ...prev, active: false } : null);
    // Clear after a short delay so ChatPanel has time to read final state
    setTimeout(() => {
      setPending(null);
      messagesRef.current = null;
    }, 500);
  }, []);

  const getLatestMessages = useCallback((): DisplayMessage[] | null => {
    return messagesRef.current;
  }, []);

  return (
    <StreamingBridgeContext.Provider value={{
      pending,
      startBridge,
      consumeBridge,
      updateMessages,
      finishBridge,
      getLatestMessages,
    }}>
      {children}
    </StreamingBridgeContext.Provider>
  );
}
