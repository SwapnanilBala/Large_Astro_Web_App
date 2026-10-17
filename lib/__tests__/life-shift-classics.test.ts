import { describe, expect, it } from "vitest";
import type { ChartApiResponse } from "../astro-types";
import { pathAt } from "../dasha-periods";
import { STOCK_PHRASES } from "../dasha-period-words";
import type { MajorLifeShift } from "../engines/major-shifts-engine";
import { calculateDashaTimeline } from "../engines/nakshatra-engine";
import type { AreaChart } from "../knowledge/area-classics-reading";
import { readingFromMarkers } from "../knowledge/dasha-reading";
import {
  LIFE_SHIFTS_SYSTEM_PROMPT,
  SHIFT_PASSAGE_LIMITS,
  allGroups,
  chapterPassages,
  chapterQueryText,
  describeChapter,
  lifeShiftsInstruction,
  shiftBatches,
  shiftChapters,
  shiftPassageListing,
  shiftsCanonical,
} from "../knowledge/life-shift-classics";
import { CLASSICAL_NOTE_RULES, type PassageRow } from "../knowledge/yoga-classics-reading";
import { lifeShiftId } from "../life-shift-reading";

/*
 * The life shifts readings are written from each chapter's planet in the
 * chart and the classical passages that concern it. These pin what a chapter
 * carries, that two chapters never share a verse, and that the passages are
 * numbered in the order the marks are read back against.
 */

/* Born 2 November 1985; Libra rising, Saturn and Mercury in Scorpio, Venus in Virgo. */
const TIMELINE = calculateDashaTimeline(
  { name: "Rohini", index: 3, lord: "Moon", pada: 2, degree_in_nakshatra: 5 },
  "1985-11-02",
  Date.now(),
  Date.parse("1985-11-02T00:45:00Z"),
);
const PLANETS = [
  { name: "Sun", sign: "Libra", house: 1 },
  { name: "Moon", sign: "Gemini", house: 9 },
  { name: "Mercury", sign: "Scorpio", house: 2 },
  { name: "Venus", sign: "Virgo", house: 12 },
  { name: "Mars", sign: "Virgo", house: 12 },
  { name: "Jupiter", sign: "Capricorn", house: 4 },
  { name: "Saturn", sign: "Scorpio", house: 2 },
  { name: "Rahu", sign: "Aries", house: 7 },
  { name: "Ketu", sign: "Libra", house: 1 },
];
const PAYLOAD = {
  chart: { planets: PLANETS, ascendant: { sign: "Libra" }, dasha: { periods: TIMELINE.periods } },
} as unknown as ChartApiResponse;

const CHART: AreaChart = {
  keys: new Set(PLANETS.map((planet) => `${planet.name}.sign.${planet.sign}`)),
  yogas: [],
};

const base = (overrides: Partial<MajorLifeShift>): MajorLifeShift => ({
  index: 1,
  kind: "saturn-return",
  label: "Saturn return (first)",
  planet: "Saturn",
  pivotIso: "2015-04-18T00:00:00.000Z",
  windowStartIso: "2014-04-18T00:00:00.000Z",
  windowEndIso: "2016-04-18T00:00:00.000Z",
  status: "past",
  ageAtPivot: 29,
  theme: "structure",
  narrative: "the engine's own sentence",
  evidence: "",
  ...overrides,
});

/* The second Maha Dasha of the timeline, so there is one before it. */
const SECOND = TIMELINE.periods[1];
const MAHA = base({ kind: "mahadasha", label: `${SECOND.planet} mahadasha begins`, planet: SECOND.planet, pivotIso: new Date(SECOND.start_date).toISOString(), status: "past" });
const SATURN = base({});
const NODES = base({ kind: "nodal-return", label: "Nodal return (second)", planet: "Rahu / Ketu", pivotIso: "2023-01-23T00:00:00.000Z" });

const passage = (ref: string, placements: string[]): PassageRow & { similarity: number } => {
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
    placements,
    placementsAny: [],
    similarity: 0.4,
  };
};

describe("a chapter's facts", () => {
  it("give a Maha Dasha its length and the lord it takes over from", () => {
    const [chapter] = shiftChapters([MAHA], PAYLOAD);
    expect(chapter.id).toBe(lifeShiftId(MAHA));
    expect(chapter.years).toBe(SECOND.years);
    expect(chapter.previous?.lord).toBe(TIMELINE.periods[0].planet);
    const text = describeChapter(chapter);
    expect(text).toContain(`taking over from the Maha Dasha of`);
    expect(text).toContain("(the Maha Dasha lord before it)");
  });

  it("give a return the periods running at its pivot and its occurrence", () => {
    const [chapter] = shiftChapters([SATURN], PAYLOAD);
    const running = pathAt(PAYLOAD.chart.dasha!, Date.parse(SATURN.pivotIso), 2).map((span) => span.planet);
    expect(chapter.running).toEqual(running);
    expect(chapter.occurrence).toBe(1);
    const text = describeChapter(chapter);
    expect(text).toContain("Saturn's first return");
    expect(text).toContain("Saturn in the birth chart: in Scorpio, the 2nd house");
    expect(text).toContain(`Running at the pivot: the Maha Dasha of`);
  });

  it("read a nodal return from both nodes", () => {
    const [chapter] = shiftChapters([NODES], PAYLOAD);
    expect(chapter.facts.lords.map((lord) => lord.lord)).toEqual(["Rahu", "Ketu"]);
    expect(chapterQueryText(chapter)).toMatch(/^What the return of Rahu and Ketu brings for a chart with Rahu in Aries in the 7th house/);
  });

  it("name the houses the chapter brings forward and how they show up", () => {
    const text = describeChapter(shiftChapters([SATURN], PAYLOAD)[0]);
    /* Saturn in Scorpio from Libra: the 2nd, ruling the 4th and the 5th. */
    expect(text).toContain("Houses it brings forward (where its planet sits and what it rules): the 2nd, the 4th and the 5th.");
    expect(text).toContain("Everyday ways they tend to show up: the 2nd: the money you keep and spend");
  });

  it("leave out a chapter whose planet the chart does not place", () => {
    const payload = { chart: { ...PAYLOAD.chart, planets: PLANETS.filter((planet) => planet.name !== "Saturn") } } as unknown as ChartApiResponse;
    expect(shiftChapters([SATURN, NODES], payload).map((chapter) => chapter.id)).toEqual([lifeShiftId(NODES)]);
  });
});

