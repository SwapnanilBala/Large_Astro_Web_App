import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * Exercises the bytes that actually ship.
 *
 * public/sw-cache-policy.js is served to browsers verbatim — no bundler, no
 * transform — so the test evaluates the file itself rather than a TypeScript
 * copy of it that could drift. The UMD wrapper in that file assigns to
 * module.exports when one is present, which is what makes this possible.
 */

type PolicyRequest = {
  url: string;
  method?: string;
  mode?: string;
  destination?: string;
};

type Policy = {
  NAVIGATION_ALLOWLIST: string[];
  isCacheable: (request: PolicyRequest, origin: string) => boolean;
  isCacheFirst: (request: PolicyRequest, origin: string) => boolean;
};

function loadPolicy(): Policy {
  const source = readFileSync(
    join(process.cwd(), "public", "sw-cache-policy.js"),
    "utf8",
  );
  /* Named `mod`, not `module`: Next's no-assign-module-variable rule fires on a
     local called `module`. The parameter inside the generated function is still
     `module`, which is what the UMD wrapper in the policy file looks for. */
  const mod = { exports: {} as Policy };
  new Function("module", "self", source)(mod, undefined);
  return mod.exports;
}

const policy = loadPolicy();
const ORIGIN = "https://lagna.example";
const nav = (url: string): PolicyRequest => ({ url, mode: "navigate", method: "GET" });

/* The birth details that reach /insights, from lib/profile-redirect.ts. */
const CHART_QUERY =
  "name=Asha&birthDate=1990-05-15&birthTime=14:30&timezoneOffsetMinutes=330" +
  "&latitude=22.5726&longitude=88.3639&country=India&state=West%20Bengal&city=Kolkata";

describe("service worker cache policy", () => {
  describe("never stores personal data", () => {
    it("refuses any URL carrying a query string", () => {
      expect(policy.isCacheable(nav(`${ORIGIN}/insights?${CHART_QUERY}`), ORIGIN)).toBe(false);
      expect(policy.isCacheable(nav(`${ORIGIN}/m/insights?${CHART_QUERY}`), ORIGIN)).toBe(false);
      expect(policy.isCacheable(nav(`${ORIGIN}/insights/palm-history?saved=3`), ORIGIN)).toBe(false);
    });

    it("refuses every API route, with or without a query", () => {
      for (const path of ["/api/chart", "/api/compatibility", "/api/palm-reading"]) {
        expect(
          policy.isCacheable({ url: `${ORIGIN}${path}?${CHART_QUERY}`, method: "GET" }, ORIGIN),
          path,
        ).toBe(false);
        expect(policy.isCacheable({ url: `${ORIGIN}${path}`, method: "GET" }, ORIGIN)).toBe(false);
      }
    });

    it("refuses non-GET requests, whose bodies carry chart input", () => {
      expect(
        policy.isCacheable({ url: `${ORIGIN}/api/chart`, method: "POST" }, ORIGIN),
      ).toBe(false);
    });

    it("refuses cross-origin responses, which may be opaque", () => {
      expect(policy.isCacheable(nav("https://elsewhere.test/insights/palm-history"), ORIGIN)).toBe(false);
    });
  });

  describe("never stores a device-dependent entry page", () => {
    /* proxy.ts varies these on User-Agent and the astro_view cookie; Cache
       Storage keys on URL alone and cannot distinguish the variants. */
    it.each(["/", "/insights", "/login", "/m", "/m/insights", "/m/login", "/m/"])("refuses %s", (path) => {
      expect(policy.isCacheable(nav(`${ORIGIN}${path}`), ORIGIN)).toBe(false);
    });

    it("does not accidentally refuse a path that merely starts with those letters", () => {
      expect(policy.isCacheable(nav(`${ORIGIN}/insights/palm-history`), ORIGIN)).toBe(true);
    });
  });

  describe("still caches what is safe", () => {
    it("allows the allowlisted prerendered routes", () => {
      for (const path of policy.NAVIGATION_ALLOWLIST) {
        expect(policy.isCacheable(nav(`${ORIGIN}${path}`), ORIGIN), path).toBe(true);
      }
    });

    it("allows content-hashed build output and prefers it from cache", () => {
      const asset = {
        url: `${ORIGIN}/_next/static/chunks/abc123.js`,
        method: "GET",
        destination: "script",
      };
      expect(policy.isCacheable(asset, ORIGIN)).toBe(true);
      expect(policy.isCacheFirst(asset, ORIGIN)).toBe(true);
    });

    it("allows static files from public/ but never prefers them from cache", () => {
      const icon = { url: `${ORIGIN}/icon.svg`, method: "GET", destination: "image" };
      expect(policy.isCacheable(icon, ORIGIN)).toBe(true);
      /* Not content-hashed, so a cached copy must never win over the network. */
      expect(policy.isCacheFirst(icon, ORIGIN)).toBe(false);
    });

    it("refuses a navigation that is not on the allowlist", () => {
      expect(policy.isCacheable(nav(`${ORIGIN}/some/future/route`), ORIGIN)).toBe(false);
    });

    it("never caches /login, in any form", () => {
      /* Off the allowlist deliberately, and since /m/login shipped it is also
         device-dependent: proxy.ts now varies /login on User-Agent, so a cached
         copy could hand a handset the desktop document.

         The parameterised form was never cacheable either, and that is the case
         worth keeping a test on: lib/profile-redirect.ts builds returnTo values
         pointing at /engine-select with the full chart query attached, so
         /login?returnTo=... carries birth details into the URL. */
      const personalReturnTo =
        `${ORIGIN}/login?returnTo=` +
        encodeURIComponent(`/engine-select?${CHART_QUERY}`);
      expect(policy.isCacheable(nav(`${ORIGIN}/login`), ORIGIN)).toBe(false);
      expect(policy.isCacheable(nav(personalReturnTo), ORIGIN)).toBe(false);
      expect(policy.NAVIGATION_ALLOWLIST).not.toContain("/login");
    });
  });

  describe("the allowlist stays honest", () => {
    it("lists no device-dependent path", () => {
      const overlap = policy.NAVIGATION_ALLOWLIST.filter(
        (path) => !policy.isCacheable(nav(`${ORIGIN}${path}`), ORIGIN),
      );
      expect(overlap).toEqual([]);
    });

    it("is non-empty, so a broken predicate cannot pass by allowing nothing", () => {
      expect(policy.NAVIGATION_ALLOWLIST.length).toBeGreaterThan(0);
    });
  });
});

describe("the shipped worker uses the policy", () => {
  const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

  it("imports the policy file", () => {
    expect(sw).toContain("importScripts('/sw-cache-policy.js')");
  });

  it("gates every cache write behind it", () => {
    /* Any cache.put outside maybeCache would bypass the policy entirely. */
    const puts = sw.match(/cache\.put\(/g) ?? [];
    expect(puts).toHaveLength(1);
    expect(sw).toMatch(/function maybeCache[\s\S]*?self\.isCacheable\([\s\S]*?cache\.put\(/);
  });

  it("no longer pre-caches the device-dependent root", () => {
    expect(sw).toMatch(/const PRECACHE = \['\/offline\.html'\]/);
  });

  it("bumps the cache name so earlier caches are purged on activate", () => {
    /* The activate handler deletes every cache whose key is not CACHE_NAME, so
       the rename is what removes birth details already stored under v3. */
    expect(sw).not.toContain("lagna-v3");
    expect(sw).toMatch(/const CACHE_NAME = 'lagna-v4'/);
    expect(sw).toMatch(/keys\.filter\(\(key\) => key !== CACHE_NAME\)/);
  });
});
