// @vitest-environment node
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode, PLAIN_MESSAGES } from "@/lib/api-errors";
import type { AreaSelection } from "@/lib/knowledge/area-classics-reading";
import type { PassageRow } from "@/lib/knowledge/yoga-classics-reading";

/*
 * A provider that throws must not reach the reader in its own words.
 *
 * Each route below is driven into a thrown SDK error (the Anthropic key
 * rejected, OpenAI's key rejected, a database that refuses the connection),
 * and its whole response body is scanned for anything the provider said.
 */

const REQUEST_ID = "req_011CRouteLeakScan";
const LEAKS = [
  "invalid x-api-key",
  "authentication_error",
  "Incorrect API key",
  "sk-live",
  "ECONNREFUSED",
  "auth_users",
  "req_",
];

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  stream: vi.fn(),
  openaiCreate: vi.fn(),
  budget: vi.fn(),
  selectAreas: vi.fn(),
  passagesTaggedWith: vi.fn(),
  calculate: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const { default: Anthropic } = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return {
    default: class extends Anthropic {
      messages = { create: mocks.create, stream: mocks.stream } as unknown as InstanceType<typeof Anthropic>["messages"];
    },
  };
});
vi.mock("openai", async (importOriginal) => {
  const { default: OpenAI } = await importOriginal<typeof import("openai")>();
  return {
    default: class extends OpenAI {
      chat = { completions: { create: mocks.openaiCreate } } as unknown as InstanceType<typeof OpenAI>["chat"];
    },
  };
});
vi.mock("@/lib/llm-budget", () => ({ consumeLlmBudget: mocks.budget }));
vi.mock("@/lib/knowledge/retrieve", () => ({
  passagesForChart: async () => [],
  passagesTaggedWith: mocks.passagesTaggedWith,
}));
vi.mock("@/lib/knowledge/placements", () => ({ chartPlacementKeys: () => new Set<string>() }));
vi.mock("@/lib/chart-params", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chart-params")>()),
  readChartParams: (params: unknown) => params,
  hasAllChartParams: (params: Record<string, string>) => Boolean(params.birthDate),
  chartParamsToBirthInput: () => ({}),
  getChartPayload: () => ({ chart: { planets: [], ascendant: { sign: "Aries" }, navamsa: [], yogas: [] } }),
}));
vi.mock("@/lib/knowledge/area-classics-reading", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/knowledge/area-classics-reading")>()),
  selectAreas: mocks.selectAreas,
}));
vi.mock("@/lib/engines/swiss-ephemeris-engine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/engines/swiss-ephemeris-engine")>()),
  calculate: mocks.calculate,
}));

const passage = (id: string, lifeArea: string, placement: string): PassageRow => ({
  id,
  source: "brihat-jataka-1885",
  chapter: 20,
  verse: 8,
  part: 1,
  kind: "verse",
  text: `text of ${id}`,
  yogaIds: ["sunapha"],
  planets: [],
  lifeAreas: [lifeArea],
  placements: [placement],
  placementsAny: [],
});

const SELECTION: AreaSelection[] = [
  { area: "love_life", passages: [passage("bj:20.8.1", "relationships", "Venus.house.7")], conditions: ["Venus.house.7"], yogaNames: [] },
];

