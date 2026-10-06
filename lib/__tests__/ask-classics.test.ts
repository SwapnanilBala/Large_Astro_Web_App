/**
 * "Ask the classics" on the life-areas page: the questions on offer, which
 * passages may answer one for a chart and in what order, the planetary
 * periods a year question is answered with, and what the model is sent. The
 * route and the network are not involved.
 */
import { describe, expect, it } from "vitest";
import enLifeAreas from "@/messages/en.life-areas.json";
import bj from "../knowledge/corpus/brihat-jataka-1885.json";
import strijataka from "../knowledge/corpus/strijataka-1931.json";
import type { DashaInfo } from "../astro-types";
import type { AreaChart } from "../knowledge/area-classics-reading";
import {
  ASK_CLASSICS_SYSTEM_PROMPT,
  ASK_PASSAGE_LIMIT,
  ASK_TOPIC_LIST,
  PERIOD_LORD_BOOST,
  answerableQuestions,
  answersQuestion,
  askClassicsInstruction,
  describePeriods,
  periodLords,
  periodSentence,
  questionDocumentGroups,
  questionDocuments,
  selectQuestionPassages,
  yearPeriods,
  type CandidatePassage,
} from "../knowledge/ask-classics-reading";
import { ASK_QUESTION_IDS, ASK_QUESTIONS, isAskQuestionId } from "../knowledge/ask-questions";
import { bannedTerms } from "../knowledge/classical-note-check";
import { KNOWLEDGE_LIFE_AREAS } from "../knowledge/corpus";
import { chartPlacementKeys } from "../knowledge/placements";
import { CLASSICAL_NOTE_RULES, NOTE_PREFIX, type PassageRow } from "../knowledge/yoga-classics-reading";

const row = (
  ref: string,
  fields: Partial<Omit<CandidatePassage, "id" | "chapter" | "verse" | "part" | "text">> = {},
): CandidatePassage => {
  const [chapter, verse, part] = ref.split(".").map(Number);
  return {
    id: `${fields.source ?? "brihat-jataka-1885"}:${ref}`,
    source: fields.source ?? "brihat-jataka-1885",
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
    ...(fields.similarity === undefined ? {} : { similarity: fields.similarity }),
  };
};

/* Aries rising, a woman's chart: the Strijataka's passages apply too. */
const CHART: AreaChart = {
  keys: chartPlacementKeys({
    planets: [
      { name: "Sun", sign: "Leo" },
      { name: "Moon", sign: "Libra" },
      { name: "Mars", sign: "Capricorn" },
      { name: "Mercury", sign: "Virgo" },
      { name: "Jupiter", sign: "Cancer" },
      { name: "Venus", sign: "Libra" },
      { name: "Saturn", sign: "Aquarius" },
      { name: "Rahu", sign: "Gemini" },
      { name: "Ketu", sign: "Sagittarius" },
    ],
    ascendantSign: "Aries",
    navamsa: [{ name: "Ascendant", navamsa_sign: "Aries" }],
    sex: "female",
  }),
  yogas: [{ id: "kalatra_chandra_shukra", planets: ["Moon", "Venus"] }],
};

const CAREER = ASK_QUESTIONS.career_year;

describe("the questions on offer", () => {
  it("are listed once each, and each has its settings", () => {
    expect(new Set(ASK_QUESTION_IDS).size).toBe(ASK_QUESTION_IDS.length);
    expect(Object.keys(ASK_QUESTIONS).sort()).toEqual([...ASK_QUESTION_IDS].sort());
  });

  it("read only topics the corpus has, and never lifespan", () => {
    for (const id of ASK_QUESTION_IDS) {
      for (const topic of ASK_QUESTIONS[id].topics) {
        expect(KNOWLEDGE_LIFE_AREAS, `${id}: ${topic}`).toContain(topic);
        expect(topic).not.toBe("longevity");
      }
    }
    expect(ASK_TOPIC_LIST).not.toContain("longevity");
  });

  it("each have an English label on the page, and the panel's strings never say AI", () => {
    const ask = (enLifeAreas as { lifeAreas: { ask: Record<string, unknown> } }).lifeAreas.ask;
    const labels = ask.questions as Record<string, string>;
    for (const id of ASK_QUESTION_IDS) expect(typeof labels[id], id).toBe("string");
    expect(JSON.stringify(ask)).not.toMatch(/\bAI\b/);
  });

  it("are asked as written, in words the content line allows", () => {
    for (const id of ASK_QUESTION_IDS) {
      expect(ASK_QUESTIONS[id].text.endsWith("?"), id).toBe(true);
      expect(bannedTerms(ASK_QUESTIONS[id].text, "en"), id).toEqual([]);
    }
  });

  it("are told apart from anything else the browser could send", () => {
    expect(isAskQuestionId("career_year")).toBe(true);
    for (const value of ["", "Career", "constructor", "__proto__", 7, null]) expect(isAskQuestionId(value)).toBe(false);
  });
});

