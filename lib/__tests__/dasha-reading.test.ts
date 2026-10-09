/**
 * The reading for one Vimshottari period: which passages a period's planets
 * get, the documents and facts the model is sent, and the instruction. The
 * route and the network are not involved.
 */
import { describe, expect, it } from "vitest";
import type { DashaSpan } from "../dasha-periods";
import { periodFacts, type FactChart } from "../dasha-reading-facts";
import type { AreaChart } from "../knowledge/area-classics-reading";
import { bannedTerms } from "../knowledge/classical-note-check";
import {
  DASHA_READING_SYSTEM_PROMPT,
  HOUSE_MEANINGS,
  PERIOD_PARTS_PER_VERSE,
  PERIOD_PASSAGE_LIMIT,
  PERIOD_PER_LORD_LIMIT,
  concernFor,
  dashaReadingInstruction,
  describeLord,
  describePeriod,
  durationOf,
  periodCanonical,
  periodDocumentGroups,
  periodDocuments,
  periodQueryText,
  selectPeriodPassages,
  usableForPeriod,
  voicesOf,
  type PeriodCandidate,
} from "../knowledge/dasha-reading";
import { chartPlacementKeys } from "../knowledge/placements";
import { CLASSICAL_NOTE_RULES, CLOSING_REMINDERS, NOTE_PREFIX } from "../knowledge/yoga-classics-reading";

/* Libra rising: Saturn and Mercury together in Scorpio (2nd), Rahu in Aries (7th) acting through Mars in Virgo (12th). */
const FACT_CHART: FactChart = {
  ascendantSign: "Libra",
  planets: [
    { name: "Sun", sign: "Libra" },
    { name: "Moon", sign: "Gemini" },
    { name: "Mercury", sign: "Scorpio" },
    { name: "Venus", sign: "Virgo" },
    { name: "Mars", sign: "Virgo" },
    { name: "Jupiter", sign: "Capricorn" },
    { name: "Saturn", sign: "Scorpio" },
    { name: "Rahu", sign: "Aries" },
    { name: "Ketu", sign: "Libra" },
  ],
};

const CHART: AreaChart = {
  keys: chartPlacementKeys({ planets: FACT_CHART.planets, ascendantSign: "Libra", sex: "female" }),
  yogas: [
    { id: "shani_budha_yoga", planets: ["Saturn", "Mercury"] },
    { id: "bhrigu_mangal", planets: ["Venus", "Mars"] },
    /* No life area counts Kemadruma, so its verse stays in the yoga section. */
    { id: "kemadruma", planets: ["Moon"] },
  ],
};

const row = (
  ref: string,
  fields: Partial<Omit<PeriodCandidate, "id" | "chapter" | "verse" | "part">> = {},
): PeriodCandidate => {
  const [chapter, verse, part] = ref.split(".").map(Number);
  return {
    id: `${fields.source ?? "brihat-jataka-1885"}:${ref}`,
    source: fields.source ?? "brihat-jataka-1885",
    chapter,
    verse,
    part,
    kind: fields.kind ?? "verse",
    text: fields.text ?? `text of ${ref}`,
    yogaIds: fields.yogaIds ?? [],
    planets: fields.planets ?? [],
    lifeAreas: fields.lifeAreas ?? ["career"],
    placements: fields.placements ?? [],
    placementsAny: fields.placementsAny ?? [],
    ...(fields.similarity === undefined ? {} : { similarity: fields.similarity }),
  };
};

const span = (level: 1 | 2 | 3 | 4, planet: string, lords: string[], start: string, end: string): DashaSpan => ({
  level,
  planet,
  lords,
  start,
  end,
  sequenceStart: start,
  sequenceEnd: end,
});

const PATH: DashaSpan[] = [
  span(1, "Saturn", ["Saturn"], "2022-01-19", "2041-01-19"),
  span(2, "Mercury", ["Saturn", "Mercury"], "2025-01-19", "2027-09-30"),
  span(3, "Rahu", ["Saturn", "Mercury", "Rahu"], "2026-07-12", "2026-12-21"),
  span(4, "Mercury", ["Saturn", "Mercury", "Rahu", "Mercury"], "2026-09-25", "2026-10-16"),
];
const FACTS = periodFacts(FACT_CHART, PATH.map((step) => step.planet))!;
const saturn = FACTS.lords[0];
const mercury = FACTS.lords[1];
const rahu = FACTS.lords[2];

