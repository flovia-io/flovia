/**
 * Array utility functions
 */

/**
 * findLastIndex polyfill for ES2020 targets
 */
export function findLastIdx<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

/**
 * Group array items by a key function
 */
export function groupBy<T, K extends string | number>(
  arr: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

/**
 * Remove duplicates from array based on key function
 */
export function uniqueBy<T, K>(arr: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  return arr.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Sort array by multiple criteria
 */
export function sortBy<T>(
  arr: T[],
  ...compareFns: ((a: T, b: T) => number)[]
): T[] {
  return [...arr].sort((a, b) => {
    for (const fn of compareFns) {
      const result = fn(a, b);
      if (result !== 0) return result;
    }
    return 0;
  });
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
