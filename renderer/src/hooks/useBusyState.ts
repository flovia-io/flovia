/**
 * useBusyState — Reusable hook for tracking busy/loading state per ID.
 *
 * Used across panels that manage multiple items (servers, connectors, agents, etc.)
 * each of which can independently be in a "busy" state.
 */
import { useState, useCallback } from 'react';

export function useBusyState() {
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds(prev => {
      const next = new Set(prev);
      busy ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const isBusy = useCallback((id: string) => busyIds.has(id), [busyIds]);

  return { busyIds, setBusy, isBusy };
}
