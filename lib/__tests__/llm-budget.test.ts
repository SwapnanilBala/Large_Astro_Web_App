import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The daily ceiling on paid LLM calls.
 *
 * What these pin down is the part the per-minute rate limiter cannot do: that a
 * caller who paces themselves under the window still stops, that one caller
 * exhausting their own allowance does not lock anyone else out, that the route
 * total stops everybody regardless of address, and that the whole thing resets
 * on the UTC day rather than drifting with process start.
 *
 * Since the allowance was split in two, they also pin down which allowance
 * applies to whom: an account carries its own, an address gets a taste, and the
 * two never share a bucket.
 *
 * All of it with no shared counter, which is both the local-dev configuration
 * and the shape the module degrades to when Neon is unreachable. The Postgres
 * half is covered in llm-budget-shared.test.ts; stubbing it out here keeps this
 * file about the policy and stops a `DATABASE_URL` in the environment from
 * turning these into integration tests by accident.
 */

vi.mock("@/lib/db/llm-budget-counters", () => ({
  isSharedLlmCounterConfigured: () => false,
  bumpSharedLlmCounters: () => Promise.reject(new Error("not reached")),
  pruneSharedLlmCounters: () => Promise.reject(new Error("not reached")),
}));

/* A token of the form `session-for-<id>` resolves to that account and nothing
   else does, so a test can mint as many distinct signed-in callers as it needs
   without a database. */
const TOKEN_PREFIX = "session-for-";

vi.mock("@/lib/identity/session", () => ({
  SESSION_COOKIE: "astro_session",
  resolveSession: async (token: string | null | undefined) =>
    token?.startsWith(TOKEN_PREFIX)
      ? { sessionId: "session-1", userId: token.slice(TOKEN_PREFIX.length) }
      : null,
}));

const {
  __resetLlmBudgetForTests,
  consumeLlmBudget,
  readLlmBudgetUsage,
} = await import("@/lib/llm-budget");

/* 2026-09-12T12:00:00Z -- midday, so "same day" cases cannot straddle midnight
   by accident and the rollover case has to be deliberate. */
const NOON = Date.UTC(2026, 8, 12, 12, 0, 0);
const NEXT_DAY = NOON + 86_400_000;

/* Two free, then ten once registered, the same on all three routes. */
const PER_ACCOUNT = 10;
const PER_ADDRESS = 2;

function requestFrom(ip: string, path = "/api/chart/domain-brief") {
  return new Request(`https://example.test${path}`, {
    headers: { "x-real-ip": ip },
  });
}

/**
 * A signed-in caller who is also behind an address.
 *
 * The address is always the same one on purpose: if it were ever what got
 * counted, the per-account tests below would fail instead of quietly passing.
 */
function signedInAs(userId: string, path = "/api/chart/domain-brief") {
  return new Request(`https://example.test${path}`, {
    headers: {
      cookie: `astro_session=${TOKEN_PREFIX}${userId}`,
      "x-real-ip": "203.0.113.1",
    },
  });
}

beforeEach(() => {
  __resetLlmBudgetForTests();
});

describe("per-account ceiling", () => {
  it("allows the configured number of calls then refuses that account", async () => {
    const caller = signedInAs("user-a");

    for (let i = 0; i < PER_ACCOUNT; i += 1) {
      expect((await consumeLlmBudget("/api/chart/domain-brief", caller, NOON)).allowed).toBe(true);
    }

    const refused = await consumeLlmBudget("/api/chart/domain-brief", caller, NOON);
    expect(refused.allowed).toBe(false);
    if (refused.allowed) throw new Error("unreachable");
    expect(refused.scope).toBe("caller");
  });

  it("does not let one exhausted account block a different account", async () => {
    const greedy = signedInAs("user-a");
    for (let i = 0; i < PER_ACCOUNT; i += 1) {
      await consumeLlmBudget("/api/chart/domain-brief", greedy, NOON);
    }
    expect((await consumeLlmBudget("/api/chart/domain-brief", greedy, NOON)).allowed).toBe(false);

    /* Same address, different account: the address is not what was spent. */
    const bystander = signedInAs("user-b");
    expect((await consumeLlmBudget("/api/chart/domain-brief", bystander, NOON)).allowed).toBe(true);
  });

  it("counts the two LLM routes separately", async () => {
    const caller = signedInAs("user-a");
    for (let i = 0; i < PER_ACCOUNT; i += 1) {
      await consumeLlmBudget("/api/chart/domain-brief", caller, NOON);
    }
    expect((await consumeLlmBudget("/api/chart/domain-brief", caller, NOON)).allowed).toBe(false);
    /* Same caller, different route, untouched allowance. */
    expect(
      (await consumeLlmBudget("/api/chart/dasha-interpretation", caller, NOON)).allowed,
    ).toBe(true);
  });
});

