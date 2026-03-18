/**
 * Server-side in-memory LRU cache with TTL expiration.
 *
 * Module-level singletons ensure a single cache instance per Next.js
 * server process (hot-reloads in dev are handled via globalThis).
 *
 * - LRU eviction when maxSize is reached
 * - Per-entry TTL with lazy expiration on access
 * - Deterministic cache-key generation from sorted params
 */

// ---------------------------------------------------------------------------
// Generic LRU + TTL cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ServerCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  public readonly name: string;

  constructor(name: string, maxSize: number, ttlMs: number) {
    this.name = name;
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /** Retrieve a cached value. Returns null when missing or expired. */
  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Move to end (most-recently-used) by re-inserting
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  /** Store a value. Evicts the least-recently-used entry when at capacity. */
  set(key: string, value: T, ttlMs?: number): void {
    this.store.delete(key);

    // Evict oldest (least-recently-used) entries
    while (this.store.size >= this.maxSize) {
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

  /** Remove all expired entries. */
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

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// Deterministic cache-key generation
// ---------------------------------------------------------------------------

/**
 * Build a deterministic cache key from a plain object of params.
 * Keys are sorted alphabetically so param ordering doesn't matter.
 */
export function makeCacheKey(
  prefix: string,
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k] ?? ""}`)
    .join("&");

  // djb2 hash for a compact key
  let hash = 5381;
  for (let i = 0; i < sorted.length; i++) {
    hash = ((hash << 5) + hash + sorted.charCodeAt(i)) | 0;
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

// ---------------------------------------------------------------------------
// Singleton instances (survive hot-reload in dev via globalThis)
// ---------------------------------------------------------------------------

const GLOBAL_KEY = "__serverCaches";

interface GlobalCaches {
  chart: ServerCache;
  forecast: ServerCache;
  dasha: ServerCache;
  compatibility: ServerCache;
  suggest: ServerCache;
  geocode: ServerCache;
  varshaphal: ServerCache;
}

function createCaches(): GlobalCaches {
  return {
    /** 500 entries, 1 hour TTL */
    chart: new ServerCache("chart", 500, 60 * 60 * 1000),
    /** 100 entries, 5 min TTL */
    forecast: new ServerCache("forecast", 100, 5 * 60 * 1000),
    /** 200 entries, 30 min TTL */
    dasha: new ServerCache("dasha", 200, 30 * 60 * 1000),
    /** 200 entries, 1 hour TTL */
    compatibility: new ServerCache("compatibility", 200, 60 * 60 * 1000),
    /** 300 entries, 24 hour TTL — autocomplete suggestions */
    suggest: new ServerCache("suggest", 300, 24 * 60 * 60 * 1000),
    /** 200 entries, 24 hour TTL — geocode lookups */
    geocode: new ServerCache("geocode", 200, 24 * 60 * 60 * 1000),
    /** 200 entries, 1 hour TTL — varshaphal / solar return */
    varshaphal: new ServerCache("varshaphal", 200, 60 * 60 * 1000),
  };
}

// Persist across hot-reloads in Next.js dev mode
const g = globalThis as unknown as Record<string, GlobalCaches>;
if (!g[GLOBAL_KEY]) {
  g[GLOBAL_KEY] = createCaches();
}

export const serverCaches: GlobalCaches = g[GLOBAL_KEY];
