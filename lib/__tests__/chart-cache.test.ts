import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChartCache } from "../chart-cache";

describe("ChartCache", () => {
  let cache: ChartCache<string>;

  beforeEach(() => {
    cache = new ChartCache<string>(5, 30_000);
  });

  it("should store and retrieve a value", () => {
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("should return null for a missing key", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("should respect max entries and evict oldest", () => {
    for (let i = 0; i < 7; i++) {
      cache.set(`key${i}`, `value${i}`);
    }
    // Max is 5, so first 2 should be evicted
    expect(cache.size).toBe(5);
    expect(cache.get("key0")).toBeNull();
    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key2")).toBe("value2");
    expect(cache.get("key6")).toBe("value6");
  });

  it("should expire entries after TTL", () => {
    vi.useFakeTimers();
    try {
      cache.set("expiring", "data", 1000); // 1 second TTL
      expect(cache.get("expiring")).toBe("data");

      vi.advanceTimersByTime(1500); // advance past TTL
      expect(cache.get("expiring")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("should not expire entries within TTL", () => {
    vi.useFakeTimers();
    try {
      cache.set("alive", "data", 5000);
      vi.advanceTimersByTime(3000);
      expect(cache.get("alive")).toBe("data");
    } finally {
      vi.useRealTimers();
    }
  });

  it("should update existing entry on re-set", () => {
    cache.set("key", "old");
    cache.set("key", "new");
    expect(cache.get("key")).toBe("new");
    expect(cache.size).toBe(1);
  });

  it("should invalidate a specific key", () => {
    cache.set("a", "1");
    cache.set("b", "2");
    cache.invalidate("a");
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe("2");
  });

  it("should clear all entries", () => {
    cache.set("a", "1");
    cache.set("b", "2");
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeNull();
  });

  it("should report has() correctly", () => {
    cache.set("present", "yes");
    expect(cache.has("present")).toBe(true);
    expect(cache.has("absent")).toBe(false);
  });

  it("should prune expired entries", () => {
    vi.useFakeTimers();
    try {
      cache.set("short", "data", 500);
      cache.set("long", "data", 10_000);
      vi.advanceTimersByTime(1000);
      const pruned = cache.prune();
      expect(pruned).toBe(1);
      expect(cache.size).toBe(1);
      expect(cache.get("long")).toBe("data");
    } finally {
      vi.useRealTimers();
    }
  });

  describe("makeKey", () => {
    it("should produce deterministic keys", () => {
      const key1 = ChartCache.makeKey("test=123&foo=bar");
      const key2 = ChartCache.makeKey("test=123&foo=bar");
      expect(key1).toBe(key2);
    });

    it("should produce different keys for different inputs", () => {
      const key1 = ChartCache.makeKey("input_a");
      const key2 = ChartCache.makeKey("input_b");
      expect(key1).not.toBe(key2);
    });

    it("should return a string starting with 'chart_'", () => {
      const key = ChartCache.makeKey("anything");
      expect(key.startsWith("chart_")).toBe(true);
    });
  });

  it("should promote recently accessed items (LRU behavior)", () => {
    // Fill cache to capacity
    for (let i = 0; i < 5; i++) {
      cache.set(`k${i}`, `v${i}`);
    }
    // Access k0 to promote it
    cache.get("k0");
    // Add 2 more entries to trigger eviction
    cache.set("new1", "n1");
    cache.set("new2", "n2");
    // k0 should survive because it was recently accessed
    expect(cache.get("k0")).toBe("v0");
    // k1 and k2 should have been evicted (oldest not-recently-accessed)
    expect(cache.get("k1")).toBeNull();
    expect(cache.get("k2")).toBeNull();
  });
});
