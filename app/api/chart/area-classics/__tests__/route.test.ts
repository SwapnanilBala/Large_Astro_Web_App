// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AreaSelection } from "@/lib/knowledge/area-classics-reading";
import type { PassageRow } from "@/lib/knowledge/yoga-classics-reading";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  budget: vi.fn(),
  selectAreas: vi.fn(),
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
vi.mock("@/lib/knowledge/retrieve", () => ({ passagesForChart: async () => [] }));
vi.mock("@/lib/knowledge/placements", () => ({ chartPlacementKeys: () => new Set<string>() }));
vi.mock("@/lib/chart-params", () => ({
  readChartParams: (params: unknown) => params,
  hasAllChartParams: (params: Record<string, string>) => Boolean(params.birthDate),
  chartParamsToBirthInput: () => ({}),
  getChartPayload: () => ({ chart: { planets: [], ascendant: { sign: "Aries" }, navamsa: [], yogas: [] } }),
}));
/* The selection is decided by the chart; here it is two areas, one passage each. */
vi.mock("@/lib/knowledge/area-classics-reading", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/knowledge/area-classics-reading")>()),
  selectAreas: mocks.selectAreas,
}));

const passage = (id: string, lifeArea: string, placement: string): PassageRow => ({
  id,
  source: "brihat-jataka-1885",
  chapter: 20,
  verse: Number(id.split(".")[1]),
  part: 1,
  kind: "verse",
  text: `text of ${id}`,
  yogaIds: [],
  planets: [],
  lifeAreas: [lifeArea],
  placements: [placement],
  placementsAny: [],
});

const SELECTION: AreaSelection[] = [
  { area: "love_life", passages: [passage("bj:20.8.1", "relationships", "Venus.house.7")], conditions: ["Venus.house.7"], yogaNames: [] },
  { area: "career", passages: [passage("bj:20.6.1", "career", "Mars.house.10")], conditions: ["Mars.house.10"], yogaNames: [] },
];

const cited = (text: string, document_index: number) => ({
  type: "text",
  text,
  citations: [
    { type: "content_block_location", cited_text: "", document_index, document_title: null, start_block_index: 0, end_block_index: 1 },
  ],
});
const plain = (text: string) => ({ type: "text", text, citations: null });
const answer = (...content: unknown[]) => ({
  stop_reason: "end_turn",
  content,
  usage: { input_tokens: 2000, output_tokens: 300 },
});

const LOVE_HI = "शुक्र के सातवें भाव में होने से आप प्रेम में सुखी रहेंगे।";
const CAREER_HI = "मंगल के दसवें भाव में होने से आप नेतृत्व करेंगे।";
const CAREER_EN = "With Mars in your 10th house, the Brihat Jataka holds that you will lead.";

function request(language: string) {
  return new NextRequest(`https://example.test/api/chart/area-classics?birthDate=1990-06-15&language=${language}`);
}

type Body = { readings: Record<string, { segments: { text: string }[] }>; cached: boolean };
const read = async (response: Response) => (await response.json()) as Body;
const words = (body: Body, area: string) => body.readings[area]?.segments.map((segment) => segment.text).join("");

