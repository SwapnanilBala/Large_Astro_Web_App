/**
 * "From the classics": which verses a chart's yogas get, how the model's
 * citations become the numbered sources under the reading, and how the
 * reading is cut into paragraphs. The route and the network are not involved;
 * everything here is the part that decides what a reader is shown.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { YogaDetectionResult } from "../astro-types";
import {
  YOGA_CLASSICS_MAX_REQUEST,
  readingParagraphs,
  yogaClassicsRequest,
  type YogaClassicsYoga,
} from "../knowledge/yoga-classics";
import {
  NOTE_PREFIX,
  readingFrom,
  selectYogaPassages,
  yogaDocuments,
  type PassageRow,
} from "../knowledge/yoga-classics-reading";

const row = (
  ref: string,
  yogaIds: string[],
  planets: string[],
  lifeAreas: string[],
  kind: "verse" | "note" = "verse",
): PassageRow => {
  const [chapter, verse, part] = ref.split(".").map(Number);
  return {
    id: `bj:${ref}`,
    chapter,
    verse,
    part,
    kind,
    text: `text of ${ref}`,
    yogaIds,
    planets,
    lifeAreas,
    placements: [],
    placementsAny: [],
  };
};

/* Shaped like the corpus: Sunapha's definition names the Sun (as the planet
   that does not count), its results are general, then planet by planet. */
const ROWS: PassageRow[] = [
  row("13.3.1", ["sunapha", "anapha", "durudhara"], ["Sun", "Moon"], []),
  row("13.4.4", ["sunapha", "anapha"], ["Moon"], [], "note"),
  row("13.5.1", ["sunapha"], [], ["wealth", "status"]),
  row("13.7.2", ["sunapha", "anapha", "durudhara"], ["Mercury"], ["learning"]),
  row("13.7.3", ["sunapha", "anapha", "durudhara"], ["Jupiter"], ["wealth"]),
  row("13.8.1", ["sunapha", "anapha", "durudhara"], ["Saturn"], ["career"]),
  row("13.2.1", ["adhi"], ["Moon", "Mercury", "Jupiter", "Venus"], ["status"]),
  row("12.10.7", ["gola"], [], []),
  row("12.19.2", ["gola"], [], ["wealth"]),
];

const yoga = (id: string, planets: string[]): YogaClassicsYoga => ({ id, planets, strength: "moderate" });
const ids = (passages: PassageRow[]) => passages.map((passage) => passage.id.replace("bj:", ""));

