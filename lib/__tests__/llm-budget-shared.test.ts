import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The daily ceiling once it is backed by Postgres rather than by one process.
 *
 * llm-budget.test.ts covers the policy with no shared counter — which is local
 * dev, and which is also what this module degrades to during an outage. What is
 * left, and what is the entire reason the table exists, is the part a single
 * process cannot be asked about: that two instances counting the same route
 * cannot between them spend more than the limit, that they cannot do it by
 * racing, and that the thing still works when the database does not.
 *
 * `llm_budget_counters` is faked here rather than reached over the network. The
 * fake reproduces the one property the real statement is chosen for — an
 * increment is atomic and returns the number it produced, with no suspension
 * point between the read and the write — because that is the property the code
 * under test is written against. Whether Postgres honours it for `INSERT .. ON
 * CONFLICT DO UPDATE .. RETURNING` is Postgres's business, not this suite's.
 */

const ROUTE_TOTAL_CALLER = "*";

/** The rows the real table would hold, keyed the same way its primary key is. */
const rows = new Map<string, number>();

/** Every increment the module asked for, recorded before the fake suspends. */
const bumpCalls: Array<{ utcDay: string; route: string; caller: string }> = [];

/** Every prune the module asked for, as the oldest day it wanted kept. */
const pruneCalls: string[] = [];

/** Set to make the round trip fail the way an unreachable Neon does. */
let failWith: Error | null = null;

/** Set to make the fire-and-forget prune fail. */
let pruneFailsWith: Error | null = null;

/**
 * When set, every increment parks here before touching a row.
 *
 * This is what makes the concurrency tests concurrent rather than merely
 * sequential-with-promises: it holds every in-flight call at the point *after*
 * it has passed the in-memory layer and *before* the shared counter has moved,
 * which is precisely the window the old per-instance ceiling lost.
 */
let gate: { promise: Promise<void>; open: () => void } | null = null;

function rowKey(utcDay: string, route: string, caller: string) {
  return `${utcDay}|${route}|${caller}`;
}

vi.mock("@/lib/db/llm-budget-counters", () => ({
  ROUTE_TOTAL_CALLER,
  isSharedLlmCounterConfigured: () => true,
  bumpSharedLlmCounters: async (utcDay: string, route: string, caller: string) => {
    bumpCalls.push({ utcDay, route, caller });
    if (gate) {
      await gate.promise;
    }
    if (failWith) {
      throw failWith;
    }
    /* No await between reading and writing: one statement, one row, atomic. */
    const bump = (who: string) => {
      const key = rowKey(utcDay, route, who);
      const next = (rows.get(key) ?? 0) + 1;
      rows.set(key, next);
      return next;
    };
    return { routeTotal: bump(ROUTE_TOTAL_CALLER), caller: bump(caller) };
  },
  pruneSharedLlmCounters: async (oldestUtcDayToKeep: string) => {
    pruneCalls.push(oldestUtcDayToKeep);
    if (pruneFailsWith) {
      throw pruneFailsWith;
    }
  },
}));

const TOKEN_PREFIX = "session-for-";

vi.mock("@/lib/identity/session", () => ({
  SESSION_COOKIE: "astro_session",
  resolveSession: async (token: string | null | undefined) =>
    token?.startsWith(TOKEN_PREFIX)
      ? { sessionId: "session-1", userId: token.slice(TOKEN_PREFIX.length) }
      : null,
}));

/* Two free, then ten once registered. */
const PER_ACCOUNT = 10;
const PER_ADDRESS = 2;

/* Same clock as llm-budget.test.ts: midday, so nothing straddles midnight by
   accident and the day key is unambiguously 2026-09-12. */
const NOON = Date.UTC(2026, 8, 12, 12, 0, 0);
const NEXT_DAY = NOON + 86_400_000;
const TODAY = "2026-09-12";

type BudgetModule = typeof import("@/lib/llm-budget");

/**
 * A warm serverless instance that has counted nothing yet.
 *
 * A fresh module registry gives a fresh `counters` map while the fake table
 * above survives, which is exactly the asymmetry the whole change is about.
 * Two of these can be held at once and driven against each other.
 */
async function newInstance(): Promise<BudgetModule> {
  vi.resetModules();
  return await import("@/lib/llm-budget");
}

/** Usage already on the books, as if other instances had spent it. */
function seed(route: string, caller: string, count: number, utcDay = TODAY) {
  rows.set(rowKey(utcDay, route, caller), count);
}

function requestFrom(ip: string, path = "/api/palm-reading") {
  return new Request(`https://example.test${path}`, {
    headers: { "x-real-ip": ip },
  });
}

function signedInAs(userId: string, path = "/api/palm-reading") {
  return new Request(`https://example.test${path}`, {
    headers: { cookie: `astro_session=${TOKEN_PREFIX}${userId}`, "x-real-ip": "203.0.113.1" },
  });
}

