// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PassageRow } from "@/lib/knowledge/yoga-classics-reading";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  budget: vi.fn(),
  passages: vi.fn(),
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
vi.mock("@/lib/knowledge/retrieve", () => ({ passagesTaggedWith: mocks.passages }));

const ROWS: PassageRow[] = [
  {
    id: "bj:13.5.1",
    source: "brihat-jataka-1885",
    chapter: 13,
    verse: 5,
    part: 1,
    kind: "verse",
    text: "A person born in a Sunapha yoga will be possessed of self-acquired wealth.",
    yogaIds: ["sunapha"],
    planets: [],
    lifeAreas: ["wealth"],
    placements: [],
    placementsAny: [],
  },
];

const cited = (text: string) => ({
  type: "text",
  text,
  citations: [
    { type: "content_block_location", cited_text: "", document_index: 0, document_title: null, start_block_index: 0, end_block_index: 1 },
  ],
});
const answer = (...content: unknown[]) => ({
  stop_reason: "end_turn",
  content,
  usage: { input_tokens: 1000, output_tokens: 200 },
});

const ENGLISH = answer(cited("The Brihat Jataka holds that Sunapha Yoga brings you wealth you earn yourself."));
const HINDI = answer(cited("Brihat Jataka के अनुसार, Sunapha Yoga आपको स्वयं अर्जित धन देता है।"));
/* Haiku's decline, measured: in Hindi, and citing nothing. */
const DECLINE = answer({ type: "text", text: "मैं हिंदी में citations के साथ लिखने में असमर्थ हूँ।", citations: null });

function request(language: string) {
  return new NextRequest("https://example.test/api/chart/yoga-classics", {
    method: "POST",
    body: JSON.stringify({ yogas: [{ id: "sunapha", planets: ["Jupiter"], strength: "strong" }], language }),
  });
}

const text = (response: Response) => response.json() as Promise<{ reading: { segments: { text: string }[] } | null; cached: boolean }>;
const words = (body: Awaited<ReturnType<typeof text>>) => body.reading?.segments.map((segment) => segment.text).join("");

let POST: typeof import("../route").POST;
let clock = 0;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  clock = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  mocks.budget.mockResolvedValue({ allowed: true, remaining: 100, callerRemaining: 3 });
  mocks.passages.mockResolvedValue(ROWS);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  POST = (await import("../route")).POST;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the yoga note", () => {
  it("is written on Haiku 5.5 alone, at low effort, when Haiku's note passes", async () => {
    mocks.create.mockResolvedValueOnce(HINDI);
    const response = await POST(request("hi"));
    expect(response.status).toBe(200);
    expect(words(await text(response))).toContain("स्वयं अर्जित धन");
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const [body] = mocks.create.mock.calls[0];
    expect(body.model).toBe("claude-haiku-5-5");
    // The shared chart setting (lib/llm-models.ts).
    expect(body.output_config).toEqual({ effort: "low" });
  });

  it.each([
    ["an English note for a Hindi reader", "hi", ENGLISH],
    ["a decline that cites nothing", "hi", DECLINE],
    ["a Bengali note that names an illness", "bn", answer(cited("Sunapha Yoga আপনাকে রোগের হাত থেকে রক্ষা করে।"))],
    ["a refusal", "hi", { ...HINDI, stop_reason: "refusal" }],
    ["a truncated note", "hi", { ...HINDI, stop_reason: "max_tokens" }],
  ])("retries %s once on Opus 5.5 at low effort, in the same budget unit", async (_, language, first) => {
    mocks.create.mockResolvedValueOnce(first).mockResolvedValueOnce(
      language === "bn" ? answer(cited("Brihat Jataka অনুসারে, Sunapha Yoga আপনাকে নিজের উপার্জিত সম্পদ দেয়।")) : HINDI,
    );
    const response = await POST(request(language));
    expect(response.status).toBe(200);
    expect(words(await text(response))).not.toContain("রোগ");
    expect(mocks.create).toHaveBeenCalledTimes(2);
    const [retry, options] = mocks.create.mock.calls[1];
    expect(retry.model).toBe("claude-opus-5-5");
    expect(retry.output_config).toEqual({ effort: "low" });
    // The same request otherwise: the documents and the instruction.
    expect(retry.messages).toEqual(mocks.create.mock.calls[0][0].messages);
    expect(options).toEqual({ timeout: 45_000, maxRetries: 0 });
    expect(mocks.budget).toHaveBeenCalledTimes(1);
  });

  it("caches the retry's note, not Haiku's", async () => {
    mocks.create.mockResolvedValueOnce(ENGLISH).mockResolvedValueOnce(HINDI);
    await POST(request("hi"));
    const again = await text(await POST(request("hi")));
    expect(again.cached).toBe(true);
    expect(words(again)).toContain("स्वयं अर्जित धन");
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });

  it("ships nothing, and caches nothing, when the retry fails too", async () => {
    mocks.create.mockResolvedValue(ENGLISH);
    expect((await POST(request("hi"))).status).toBe(502);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect((await POST(request("hi"))).status).toBe(502);
    expect(mocks.create).toHaveBeenCalledTimes(4);
  });

  it("gives the retry only the time left, and skips it when that is too little", async () => {
    mocks.create.mockImplementation(async () => {
      clock += 20_000;
      return ENGLISH;
    });
    await POST(request("hi"));
    expect(mocks.create.mock.calls[1][1]).toEqual({ timeout: 35_000, maxRetries: 0 });

    mocks.create.mockClear();
    mocks.create.mockImplementationOnce(async () => {
      clock += 41_000;
      return ENGLISH;
    });
    expect((await POST(request("hi"))).status).toBe(502);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("ships a German note that names an illness, and logs it", async () => {
    mocks.create.mockResolvedValueOnce(answer(cited("Der Sunapha Yoga befreit dich von Krankheit.")));
    const response = await POST(request("de"));
    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const logged = vi.mocked(console.warn).mock.calls.map(([line]) => JSON.parse(String(line)));
    expect(logged).toContainEqual(
      expect.objectContaining({ event: "llm_note_check", language: "de", blocks: false }),
    );
  });

  it("reads a language that is only a property of every object as English", async () => {
    mocks.create.mockResolvedValueOnce(ENGLISH);
    expect((await POST(request("constructor"))).status).toBe(200);
    const instruction = mocks.create.mock.calls[0][0].messages[0].content.at(-1).text;
    expect(instruction).toContain("Write the note in English");
  });
});
