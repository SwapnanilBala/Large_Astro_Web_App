// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOMAIN_BRIEF_KEYS } from "@/lib/domain-briefs";
import type { LifeDomainInsight } from "@/lib/astro-types";

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  budget: vi.fn(),
  resolveSession: vi.fn(),
  payload: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const { default: Anthropic } = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return {
    default: class extends Anthropic {
      messages = { parse: mocks.parse } as unknown as InstanceType<typeof Anthropic>["messages"];
    },
  };
});
vi.mock("@/lib/llm-budget", () => ({ consumeLlmBudget: mocks.budget }));
vi.mock("@/lib/identity/session", () => ({
  SESSION_COOKIE: "astro_session",
  resolveSession: mocks.resolveSession,
}));
vi.mock("@/lib/chart-params", () => ({
  readChartParams: (params: unknown) => params,
  hasAllChartParams: (params: Record<string, string>) => Boolean(params.birthDate),
  chartParamsToBirthInput: () => ({}),
  getLifeDomainPayload: mocks.payload,
}));

const insights = DOMAIN_BRIEF_KEYS.map((key, index) => ({
  key,
  label: `Area ${key}`,
  signal_profile: { activity_score: 80 - index, activity_band: "high" },
  evidence_matrix: {
    conclusion_strength: "strong", confirmation_status: "confirmed",
    supporting_families: ["natal"], pressure_families: ["timing"],
  },
  subthemes: [{ label: `${key} theme`, band: "high" }],
  display: {
    headline: `${key} headline`, strengths: [`${key} strength`],
    watchouts: [`${key} watchout`], timing: [`${key} timing`],
  },
})) as unknown as LifeDomainInsight[];

function providerResponse(prefix = "Guest") {
  return {
    stop_reason: "end_turn",
    parsed_output: Object.fromEntries(DOMAIN_BRIEF_KEYS.map((key) => [key, `${prefix} **${key}** brief.`])),
    usage: { input_tokens: 100, output_tokens: 200 },
  };
}

function request(domain = "love_life", cookie?: string, extra = "") {
  return new NextRequest(`https://example.test/api/chart/domain-brief?birthDate=1990-06-15&domain=${domain}${extra}`, {
    headers: cookie ? { cookie } : {},
  });
}

let GET: typeof import("../route").GET;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  mocks.payload.mockReturnValue({ insights });
  mocks.resolveSession.mockResolvedValue(null);
  mocks.budget.mockResolvedValue({ allowed: true, remaining: 100, callerRemaining: 3 });
  mocks.parse.mockResolvedValue(providerResponse());
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  GET = (await import("../route")).GET;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Ultimate Module briefs", () => {
  it("writes all seven guest areas on Haiku 5.5 at low effort and spends only one budget unit", async () => {
    for (const key of DOMAIN_BRIEF_KEYS) {
      const response = await GET(request(key));
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await response.json()).toMatchObject({
        brief: `Guest ${key} brief.`, cached: key !== DOMAIN_BRIEF_KEYS[0],
        briefs: Object.fromEntries(DOMAIN_BRIEF_KEYS.map((area) => [area, `Guest ${area} brief.`])),
      });
    }
    expect(mocks.parse).toHaveBeenCalledTimes(1);
    expect(mocks.budget).toHaveBeenCalledTimes(1);
    expect(mocks.resolveSession).not.toHaveBeenCalled();
    const call = mocks.parse.mock.calls[0][0];
    expect(call.model).toBe("claude-haiku-5-5");
    // The shared chart setting (lib/llm-models.ts), the same for every caller.
    expect(call.output_config.effort).toBe("low");
    expect(call.output_config.format.schema.required).toEqual([...DOMAIN_BRIEF_KEYS]);
    for (const key of DOMAIN_BRIEF_KEYS) expect(call.messages[0].content).toContain(`${key} strength`);
  });

  it("writes the same briefs for a signed-in reader, and takes no effort from the URL", async () => {
    mocks.resolveSession.mockResolvedValue({ userId: "google-user", email: "reader@gmail.com" });
    const response = await GET(request("career", "astro_session=valid-token", "&effort=high&signedIn=true"));
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("effort");
    expect(mocks.parse.mock.calls[0][0].output_config.effort).toBe("low");
    // One request shape for everyone, so there is no caller to resolve.
    expect(mocks.resolveSession).not.toHaveBeenCalled();
  });

  it("is untouched by a broken session store", async () => {
    mocks.resolveSession.mockRejectedValue(new Error("database offline"));
    const response = await GET(request("inheritance", "astro_session=valid-token"));
    expect(response.status).toBe(200);
    expect(mocks.parse.mock.calls[0][0].model).toBe("claude-haiku-5-5");
  });

  it("shares one cache between guests and accounts", async () => {
    await GET(request());
    const account = await GET(request("career", "astro_session=valid-token"));
    expect(await account.json()).toMatchObject({ brief: "Guest career brief.", cached: true });
    expect(mocks.parse).toHaveBeenCalledTimes(1);
    expect(mocks.budget).toHaveBeenCalledTimes(1);
  });

  it("coalesces overlapping tab requests into one call", async () => {
    let finish!: (value: ReturnType<typeof providerResponse>) => void;
    mocks.parse.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const first = GET(request("career"));
    const second = GET(request("family"));
    await vi.waitFor(() => expect(mocks.parse).toHaveBeenCalledTimes(1));
    finish(providerResponse());
    const responses = await Promise.all([first, second]);
    expect(await responses[0].json()).toMatchObject({ brief: "Guest career brief." });
    expect(await responses[1].json()).toMatchObject({ brief: "Guest family brief." });
    expect(mocks.budget).toHaveBeenCalledTimes(1);
  });

  it.each(["refusal", "max_tokens"])("does not cache %s responses", async (stop_reason) => {
    mocks.parse.mockResolvedValueOnce({ ...providerResponse(), stop_reason });
    expect((await GET(request())).status).toBe(502);
    expect((await GET(request())).status).toBe(200);
    expect(mocks.parse).toHaveBeenCalledTimes(2);
  });

  it("rejects a missing area rather than silently caching partial coverage", async () => {
    mocks.parse.mockResolvedValueOnce({ ...providerResponse(), parsed_output: { love_life: "Only one area" } });
    expect((await GET(request())).status).toBe(502);
    expect((await GET(request())).status).toBe(200);
  });

  it("keeps the missing-key fallback and daily budget enforcement", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await GET(request())).status).toBe(503);
    expect(mocks.budget).not.toHaveBeenCalled();
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    mocks.budget.mockResolvedValue({ allowed: false, scope: "anonymous", retryAfterSeconds: 3600 });
    const response = await GET(request());
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { details: { scope: "anonymous" } } });
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  it("validates birth details and domain keys before calling the model", async () => {
    expect((await GET(new NextRequest("https://example.test/api/chart/domain-brief?domain=career"))).status).toBe(400);
    expect((await GET(request("unknown"))).status).toBe(400);
    expect(mocks.parse).not.toHaveBeenCalled();
  });
});
