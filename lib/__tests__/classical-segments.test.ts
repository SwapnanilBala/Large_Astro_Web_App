/**
 * The seams a citation mark leaves in a classical note.
 *
 * Every "From the classics" reader turns the model's marks into segments:
 * the dasha reading, the life shifts and Ask the classics read numbered marks
 * out of the text (readingFromMarkers); the yoga section and the life areas
 * get the citations API's cited blocks (readingFrom, areaReadingsFrom). When
 * a mark could not be resolved its numbers were dropped but the space the
 * model wrote before it stayed, so readers saw "a strained partnership ." and
 * "may be unequal , and". These tests start from real answers -- the routes'
 * output saved as the Android app's test fixtures, copied here so this repo
 * does not read the other one -- and check that no reader leaves a space
 * before punctuation or a doubled space, resolved or not.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { areaReadingsFrom, type AreaSelection } from "../knowledge/area-classics-reading";
import { withoutHeadings } from "../knowledge/ask-classics-reading";
import { readingParagraphs, tidySegments, type ClassicalReading, type ClassicalSegment } from "../knowledge/classical-reading";
import { endsMidSentence, readingFromMarkers } from "../knowledge/dasha-reading";
import { readingFrom, type PassageRow } from "../knowledge/yoga-classics-reading";

/* ── Real answers (Lagna Atelier Android App, app/src/test/resources) ────── */

/** periods/dasha-reading-mercury-mercury-rahu.json */
const DASHA: ClassicalSegment[] = [
  {
    text: "This period concentrates on your 5th house of children, learning, creativity and romance. Rahu, the period's own planet, newly brings this area forward, since no other level touches it. It tends to show up as study or exam work, a creative project, a new attraction, or a willingness to take a financial gamble. Rahu shares Capricorn with Saturn, and The Brihat Jataka holds that Saturn there gives standing as head of a town, village or army",
    sources: [1],
  },
  {
    text: ", so public responsibility may come alongside the personal matters.\n\nRahu sits in a trine to Mercury, so the two work together, and your Mercury sub-period is the fullest of the planets involved, which makes the support feel smooth. The Brihat Jataka ties Mercury in Taurus to a preacher's bent, generous giving, steady work to earn money, and respect for teachers, with many close partnerships",
    sources: [2],
  },
  { text: ". Virgo rising, the book says, brings sweet speech and a bright appearance, though with a mixed temperament", sources: [3] },
  { text: ". It also warns of a tight-fisted streak alongside wealth", sources: [4] },
  { text: ".", sources: [] },
];

/** periods/life-shifts-ananya-mehra.ndjson, the nodal return */
const LIFE_SHIFT: ClassicalSegment[] = [
  {
    text: "Creative projects, romance and any risk you take with money come back into play, while the pull of friendships, networks and easy gains is set to loosen, with daily workload and routines carrying the strain between them. Because Rahu sits in a trine from Mercury, whose period will be running then, the reaching-out should work with the main current rather than against it. The Brihat Jataka ties Saturn in Capricorn, whose results Rahu gives here, to taking charge of a group or a locality, as head of a town or a team",
    sources: [1],
  },
  { text: ".", sources: [] },
];

/** lifeareas/ask-typed.json, the first four segments */
const ASK: ClassicalSegment[] = [
  { text: "Your Sun in Gemini, the Brihat Jataka holds, makes a person ", sources: [] },
  { text: "learned in grammar, will be an Astrologer and will be rich.", sources: [1] },
  { text: " With Mercury in Taurus, the book says you ", sources: [] },
  {
    text: "will be a preacher, will have many sons and [partners], will ever be engaged in earning money, will be liberal in gift and will respect his preceptor.",
    sources: [2],
  },
];