function anthropicKeyRejected() {
  return new Anthropic.AuthenticationError(
    401,
    { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" }, request_id: REQUEST_ID },
    undefined,
    new Headers({ "request-id": REQUEST_ID }),
  );
}

function openaiKeyRejected() {
  return new OpenAI.AuthenticationError(
    401,
    { message: "Incorrect API key provided: sk-live-abc", type: "invalid_request_error" },
    undefined,
    new Headers({ "x-request-id": "req_openai_scan" }),
  );
}

function databaseRefused() {
  return new Error('relation "auth_users" does not exist (connect ECONNREFUSED 10.0.0.5:5432)');
}

const post = (url: string, body: unknown) =>
  new NextRequest(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function scan(response: Response) {
  const text = await response.text();
  for (const leak of LEAKS) expect(text, `body leaks "${leak}": ${text}`).not.toContain(leak);
  return JSON.parse(text) as { error: { code: string; message: string; details?: unknown } };
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("OPENAI_API_KEY", "");
  mocks.budget.mockResolvedValue({ allowed: true, remaining: 100, callerRemaining: 3 });
  mocks.selectAreas.mockReturnValue(SELECTION);
  mocks.passagesTaggedWith.mockResolvedValue([passage("bj:13.5.1", "wealth", "Moon.house.1")]);
  mocks.create.mockRejectedValue(anthropicKeyRejected());
  mocks.stream.mockImplementation(() => {
    throw anthropicKeyRejected();
  });
  mocks.openaiCreate.mockRejectedValue(openaiKeyRejected());
  mocks.calculate.mockImplementation(() => {
    throw databaseRefused();
  });
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** The structured line errorResponse wrote, if any. */
function unexpectedLine(): Record<string, unknown> | undefined {
  for (const [first] of errorSpy.mock.calls as unknown[][]) {
    try {
      const entry = JSON.parse(String(first)) as Record<string, unknown>;
      if (entry.event === "unexpected_error") return entry;
    } catch {
      /* not a JSON line */
    }
  }
  return undefined;
}

describe("a thrown provider error, as the browser sees it", () => {
  it("/api/chart/area-classics: the plain message, and the request id in the log", async () => {
    const { GET } = await import("../chart/area-classics/route");
    const response = await GET(new NextRequest("https://example.test/api/chart/area-classics?birthDate=1990-06-15&language=en"));
    expect(response.status).toBe(500);
    const body = await scan(response);
    expect(body.error).toEqual({ code: "INTERNAL", message: PLAIN_MESSAGES[ErrorCode.INTERNAL] });
    expect(unexpectedLine()).toMatchObject({
      route: "/api/chart/area-classics",
      code: "INTERNAL",
      error: { name: "AuthenticationError", requestId: REQUEST_ID },
    });
  });

  it("/api/chart/yoga-classics", async () => {
    const { POST } = await import("../chart/yoga-classics/route");
    const response = await POST(
      post("https://example.test/api/chart/yoga-classics", {
        yogas: [{ id: "sunapha", planets: ["Jupiter"], strength: "strong" }],
        language: "en",
      }),
    );
    expect(response.status).toBeGreaterThanOrEqual(500);
    const body = await scan(response);
    expect(body.error.message).toBe(PLAIN_MESSAGES[ErrorCode.INTERNAL]);
    expect(unexpectedLine()).toMatchObject({ route: "/api/chart/yoga-classics" });
  });

  it("/api/palm-reading/ask", async () => {
    const { POST } = await import("../palm-reading/ask/route");
    const response = await POST(
      post("http://localhost/api/palm-reading/ask", {
        reading: { overall_summary: "A balanced hand.", guidance: "Tendencies, not fate." },
        question: "What about my heart line?",
      }),
    );
    expect(response.status).toBe(500);
    const body = await scan(response);
    expect(body.error.message).toBe(PLAIN_MESSAGES[ErrorCode.INTERNAL]);
    expect(unexpectedLine()).toMatchObject({ route: "/api/palm-reading/ask", error: { requestId: REQUEST_ID } });
  });

  it("/api/palm-reading, Claude rejected and the OpenAI fallback rejected too", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    const { POST } = await import("../palm-reading/route");
    const response = await POST(
      post("http://localhost/api/palm-reading", { image: "aGVsbG8gcGFsbQ==", mediaType: "image/jpeg" }),
    );
    expect(mocks.openaiCreate).toHaveBeenCalled();
    expect(response.status).toBe(500);
    const body = await scan(response);
    expect(body.error.code).toBe("INTERNAL");
  });

  it("/api/chart/sun-sign, a database-style error from the engine", async () => {
    const { GET } = await import("../chart/sun-sign/route");
    const response = await GET(
      new NextRequest("http://localhost/api/chart/sun-sign?birth_date=1995-03-14&birth_time=15:45&timezone_offset_minutes=-240"),
    );
    expect(response.status).toBe(500);
    const body = await scan(response);
    expect(body.error).toEqual({ code: "INTERNAL", message: PLAIN_MESSAGES[ErrorCode.INTERNAL] });
    expect(unexpectedLine()).toMatchObject({ route: "/api/chart/sun-sign", error: { name: "Error" } });
  });
});

describe("a deliberate refusal still says what it means", () => {
  it("keeps the rate-limit message and its details", async () => {
    mocks.budget.mockResolvedValue({ allowed: false, scope: "anonymous", retryAfterSeconds: 3600, remaining: 0 });
    const { GET } = await import("../chart/area-classics/route");
    const response = await GET(new NextRequest("https://example.test/api/chart/area-classics?birthDate=1990-06-15&language=en"));
    expect(response.status).toBe(429);
    const body = await scan(response);
    expect(body.error).toEqual({
      code: "RATE_LIMITED",
      message: "Sign in to keep reading classical notes today.",
      details: { retryAfterSeconds: 3600, scope: "anonymous" },
    });
  });
});
