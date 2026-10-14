// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pathAt } from "@/lib/dasha-periods";
import { calculateDashaTimeline } from "@/lib/engines/nakshatra-engine";
import type { PassageRow } from "@/lib/knowledge/yoga-classics-reading";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  budget: vi.fn(),
  embed: vi.fn(),
  forPeriod: vi.fn(),
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
vi.mock("@/lib/knowledge/retrieve", () => ({ passagesForPeriod: mocks.forPeriod }));

/* Born 1 January 1990 in Rohini; Libra rising, Saturn and Mercury in Scorpio, Rahu in Aries. */
const TIMELINE = calculateDashaTimeline(
  { name: "Rohini", index: 3, lord: "Moon", pada: 2, degree_in_nakshatra: 5 },
  "1990-01-01",
  Date.now(),
  Date.parse("1990-01-01T04:30:00Z"),
);
const PAYLOAD = {
  chart: {
    planets: [
      { name: "Sun", sign: "Libra", house: 1 },
      { name: "Moon", sign: "Gemini", house: 9 },
      { name: "Mercury", sign: "Scorpio", house: 2 },
      { name: "Venus", sign: "Virgo", house: 12 },
      { name: "Mars", sign: "Virgo", house: 12 },
      { name: "Jupiter", sign: "Capricorn", house: 4 },
      { name: "Saturn", sign: "Scorpio", house: 2 },
      { name: "Rahu", sign: "Aries", house: 7 },
      { name: "Ketu", sign: "Libra", house: 1 },
    ],
    ascendant: { sign: "Libra" },
    navamsa: [],
    nakshatra: { name: "Rohini" },
    yogas: [],
    dasha: { periods: TIMELINE.periods },
  },
};

vi.mock("@/lib/chart-params", () => ({
  readChartParams: (params: unknown) => params,
  hasAllChartParams: (params: Record<string, string>) => Boolean(params.birthDate),
  chartParamsToBirthInput: () => ({}),
  getChartPayload: () => PAYLOAD,
}));

const NOW_PATH = pathAt(PAYLOAD.chart.dasha, Date.now());
const LORDS = NOW_PATH.slice(0, 2).map((span) => span.planet);
const START = NOW_PATH[1].start;

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
    placements: [],
    placementsAny: [],
    similarity: 0.4,
    ...fields,
  };
};

/* A passage for every planet, so whichever two lords run today, each has one. */
const ROWS = PAYLOAD.chart.planets.map((planet, index) =>
  passage(`18.${index + 1}`, { placements: [`${planet.name}.sign.${planet.sign}`] }),
);

/* The model marks a classical result with its passage's number, which the route turns into a source. */
const marked = (text: string) => ({ type: "text", text });

const answer = (...content: unknown[]) => ({
  stop_reason: "end_turn",
  content,
  usage: { input_tokens: 1400, output_tokens: 900 },
});

