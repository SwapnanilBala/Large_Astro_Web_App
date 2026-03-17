/**
 * Client-side in-memory cache for recently viewed chart responses.
 *
 * - Map-based with TTL expiration per entry
 * - LRU eviction when max entries is reached
 * - Cache key: SHA-256 hash of query string (or plain string if crypto unavailable)
 */

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ENTRIES = 20;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class ChartCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(maxEntries = MAX_ENTRIES, ttlMs = DEFAULT_TTL_MS) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /**
   * Generate a cache key from an arbitrary query string.
   * Uses a simple hash when crypto.subtle is unavailable (sync fallback).
   */
  static makeKey(input: string): string {
    // Simple djb2 hash - fast, deterministic, no async needed
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
    }
    return `chart_${(hash >>> 0).toString(36)}`;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Move to end (most recently used) by re-inserting
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    // Remove if already present so re-insert puts it at the end
    this.store.delete(key);

    // Evict oldest entries if at capacity
    while (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      } else {
        break;
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.ttlMs),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  /**
   * Remove all expired entries. Call periodically if desired.
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}

/** Singleton chart cache instance for the client app. */
export const chartCache = new ChartCache();

export { ChartCache };
