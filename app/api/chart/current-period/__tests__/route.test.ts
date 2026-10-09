// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The current-period reading is bought on mount for every visitor who opens
 * the timing section, so what it is asked in and what it is filed under are
 * the two things worth pinning: the reader's language has to reach the
 * prompt, and the same stack in two languages must be two cache entries, or
 * a Hindi page would be served the English reading for free.
 */

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  budget: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const { default: Anthropic } = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return {
    default: class extends Anthropic {
      messages = { create: mocks.create } as unknown as InstanceType<typeof Anthropic>["messages"];
    },
  };
});
vi.mock("@/lib/llm-budget", () => ({ consumeLlmBudget: mocks.budget }));

const STACK = [
  { lord: "Saturn", startDate: "2019-03-01", endDate: "2038-03-01", sign: "Capricorn", house: 10 },
  { lord: "Mercury", startDate: "2025-01-10", endDate: "2027-09-20", sign: "Virgo", house: 6 },
];

function request(language?: unknown) {
  return new NextRequest("https://example.test/api/chart/current-period", {
    method: "POST",
    body: JSON.stringify({
      stack: STACK,
      nakshatra: { name: "Rohini", lord: "Moon", pada: 2 },
      progressPercent: 40,
      language,
    }),
  });
}

type Sent = { system: Array<{ text: string }>; messages: Array<{ content: string }> };
const sent = (call = 0) => mocks.create.mock.calls[call][0] as Sent;
const userTurn = (call = 0) => sent(call).messages[0].content;

let POST: typeof import("../route").POST;

beforeEach(async () => {
  /* A fresh module each time, so each test starts with an empty cache. */
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  mocks.budget.mockResolvedValue({ allowed: true, remaining: 100, callerRemaining: 3 });
  mocks.create.mockResolvedValue({
    stop_reason: "end_turn",
    content: [{ type: "text", text: "Your Saturn period asks for structure." }],
    usage: { input_tokens: 300, output_tokens: 90 },
  });
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  POST = (await import("../route")).POST;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the current-period reading's language", () => {
  it("is the reader's, said last in the user turn", async () => {
    expect((await POST(request("hi"))).status).toBe(200);
    expect(userTurn()).toContain("Maha Dasha: Saturn");
    expect(userTurn()).toContain("\n\nWrite the paragraph in Hindi.");
    expect(userTurn().endsWith("Write every sentence in Hindi, although the facts above are in English.")).toBe(true);
  });

  it("asks a German reading to say du", async () => {
    await POST(request("de"));
    expect(userTurn()).toContain('Write the paragraph in German, addressing the reader informally as "du".');
  });

  it("leaves the frozen system prompt, its content rules and its word ceiling alone", async () => {
    await POST(request("bn"));
    await POST(request("en"));
    expect(sent(0).system[0].text).toBe(sent(1).system[0].text);
    expect(sent(0).system[0].text).toContain("Exactly 3 sentences, one paragraph, no more than 80 words in total.");
    expect(sent(0).system[0].text).toContain("No predictions of specific events");
    expect(userTurn(0)).toContain("Write every sentence in Bengali");
  });

  it.each(["constructor", "__proto__", "toString", "xx", 7, undefined])("is English for %j", async (language) => {
    expect((await POST(request(language))).status).toBe(200);
    expect(userTurn().endsWith("\n\nWrite the paragraph in English.")).toBe(true);
    expect(userTurn()).not.toContain("Write every sentence");
    expect(userTurn()).not.toContain("native code");
  });

  it("files each language's reading apart, and pays once for each", async () => {
    const english = await (await POST(request("en"))).json();
    const hindi = await (await POST(request("hi"))).json();
    expect(english.cached).toBe(false);
    expect(hindi.cached).toBe(false);
    expect(mocks.create).toHaveBeenCalledTimes(2);

    expect((await (await POST(request("hi"))).json()).cached).toBe(true);
    /* An unknown language is English, so it is the English entry's reader. */
    expect((await (await POST(request("xx"))).json()).cached).toBe(true);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.budget).toHaveBeenCalledTimes(2);
  });

  it("names the language on the usage line", async () => {
    await POST(request("it"));
    const usage = vi
      .mocked(console.info)
      .mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>)
      .find((line) => line.event === "llm_usage");
    expect(usage?.language).toBe("it");
  });
});
