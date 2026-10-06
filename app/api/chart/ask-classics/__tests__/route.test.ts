// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ASK_QUESTIONS } from "@/lib/knowledge/ask-questions";
import type { PassageRow } from "@/lib/knowledge/yoga-classics-reading";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  budget: vi.fn(),
  embed: vi.fn(),
  near: vi.fn(),
  forChart: vi.fn(),
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
vi.mock("@/lib/knowledge/question-embedding", () => ({ embedQuestion: mocks.embed }));
vi.mock("@/lib/knowledge/retrieve", () => ({ passagesNearQuestion: mocks.near, passagesForChart: mocks.forChart }));

/* Aries rising: Mars in Capricorn is in the 10th, Saturn in Aquarius the 11th. */
const PAYLOAD = {
  chart: {
    planets: [
      { name: "Sun", sign: "Leo", house: 5 },
      { name: "Moon", sign: "Libra", house: 7 },
      { name: "Mars", sign: "Capricorn", house: 10 },
      { name: "Mercury", sign: "Virgo", house: 6 },
      { name: "Jupiter", sign: "Cancer", house: 4 },
      { name: "Venus", sign: "Libra", house: 7 },
      { name: "Saturn", sign: "Aquarius", house: 11 },
    ],
    ascendant: { sign: "Aries" },
    navamsa: [],
    nakshatra: { name: "Swati" },
    yogas: [],
    dasha: {
      current_dasha: "Saturn",
      current_antardasha: "Mercury",
      current_dasha_start: "2015-01-01",
      current_dasha_end: "2034-01-01",
      current_antardasha_start: "2026-01-01",
      current_antardasha_end: "2099-01-01",
      periods: [],
    },
  },
};

vi.mock("@/lib/chart-params", () => ({
  readChartParams: (params: unknown) => params,
  hasAllChartParams: (params: Record<string, string>) => Boolean(params.birthDate),
  chartParamsToBirthInput: () => ({}),
  getChartPayload: () => PAYLOAD,
}));

const passage = (ref: string, fields: Partial<PassageRow & { similarity: number }> = {}): PassageRow & { similarity: number } => {
  const [chapter, verse] = ref.split(".").map(Number);
  return {
    id: `brihat-jataka-1885:${ref}.1`,
    source: "brihat-jataka-1885",
    chapter,
    verse,
    part: 1,
    kind: "verse",
    text: `The verse ${ref}.`,
    yogaIds: [],
    planets: [],
    lifeAreas: ["career"],
    placements: ["Mars.house.10"],
    placementsAny: [],
    similarity: 0.4,
    ...fields,
  };
};

const cited = (text: string) => ({
  type: "text",
  text,
  citations: [
    {
      type: "content_block_location",
      document_index: 0,
      start_block_index: 0,
      end_block_index: 1,
      cited_text: "The verse",
      document_title: "Brihat Jataka",
    },
  ],
});

const answer = (...content: unknown[]) => ({
  stop_reason: "end_turn",
  content,
  usage: { input_tokens: 1200, output_tokens: 140 },
});

function request(query: string) {
  return new NextRequest(`https://example.test/api/chart/ask-classics?birthDate=1990-05-01&name=Reader${query}`);
}

let GET: typeof import("../route").GET;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  mocks.budget.mockResolvedValue({ allowed: true, remaining: 100, callerRemaining: 3 });
  mocks.embed.mockResolvedValue(new Array(1024).fill(0.01));
  mocks.near.mockResolvedValue([passage("18.10"), passage("10.4", { similarity: 0.3 })]);
  mocks.forChart.mockResolvedValue([passage("18.10"), passage("18.11", { lifeAreas: ["children"], placements: ["Jupiter.house.4"] })]);
  mocks.create.mockResolvedValue(answer(cited("With Mars in your 10th house, the Brihat Jataka holds that you rise in your work.")));
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  GET = (await import("../route")).GET;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("which questions the books can answer", () => {
  it("are found from the chart's passages, with nothing paid for", async () => {
    const response = await GET(request(""));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: ["career_year", "children"] });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.budget).not.toHaveBeenCalled();
    expect(mocks.embed).not.toHaveBeenCalled();
  });

  it("need complete birth details", async () => {
    const response = await GET(new NextRequest("https://example.test/api/chart/ask-classics?name=Reader"));
    expect(response.status).toBe(400);
  });
});