/** reading/yoga-classics-ananya-mehra.json, the first eight segments */
const YOGA: ClassicalSegment[] = [
  { text: "The Brihat Jataka holds that a Damini yoga makes a person ", sources: [] },
  { text: "liberal in gift, will delight in helping others and will possess many cows.", sources: [1] },
  { text: "\n\nVarahamihira ties Vasumati to wealth. ", sources: [] },
  {
    text: "If all the benefic planets occupy the Upachaya places from the ascendant at the time of birth, a person will be very rich",
    sources: [2],
  },
  { text: ", while ", sources: [] },
  { text: "if one of them occupy such places he will possess small wealth", sources: [2] },
  { text: ". The book adds that ", sources: [] },
  { text: "even if the person be born in other malefic Yogas the present yoga will take effect to their exclusion", sources: [2] },
];

/** lifeareas/area-classics.json, love_life */
const AREA: ClassicalSegment[] = [
  { text: " The Brihat Jataka says that with the Moon in Aquarius you will be ", sources: [] },
  { text: "attached to the partners of other men", sources: [1] },
  { text: ". With Venus in Aries, it warns of entanglements that cost property and reputation, since such a person ", sources: [] },
  { text: "will lose his property through their influence and will bring disgrace on his family", sources: [2] },
  { text: ". With Mercury in Taurus, it describes a person who ", sources: [] },
  { text: "will have many sons and partners", sources: [3] },
  { text: ".\n\n", sources: [] },
];

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const passage = (index: number): PassageRow => ({
  id: `bj:18.${index}.1`,
  source: "brihat-jataka-1885",
  chapter: 18,
  verse: index,
  part: 1,
  kind: "verse",
  text: `text of 18.${index}`,
  yogaIds: [],
  planets: [],
  lifeAreas: ["relationships"],
  placements: [],
  placementsAny: [],
});
const GROUPS = [{ passages: [1, 2, 3, 4].map(passage) }];

/** What the card prints: each piece, its numbers as ^n, paragraphs on blank lines. */
const shown = (reading: Pick<ClassicalReading, "segments">) =>
  readingParagraphs({ segments: reading.segments, sources: [] })
    .map((pieces) => pieces.map((piece) => piece.text + (piece.sources.length > 0 ? `^${piece.sources.join(",")}` : "")).join(""))
    .join("\n\n");

/** The words alone, as a reader takes them in with the marks unseen. */
const words = (reading: Pick<ClassicalReading, "segments">) => shown(reading).replace(/\^[\d,]+/g, "");