function request(body: unknown, query = "birthDate=1990-01-01&name=Reader") {
  return new NextRequest(`https://example.test/api/chart/dasha-reading?${query}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

let POST: typeof import("../route").POST;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  mocks.budget.mockResolvedValue({ allowed: true, remaining: 100, callerRemaining: 3 });
  mocks.embed.mockResolvedValue(new Array(1024).fill(0.01));
  mocks.forPeriod.mockResolvedValue(ROWS);
  mocks.create.mockResolvedValue(answer(marked("With this planet in your chart, the Brihat Jataka ties the period to steady work [1].")));
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  ({ POST } = await import("../route"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("reading a period", () => {
  it("rebuilds the period from the chart, searches by its description, and writes it once", async () => {
    const response = await POST(request({ lords: LORDS, start: START, language: "en" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cached).toBe(false);
    expect(body.reading.sources).toHaveLength(1);
    expect(mocks.budget).toHaveBeenCalledTimes(1);
    expect(mocks.embed).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^What the period of ${LORDS[0]}`)));
    expect(mocks.forPeriod).toHaveBeenCalledWith(expect.objectContaining({ embedding: expect.any(Array) }));

    const sent = mocks.create.mock.calls[0][0];
    expect(sent.model).toBe("claude-haiku-5-5");
    expect(sent.output_config).toEqual({ effort: "low" });
    expect(sent.max_tokens).toBe(6000);
    const content = sent.messages[0].content;
    expect(content[0].text).toMatch(/^The passages:\nChosen for /);
    expect(content[0].text).toContain("[1] (18.");
    const instruction = content[content.length - 1].text as string;
    expect(instruction).toContain(`the Antardasha of ${LORDS[1]}`);
    expect(instruction).toContain("The chart rises in Libra");
    expect(instruction).toContain("in English");
  });

  it("answers the same period again from cache, paying nothing", async () => {
    await POST(request({ lords: LORDS, start: START }));
    const again = await POST(request({ lords: LORDS, start: START }));
    expect((await again.json()).cached).toBe(true);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.budget).toHaveBeenCalledTimes(1);
  });

  it("writes in the reader's language", async () => {
    await POST(request({ lords: LORDS, start: START, language: "de" }));
    const content = mocks.create.mock.calls[0][0].messages[0].content;
    expect(content[content.length - 1].text).toContain("Write every sentence in German");
  });

  it("still writes from the chart's passages when the period cannot be embedded", async () => {
    mocks.embed.mockRejectedValue(new Error("no key"));
    const response = await POST(request({ lords: LORDS, start: START }));
    expect(response.status).toBe(200);
    expect(mocks.forPeriod).toHaveBeenCalledWith(expect.not.objectContaining({ embedding: expect.anything() }));
  });

  it("is nothing, and costs nothing, when the books have nothing on the period's planets", async () => {
    mocks.forPeriod.mockResolvedValue([]);
    const response = await POST(request({ lords: LORDS, start: START }));
    expect(await response.json()).toEqual({ reading: null, cached: false });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.budget).not.toHaveBeenCalled();
  });

  it("asks once more on Opus when the first reading fails its check", async () => {
    mocks.create
      .mockResolvedValueOnce(answer(marked("Your wife will be devoted to you [1].")))
      .mockResolvedValueOnce(answer(marked("Your partner is devoted to you, the Brihat Jataka holds [1].")));
    const response = await POST(request({ lords: LORDS, start: START }));
    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[1][0].model).toBe("claude-opus-5-5");
    expect(mocks.budget).toHaveBeenCalledTimes(1);
  });

  it("does not ship a reading that cites nothing", async () => {
    mocks.create.mockResolvedValue(answer({ type: "text", text: "An uncited reading." }));
    const response = await POST(request({ lords: LORDS, start: START }));
    expect(response.status).toBe(502);
  });

  it("asks once more on Opus when the reading copies a verse word for word", async () => {
    const verse = "A person born so will be indifferent to work and will be merciless.";
    mocks.forPeriod.mockResolvedValue(ROWS.map((row) => ({ ...row, text: verse })));
    mocks.create
      .mockResolvedValueOnce(answer(marked(`The book says a person born so will be indifferent to work and will be merciless [1].`)))
      .mockResolvedValueOnce(answer(marked("The book ties this placement to a cool, detached attitude to work [1].")));
    const response = await POST(request({ lords: LORDS, start: START }));
    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[1][0].model).toBe("claude-opus-5-5");
    expect((await response.json()).reading.segments[0].text).toContain("cool, detached attitude");
  });

  it("asks once more when the reading stops mid-sentence", async () => {
    mocks.create
      .mockResolvedValueOnce(answer(marked("Money and talk at home come first [1]. The")))
      .mockResolvedValueOnce(answer(marked("Money and talk at home come first [1].")));
    const response = await POST(request({ lords: LORDS, start: START }));
    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });

  it("drops a mark for a passage it was not given", async () => {
    mocks.create.mockResolvedValue(answer(marked("Steady work comes first [1], and more [42].")));
    const response = await POST(request({ lords: LORDS, start: START }));
    const body = await response.json();
    expect(body.reading.sources).toHaveLength(1);
    expect(JSON.stringify(body.reading.segments)).not.toContain("42");
  });
});

describe("what it refuses", () => {
  it("a chain that is not one to four known lords", async () => {
    for (const lords of [[], ["Pluto"], ["Saturn", "Saturn", "Saturn", "Saturn", "Saturn"], "Saturn"]) {
      const response = await POST(request({ lords, start: START }));
      expect(response.status).toBe(400);
    }
  });

  it("a missing or malformed start", async () => {
    expect((await POST(request({ lords: LORDS }))).status).toBe(400);
    expect((await POST(request({ lords: LORDS, start: "8 October" }))).status).toBe(400);
  });

  it("a period the chart does not have", async () => {
    const other = LORDS[1] === "Venus" ? "Sun" : "Venus";
    const response = await POST(request({ lords: [LORDS[0], other], start: START }));
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("a request without birth details, or one that is not JSON", async () => {
    expect((await POST(request({ lords: LORDS, start: START }, "name=Reader"))).status).toBe(400);
    expect((await POST(request("{not json"))).status).toBe(400);
  });

  it("a reader whose allowance is spent, saying who could get more by signing in", async () => {
    mocks.budget.mockResolvedValue({ allowed: false, scope: "anonymous", retryAfterSeconds: 3600 });
    const response = await POST(request({ lords: LORDS, start: START }));
    expect(response.status).toBe(429);
    expect((await response.json()).error.details.scope).toBe("anonymous");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