describe("which passages may be read into a period", () => {
  it("are the chart's own, from the two books, with a result that is not lifespan or health", () => {
    expect(usableForPeriod(row("18.17.3", { placements: ["Saturn.sign.Scorpio"] }), CHART)).toBe(true);
    expect(usableForPeriod(row("18.17.3", { placements: ["Saturn.sign.Aries"] }), CHART)).toBe(false);
    expect(usableForPeriod(row("18.17.3", { placements: ["Saturn.sign.Scorpio"], lifeAreas: [] }), CHART)).toBe(false);
    expect(usableForPeriod(row("18.17.3", { placements: ["Saturn.sign.Scorpio"], lifeAreas: ["health", "wealth"] }), CHART)).toBe(false);
    expect(usableForPeriod(row("18.17.3", { placements: ["Saturn.sign.Scorpio"], lifeAreas: ["longevity"] }), CHART)).toBe(false);
    expect(usableForPeriod(row("68.1.1", { source: "brihat-samhita-1884", placements: ["Saturn.sign.Scorpio"] }), CHART)).toBe(false);
    expect(usableForPeriod(row("9.1.1", { source: "strijataka-1931", placements: ["reader.sex.female", "Mars.house.12"] }), CHART)).toBe(true);
  });

  it("include a yoga's verse only for a yoga some life area counts", () => {
    expect(usableForPeriod(row("14.4.3", { yogaIds: ["shani_budha_yoga"] }), CHART)).toBe(true);
    expect(usableForPeriod(row("13.9.1", { yogaIds: ["kemadruma"] }), CHART)).toBe(false);
  });
});

describe("how a passage concerns a period's planet", () => {
  it("by a condition on the planet, a yoga it forms, a house it rules or an aspect it receives", () => {
    expect(concernFor(row("18.17.3", { placements: ["Saturn.sign.Scorpio"] }), CHART, saturn, "Libra")).toBe("placement");
    expect(concernFor(row("14.4.3", { yogaIds: ["shani_budha_yoga"] }), CHART, mercury, "Libra")).toBe("yoga");
    /* Saturn rules the 4th and 5th for Libra rising; the 4th's lord, Saturn, is in the 2nd. */
    expect(concernFor(row("9.4.1", { placements: ["lord4.house.2"] }), CHART, saturn, "Libra")).toBe("lordship");
    /* The Sun in Libra aspects Aries, where Rahu is. */
    expect(concernFor(row("19.1.1", { placements: ["Sun.aspects.Rahu"] }), CHART, rahu, "Libra")).toBe("aspect");
  });

  it("for Rahu, through the lord of its sign", () => {
    expect(voicesOf(rahu)).toEqual(["Rahu", "Mars"]);
    expect(concernFor(row("18.6.1", { placements: ["Mars.sign.Virgo"] }), CHART, rahu, "Libra")).toBe("placement");
    expect(concernFor(row("14.4.16", { yogaIds: ["bhrigu_mangal"] }), CHART, rahu, "Libra")).toBe("yoga");
  });

  it("not by merely naming the planet", () => {
    expect(concernFor(row("19.5.4", { placements: ["Moon.sign.Gemini"], planets: ["Moon", "Saturn"] }), CHART, saturn, "Libra")).toBeNull();
  });
});