function expectClean(text: string) {
  expect(text, "a space before punctuation").not.toMatch(/[ \t][.,।]/u);
  expect(text, "a space before a mark").not.toMatch(/\s\^/);
  expect(text, "a doubled space").not.toMatch(/ {2}/);
  expect(text, "a mark left in the text").not.toMatch(/\[\d/);
}

/** The model's text for a reading: each cited run followed by " [n]", as the routes' prompts ask. */
const marked = (segments: readonly ClassicalSegment[], number: (n: number) => number = (n) => n) =>
  segments.map((segment) => segment.text + segment.sources.map((n) => ` [${number(n)}]`).join("")).join("");

/* ── The seam, on its own ─────────────────────────────────────────────────── */

describe("tidySegments", () => {
  it("joins the seam a dropped mark leaves without a space before punctuation", () => {
    expect(tidySegments([{ text: "a strained partnership", sources: [] }, { text: " .", sources: [] }])).toEqual([
      { text: "a strained partnership.", sources: [] },
    ]);
    expect(tidySegments([{ text: "may be unequal ", sources: [] }, { text: ", and so on.", sources: [] }])).toEqual([
      { text: "may be unequal, and so on.", sources: [] },
    ]);
    expect(tidySegments([{ text: "रिश्ता तनावपूर्ण हो सकता है ", sources: [] }, { text: "।", sources: [] }])).toEqual([
      { text: "रिश्ता तनावपूर्ण हो सकता है।", sources: [] },
    ]);
  });

  it("leaves one space where both sides of the seam had one", () => {
    expect(tidySegments([{ text: "and to ", sources: [] }, { text: " nothing.", sources: [] }])).toEqual([
      { text: "and to nothing.", sources: [] },
    ]);
  });

  it("puts a mark right after its words, and moves the space after it", () => {
    expect(
      tidySegments([
        { text: "a strained partnership ", sources: [2] },
        { text: ", and more", sources: [] },
        { text: " follows ", sources: [1] },
        { text: "here.", sources: [] },
      ]),
    ).toEqual([
      { text: "a strained partnership", sources: [2] },
      { text: ", and more", sources: [] },
      { text: " follows", sources: [1] },
      { text: " here.", sources: [] },
    ]);
  });

  it("gives a mark with no words of its own to the words before it", () => {
    /* "partnership [1] [2]." and a whitespace-only cited block: one mark "1,2", not "12". */
    expect(tidySegments([{ text: "partnership", sources: [1] }, { text: "", sources: [2] }, { text: ".", sources: [] }])).toEqual([
      { text: "partnership", sources: [1, 2] },
      { text: ".", sources: [] },
    ]);
    expect(tidySegments([{ text: "partnership ", sources: [] }, { text: " ", sources: [3] }, { text: ".", sources: [] }])).toEqual([
      { text: "partnership", sources: [3] },
      { text: ".", sources: [] },
    ]);
  });

  it("keeps the space French puts before ; : ! ? and a no-break space", () => {
    const nbsp = String.fromCharCode(0xa0);
    const french = [
      { text: "un partenariat tendu", sources: [1] },
      { text: " ; puis un apaisement ?", sources: [] },
    ];
    expect(tidySegments(french)).toEqual(french);
    expect(tidySegments([{ text: `tendu${nbsp}`, sources: [] }, { text: "; puis", sources: [] }])).toEqual([
      { text: `tendu${nbsp}; puis`, sources: [] },
    ]);
  });

  it("keeps a mark before a paragraph break on its words, where the card used to lose it", () => {
    const reading = { segments: [{ text: "will live in comfort.\n\n", sources: [3] }, { text: "Next paragraph.", sources: [] }], sources: [] };
    expect(readingParagraphs(reading)).toEqual([[{ text: "will live in comfort.", sources: [3] }], [{ text: "Next paragraph.", sources: [] }]]);
  });

  it("passes the saved answers through as they were, and is idempotent", () => {
    for (const segments of [DASHA, LIFE_SHIFT, ASK, YOGA, AREA]) {
      expect(tidySegments(segments)).toEqual(segments);
      expect(tidySegments(tidySegments(segments))).toEqual(tidySegments(segments));
      expectClean(shown({ segments }));
    }
  });
});

/* ── Numbered marks: the dasha reading, the life shifts, Ask the classics ── */

describe("readingFromMarkers, on real answers", () => {
  it("reads the saved dasha reading back from its marked text exactly", () => {
    const { reading, strayMarks } = readingFromMarkers(marked(DASHA), GROUPS);
    expect(strayMarks).toBe(0);
    expect(reading.segments).toEqual(DASHA);
  });

  it("drops a mark for a passage it was not given without leaving its space", () => {
    const text = marked(DASHA, (n) => (n === 2 ? 42 : n));
    expect(text).toContain("close partnerships [42]. Virgo rising");
    const { reading, strayMarks } = readingFromMarkers(text, GROUPS);
    expect(strayMarks).toBe(1);
    expect(words(reading)).toContain("with many close partnerships. Virgo rising");
    expectClean(shown(reading));
  });

  it("leaves clean words when no mark resolves at all", () => {
    const { reading, strayMarks } = readingFromMarkers(marked(DASHA, (n) => n + 40), GROUPS);
    expect(strayMarks).toBe(4);
    expect(reading.sources).toEqual([]);
    expect(reading.segments).toHaveLength(1);
    expect(words(reading)).toContain("village or army, so public responsibility");
    expect(words(reading)).toMatch(/alongside wealth\.$/);
    expectClean(shown(reading));
  });

  it("does the same for a life shift's chapter, and still knows it ends a sentence", () => {
    const resolved = readingFromMarkers(marked(LIFE_SHIFT), GROUPS).reading;
    expect(resolved.segments).toEqual(LIFE_SHIFT);
    const stray = readingFromMarkers(marked(LIFE_SHIFT, () => 7), GROUPS).reading;
    expect(words(stray)).toMatch(/as head of a town or a team\.$/);
    expect(endsMidSentence(stray)).toBe(false);
    expectClean(shown(stray));
  });

  it("does the same for Ask the classics, headings and all", () => {
    const text = `# Your work\n\n${marked(ASK, (n) => (n === 1 ? 9 : n))}`;
    const reading = withoutHeadings(readingFromMarkers(text, GROUPS).reading);
    expect(words(reading)).toContain("will be rich. With Mercury in Taurus");
    expectClean(shown(reading));
  });

  it("joins the brief's two cases the way a reader expects", () => {
    const one = readingFromMarkers("Saturn here brings a strained partnership [9]. Later it eases [1].", GROUPS).reading;
    expect(words(one)).toBe("Saturn here brings a strained partnership. Later it eases.");
    const two = readingFromMarkers("Gains may be unequal [9] , and slow [1].", GROUPS).reading;
    expect(words(two)).toBe("Gains may be unequal, and slow.");
    expectClean(shown(one));
    expectClean(shown(two));
  });
});

/* ── The citations API: the yoga section and the life areas ──────────────── */

const cite = (document_index: number, block: number) => ({
  type: "content_block_location" as const,
  cited_text: "",
  document_index,
  document_title: null,
  start_block_index: block,
  end_block_index: block + 1,
});

/**
 * The model's content for a reading: one text block per segment, a cited one
 * pointing at the passage its number names (or at a document that was not
 * sent, for `lost`), and ending in the space models often leave before the
 * next block.
 */
const blocks = (segments: readonly ClassicalSegment[], lost: (n: number) => boolean = () => false) =>
  segments.map((segment) => ({
    type: "text" as const,
    text: segment.sources.length > 0 ? `${segment.text} ` : segment.text,
    citations: segment.sources.length > 0 ? segment.sources.map((n) => cite(lost(n) ? 9 : 0, n - 1)) : null,
  })) as unknown as Anthropic.ContentBlock[];

describe("readingFrom (the yoga section), on a real answer", () => {
  it("keeps every mark right after its words, though the cited block ends in a space", () => {
    const reading = readingFrom(blocks(YOGA), GROUPS);
    expect(reading.sources).toHaveLength(2);
    expect(shown(reading)).toContain("very rich^2, while if one");
    expectClean(shown(reading));
  });

  it("joins a citation that points at nothing without a space before the comma", () => {
    const reading = readingFrom(blocks(YOGA, (n) => n === 2), GROUPS);
    expect(reading.sources).toHaveLength(1);
    expect(words(reading)).toContain("a person will be very rich, while if one of them");
    expectClean(shown(reading));
  });
});

describe("areaReadingsFrom (the life areas), on a real answer", () => {
  const selection: AreaSelection[] = [{ area: "love_life", passages: [1, 2, 3].map(passage), conditions: [], yogaNames: [] }];
  const content = (lost: (n: number) => boolean) =>
    [
      { type: "text", text: "[love_life]", citations: null },
      ...(blocks(AREA, lost) as unknown as object[]),
    ] as unknown as Anthropic.ContentBlock[];

  it("prints the saved note as it was", () => {
    const reading = areaReadingsFrom(content(() => false), selection).love_life!;
    expect(reading.sources).toHaveLength(3);
    expect(shown(reading)).toContain("other men^1. With Venus");
    expectClean(shown(reading));
  });

  it("joins a lost citation without leaving its space", () => {
    const reading = areaReadingsFrom(content((n) => n === 3), selection).love_life!;
    expect(reading.sources).toHaveLength(2);
    expect(words(reading)).toMatch(/will have many sons and partners\.$/);
    expectClean(shown(reading));
  });
});
