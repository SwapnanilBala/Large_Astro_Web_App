/**
 * "From the classics" on the life-areas page: which placement keys a chart
 * has, which passages each area gets, what the model is sent, and how one
 * answer is cut back into a reading per area. The route and the network are
 * not involved; everything here decides what a reader is shown.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { YOGA_DEFINITIONS } from "../engines/yoga-engine";
import {
  AREA_CLASSICS_SYSTEM_PROMPT,
  AREA_KEYS,
  AREA_TOPICS,
  areaClassicsInstruction,
  areaDocuments,
  areaReadingsFrom,
  describePlacement,
  selectAreaPassages,
  selectAreas,
  type AreaChart,
  type AreaSelection,
} from "../knowledge/area-classics-reading";
import { chartPlacementKeys, heldPlacements, placementsHold } from "../knowledge/placements";
import { CLASSICAL_NOTE_RULES, NOTE_PREFIX, type PassageRow } from "../knowledge/yoga-classics-reading";

const row = (
  ref: string,
  fields: Partial<Pick<PassageRow, "lifeAreas" | "placements" | "placementsAny" | "yogaIds" | "planets" | "kind">>,
): PassageRow => {
  const [chapter, verse, part] = ref.split(".").map(Number);
  return {
    id: `bj:${ref}`,
    chapter,
    verse,
    part,
    kind: fields.kind ?? "verse",
    text: `text of ${ref}`,
    yogaIds: fields.yogaIds ?? [],
    planets: fields.planets ?? [],
    lifeAreas: fields.lifeAreas ?? [],
    placements: fields.placements ?? [],
    placementsAny: fields.placementsAny ?? [],
  };
};

/* Aries rising. `house` is deliberately wrong for the Sun, the way a quadrant
   house system can put a planet near a cusp in the next house: the keys must
   count whole signs and ignore it. */
const PLANETS = [
  { name: "Sun", sign: "Leo", house: 6 },
  { name: "Moon", sign: "Libra", house: 7 },
  { name: "Mars", sign: "Capricorn", house: 10 },
  { name: "Mercury", sign: "Virgo", house: 6 },
  { name: "Jupiter", sign: "Cancer", house: 4 },
  { name: "Venus", sign: "Libra", house: 7 },
  { name: "Saturn", sign: "Aquarius", house: 11 },
  { name: "Rahu", sign: "Gemini", house: 3 },
  { name: "Ketu", sign: "Sagittarius", house: 9 },
];

const KEYS = chartPlacementKeys({
  planets: PLANETS,
  ascendantSign: "Aries",
  navamsa: [
    { name: "Moon", navamsa_sign: "Leo" },
    { name: "Ascendant", navamsa_sign: "Aries" },
  ],
});

const CHART: AreaChart = {
  keys: KEYS,
  yogas: [{ id: "kalatra_chandra_shukra", planets: ["Moon", "Venus"] }],
};

describe("a chart's placement keys", () => {
  it("count houses in whole signs from the rising sign, not by the house a planet is reported in", () => {
    expect(KEYS.has("Sun.house.5")).toBe(true);
    expect(KEYS.has("Sun.house.6")).toBe(false);
    expect(KEYS.has("Moon.house.7")).toBe(true);
    expect(KEYS.has("ascendant.sign.Aries")).toBe(true);
  });

  it("name signs, dignities and navamsas, for the nine planets only", () => {
    expect(KEYS.has("Mars.sign.Capricorn")).toBe(true);
    expect(KEYS.has("Mars.dignity.exalted")).toBe(true);
    expect(KEYS.has("Mercury.dignity.own")).toBe(true);
    expect(KEYS.has("Mercury.dignity.exalted")).toBe(true);
    expect(KEYS.has("Venus.dignity.own")).toBe(true);
    expect(KEYS.has("Moon.navamsa.Leo")).toBe(true);
    expect([...KEYS].some((key) => key.startsWith("Ascendant."))).toBe(false);
  });

  it("name the reader's sex only when they gave it", () => {
    expect([...KEYS].some((key) => key.startsWith("reader."))).toBe(false);
    const hers = chartPlacementKeys({ planets: PLANETS, ascendantSign: "Aries", sex: "female" });
    expect(hers.has("reader.sex.female")).toBe(true);
    expect(hers.has("reader.sex.male")).toBe(false);
  });

  it("give full aspects by Varahamihira's rule: the 7th for all, Mars, Jupiter and Saturn their extra signs", () => {
    expect(KEYS.has("Saturn.aspects.Sun")).toBe(true); // Leo is 7th from Aquarius
    expect(KEYS.has("Jupiter.aspects.Mars")).toBe(true); // Capricorn is 7th from Cancer
    expect(KEYS.has("Jupiter.aspects.Moon")).toBe(false); // Libra is 4th from Cancer
    expect(KEYS.has("Mars.aspects.Jupiter")).toBe(true); // Cancer is 7th from Capricorn
    expect(KEYS.has("Mars.aspects.Sun")).toBe(true); // Leo is 8th, a Mars aspect
    expect(KEYS.has("Mars.aspects.Moon")).toBe(false); // Libra is 10th, which is Saturn's, not Mars's
    expect(KEYS.has("Venus.aspects.Moon")).toBe(false); // the same sign is company, not an aspect
  });
});

