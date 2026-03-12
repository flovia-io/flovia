import { useEffect, type RefObject } from 'react';

/**
 * Hook that triggers a callback when clicking outside of the specified element
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement>,
  callback: () => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, callback, enabled]);
}