describe("which passages may answer a question", () => {
  it("need one of the question's topics, a condition that holds, and no lifespan", () => {
    const career = { lifeAreas: ["career"] };
    expect(answersQuestion(row("18.1.1", { ...career, placements: ["Mars.house.10"] }), CAREER, CHART)).toBe(true);
    /* Mars is in the 10th here, not the 7th: that passage is about somebody else. */
    expect(answersQuestion(row("18.1.2", { ...career, placements: ["Mars.house.7"] }), CAREER, CHART)).toBe(false);
    expect(answersQuestion(row("18.1.3", { lifeAreas: ["wealth"], placements: ["Mars.house.10"] }), CAREER, CHART)).toBe(false);
    expect(
      answersQuestion(row("18.1.4", { lifeAreas: ["career", "longevity"], placements: ["Mars.house.10"] }), CAREER, CHART),
    ).toBe(false);
    /* A passage with no condition at all speaks to no chart in particular. */
    expect(answersQuestion(row("18.1.5", career), CAREER, CHART)).toBe(false);
  });

  it("include a yoga's passage when the chart has the yoga in the form it speaks of", () => {
    const love = ASK_QUESTIONS.love_year;
    const yoga = { lifeAreas: ["relationships"], yogaIds: ["kalatra_chandra_shukra"] };
    expect(answersQuestion(row("23.1.1", { ...yoga, planets: ["Moon", "Venus"] }), love, CHART)).toBe(true);
    expect(answersQuestion(row("23.1.2", { ...yoga, planets: ["Saturn"] }), love, CHART)).toBe(false);
  });

  it("are the questions offered, in the catalogue's order", () => {
    const rows = [
      row("18.2.1", { lifeAreas: ["children"], placements: ["Jupiter.house.4"] }),
      row("18.2.2", { lifeAreas: ["career"], placements: ["Mars.house.10"] }),
      row("18.2.3", { lifeAreas: ["health"], placements: ["Mars.house.7"] }),
    ];
    expect(answerableQuestions(rows, CHART)).toEqual(["career_year", "children"]);
  });
});

describe("the order passages are chosen in", () => {
  const career = (ref: string, similarity: number, extra: Partial<CandidatePassage> = {}) =>
    row(ref, { lifeAreas: ["career"], placements: ["Mars.house.10"], similarity, ...extra });

  it("is nearest the question first, then sent in the book's order", () => {
    const chosen = selectQuestionPassages(
      [career("18.5.1", 0.21), career("10.1.1", 0.48), career("14.2.1", 0.33)],
      CAREER,
      CHART,
      new Set(),
      2,
    );
    expect(chosen.map((p) => p.id)).toEqual(["brihat-jataka-1885:10.1.1", "brihat-jataka-1885:14.2.1"]);
  });

  it("lifts a year question's passage about a planet whose period runs that year, but not past a clearly better one", () => {
    const saturn = career("18.6.1", 0.3, { placements: ["Saturn.house.11"], planets: ["Saturn"] });
    const nearer = career("18.6.2", 0.3 + PERIOD_LORD_BOOST / 2);
    const best = career("18.6.3", 0.3 + PERIOD_LORD_BOOST * 2);
    const lords = new Set(["Saturn", "Mercury"]);
    const ids = (rows: CandidatePassage[], question = CAREER) =>
      selectQuestionPassages(rows, question, CHART, lords, 2).map((p) => p.id.split(":")[1]);
    expect(ids([saturn, nearer, best])).toEqual(["18.6.1", "18.6.3"]);
    /* A question about a whole life is not about this year's periods. */
    expect(ids([saturn, nearer, best], { ...CAREER, span: "life" })).toEqual(["18.6.2", "18.6.3"]);
  });

  it("puts the Brihat Jataka's passages before the Strijataka's, and keeps at most the limit", () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      row(`9.${index + 1}.1`, {
        source: index % 2 ? "strijataka-1931" : "brihat-jataka-1885",
        lifeAreas: ["career"],
        placements: ["Mars.house.10", "reader.sex.female"],
        similarity: 0.5 - index / 100,
      }),
    );
    const chosen = selectQuestionPassages(rows, CAREER, CHART);
    expect(chosen).toHaveLength(ASK_PASSAGE_LIMIT);
    const books = chosen.map((p) => p.source);
    expect(books.lastIndexOf("brihat-jataka-1885")).toBeLessThan(books.indexOf("strijataka-1931"));
  });

  it("falls back to the verse before the note, then the book's order, when nothing is scored", () => {
    const chosen = selectQuestionPassages(
      [career("18.7.2", undefined as unknown as number, { kind: "note" }), career("18.7.3", undefined as unknown as number)],
      CAREER,
      CHART,
      new Set(),
      1,
    );
    expect(chosen.map((p) => p.id.split(":")[1])).toEqual(["18.7.3"]);
  });
});

