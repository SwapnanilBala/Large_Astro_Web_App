/**
 * Client-side in-memory cache for recently viewed chart responses.
 *
 * - Map-based with TTL expiration per entry
 * - LRU eviction when max entries is reached
 * - Cache key: dual-pass FNV-1a 64-bit hash of query string
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
   * Uses two-pass FNV-1a to produce a 64-bit hash (16 hex chars),
   * providing much better collision resistance than a single 32-bit hash
   * while remaining synchronous for client-side use.
   */
  static makeKey(input: string): string {
    // FNV-1a pass 1 (standard offset basis)
    let h1 = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h1 ^= input.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
    }

    // FNV-1a pass 2 (different offset basis for independent bits)
    let h2 = 0x050c5d1f;
    for (let i = 0; i < input.length; i++) {
      h2 ^= input.charCodeAt(i);
      h2 = Math.imul(h2, 0x01000193);
    }

    const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
    const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
    return `chart_${hex1}${hex2}`;
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