describe("choosing a period's passages", () => {
  it("lets every planet draw in turn, Maha Dasha first, nearest by concern and then by meaning", () => {
    const rows = [
      row("18.17.3", { placements: ["Saturn.sign.Scorpio"], similarity: 0.4 }),
      row("18.17.4", { placements: ["Saturn.sign.Scorpio"], similarity: 0.5 }),
      row("20.6.6", { placements: ["Mercury.house.2"], similarity: 0.3 }),
      row("18.6.1", { placements: ["Mars.sign.Virgo"], similarity: 0.2 }),
      row("14.4.3", { yogaIds: ["shani_budha_yoga"], similarity: 0.9 }),
    ];
    const chosen = selectPeriodPassages(rows, CHART, FACTS);
    expect(chosen.map(({ lord, passage }) => `${lord}:${passage.id.split(":")[1]}`)).toEqual([
      "Saturn:18.17.4",
      "Mercury:20.6.6",
      "Rahu:18.6.1",
      /* The yoga Saturn and Mercury share goes to Saturn, which draws first; a placement outranks it. */
      "Saturn:14.4.3",
      "Saturn:18.17.3",
    ]);
  });

  it("takes a second part of a verse only when nothing else is left, and never a third", () => {
    const rows = [1, 2, 3, 4].map((part) => row(`18.8.${part}`, { placements: ["Mercury.sign.Scorpio"], similarity: 0.5 + part / 100 }));
    rows.push(row("20.6.6", { placements: ["Mercury.house.2"], similarity: 0.1 }));
    const chosen = selectPeriodPassages(rows, CHART, periodFacts(FACT_CHART, ["Mercury"])!);
    expect(chosen.map(({ passage }) => passage.id.split(":")[1])).toEqual(["18.8.4", "20.6.6", "18.8.3"]);
    expect(PERIOD_PARTS_PER_VERSE).toBe(2);
  });

  it("caps each planet and the whole", () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      row(`20.${index + 1}.1`, { placements: [index % 2 ? "Mercury.house.2" : "Saturn.house.2"] }),
    );
    const chosen = selectPeriodPassages(many, CHART, periodFacts(FACT_CHART, ["Saturn", "Mercury"])!);
    expect(chosen).toHaveLength(PERIOD_PASSAGE_LIMIT);
    expect(chosen.filter(({ lord }) => lord === "Saturn")).toHaveLength(PERIOD_PER_LORD_LIMIT);
  });

  it("is empty when nothing concerns the period's planets", () => {
    expect(selectPeriodPassages([row("18.1.1", { placements: ["Moon.sign.Gemini"] })], CHART, periodFacts(FACT_CHART, ["Saturn"])!)).toEqual([]);
  });
});