describe("the real corpus, for this chart", () => {
  const shown = [...bj.passages, ...strijataka.passages].filter((passage) => !passage.withheld) as unknown as PassageRow[];

  it.each(ASK_QUESTION_IDS)("never offers %s a passage it may not use", (id) => {
    const question = ASK_QUESTIONS[id];
    for (const passage of selectQuestionPassages(shown, question, CHART, new Set(["Saturn"]), 50)) {
      expect(passage.lifeAreas).not.toContain("longevity");
      expect(passage.lifeAreas.some((topic) => (question.topics as readonly string[]).includes(topic))).toBe(true);
      expect(answersQuestion(passage, question, CHART)).toBe(true);
    }
  });

  it("can answer some questions for an ordinary chart", () => {
    expect(answerableQuestions(shown, CHART).length).toBeGreaterThan(0);
  });
});

describe("the year's planetary periods", () => {
  const NOW = Date.parse("2026-10-06T00:00:00Z");
  const dasha = (maha: string, antar: string, end: string): DashaInfo => ({
    current_dasha: maha,
    current_antardasha: antar,
    current_dasha_start: "2010-01-01",
    current_dasha_end: "2029-01-01",
    current_antardasha_start: "2025-01-01",
    current_antardasha_end: end,
    periods: [],
  });

  it("count on from the current Antardasha in the Vimshottari order until a year has passed", () => {
    /* Saturn-Mercury ends in two months; Saturn-Ketu runs 19 x 7 / 120 years, about 1.1 years. */
    const periods = yearPeriods(dasha("Saturn", "Mercury", "2026-12-06"), NOW);
    expect(periods.map(({ maha, antar }) => `${maha}-${antar}`)).toEqual(["Saturn-Mercury", "Saturn-Ketu"]);
    expect(periods[1].until).toBe("2028-01-14");
    expect([...periodLords(periods)].sort()).toEqual(["Ketu", "Mercury", "Saturn"]);
  });

  it("move to the next Maha Dasha after its last Antardasha, which opens with its own lord", () => {
    /* Saturn's Antardashas end with Jupiter's; Mercury's Maha Dasha opens with Mercury-Mercury. */
    const periods = yearPeriods(dasha("Saturn", "Jupiter", "2027-01-01"), NOW);
    expect(periods.map(({ maha, antar }) => `${maha}-${antar}`)).toEqual(["Saturn-Jupiter", "Mercury-Mercury"]);
  });

  it("drop a period that ended before today, and give nothing without a current period", () => {
    const periods = yearPeriods(dasha("Venus", "Sun", "2026-01-01"), NOW);
    expect(periods[0]).toMatchObject({ maha: "Venus", antar: "Moon" });
    expect(yearPeriods(undefined, NOW)).toEqual([]);
    expect(yearPeriods(dasha("Pluto", "Sun", "2027-01-01"), NOW)).toEqual([]);
  });

  it("are put to the model as one plain sentence, which leaves out the end of the last", () => {
    expect(periodSentence([{ maha: "Saturn", antar: "Saturn", until: "2027-09-14" }, { maha: "Saturn", antar: "Mercury", until: "2030-05-24" }])).toBe(
      "This year runs under your Saturn period, in its Saturn sub-period until September 2027, then its Mercury sub-period.",
    );
    expect(periodSentence([{ maha: "Saturn", antar: "Jupiter", until: "2027-01-01" }, { maha: "Mercury", antar: "Mercury", until: "2029-05-30" }])).toBe(
      "This year runs under your Saturn period, in its Jupiter sub-period until January 2027, then under your Mercury period, in its Mercury sub-period.",
    );
    expect(periodSentence([{ maha: "Venus", antar: "Moon", until: "2028-01-01" }])).toBe(
      "This year runs under your Venus period, in its Moon sub-period.",
    );
  });

  it("are described by month for the model", () => {
    expect(describePeriods([{ maha: "Saturn", antar: "Mercury", until: "2026-12-06" }, { maha: "Saturn", antar: "Ketu", until: "2028-01-13" }])).toBe(
      "Saturn–Mercury until December 2026, then Saturn–Ketu until January 2028",
    );
  });
});