describe("whether a passage's conditions hold", () => {
  const keys = new Set(["Mars.sign.Libra", "Moon.house.7"]);

  it("never matches a passage with no conditions", () => {
    expect(placementsHold({ placements: [], placementsAny: [] }, keys)).toBe(false);
  });

  it("needs every plain condition", () => {
    expect(placementsHold({ placements: ["Moon.house.7"], placementsAny: [] }, keys)).toBe(true);
    expect(placementsHold({ placements: ["Moon.house.7", "Sun.house.1"], placementsAny: [] }, keys)).toBe(false);
  });

  it("needs one of the alternatives, alongside the plain conditions", () => {
    const either = ["Mars.sign.Taurus", "Mars.sign.Libra"];
    expect(placementsHold({ placements: [], placementsAny: either }, keys)).toBe(true);
    expect(placementsHold({ placements: ["Moon.house.7"], placementsAny: either }, keys)).toBe(true);
    expect(placementsHold({ placements: ["Sun.house.1"], placementsAny: either }, keys)).toBe(false);
    expect(placementsHold({ placements: [], placementsAny: ["Mars.sign.Taurus", "Mars.sign.Aries"] }, keys)).toBe(false);
  });

  it("reports the conditions that held, and only the alternative the chart has", () => {
    expect(
      heldPlacements({ placements: ["Moon.house.7"], placementsAny: ["Mars.sign.Taurus", "Mars.sign.Libra"] }, keys),
    ).toEqual(["Moon.house.7", "Mars.sign.Libra"]);
  });
});