describe("what the model is sent", () => {
  const chosen = selectPeriodPassages(
    [
      row("18.17.3", { placements: ["Saturn.sign.Scorpio"], text: "[A person born with Saturn in sign Scorpio] will have a mean wife." }),
      row("18.17.9", { kind: "note", placements: ["Saturn.sign.Scorpio"], text: "Other authorities differ." }),
      row("9.2.1", { source: "strijataka-1931", placements: ["reader.sex.female", "Saturn.house.2"], text: "Sani in 2 — wealthy." }),
      row("18.6.1", { placements: ["Mars.sign.Virgo"], text: "A person born with Mars in sign Gemini or Virgo will be bright." }),
    ],
    CHART,
    FACTS,
  );
  const groups = periodDocumentGroups(chosen, CHART, FACTS);

  it("groups the passages by planet, then by book", () => {
    expect(groups.map(({ lord, source }) => `${lord}/${source}`)).toEqual([
      "Saturn/brihat-jataka-1885",
      "Saturn/strijataka-1931",
      "Rahu/brihat-jataka-1885",
    ]);
    expect(groups[0].conditions).toEqual(["Saturn.sign.Scorpio"]);
  });

  it("as citable documents that name the planet and its levels, in the app's wording", () => {
    const documents = periodDocuments(groups, FACTS);
    expect(documents[0].title).toBe("The Brihat Jataka of Varaha Mihira: on Saturn");
    expect(documents[0].context).toContain("Chosen for Saturn, the Maha Dasha lord of this period");
    expect(documents[0].context).toContain("Saturn in Scorpio");
    expect(documents[2].context).toContain("whose results it gives through Mars");
    const blocks = (documents[0].source as { content: { text: string }[] }).content.map((block) => block.text);
    expect(blocks[0]).toContain("[partner]");
    expect(blocks[0]).not.toMatch(/\bwife\b/);
    expect(blocks[1].startsWith(NOTE_PREFIX)).toBe(true);
    expect(documents.every((document) => document.citations?.enabled)).toBe(true);
  });

  it("with the period, its planets' places and relations, and only the houses they name", () => {
    const text = describePeriod(PATH, FACTS, "now");
    expect(text).toContain("The period: the Sookshma Dasha of Mercury, 25 September 2026 to 16 October 2026 (21 days), running now.");
    expect(text).toContain("It sits inside the Maha Dasha of Saturn (January 2022 to January 2041), the Antardasha of Mercury");
    expect(text).toContain("The chart rises in Libra");
    expect(text).toContain("Saturn (Maha Dasha lord): in Scorpio, the 2nd house; in the sign of a natural enemy; rules the 4th and the 5th houses; with Mercury.");
    expect(text).toContain("Mercury (Antardasha and Sookshma Dasha lord)");
    expect(text).toContain("owns no sign, so gives the results of Mars, the lord of Aries, which sits in Virgo, the 12th house");
    expect(text).toContain("Mercury (Antardasha) is in the same sign as Saturn (Maha Dasha); Saturn counts Mercury a natural friend.");
    expect(text).toContain("Rahu (Pratyantardasha) is 6th from Mercury (Antardasha), 6th and 8th from each other, so the two are at odds.");
    expect(text).toContain(`the 7th: ${HOUSE_MEANINGS[7]}`);
    expect(text).not.toContain("the 3rd:");
    expect(describeLord(FACTS.lords[0])).not.toContain("aspected");
  });

  it("measures a period in days, months or years", () => {
    expect(durationOf(PATH[3])).toBe("21 days");
    expect(durationOf(PATH[2])).toBe("5 months");
    expect(durationOf(PATH[0])).toBe("19 years");
  });

  it("searches with a description of the period's planets and the houses they name", () => {
    const query = periodQueryText(FACTS);
    expect(query).toMatch(/^What the period of Saturn, with the sub-periods of Mercury and Rahu, brings for a chart with Saturn in Scorpio in the 2nd house, ruling the 4th and the 5th houses/);
    expect(query).toContain("Rahu in Aries in the 7th house, acting through Mars in Virgo in the 12th house");
    expect(query).toContain("partnership and marriage");
  });

  it("closes with the language, the reader and the reminders, and asks for one paragraph for a Maha Dasha alone", () => {
    const english = dashaReadingInstruction(PATH, FACTS, "now", "female");
    expect(english).toContain("Write the reading for this period in English: two short paragraphs");
    expect(english).toContain("The reader is a woman.");
    expect(english).toContain(CLOSING_REMINDERS);
    expect(english).not.toContain("Write every sentence in");
    const hindi = dashaReadingInstruction(PATH.slice(0, 1), periodFacts(FACT_CHART, ["Saturn"])!, "past", undefined, "hi");
    expect(hindi).toContain("in Hindi: one paragraph");
    expect(hindi.endsWith("Write every sentence in Hindi, although the facts and the passages are in English.")).toBe(true);
    expect(dashaReadingInstruction(PATH, FACTS, "now", undefined, "xx")).toContain("in English");
  });

  it("files a reading under everything the model reads", () => {
    const base = periodCanonical(PATH, FACTS, "now", groups);
    expect(periodCanonical(PATH, FACTS, "past", groups)).not.toBe(base);
    expect(periodCanonical(PATH, FACTS, "now", groups.slice(1))).not.toBe(base);
    expect(periodCanonical(PATH, FACTS, "now", groups)).toBe(base);
  });
});

describe("the prompt", () => {
  it("carries the rules every classical note follows", () => {
    expect(DASHA_READING_SYSTEM_PROMPT).toContain(CLASSICAL_NOTE_RULES);
  });

  it("says what the houses stand for inside the content line", () => {
    for (const meaning of Object.values(HOUSE_MEANINGS)) {
      expect(bannedTerms(meaning, "en")).toEqual([]);
      expect(meaning).not.toMatch(/death|disease|illness|lifespan|longevity|enem/i);
    }
    expect(Object.keys(HOUSE_MEANINGS)).toHaveLength(12);
  });
});
