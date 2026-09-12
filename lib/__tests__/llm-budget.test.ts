import { beforeEach, describe, expect, it } from "vitest";

import {
  __resetLlmBudgetForTests,
  consumeLlmBudget,
  readLlmBudgetUsage,
} from "@/lib/llm-budget";

/**
 * The daily ceiling on paid LLM calls.
 *
 * What these pin down is the part the per-minute rate limiter cannot do: that a
 * caller who paces themselves under the window still stops, that one caller
 * exhausting their own allowance does not lock anyone else out, that the route
 * total stops everybody regardless of address, and that the whole thing resets
 * on the UTC day rather than drifting with process start.
 */

/* 2026-09-12T12:00:00Z -- midday, so "same day" cases cannot straddle midnight
   by accident and the rollover case has to be deliberate. */
const NOON = Date.UTC(2026, 8, 12, 12, 0, 0);
const NEXT_DAY = NOON + 86_400_000;

function requestFrom(ip: string, path = "/api/chart/domain-brief") {
  return new Request(`https://example.test${path}`, {
    headers: { "x-real-ip": ip },
  });
}

beforeEach(() => {
  __resetLlmBudgetForTests();
});

describe("per-caller ceiling", () => {
  it("allows the configured number of calls then refuses that caller", () => {
    const caller = requestFrom("203.0.113.5");
    const limit = 60; // domain-brief perCallerPerDay

    for (let i = 0; i < limit; i += 1) {
      expect(consumeLlmBudget("/api/chart/domain-brief", caller, NOON).allowed).toBe(true);
    }

    const refused = consumeLlmBudget("/api/chart/domain-brief", caller, NOON);
    expect(refused.allowed).toBe(false);
    if (refused.allowed) throw new Error("unreachable");
    expect(refused.scope).toBe("caller");
  });

  it("does not let one exhausted caller block a different caller", () => {
    const greedy = requestFrom("203.0.113.5");
    for (let i = 0; i < 60; i += 1) {
      consumeLlmBudget("/api/chart/domain-brief", greedy, NOON);
    }
    expect(consumeLlmBudget("/api/chart/domain-brief", greedy, NOON).allowed).toBe(false);

    const bystander = requestFrom("198.51.100.7");
    expect(consumeLlmBudget("/api/chart/domain-brief", bystander, NOON).allowed).toBe(true);
  });

  it("counts the two LLM routes separately", () => {
    const caller = requestFrom("203.0.113.5");
    for (let i = 0; i < 60; i += 1) {
      consumeLlmBudget("/api/chart/domain-brief", caller, NOON);
    }
    expect(consumeLlmBudget("/api/chart/domain-brief", caller, NOON).allowed).toBe(false);
    /* Same caller, different route, untouched allowance. */
    expect(
      consumeLlmBudget("/api/chart/dasha-interpretation", caller, NOON).allowed,
    ).toBe(true);
  });
});

describe("route ceiling", () => {
  it("refuses a caller who has never called once the route total is spent", () => {
    /* Palm reading is 200 a day globally at 5 per caller, so 40 distinct
       addresses spend the whole route budget without any one of them tripping
       the per-caller limit. This is the distributed case the per-IP sliding
       window cannot see at all. */
    for (let n = 0; n < 40; n += 1) {
      const caller = requestFrom(`203.0.113.${n}`, "/api/palm-reading");
      for (let i = 0; i < 5; i += 1) {
        expect(consumeLlmBudget("/api/palm-reading", caller, NOON).allowed).toBe(true);
      }
    }

    expect(readLlmBudgetUsage("/api/palm-reading", NOON)).toEqual({
      used: 200,
      limit: 200,
    });

    const fresh = requestFrom("198.51.100.200", "/api/palm-reading");
    const refused = consumeLlmBudget("/api/palm-reading", fresh, NOON);
    expect(refused.allowed).toBe(false);
    if (refused.allowed) throw new Error("unreachable");
    expect(refused.scope).toBe("global");
  });
});

describe("UTC day rollover", () => {
  it("resets both ceilings at midnight UTC", () => {
    const caller = requestFrom("203.0.113.5");
    for (let i = 0; i < 60; i += 1) {
      consumeLlmBudget("/api/chart/domain-brief", caller, NOON);
    }
    expect(consumeLlmBudget("/api/chart/domain-brief", caller, NOON).allowed).toBe(false);

    expect(consumeLlmBudget("/api/chart/domain-brief", caller, NEXT_DAY).allowed).toBe(true);
    expect(readLlmBudgetUsage("/api/chart/domain-brief", NEXT_DAY).used).toBe(1);
  });

  it("reports retryAfterSeconds as the time left until that reset", () => {
    const caller = requestFrom("203.0.113.5");
    for (let i = 0; i < 60; i += 1) {
      consumeLlmBudget("/api/chart/domain-brief", caller, NOON);
    }
    const refused = consumeLlmBudget("/api/chart/domain-brief", caller, NOON);
    if (refused.allowed) throw new Error("unreachable");
    /* NOON is exactly 12 hours before the next UTC midnight. */
    expect(refused.retryAfterSeconds).toBe(12 * 60 * 60);
  });
});

describe("caller identity", () => {
  it("falls back to a shared bucket when no proxy header is present", () => {
    const anonymous = () => new Request("https://example.test/api/chart/domain-brief");
    for (let i = 0; i < 60; i += 1) {
      expect(consumeLlmBudget("/api/chart/domain-brief", anonymous(), NOON).allowed).toBe(true);
    }
    /* Unattributable traffic shares one allowance rather than getting a fresh
       one per request -- the opposite would make the header optional in
       practice, which is the same as having no per-caller limit. */
    expect(consumeLlmBudget("/api/chart/domain-brief", anonymous(), NOON).allowed).toBe(false);
  });
});