describe("the signed-out tier", () => {
  it("gives an address a taste and then asks it to sign in", async () => {
    const caller = requestFrom("203.0.113.5");

    for (let i = 0; i < PER_ADDRESS; i += 1) {
      expect((await consumeLlmBudget("/api/chart/domain-brief", caller, NOON)).allowed).toBe(true);
    }

    const refused = await consumeLlmBudget("/api/chart/domain-brief", caller, NOON);
    expect(refused.allowed).toBe(false);
    if (refused.allowed) throw new Error("unreachable");
    /* Not "caller": this is the one refusal the visitor can lift themselves,
       and the routes phrase it as an invitation on the strength of this. */
    expect(refused.scope).toBe("anonymous");
  });

  it("gives palm reading the same two, on the dearest route of the three", async () => {
    const caller = requestFrom("203.0.113.5", "/api/palm-reading");
    for (let i = 0; i < PER_ADDRESS; i += 1) {
      expect((await consumeLlmBudget("/api/palm-reading", caller, NOON)).allowed).toBe(true);
    }

    const refused = await consumeLlmBudget("/api/palm-reading", caller, NOON);
    expect(refused.allowed).toBe(false);
    if (refused.allowed) throw new Error("unreachable");
    expect(refused.scope).toBe("anonymous");
  });

  it("hands the same person the full allowance once they sign in", async () => {
    const address = requestFrom("203.0.113.5", "/api/palm-reading");
    for (let i = 0; i < PER_ADDRESS; i += 1) {
      await consumeLlmBudget("/api/palm-reading", address, NOON);
    }
    expect((await consumeLlmBudget("/api/palm-reading", address, NOON)).allowed).toBe(false);

    /* Signing in is a different bucket, not a top-up of the spent one: the
       taste is what it costs the funnel, and it is not deducted twice. */
    const account = signedInAs("user-a", "/api/palm-reading");
    for (let i = 0; i < PER_ACCOUNT; i += 1) {
      expect((await consumeLlmBudget("/api/palm-reading", account, NOON)).allowed).toBe(true);
    }
    expect((await consumeLlmBudget("/api/palm-reading", account, NOON)).allowed).toBe(false);
  });

  it("does not let a campus NAT spend an account's allowance, or the reverse", async () => {
    /* Everyone here shares 203.0.113.1 -- the address `signedInAs` uses. */
    const account = signedInAs("user-a", "/api/palm-reading");
    for (let i = 0; i < PER_ACCOUNT; i += 1) {
      await consumeLlmBudget("/api/palm-reading", account, NOON);
    }
    expect((await consumeLlmBudget("/api/palm-reading", account, NOON)).allowed).toBe(false);

    const neighbour = requestFrom("203.0.113.1", "/api/palm-reading");
    expect((await consumeLlmBudget("/api/palm-reading", neighbour, NOON)).allowed).toBe(true);
  });

  it("reports the remaining allowance of the tier that applies", async () => {
    expect(
      await consumeLlmBudget("/api/chart/domain-brief", requestFrom("203.0.113.5"), NOON),
    ).toEqual({ allowed: true, remaining: 2499, callerRemaining: PER_ADDRESS - 1 });
    /* One free left, and the next one after that is the sign-in prompt. */

    expect(await consumeLlmBudget("/api/chart/domain-brief", signedInAs("user-a"), NOON)).toEqual({
      allowed: true,
      remaining: 2498,
      callerRemaining: PER_ACCOUNT - 1,
    });
  });
});