describe("which passages an area gets", () => {
  const ROWS: PassageRow[] = [
    row("17.7.1", { lifeAreas: ["relationships"], placements: ["Moon.sign.Libra"] }),
    row("20.8.2", { lifeAreas: ["relationships"], placements: ["Venus.house.7"] }),
    row("18.20.3", { lifeAreas: ["relationships"], placements: ["ascendant.sign.Aries"] }),
    row("20.3.1", { lifeAreas: ["relationships"], placements: ["Sun.house.7"] }),
    row("17.7.2", { lifeAreas: ["character"], placements: ["Moon.sign.Libra"] }),
    row("23.1.7", { lifeAreas: ["relationships"], yogaIds: ["kalatra_chandra_shukra"], planets: ["Moon", "Venus"] }),
    row("23.1.4", { lifeAreas: ["relationships"], yogaIds: ["kalatra_chandra_shani"], planets: ["Moon", "Saturn"] }),
    row("18.5.4", { lifeAreas: ["career"], placementsAny: ["Mars.sign.Taurus", "Mars.sign.Capricorn"] }),
    row("20.6.9", { lifeAreas: ["career"], placements: ["Mars.house.10"], kind: "note" }),
  ];

  it("keeps passages whose conditions hold or whose yoga the chart has, about the area's own topics", () => {
    const ids = selectAreaPassages(ROWS, "love_life", CHART, 10).map((passage) => passage.id);
    expect(ids).toContain("bj:20.8.2");
    expect(ids).toContain("bj:23.1.7");
    expect(ids).not.toContain("bj:20.3.1"); // the Sun is in the 5th here
    expect(ids).not.toContain("bj:17.7.2"); // character, not relationships
    expect(ids).not.toContain("bj:23.1.4"); // a yoga this chart does not have
  });

  it("ranks the area's own houses and planets first, then returns them in the book's order", () => {
    // Venus in the 7th: house and planet. The Moon in Libra: planet. The Kalatra
    // yoga: one the area counts once kalatra_ is on its list. Aries rising: neither.
    expect(selectAreaPassages(ROWS, "love_life", CHART, 2).map((passage) => passage.id)).toEqual([
      "bj:17.7.1",
      "bj:20.8.2",
    ]);
    expect(selectAreaPassages(ROWS, "love_life", CHART, 10).map((passage) => passage.id)).toEqual([
      "bj:17.7.1",
      "bj:18.20.3",
      "bj:20.8.2",
      "bj:23.1.7",
    ]);
  });

  it("reaches a yoga's verse only for an area that counts the yoga", () => {
    const kemadruma = row("13.6.2", { lifeAreas: ["wealth", "status"], yogaIds: ["kemadruma"], planets: ["Moon"] });
    const chart: AreaChart = { keys: KEYS, yogas: [...CHART.yogas, { id: "kemadruma", planets: ["Moon"] }] };
    expect(selectAreaPassages([kemadruma], "inheritance", chart)).toEqual([]);
    expect(selectAreaPassages([kemadruma], "influence", chart)).toEqual([]);
    expect(selectAreas([kemadruma], chart)).toEqual([]);
  });

  it("reaches a passage through one alternative of its either/or", () => {
    expect(selectAreaPassages(ROWS, "career", CHART, 10).map((passage) => passage.id)).toEqual([
      "bj:18.5.4",
      "bj:20.6.9",
    ]);
  });

  it("sends only the areas the book has something for, in the fixed order, with what each was chosen for", () => {
    const selection = selectAreas(ROWS, CHART);
    // The Moon in Libra's character passage reaches life_cycle; nothing reaches family or travel.
    expect(selection.map(({ area }) => area)).toEqual(["love_life", "career", "life_cycle"]);
    const career = selection[1];
    expect(career.conditions).toEqual(["Mars.sign.Capricorn", "Mars.house.10"]);
    expect(selection[0].yogaNames).toEqual([
      YOGA_DEFINITIONS.find((definition) => definition.id === "kalatra_chandra_shukra")?.name,
    ]);
  });

  it("maps every area to topics the corpus uses", () => {
    expect(Object.keys(AREA_TOPICS)).toEqual(AREA_KEYS);
    expect(AREA_KEYS).toHaveLength(7);
  });
});

describe("what the model is sent", () => {
  const selection: AreaSelection[] = [
    {
      area: "love_life",
      passages: [row("20.8.2", { lifeAreas: ["relationships"], placements: ["Venus.house.7"] })],
      conditions: ["Venus.house.7"],
      yogaNames: [],
    },
    {
      area: "career",
      passages: [
        row("18.5.4", { lifeAreas: ["career"], placementsAny: ["Mars.sign.Taurus", "Mars.sign.Capricorn"] }),
        row("20.6.9", { lifeAreas: ["career"], placements: ["Mars.house.10"], kind: "note" }),
      ],
      conditions: ["Mars.sign.Capricorn", "Mars.house.10"],
      yogaNames: ["Ruchaka Yoga"],
    },
  ];

  it("is one citable document per area, marked, with its conditions in words", () => {
    const documents = areaDocuments(selection);
    expect(documents).toHaveLength(2);
    expect(documents[0].title).toMatch(/^\[love_life\] /);
    expect(documents[0].context).toContain("Venus in the 7th house");
    expect(documents[1].context).toContain("Mars in Capricorn; Mars in the 10th house");
    expect(documents[1].context).not.toContain("Taurus");
    expect(documents[1].context).toContain("Ruchaka Yoga");
    expect(documents[1].citations).toEqual({ enabled: true });
    const blocks = (documents[1].source as Anthropic.ContentBlockSource).content as Anthropic.TextBlockParam[];
    expect(blocks.map((block) => block.text)).toEqual(["text of 18.5.4", `${NOTE_PREFIX}text of 20.6.9`]);
  });

  it("names the areas in order, under their markers, in the reader's language", () => {
    expect(areaClassicsInstruction(selection, "Hindi")).toBe(
      "Write the notes in Hindi, one paragraph for each of these 2 areas, in this order, each opening with its marker: " +
        "[love_life] love and marriage; [career] work and career.",
    );
  });

  it("carries the shared rules, and never the word AI", () => {
    expect(AREA_CLASSICS_SYSTEM_PROMPT).toContain(CLASSICAL_NOTE_RULES);
    expect(CLASSICAL_NOTE_RULES).toMatch(/reader of any gender/);
    expect(AREA_CLASSICS_SYSTEM_PROMPT).not.toMatch(/\bAI\b/);
  });

  it("describes every kind of key", () => {
    expect(describePlacement("Sun.house.1")).toBe("the Sun in the 1st house");
    expect(describePlacement("Jupiter.house.2")).toBe("Jupiter in the 2nd house");
    expect(describePlacement("Moon.sign.Taurus")).toBe("the Moon in Taurus");
    expect(describePlacement("Moon.navamsa.Leo")).toBe("the Moon in the navamsa of Leo");
    expect(describePlacement("Mars.dignity.exalted")).toBe("Mars exalted");
    expect(describePlacement("Venus.dignity.own")).toBe("Venus in its own sign");
    expect(describePlacement("Jupiter.aspects.Moon")).toBe("Jupiter aspecting the Moon");
    expect(describePlacement("ascendant.sign.Leo")).toBe("Leo rising");
    expect(describePlacement("reader.sex.female")).toBe("the reader is a woman");
  });
});

