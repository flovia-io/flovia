import { useEffect, useCallback } from 'react';

interface ShortcutOptions {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/**
 * Hook to handle keyboard shortcuts
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: ShortcutOptions = {},
  enabled = true
): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const matchesKey = event.key.toLowerCase() === key.toLowerCase();
      const matchesCtrl = options.ctrlKey === undefined || event.ctrlKey === options.ctrlKey;
      const matchesMeta = options.metaKey === undefined || event.metaKey === options.metaKey;
      const matchesShift = options.shiftKey === undefined || event.shiftKey === options.shiftKey;
      const matchesAlt = options.altKey === undefined || event.altKey === options.altKey;

      if (matchesKey && matchesCtrl && matchesMeta && matchesShift && matchesAlt) {
        event.preventDefault();
        callback();
      }
    },
    [key, callback, options, enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

/**
 * Hook specifically for Escape key
 */
export function useEscapeKey(callback: () => void, enabled = true): void {
  useKeyboardShortcut('Escape', callback, {}, enabled);
}
