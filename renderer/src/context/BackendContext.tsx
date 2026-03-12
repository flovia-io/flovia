/**
 * BackendContext
 *
 * Provides the `BackendAPI` instance to the entire React tree.
 * Usage:
 *   <BackendProvider>
 *     <App />
 *   </BackendProvider>
 *
 *   const backend = useBackend();  // in any component / hook
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { BackendAPI, BackendMode } from '../backend';
import { getBackend } from '../backend';

// ─── Context ────────────────────────────────────────────────────────────────

const BackendContext = createContext<BackendAPI | null>(null);

/**
 * Hook — returns the `BackendAPI` singleton.
 * Must be called within a `<BackendProvider>`.
 */
export function useBackend(): BackendAPI {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error('useBackend must be used within <BackendProvider>');
  return ctx;
}

/**
 * Hook — returns the current backend mode ('electron' | 'web').
 */
export function useBackendMode(): BackendMode {
  return useBackend().mode;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function BackendProvider({ children }: { children: ReactNode }) {
  const backend = useMemo(() => getBackend(), []);

  return (
    <BackendContext.Provider value={backend}>
      {children}
    </BackendContext.Provider>
  );
}
