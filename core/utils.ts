/**
 * Core utilities — Shared helpers used across the core domain.
 *
 * This module eliminates duplication of common patterns like ID generation,
 * list upsert, and timestamp formatting.
 */

// ─── ID Generation ──────────────────────────────────────────────────────────

/**
 * Generate a unique ID. Uses `crypto.randomUUID()` when available,
 * falls back to a timestamp + random suffix.
 */
export function genId(prefix?: string): string {
  try {
    return crypto.randomUUID();
  } catch {
    const base = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return prefix ? `${prefix}-${base}` : base;
  }
}

// ─── List Upsert ────────────────────────────────────────────────────────────

/**
 * Upsert an item into a list by matching on `id`.
 * Returns a new array (does NOT mutate the original).
 *
 * @param list   The existing array of items with `{ id: string }`.
 * @param item   The item to insert or replace.
 * @returns      The updated array.
 */
export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex(x => x.id === item.id);
  if (idx >= 0) {
    const copy = [...list];
    copy[idx] = item;
    return copy;
  }
  return [...list, item];
}

/**
 * Remove an item from a list by `id`.
 * Returns `{ list, removed }`.
 */
export function removeById<T extends { id: string }>(list: T[], id: string): { list: T[]; removed: boolean } {
  const filtered = list.filter(x => x.id !== id);
  return { list: filtered, removed: filtered.length < list.length };
}

// ─── Timestamps ─────────────────────────────────────────────────────────────

/** ISO timestamp for right now */
export function now(): string {
  return new Date().toISOString();
}

// ─── Capped Array ───────────────────────────────────────────────────────────

/**
 * Append to an array and cap its length (keeps the most recent entries).
 */
export function appendCapped<T>(list: T[], item: T, max: number): T[] {
  const next = [...list, item];
  return next.length > max ? next.slice(next.length - max) : next;
}