let GET: typeof import("../route").GET;
let clock = 0;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  clock = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  mocks.budget.mockResolvedValue({ allowed: true, remaining: 100, callerRemaining: 3 });
  mocks.selectAreas.mockReturnValue(SELECTION);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  GET = (await import("../route")).GET;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the life areas' notes", () => {
  it("are written on Haiku 4.5 alone when every area passes", async () => {
    mocks.create.mockResolvedValueOnce(
      answer(plain("[love_life] "), cited(LOVE_HI, 0), plain("\n\n[career] "), cited(CAREER_HI, 1)),
    );
    const body = await read(await GET(request("hi")));
    expect(Object.keys(body.readings).sort()).toEqual(["career", "love_life"]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0].model).toBe("claude-haiku-4-5");
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("output_config");
  });

  it("asks Opus 5.5 again for only the areas that failed, and keeps the ones that passed", async () => {
    mocks.create
      .mockResolvedValueOnce(answer(plain("[love_life] "), cited(LOVE_HI, 0), plain("\n\n[career] "), cited(CAREER_EN, 1)))
      .mockResolvedValueOnce(answer(plain("[career] "), cited(CAREER_HI, 0)));
    const body = await read(await GET(request("hi")));
    expect(words(body, "love_life")).toContain("प्रेम");
    expect(words(body, "career")).toContain("नेतृत्व");
    expect(words(body, "career")).not.toContain("Mars");

    const [retry, options] = mocks.create.mock.calls[1];
    expect(retry.model).toBe("claude-opus-5-5");
    expect(retry.output_config).toEqual({ effort: "low" });
    expect(options).toEqual({ timeout: 50_000 });
    // Only the failed area's document and marker are sent again.
    const content = retry.messages[0].content;
    expect(content.filter((block: { type: string }) => block.type === "document")).toHaveLength(1);
    expect(content.at(-1).text).toContain("[career]");
    expect(content.at(-1).text).not.toContain("[love_life]");
    expect(mocks.budget).toHaveBeenCalledTimes(1);
  });

  it("retries an area that came back uncited, and a whole answer that was declined", async () => {
    mocks.create
      .mockResolvedValueOnce(answer(plain("[love_life] "), cited(LOVE_HI, 0), plain(`\n\n[career] ${CAREER_HI}`)))
      .mockResolvedValueOnce(answer(plain("[career] "), cited(CAREER_HI, 0)));
    expect(Object.keys((await read(await GET(request("hi")))).readings).sort()).toEqual(["career", "love_life"]);

    vi.resetModules();
    GET = (await import("../route")).GET;
    mocks.create.mockReset();
    mocks.create
      .mockResolvedValueOnce({ ...answer(), stop_reason: "refusal" })
      .mockResolvedValueOnce(answer(plain("[love_life] "), cited(LOVE_HI, 0), plain("\n\n[career] "), cited(CAREER_HI, 1)));
    expect(Object.keys((await read(await GET(request("hi")))).readings).sort()).toEqual(["career", "love_life"]);
    expect(mocks.create.mock.calls[1][0].messages[0].content.at(-1).text).toContain("[love_life]");
  });

  it("keeps the areas that passed when the retry itself fails", async () => {
    mocks.create
      .mockResolvedValueOnce(answer(plain("[love_life] "), cited(LOVE_HI, 0), plain("\n\n[career] "), cited(CAREER_EN, 1)))
      .mockRejectedValueOnce(new Error("Request timed out."));
    const response = await GET(request("hi"));
    expect(response.status).toBe(200);
    expect(Object.keys((await read(response)).readings)).toEqual(["love_life"]);
  });

  it("fails when no area passes, even after the retry", async () => {
    mocks.create.mockResolvedValue(answer(plain("[love_life] "), cited(CAREER_EN, 0), plain("\n\n[career] "), cited(CAREER_EN, 1)));
    expect((await GET(request("bn"))).status).toBe(502);
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });

  it("skips the retry when too little time is left", async () => {
    mocks.create.mockImplementationOnce(async () => {
      clock += 41_000;
      return answer(plain("[love_life] "), cited(LOVE_HI, 0), plain("\n\n[career] "), cited(CAREER_EN, 1));
    });
    const body = await read(await GET(request("hi")));
    expect(Object.keys(body.readings)).toEqual(["love_life"]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("ships an English area that names an illness, and logs it", async () => {
    mocks.create.mockResolvedValueOnce(
      answer(plain("[love_life] "), cited("You will be free from disease and fond of romance.", 0), plain("\n\n[career] "), cited(CAREER_EN, 1)),
    );
    const body = await read(await GET(request("en")));
    expect(Object.keys(body.readings).sort()).toEqual(["career", "love_life"]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const logged = vi.mocked(console.warn).mock.calls.map(([line]) => JSON.parse(String(line)));
    expect(logged).toContainEqual(
      expect.objectContaining({
        event: "llm_note_check",
        flagged: [{ area: "love_life", problems: [{ kind: "content", terms: ["disease"] }], blocks: false }],
      }),
    );
  });
});