describe("which verses a chart's yogas get", () => {
  it("gives Sunapha formed by Jupiter Jupiter's verse, not Mercury's or Saturn's", () => {
    const [chosen] = selectYogaPassages(ROWS, [yoga("sunapha", ["Moon", "Jupiter"])], { yogas: 5, perYoga: 10 });
    expect(ids(chosen.passages)).toContain("13.7.3");
    expect(ids(chosen.passages)).not.toContain("13.7.2");
    expect(ids(chosen.passages)).not.toContain("13.8.1");
  });

  it("keeps a verse that lists several planets as alternatives", () => {
    // Adhi's verse names all three benefics; this chart has two of them.
    const [chosen] = selectYogaPassages(ROWS, [yoga("adhi", ["Moon", "Jupiter", "Venus"])]);
    expect(ids(chosen.passages)).toEqual(["13.2.1"]);
  });

  it("does not filter a yoga that reports no planets", () => {
    const [chosen] = selectYogaPassages(ROWS, [yoga("sunapha", [])], { yogas: 5, perYoga: 10 });
    expect(chosen.passages).toHaveLength(6);
  });

  it("prefers results to bare definitions and notes, then prints them in the book's order", () => {
    const [chosen] = selectYogaPassages(ROWS, [yoga("sunapha", ["Moon", "Jupiter"])], { yogas: 5, perYoga: 3 });
    // 13.5.1 and 13.7.3 give results; 13.3.1 is the verse's definition and
    // beats 13.4.4, a counting note. Printed 13 .3, .5, .7.
    expect(ids(chosen.passages)).toEqual(["13.3.1", "13.5.1", "13.7.3"]);
  });

  it("skips yogas the book does not name, keeps rank order, and covers at most five", () => {
    const chart = [
      yoga("mridanga", ["Venus"]),
      yoga("gola", ["Sun", "Moon"]),
      yoga("lagna_benefic_flank", ["Venus"]),
      yoga("sunapha", ["Moon", "Jupiter"]),
      yoga("adhi", ["Moon", "Jupiter"]),
    ];
    expect(selectYogaPassages(ROWS, chart).map(({ yoga }) => yoga.id)).toEqual(["gola", "sunapha", "adhi"]);
    expect(selectYogaPassages(ROWS, chart, { yogas: 2, perYoga: 4 }).map(({ yoga }) => yoga.id)).toEqual([
      "gola",
      "sunapha",
    ]);
  });

  it("does not repeat a verse under a second yoga", () => {
    const chosen = selectYogaPassages(ROWS, [yoga("sunapha", ["Moon", "Jupiter"]), yoga("anapha", ["Moon", "Jupiter"])], {
      yogas: 5,
      perYoga: 10,
    });
    const all = chosen.flatMap(({ passages }) => ids(passages));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("the documents the model reads", () => {
  const selection = selectYogaPassages(ROWS, [yoga("sunapha", ["Moon", "Jupiter"])], { yogas: 5, perYoga: 10 });
  const [document] = yogaDocuments(selection);

  it("are citable, one content block per verse", () => {
    expect(document.citations).toEqual({ enabled: true });
    const source = document.source as Anthropic.ContentBlockSource;
    expect(source.content).toHaveLength(selection[0].passages.length);
  });

  it("mark the translator's notes, and only them", () => {
    const blocks = (document.source as Anthropic.ContentBlockSource).content as Anthropic.TextBlockParam[];
    selection[0].passages.forEach((passage, index) => {
      expect(blocks[index].text.startsWith(NOTE_PREFIX), passage.id).toBe(passage.kind === "note");
    });
  });

  it("say how the yoga is formed here, from the checked fields only", () => {
    expect(document.title).toContain("Sunapha Yoga");
    expect(document.context).toContain("moderate strength");
    expect(document.context).toContain("Moon, Jupiter");
  });
});

describe("the model's citations, as numbered sources", () => {
  const selection = selectYogaPassages(
    ROWS,
    [yoga("gola", []), yoga("sunapha", ["Moon", "Jupiter"])],
    { yogas: 5, perYoga: 10 },
  );
  const cite = (document_index: number, start_block_index: number, end_block_index: number) => ({
    type: "content_block_location",
    cited_text: "",
    document_index,
    document_title: null,
    start_block_index,
    end_block_index,
  });
  const content = [
    { type: "thinking", thinking: "", signature: "" },
    { type: "text", text: "Gola is defined thus.", citations: [cite(0, 0, 1)] },
    { type: "text", text: " Sunapha brings **wealth**", citations: [cite(1, 1, 3)] },
    { type: "text", text: ", as Gola's verse also says.", citations: [cite(0, 0, 1), cite(7, 0, 1)] },
    { type: "text", text: " Closing words.", citations: null },
  ] as unknown as Anthropic.ContentBlock[];
  const reading = readingFrom(content, selection);

  it("number the verses in the order the reading first cites them", () => {
    expect(reading.sources.map((source) => [source.number, source.ref])).toEqual([
      [1, "12.10"],
      [2, "13.4"],
      [3, "13.5"],
    ]);
  });

  it("put each segment's numbers on it, reuse numbers, and drop citations to nothing", () => {
    expect(reading.segments.map((segment) => segment.sources)).toEqual([[1], [2, 3], [1], []]);
  });

  it("strip markdown the prompt asked not to get", () => {
    expect(reading.segments[1].text).toBe(" Sunapha brings wealth");
  });

  it("carry each verse's own words and kind, not the model's", () => {
    expect(reading.sources[1]).toMatchObject({ kind: "note", text: "text of 13.4.4" });
  });
});

describe("the reading as paragraphs", () => {
  it("cuts at blank lines and keeps each mark after the words it supports", () => {
    const paragraphs = readingParagraphs({
      segments: [
        { text: "First paragraph", sources: [1] },
        { text: " continues.\n\nSecond paragraph", sources: [2] },
        { text: " ends.\n", sources: [] },
      ],
      sources: [],
    });
    expect(paragraphs).toEqual([
      [
        { text: "First paragraph", sources: [1] },
        { text: " continues.", sources: [] },
      ],
      [
        { text: "Second paragraph", sources: [2] },
        { text: " ends.", sources: [] },
      ],
    ]);
  });
});

describe("what the browser sends", () => {
  const detected = (yoga_id: string, occurrence_chance: number, strength: YogaDetectionResult["strength"]) =>
    ({ yoga_id, occurrence_chance, strength, involved_planets: ["Moon"] }) as YogaDetectionResult;

  it("is the panel's ranking: chance first, then strength", () => {
    const request = yogaClassicsRequest([
      detected("weak_common", 30, "weak"),
      detected("strong_rare", 2, "strong"),
      detected("strong_common", 30, "strong"),
    ]);
    expect(request.map((entry) => entry.id)).toEqual(["strong_common", "weak_common", "strong_rare"]);
    expect(request[0]).toEqual({ id: "strong_common", planets: ["Moon"], strength: "strong" });
  });

  it("is capped", () => {
    const many = Array.from({ length: YOGA_CLASSICS_MAX_REQUEST + 5 }, (_, index) => detected(`y${index}`, 1, "weak"));
    expect(yogaClassicsRequest(many)).toHaveLength(YOGA_CLASSICS_MAX_REQUEST);
  });
});