/**
 * Let every in-flight call reach the fake table.
 *
 * Resolving the caller is asynchronous now (it may consult the session store),
 * so a call no longer runs straight from `consumeLlmBudget` into the increment
 * the way it did when the identity was just a header read. Draining the
 * microtask queue is what puts all of them at the gate together, which is the
 * precondition the concurrency assertions below depend on.
 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function openGate() {
  const current = gate;
  gate = null;
  current?.open();
}

beforeEach(() => {
  rows.clear();
  bumpCalls.length = 0;
  pruneCalls.length = 0;
  failWith = null;
  pruneFailsWith = null;
  gate = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("one ceiling across instances", () => {
  it("refuses a fresh instance once another has spent the route total", async () => {
    const first = await newInstance();
    /* 20 accounts at 10 each is palm reading's whole day, with nobody tripping
       their own limit — the distributed case, now spent on one instance. */
    for (let n = 0; n < 20; n += 1) {
      const caller = signedInAs(`user-${n}`);
      for (let i = 0; i < PER_ACCOUNT; i += 1) {
        expect((await first.consumeLlmBudget("/api/palm-reading", caller, NOON)).allowed).toBe(true);
      }
    }
    expect(rows.get(rowKey(TODAY, "/api/palm-reading", ROUTE_TOTAL_CALLER))).toBe(200);

    /* The instance that has counted nothing. Under the old per-instance
       ceiling this was another 200 calls; the table is what stops it. */
    const second = await newInstance();
    const refused = await second.consumeLlmBudget(
      "/api/palm-reading",
      signedInAs("user-late"),
      NOON,
    );
    expect(refused.allowed).toBe(false);
    if (refused.allowed) throw new Error("unreachable");
    expect(refused.scope).toBe("global");
  });

  it("carries one caller's allowance from instance to instance", async () => {
    const caller = signedInAs("user-a");

    const first = await newInstance();
    for (let i = 0; i < 6; i += 1) {
      expect((await first.consumeLlmBudget("/api/palm-reading", caller, NOON)).allowed).toBe(true);
    }

    /* Four left, not ten: the same person routed to a different instance. */
    const second = await newInstance();
    for (let i = 0; i < PER_ACCOUNT - 6; i += 1) {
      expect((await second.consumeLlmBudget("/api/palm-reading", caller, NOON)).allowed).toBe(true);
    }

    const refused = await second.consumeLlmBudget("/api/palm-reading", caller, NOON);
    expect(refused.allowed).toBe(false);
    if (refused.allowed) throw new Error("unreachable");
    expect(refused.scope).toBe("caller");
  });

  it("reports remaining from the shared total, not from what it spent itself", async () => {
    seed("/api/palm-reading", ROUTE_TOTAL_CALLER, 150);

    const instance = await newInstance();
    const result = await instance.consumeLlmBudget("/api/palm-reading", signedInAs("user-a"), NOON);

    expect(result).toEqual({ allowed: true, remaining: 49, callerRemaining: PER_ACCOUNT - 1 });
  });

  it("keys the counter on the UTC day, not on the process's idea of today", async () => {
    const instance = await newInstance();
    const caller = requestFrom("203.0.113.5");

    await instance.consumeLlmBudget("/api/palm-reading", caller, NOON);
    await instance.consumeLlmBudget("/api/palm-reading", caller, NEXT_DAY);

    expect(bumpCalls.map((call) => call.utcDay)).toEqual(["2026-09-12", "2026-09-13"]);
    /* A new day is a new row, so the allowance is whole again. The caller is
       namespaced `ip:` so an address and an account can never share a row. */
    expect(rows.get(rowKey("2026-09-13", "/api/palm-reading", "ip:203.0.113.5"))).toBe(1);
  });
});

