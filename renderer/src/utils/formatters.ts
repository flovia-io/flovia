/**
 * Shared formatting utilities used across multiple components.
 */

/**
 * Format an ISO date string into a human-friendly short form.
 * - If today → "HH:MM"
 * - Otherwise → "Mon DD"
 */
export function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Extract display name from an email "From" header.
 * e.g. "John Doe <john@example.com>" → "John Doe"
 */
export function extractEmailName(from: string): string {
  const match = from.match(/^([^<]+)</);
  if (match) return match[1].trim();
  return from;
}