describe("route ceiling", () => {
  it("refuses a caller who has never called once the route total is spent", async () => {
    /* Palm reading is 200 a day globally at 10 per account, so 20 distinct
       accounts spend the whole route budget without any one of them tripping
       its per-caller limit. This is the distributed case the per-IP sliding
       window cannot see at all. */
    for (let n = 0; n < 20; n += 1) {
      const caller = signedInAs(`user-${n}`, "/api/palm-reading");
      for (let i = 0; i < PER_ACCOUNT; i += 1) {
        expect((await consumeLlmBudget("/api/palm-reading", caller, NOON)).allowed).toBe(true);
      }
    }

    expect(readLlmBudgetUsage("/api/palm-reading", NOON)).toEqual({
      used: 200,
      limit: 200,
    });

    const fresh = signedInAs("user-late", "/api/palm-reading");
    const refused = await consumeLlmBudget("/api/palm-reading", fresh, NOON);
    expect(refused.allowed).toBe(false);
    if (refused.allowed) throw new Error("unreachable");
    expect(refused.scope).toBe("global");
  });

  it("stops signed-out callers too, however many addresses they have", async () => {
    for (let n = 0; n < 200; n += 1) {
      const caller = requestFrom(`198.51.${Math.floor(n / 256)}.${n % 256}`, "/api/palm-reading");
      expect((await consumeLlmBudget("/api/palm-reading", caller, NOON)).allowed).toBe(true);
    }
    const refused = await consumeLlmBudget(
      "/api/palm-reading",
      requestFrom("203.0.113.99", "/api/palm-reading"),
      NOON,
    );
    expect(refused.allowed).toBe(false);
    if (refused.allowed) throw new Error("unreachable");
    /* The route total, not the address's own: a proxy pool defeats the
       per-caller tier and this is the layer that is left. */
    expect(refused.scope).toBe("global");
  });
});

describe("UTC day rollover", () => {
  it("resets both ceilings at midnight UTC", async () => {
    const caller = signedInAs("user-a");
    for (let i = 0; i < PER_ACCOUNT; i += 1) {
      await consumeLlmBudget("/api/chart/domain-brief", caller, NOON);
    }
    expect((await consumeLlmBudget("/api/chart/domain-brief", caller, NOON)).allowed).toBe(false);

    expect((await consumeLlmBudget("/api/chart/domain-brief", caller, NEXT_DAY)).allowed).toBe(true);
    expect(readLlmBudgetUsage("/api/chart/domain-brief", NEXT_DAY).used).toBe(1);
  });

  it("reports retryAfterSeconds as the time left until that reset", async () => {
    const caller = signedInAs("user-a");
    for (let i = 0; i < PER_ACCOUNT; i += 1) {
      await consumeLlmBudget("/api/chart/domain-brief", caller, NOON);
    }
    const refused = await consumeLlmBudget("/api/chart/domain-brief", caller, NOON);
    if (refused.allowed) throw new Error("unreachable");
    /* NOON is exactly 12 hours before the next UTC midnight. */
    expect(refused.retryAfterSeconds).toBe(12 * 60 * 60);
  });
});

describe("caller identity", () => {
  it("falls back to a shared bucket when no proxy header is present", async () => {
    const anonymous = () => new Request("https://example.test/api/chart/domain-brief");
    for (let i = 0; i < PER_ADDRESS; i += 1) {
      expect((await consumeLlmBudget("/api/chart/domain-brief", anonymous(), NOON)).allowed).toBe(true);
    }
    /* Unattributable traffic shares one allowance rather than getting a fresh
       one per request -- the opposite would make the header optional in
       practice, which is the same as having no per-caller limit. */
    expect((await consumeLlmBudget("/api/chart/domain-brief", anonymous(), NOON)).allowed).toBe(false);
  });

  it("treats a cookie that resolves to nobody as signed out", async () => {
    /* An expired or forged token must not buy the larger allowance. */
    const forged = new Request("https://example.test/api/palm-reading", {
      headers: { cookie: "astro_session=not-a-real-token", "x-real-ip": "203.0.113.5" },
    });
    for (let i = 0; i < PER_ADDRESS; i += 1) {
      expect((await consumeLlmBudget("/api/palm-reading", forged, NOON)).allowed).toBe(true);
    }
    const refused = await consumeLlmBudget("/api/palm-reading", forged, NOON);
    expect(refused.allowed).toBe(false);
    if (refused.allowed) throw new Error("unreachable");
    expect(refused.scope).toBe("anonymous");
  });
});
