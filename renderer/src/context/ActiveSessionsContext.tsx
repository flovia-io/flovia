/**
 * ActiveSessionsContext
 *
 * Global context that tracks running AI sessions across workspace switches.
 * Sessions persist when the user navigates back to the Welcome page or
 * opens a different project. This allows the UI to show active session
 * indicators on the Welcome screen and in the chat history sidebar.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ActiveSession } from '../types';

interface ActiveSessionsContextValue {
  /** All currently active sessions across all workspaces */
  sessions: ActiveSession[];
  /** Get active sessions for a specific workspace */
  getSessionsForWorkspace: (folderPath: string) => ActiveSession[];
  /** Check if a workspace has any active sessions */
  hasActiveSessions: (folderPath: string) => boolean;
  /** Get count of active sessions for a workspace */
  getActiveCount: (folderPath: string) => number;
  /** Register or update an active session */
  upsertSession: (session: ActiveSession) => void;
  /** Update the status of an existing session */
  updateSessionStatus: (
    conversationId: string,
    status: ActiveSession['status'],
    statusText: string,
  ) => void;
  /** Remove a session (e.g. when streaming is complete) */
  removeSession: (conversationId: string) => void;
  /** Remove all sessions for a workspace */
  removeWorkspaceSessions: (folderPath: string) => void;
}

const ActiveSessionsContext = createContext<ActiveSessionsContextValue | null>(null);

export function useActiveSessions(): ActiveSessionsContextValue {
  const ctx = useContext(ActiveSessionsContext);
  if (!ctx) throw new Error('useActiveSessions must be used within ActiveSessionsProvider');
  return ctx;
}

export function ActiveSessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);

  const getSessionsForWorkspace = useCallback(
    (folderPath: string) => sessions.filter(s => s.folderPath === folderPath),
    [sessions],
  );

  const hasActiveSessions = useCallback(
    (folderPath: string) => sessions.some(s => s.folderPath === folderPath && s.status !== 'idle'),
    [sessions],
  );

  const getActiveCount = useCallback(
    (folderPath: string) => sessions.filter(s => s.folderPath === folderPath && s.status !== 'idle').length,
    [sessions],
  );

  const upsertSession = useCallback((session: ActiveSession) => {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.conversationId === session.conversationId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = session;
        return updated;
      }
      return [...prev, session];
    });
  }, []);

  const updateSessionStatus = useCallback(
    (conversationId: string, status: ActiveSession['status'], statusText: string) => {
      setSessions(prev =>
        prev.map(s =>
          s.conversationId === conversationId ? { ...s, status, statusText } : s,
        ),
      );
    },
    [],
  );

  const removeSession = useCallback((conversationId: string) => {
    setSessions(prev => prev.filter(s => s.conversationId !== conversationId));
  }, []);

  const removeWorkspaceSessions = useCallback((folderPath: string) => {
    setSessions(prev => prev.filter(s => s.folderPath !== folderPath));
  }, []);

  return (
    <ActiveSessionsContext.Provider
      value={{
        sessions,
        getSessionsForWorkspace,
        hasActiveSessions,
        getActiveCount,
        upsertSession,
        updateSessionStatus,
        removeSession,
        removeWorkspaceSessions,
      }}
    >
      {children}
    </ActiveSessionsContext.Provider>
  );
}