describe("what the model is sent", () => {
  const passages = [
    row("18.8.1", { lifeAreas: ["career"], placements: ["Mars.house.10"] }),
    row("18.8.2", { lifeAreas: ["career"], placements: ["Mars.house.10"], kind: "note" }),
    row("9.40.1", { source: "strijataka-1931", lifeAreas: ["career"], placements: ["Mars.house.10", "reader.sex.female"] }),
  ];

  it("is one cited document per book, its conditions in the context and its notes marked", () => {
    const groups = questionDocumentGroups(passages, CHART);
    expect(groups.map(({ source }) => source)).toEqual(["brihat-jataka-1885", "strijataka-1931"]);
    const documents = questionDocuments(groups);
    expect(documents[0].title).toContain("Brihat Jataka");
    expect(documents[0].context).toContain("Mars in the 10th house");
    expect(documents[0].citations).toEqual({ enabled: true });
    const blocks = (documents[0].source as { content: { text: string }[] }).content.map((block) => block.text);
    expect(blocks).toEqual(["text of 18.8.1", `${NOTE_PREFIX}text of 18.8.2`]);
    expect(documents[1].context).toContain("the reader is a woman");
  });

  it("asks the question as written, in English, with the year's periods only for a year question", () => {
    const periods = [{ maha: "Saturn", antar: "Mercury", until: "2026-12-06" }];
    const year = askClassicsInstruction(CAREER, periods, "female");
    expect(year).toContain(`"${CAREER.text}"`);
    expect(year).toContain("Write the answer in English.");
    expect(year).toContain("Saturn–Mercury until December 2026");
    expect(year).toContain('use this sentence as written: "This year runs under your Saturn period, in its Mercury sub-period."');
    expect(year).toContain('"your partner"');
    const life = askClassicsInstruction(ASK_QUESTIONS.strengths, periods);
    expect(life).not.toContain("Saturn");
    expect(life).not.toContain("woman");
  });

  it("keeps every classical note's rules, and the year and health limits", () => {
    expect(ASK_CLASSICS_SYSTEM_PROMPT).toContain(CLASSICAL_NOTE_RULES);
    expect(ASK_CLASSICS_SYSTEM_PROMPT).toContain("never promise an event, a date or an outcome.");
    expect(ASK_CLASSICS_SYSTEM_PROMPT).toContain("never write disease, illness, sickness or ailment");
    expect(ASK_CLASSICS_SYSTEM_PROMPT).not.toMatch(/\bAI\b/);
  });
});

describe("the content line's check", () => {
  it("now catches a long life, as it catches longevity", () => {
    expect(bannedTerms("The book promises you a long life.", "en")).toEqual(["long life"]);
    expect(bannedTerms("a long-life blessing", "en")).toEqual(["long-life"]);
    expect(bannedTerms("Your life will be long and full of work.", "en")).toEqual([]);
  });
});

describe("the words the model reads", () => {
  it("promise good health without naming illness, while the printed passage keeps the book's", async () => {
    const { modelText } = await import("../knowledge/ask-classics-reading");
    expect(modelText("will be rich and free from diseases, and happy")).toBe("will be rich and [of robust health], and happy");
    expect(modelText("will be free from serious diseases.")).toBe("will be [of robust health].");
    expect(modelText("will be healthy")).toBe("will be healthy");
    const groups = questionDocumentGroups(
      [{ ...row("21.10.1", { lifeAreas: ["health"], placements: ["Mars.house.10"] }), text: "will be free from diseases" }],
      CHART,
    );
    const block = (questionDocuments(groups)[0].source as { content: { text: string }[] }).content[0].text;
    expect(block).toBe("will be [of robust health]");
    expect(groups[0].passages[0].text).toBe("will be free from diseases");
  });

  it("leave a yoga no life area counts to the yoga section", () => {
    const kemadruma = row("13.12.1", { lifeAreas: ["wealth"], yogaIds: ["kemadruma"] });
    const chart: AreaChart = { ...CHART, yogas: [{ id: "kemadruma", planets: [] }] };
    expect(answersQuestion(kemadruma, ASK_QUESTIONS.money_year, chart)).toBe(false);
  });
});