describe("cutting the answer back into one reading per area", () => {
  const selection: AreaSelection[] = [
    {
      area: "love_life",
      passages: [
        row("17.7.1", { lifeAreas: ["relationships"], placements: ["Moon.sign.Libra"] }),
        row("20.8.2", { lifeAreas: ["relationships"], placements: ["Venus.house.7"] }),
      ],
      conditions: [],
      yogaNames: [],
    },
    {
      area: "career",
      passages: [row("20.6.9", { lifeAreas: ["career"], placements: ["Mars.house.10"], kind: "note" })],
      conditions: [],
      yogaNames: [],
    },
    {
      area: "family",
      passages: [row("17.10.1", { lifeAreas: ["family"], placements: ["Moon.sign.Capricorn"] })],
      conditions: [],
      yogaNames: [],
    },
    {
      area: "influence",
      passages: [row("19.1.1", { lifeAreas: ["status"], placements: ["Moon.sign.Aries"] })],
      conditions: [],
      yogaNames: [],
    },
  ];

  const cite = (document: number, start: number, end = start + 1) => ({
    type: "content_block_location" as const,
    cited_text: "",
    document_index: document,
    document_title: null,
    start_block_index: start,
    end_block_index: end,
  });
  const text = (value: string, citations: ReturnType<typeof cite>[] = []) => ({
    type: "text" as const,
    text: value,
    citations: citations.length > 0 ? citations : null,
  });

  const CONTENT = [
    text("Here are your notes.\n\n"),
    text("[love_life] With Venus in your 7th house, "),
    text("the Brihat Jataka holds that you will be drawn to romance", [cite(0, 1)]),
    text(", and with the Moon in Libra, devoted to a partner.", [cite(0, 0)]),
    text("\n\n[career] With Mars in the 10th, "),
    text("the translator's notes add that you will lead.", [cite(1, 0)]),
    text("\n\n[family] Words about family that cite nothing."),
    text("\n\n[travel_destinations] An area that was never sent.", [cite(1, 0)]),
    text("\n\n"),
    text("[influence] You will be respected.", [cite(3, 0)]),
  ] as unknown as Anthropic.ContentBlock[];

  const readings = areaReadingsFrom(CONTENT, selection);

  it("gives each marked area its own words and drops what no sent area owns", () => {
    expect(Object.keys(readings).sort()).toEqual(["career", "influence", "love_life"]);
    const love = readings.love_life!.segments.map((segment) => segment.text).join("");
    expect(love).toContain("With Venus in your 7th house");
    expect(love).not.toContain("Here are your notes");
    expect(love).not.toContain("[");
    expect(readings.career!.segments.map((segment) => segment.text).join("")).not.toContain("family");
  });

  it("numbers each area's sources from one, in the order its note cites them", () => {
    expect(readings.love_life!.sources.map((source) => [source.number, source.ref])).toEqual([
      [1, "20.8"],
      [2, "17.7"],
    ]);
    expect(readings.career!.sources).toEqual([{ number: 1, ref: "20.6", kind: "note", text: "text of 20.6.9" }]);
  });

  it("keeps a citation on a block that opens with its marker", () => {
    expect(readings.influence!.sources.map((source) => source.ref)).toEqual(["19.1"]);
    expect(readings.influence!.segments.at(-1)).toEqual({ text: " You will be respected.", sources: [1] });
  });

  it("leaves out an area whose paragraph cites nothing", () => {
    expect(readings.family).toBeUndefined();
  });
});