describe("a chapter's passages", () => {
  const ROWS = [
    passage("18.19", ["Saturn.sign.Scorpio"]),
    passage("18.20", ["Saturn.sign.Scorpio"]),
    passage("18.21", ["Saturn.sign.Scorpio"]),
    passage("18.22", ["Saturn.sign.Scorpio"]),
    passage("18.5", ["Rahu.sign.Aries"]),
  ];

  it("are never offered to a second chapter, so two readings on one planet cite different verses", () => {
    const chapters = shiftChapters([SATURN, base({ kind: "saturn-return", label: "Saturn return (second)", pivotIso: "2044-09-01T00:00:00.000Z", status: "upcoming" })], PAYLOAD);
    const sets = chapterPassages(chapters, [ROWS, ROWS], CHART, "compact");
    const ids = sets.map((set) => set.groups.flatMap((group) => group.passages.map((row) => row.id)));
    expect(ids[0]).toHaveLength(SHIFT_PASSAGE_LIMITS.compact);
    expect(ids[1]).toEqual(["brihat-jataka-1885:18.22.1"]);
  });

  it("are numbered across the set in the order the marks are read back", () => {
    const chapters = shiftChapters([SATURN, NODES], PAYLOAD);
    const sets = chapterPassages(chapters, [ROWS, ROWS], CHART, "compact");
    const listing = shiftPassageListing(sets);
    expect(listing).toMatch(/^For chapter saturn-return-/);
    const numbered = [...listing.matchAll(/^\[(\d+)\] \(([\d.]+)\)/gm)].map(([, number, ref]) => `${number}:${ref}`);
    expect(numbered).toEqual(["1:18.19", "2:18.20", "3:18.21", "4:18.5"]);
    const { reading } = readingFromMarkers("Rahu's side [4].", allGroups(sets));
    expect(reading.sources[0].ref).toBe("18.5");
  });
});

describe("the prompt", () => {
  it("bans the stock phrases and carries the classical note rules", () => {
    for (const phrase of STOCK_PHRASES) expect(LIFE_SHIFTS_SYSTEM_PROMPT).toContain(`"${phrase}"`);
    expect(LIFE_SHIFTS_SYSTEM_PROMPT).toContain(CLASSICAL_NOTE_RULES);
    expect(LIFE_SHIFTS_SYSTEM_PROMPT).toContain("like [2] or [1,3]");
  });

  it("asks for the reader's language last, and for a chapter without passages, no marks", () => {
    const sets = chapterPassages(shiftChapters([SATURN], PAYLOAD), [[]], CHART, "headline");
    const instruction = lifeShiftsInstruction(sets, "headline", "female", "bn");
    expect(instruction).toContain("write it from the chart alone, with no marks");
    expect(instruction).toContain('Write exactly 1 reading at LENGTH "headline" in Bengali');
    expect(instruction).toContain("The reader is a woman.");
    expect(instruction.endsWith("Write every sentence in Bengali, although the facts and the passages are in English.")).toBe(true);
  });

  it("is filed apart by length and by where a chapter sits", () => {
    const chapters = shiftChapters([SATURN], PAYLOAD);
    const later = shiftChapters([{ ...SATURN, status: "active" }], PAYLOAD);
    expect(shiftsCanonical(chapters, CHART, "headline")).not.toBe(shiftsCanonical(chapters, CHART, "compact"));
    expect(shiftsCanonical(chapters, CHART, "headline")).not.toBe(shiftsCanonical(later, CHART, "headline"));
  });
});

describe("the batches a set is written in", () => {
  const AHEAD = base({ kind: "saturn-return", label: "Saturn return (second)", pivotIso: "2044-09-01T00:00:00.000Z", status: "upcoming" });

  it("puts the chapters still ahead in a call of their own on the life chapters page", () => {
    const chapters = shiftChapters([SATURN, AHEAD, NODES], PAYLOAD);
    expect(shiftBatches(chapters, "compact")).toEqual([[lifeShiftId(AHEAD)], [lifeShiftId(SATURN), lifeShiftId(NODES)]]);
  });

  it("keeps one call when there is nothing to split, and for the results page's one chapter", () => {
    const past = shiftChapters([SATURN, NODES], PAYLOAD);
    expect(shiftBatches(past, "compact")).toEqual([past.map((chapter) => chapter.id)]);
    const ahead = shiftChapters([AHEAD], PAYLOAD);
    expect(shiftBatches(ahead, "headline")).toEqual([[lifeShiftId(AHEAD)]]);
  });
});