describe("concurrent increments", () => {
  it("does not let two instances race one caller past the per-caller ceiling", async () => {
    const first = await newInstance();
    const second = await newInstance();
    const caller = signedInAs("user-a");

    /* Six in flight on each: under the per-account limit of 10 as far as either
       instance's own memory can tell, and twelve between them. */
    gate = (() => {
      let open!: () => void;
      const promise = new Promise<void>((resolve) => {
        open = resolve;
      });
      return { promise, open };
    })();

    const inFlight = [
      ...Array.from({ length: 6 }, () =>
        first.consumeLlmBudget("/api/palm-reading", caller, NOON),
      ),
      ...Array.from({ length: 6 }, () =>
        second.consumeLlmBudget("/api/palm-reading", caller, NOON),
      ),
    ];

    /* All twelve got past their in-memory check before any counter moved. That
       is the race; if this is not 12 the test below proves nothing. */
    await flush();
    expect(bumpCalls).toHaveLength(12);

    openGate();
    const results = await Promise.all(inFlight);

    expect(results.filter((result) => result.allowed)).toHaveLength(PER_ACCOUNT);
    const refused = results.filter((result) => !result.allowed);
    expect(refused).toHaveLength(2);
    for (const result of refused) {
      if (result.allowed) throw new Error("unreachable");
      expect(result.scope).toBe("caller");
    }
  });

  it("does not let concurrent callers race past the route ceiling", async () => {
    /* Two left in the day, spent by other instances. */
    seed("/api/palm-reading", ROUTE_TOTAL_CALLER, 198);

    const instance = await newInstance();
    gate = (() => {
      let open!: () => void;
      const promise = new Promise<void>((resolve) => {
        open = resolve;
      });
      return { promise, open };
    })();

    /* Ten distinct addresses, so no per-caller limit is in play and nothing but
       the route total can refuse them. The instance's own memory says zero. */
    const inFlight = Array.from({ length: 10 }, (_unused, n) =>
      instance.consumeLlmBudget("/api/palm-reading", requestFrom(`203.0.113.${n}`), NOON),
    );
    await flush();
    expect(bumpCalls).toHaveLength(10);

    openGate();
    const results = await Promise.all(inFlight);

    expect(results.filter((result) => result.allowed)).toHaveLength(2);
    for (const result of results.filter((item) => !item.allowed)) {
      if (result.allowed) throw new Error("unreachable");
      expect(result.scope).toBe("global");
    }
  });

  it("stops paying for round trips once the shared counter says the route is spent", async () => {
    seed("/api/palm-reading", ROUTE_TOTAL_CALLER, 200);

    const instance = await newInstance();
    const first = await instance.consumeLlmBudget("/api/palm-reading", requestFrom("203.0.113.1"), NOON);
    expect(first.allowed).toBe(false);
    expect(bumpCalls).toHaveLength(1);

    /* Five more callers this instance has never seen. Each one is a row the
       table would grow by if the refusal needed a query to reach. */
    for (let n = 2; n < 7; n += 1) {
      const refused = await instance.consumeLlmBudget("/api/palm-reading", requestFrom(`203.0.113.${n}`), NOON);
      expect(refused.allowed).toBe(false);
    }
    expect(bumpCalls).toHaveLength(1);
  });
});

describe("when the shared counter is unreachable", () => {
  it("falls back to the per-instance ceiling instead of blocking the call", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    failWith = new Error("connection terminated unexpectedly");

    const instance = await newInstance();
    const caller = signedInAs("user-a");

    /* The route still works — degraded to what it was before the table. */
    for (let i = 0; i < PER_ACCOUNT; i += 1) {
      expect((await instance.consumeLlmBudget("/api/palm-reading", caller, NOON)).allowed).toBe(true);
    }
    /* And degraded is not absent: the in-memory ceiling is still a ceiling. */
    const refused = await instance.consumeLlmBudget("/api/palm-reading", caller, NOON);
    expect(refused.allowed).toBe(false);
    if (refused.allowed) throw new Error("unreachable");
    expect(refused.scope).toBe("caller");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("llm_budget_shared_counter_unavailable");
  });

  it("does not retry the failing round trip on every call", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    failWith = new Error("connection terminated unexpectedly");

    const instance = await newInstance();
    for (let n = 0; n < 5; n += 1) {
      await instance.consumeLlmBudget("/api/palm-reading", requestFrom(`203.0.113.${n}`), NOON);
    }
    /* One attempt, then the breaker: an outage must not add a database timeout
       to the latency of every LLM request. */
    expect(bumpCalls).toHaveLength(1);
  });

  it("goes back to the shared counter once the cooldown is over", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    failWith = new Error("connection terminated unexpectedly");

    const instance = await newInstance();
    const caller = signedInAs("user-a");
    await instance.consumeLlmBudget("/api/palm-reading", caller, NOON);
    expect(bumpCalls).toHaveLength(1);

    failWith = null;
    const recovered = await instance.consumeLlmBudget("/api/palm-reading", caller, NOON + 30_000);
    expect(bumpCalls).toHaveLength(2);
    /* The call made during the outage never reached the table, so the shared
       count starts from this one. Undercounting is the cost of degrading. */
    expect(recovered).toEqual({ allowed: true, remaining: 199, callerRemaining: PER_ACCOUNT - 1 });
  });
});

describe("pruning spent days", () => {
  it("asks once per instance per day for anything older than a week", async () => {
    const instance = await newInstance();
    for (let n = 0; n < 5; n += 1) {
      await instance.consumeLlmBudget("/api/palm-reading", requestFrom(`203.0.113.${n}`), NOON);
    }

    expect(pruneCalls).toEqual(["2026-09-05"]);

    await instance.consumeLlmBudget("/api/palm-reading", requestFrom("203.0.113.9"), NEXT_DAY);
    expect(pruneCalls).toEqual(["2026-09-05", "2026-09-06"]);
  });

  it("does not fail the request when the prune fails", async () => {
    pruneFailsWith = new Error("deadlock detected");

    const instance = await newInstance();
    const result = await instance.consumeLlmBudget("/api/palm-reading", requestFrom("203.0.113.5"), NOON);

    /* The delete is fire-and-forget, so a failed one must neither reach the
       caller nor escape as an unhandled rejection — which vitest fails on, so
       the second half of that is asserted by this test simply finishing. */
    expect(pruneCalls).toEqual(["2026-09-05"]);
    expect(result).toEqual({ allowed: true, remaining: 199, callerRemaining: PER_ADDRESS - 1 });
    await Promise.resolve();
  });
});
