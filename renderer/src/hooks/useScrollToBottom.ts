import { useCallback, useRef } from 'react';

/**
 * Hook for scrolling to bottom of a container
 */
export function useScrollToBottom() {
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior });
    }, 50);
  }, []);

  return { endRef, scrollToBottom };
}