describe("a question", () => {
  it("is only one the route knows, never words from the browser", async () => {
    const response = await GET(request("&question=What%20is%20my%20fate%3F"));
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("is searched by its own words and the chart, then answered with citations", async () => {
    const response = await GET(request("&question=career_year"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.question).toBe("career_year");
    expect(body.cached).toBe(false);
    expect(body.reading.sources).toHaveLength(1);
    expect(body.reading.sources[0]).toMatchObject({ book: "brihat-jataka-1885", ref: "10.4" });

    expect(mocks.embed).toHaveBeenCalledWith(ASK_QUESTIONS.career_year.text);
    const search = mocks.near.mock.calls[0][0];
    expect(search.topics).toEqual(ASK_QUESTIONS.career_year.topics);
    expect(search.chartKeys).toContain("Mars.house.10");

    const sent = mocks.create.mock.calls[0][0];
    expect(sent.model).toBe("claude-haiku-4-5");
    const content = sent.messages[0].content;
    expect(content[0].type).toBe("document");
    const instruction = content[content.length - 1].text as string;
    expect(instruction).toContain(ASK_QUESTIONS.career_year.text);
    expect(instruction).toContain("Write the answer in English.");
    expect(instruction).toContain("Saturn–Mercury");
    expect(mocks.budget).toHaveBeenCalledTimes(1);
  });

  it("is answered from cache the second time, at no cost", async () => {
    await GET(request("&question=career_year"));
    const again = await (await GET(request("&question=career_year"))).json();
    expect(again.cached).toBe(true);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.budget).toHaveBeenCalledTimes(1);
  });

  it("is still answered from the chart's passages when the question cannot be embedded", async () => {
    mocks.embed.mockRejectedValue(new Error("no key"));
    const response = await GET(request("&question=career_year"));
    expect(response.status).toBe(200);
    expect(mocks.near).not.toHaveBeenCalled();
    expect(mocks.forChart).toHaveBeenCalledWith(expect.objectContaining({ topics: ["career", "status"] }));
    expect((await response.json()).reading.sources).toHaveLength(1);
  });

  it("with nothing in the books for this chart is an empty answer, and costs nothing", async () => {
    mocks.near.mockResolvedValue([passage("18.12", { placements: ["Mars.house.7"] })]);
    const body = await (await GET(request("&question=career_year"))).json();
    expect(body.reading).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.budget).not.toHaveBeenCalled();
  });

  it("is asked once more on Opus when the answer cites nothing, or says what the content line forbids", async () => {
    mocks.create
      .mockResolvedValueOnce(answer({ type: "text", text: "I cannot say.", citations: null }))
      .mockResolvedValueOnce(answer(cited("You will enjoy freedom from disease.")))
      .mockResolvedValueOnce(answer({ type: "text", text: "Nothing.", citations: null }))
      .mockResolvedValueOnce(answer(cited("With Mars in your 10th house, you rise in your work.")));

    const uncited = await GET(request("&question=career_year"));
    expect(uncited.status).toBe(502);
    expect(mocks.create.mock.calls[1][0].model).toBe("claude-opus-5-5");

    const recovered = await GET(request("&question=career_year"));
    expect(recovered.status).toBe(200);
    expect(mocks.budget).toHaveBeenCalledTimes(2);
  });

  it("is refused politely when today's allowance is spent", async () => {
    mocks.budget.mockResolvedValue({ allowed: false, scope: "anonymous", retryAfterSeconds: 3600 });
    const response = await GET(request("&question=career_year"));
    expect(response.status).toBe(429);
    expect((await response.json()).error.details.scope).toBe("anonymous");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
