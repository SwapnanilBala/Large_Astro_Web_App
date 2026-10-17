import type { BirthSex } from "../birth-sex";
import type { ChartApiResponse } from "../astro-types";
import { pathAt } from "../dasha-periods";
import { friendshipOf, lordFacts, relationKind, type LordFacts, type PeriodFacts } from "../dasha-reading-facts";
import {
  HOUSE_LIFE,
  HOUSE_MEANINGS,
  RELATION_WORDS,
  STOCK_PHRASES,
  houseList,
  housesNamed,
  inProse,
  lordPlacement,
  ordinal,
  periodFocus,
} from "../dasha-period-words";
import type { MajorLifeShift, MajorShiftKind, MajorShiftStatus } from "../engines/major-shifts-engine";
import { MAX_LIFE_SHIFTS, formatShiftPivot, formatShiftWindow, lifeShiftId, type LifeShiftDepth } from "../life-shift-reading";
import { COMMENTARY_LANGUAGES } from "../varga-commentary";
import { READER_LINES, describePlacement, type AreaChart } from "./area-classics-reading";
import {
  periodDocumentGroups,
  selectPeriodPassages,
  voicesOf,
  type PeriodCandidate,
  type PeriodDocumentGroup,
} from "./dasha-reading";
import { BRIHAT_JATAKA_1885, KNOWLEDGE_SOURCES, STRIJATAKA_1931 } from "./sources";
import { CLASSICAL_NOTE_RULES, CLOSING_REMINDERS, NOTE_PREFIX, modelText, passageRef } from "./yoga-classics-reading";

/*
 * The readings for the major life shifts section, from the chart and the
 * classics: the server half that touches neither the database nor the
 * network, so it can be tested directly.
 *
 * The engine (lib/engines/major-shifts-engine.ts) decides which chapters
 * matter -- the Maha Dasha openings and the Saturn, Jupiter and nodal returns
 * nearest to now -- and until 2026-10-16 the model was handed little more than
 * the engine's line about each: its planet, a stock theme, "Natal Saturn:
 * Scorpio / H2". Every Saturn return read alike. Each chapter now carries what
 * the period reading is written from (lib/dasha-reading-facts.ts): where its
 * planet stands, the houses it sits in and rules and how they show up in
 * ordinary life, and the Maha Dasha it falls in or takes over from; and the
 * passages of the books that apply to this chart and concern that planet,
 * chosen as the period reading chooses them (selectPeriodPassages), numbered
 * across the set and cited with [n] marks.
 */

/** Passages each chapter gets: the long single reading on the results page, or one of a row of five. */
export const SHIFT_PASSAGE_LIMITS: Record<LifeShiftDepth, number> = { headline: 6, compact: 3 };

/** One chapter as the reading is written from it. */
export type ShiftChapter = {
  id: string;
  kind: MajorShiftKind;
  status: MajorShiftStatus;
  /** "March 2029", as the card prints it. */
  pivot: string;
  /** "Jun 2028 → Dec 2029", as the card prints it. */
  window: string;
  ageAtPivot: number;
  /** The chapter's planets in the chart: the Maha Dasha lord, the returning planet, or Rahu and Ketu. No relations. */
  facts: PeriodFacts;
  /** For a Maha Dasha: its length in years, and the lord it takes over from. */
  years?: number;
  previous?: LordFacts;
  /** For a return: the Maha Dasha and Antardasha lords running at its pivot, and the Maha Dasha lord's place. */
  running?: string[];
  runningLord?: LordFacts;
  occurrence?: number;
};

const OCCURRENCE = /\((first|second|third|fourth|(\d+)th)\)$/;
const OCCURRENCE_NUMBERS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4 };

const DAY_MS = 86_400_000;

/** The planets a chapter is about: the nodes for a nodal return, else the engine's planet. */
function chapterPlanets(shift: MajorLifeShift): string[] {
  return shift.kind === "nodal-return" ? ["Rahu", "Ketu"] : [shift.planet];
}

/**
 * The chapters as the reading is written from them, in the order given, from
 * the chart this server built. A chapter whose planets the chart cannot place
 * is left out, and the panel keeps the engine's words for it.
 */
export function shiftChapters(shifts: readonly MajorLifeShift[], payload: ChartApiResponse): ShiftChapter[] {
  const chart = { ascendantSign: payload.chart.ascendant.sign, planets: payload.chart.planets };
  const dasha = payload.chart.dasha;
  return shifts.slice(0, MAX_LIFE_SHIFTS).flatMap((shift): ShiftChapter[] => {
    const lords = chapterPlanets(shift).map((planet) => lordFacts(chart, planet));
    if (lords.some((facts) => !facts)) return [];
    const pivotMs = Date.parse(shift.pivotIso);
    const chapter: ShiftChapter = {
      id: lifeShiftId(shift),
      kind: shift.kind,
      status: shift.status,
      pivot: formatShiftPivot(shift.pivotIso),
      window: formatShiftWindow(shift.windowStartIso, shift.windowEndIso),
      ageAtPivot: shift.ageAtPivot,
      facts: { ascendantSign: chart.ascendantSign, lords: lords as LordFacts[], relations: [] },
    };
    if (shift.kind === "mahadasha") {
      const period = dasha?.periods.find(
        (entry) => entry.planet === shift.planet && Math.abs(Date.parse(entry.start_date) - pivotMs) < DAY_MS,
      );
      if (period) chapter.years = period.years;
      const before = dasha ? pathAt(dasha, pivotMs - DAY_MS, 1)[0] : undefined;
      const previous = before && before.planet !== shift.planet ? lordFacts(chart, before.planet) : null;
      if (previous) chapter.previous = previous;
    } else {
      const running = dasha ? pathAt(dasha, pivotMs, 2).map((span) => span.planet) : [];
      if (running.length > 0) chapter.running = running;
      const runningLord = running[0] && !chapterPlanets(shift).includes(running[0]) ? lordFacts(chart, running[0]) : null;
      if (runningLord) chapter.runningLord = runningLord;
      const occurrence = OCCURRENCE.exec(shift.label);
      if (occurrence) chapter.occurrence = OCCURRENCE_NUMBERS[occurrence[1]] ?? Number(occurrence[2]);
    }
    return [chapter];
  });
}

/* ── The facts, in words ─────────────────────────────────────────────────── */

const STATUS_WORDS: Record<MajorShiftStatus, string> = {
  past: "already lived: write it as something to recognise, in the past tense",
  active: "running now",
  upcoming: "still to come: say what it is set to bring forward",
};

const ORDINAL_WORDS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
const occurrenceWord = (occurrence: number | undefined) =>
  occurrence ? `${ORDINAL_WORDS[occurrence - 1] ?? ordinal(occurrence)} ` : "";

/** What the chapter is, in one sentence. */
function chapterWhat(chapter: ShiftChapter): string {
  const [lord] = chapter.facts.lords;
  switch (chapter.kind) {
    case "mahadasha":
      return (
        `The Maha Dasha of ${inProse(lord.lord)} begins` +
        (chapter.years ? `, a period of about ${Math.round(chapter.years)} years` : "") +
        (chapter.previous ? `, taking over from the Maha Dasha of ${inProse(chapter.previous.lord)}` : "") +
        ". A Maha Dasha brings forward the matters of the houses its planet sits in and rules, for its whole span."
      );
    case "saturn-return":
    case "jupiter-return":
      return (
        `${lord.lord}'s ${occurrenceWord(chapter.occurrence)}return: ${lord.lord} comes back, in its own slow round of the zodiac, to the sign it held at birth, ${lord.sign}. ` +
        `It goes over again the matters of the houses it sits in and rules in the birth chart` +
        (chapter.kind === "saturn-return"
          ? ", asking what has been built there to hold its weight."
          : ", widening what can grow there.")
      );
    case "antardasha":
      return `The Antardasha of ${inProse(lord.lord)} begins, a sub-period that brings forward the matters of the houses its planet sits in and rules.`;
    case "nodal-return":
      return (
        `The ${occurrenceWord(chapter.occurrence)}nodal return: Rahu and Ketu come back to the signs they held at birth, ` +
        `so the axis between what you reach for (Rahu) and what you are ready to let go of (Ketu) is live again.`
      );
  }
}

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];

/** How a planet stands to another, as the period reading says it of two levels: the count of signs from the other to it, and natural friendship. */
function standing(lord: LordFacts, other: LordFacts, otherRole: string): string {
  const distance = ((SIGNS.indexOf(lord.sign) - SIGNS.indexOf(other.sign) + 12) % 12) + 1;
  const where =
    distance === 1
      ? `in the same sign as ${inProse(other.lord)}`
      : `${ordinal(distance)} from ${inProse(other.lord)}, ${RELATION_WORDS[relationKind(distance)]}`;
  const friendship = friendshipOf(other.lord, lord.lord);
  const regard =
    friendship === "neutral"
      ? `; ${inProse(other.lord)} is neutral to ${inProse(lord.lord)} by nature`
      : friendship
        ? `; ${inProse(other.lord)} counts ${inProse(lord.lord)} a natural ${friendship}`
        : "";
  const subject = inProse(lord.lord);
  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} stands ${where} (${otherRole})${regard}.`;
}

/**
 * One chapter in words, for the model: what it is, when, where its planets
 * stand, how it meets the Maha Dasha around it, which houses it concentrates
 * on and how those show up in ordinary life.
 */
export function describeChapter(chapter: ShiftChapter): string {
  const { facts } = chapter;
  const lines = [
    `Chapter id: ${chapter.id}`,
    chapterWhat(chapter),
    `Where it sits: ${STATUS_WORDS[chapter.status]}. Pivot: ${chapter.pivot} (age ${chapter.ageAtPivot}); window: ${chapter.window}.`,
    ...facts.lords.map((lord) => `${lord.lord} in the birth chart: ${lordPlacement(lord)}.`),
  ];
  const [lord] = facts.lords;
  if (chapter.previous) {
    lines.push(`The Maha Dasha it takes over from: ${chapter.previous.lord}, ${lordPlacement(chapter.previous)}.`);
    lines.push(standing(lord, chapter.previous, "the Maha Dasha lord before it"));
  }
  if (chapter.running && chapter.running.length > 0) {
    const [maha, antar] = chapter.running;
    lines.push(
      `Running at the pivot: the Maha Dasha of ${inProse(maha)}` +
        (antar && antar !== maha ? `, in its Antardasha of ${inProse(antar)}` : antar === maha ? ", in its own Antardasha" : "") +
        ".",
    );
    if (chapter.runningLord) lines.push(standing(lord, chapter.runningLord, "the Maha Dasha lord running then"));
    else if (maha === lord.lord) lines.push(`${lord.lord} also rules the Maha Dasha running then, so the return lands in its own period.`);
  }
  const houses = housesNamed(facts);
  const { shared } = periodFocus(facts);
  lines.push(
    `Houses it brings forward (where its planet${facts.lords.length > 1 ? "s sit" : " sits"} and what ${facts.lords.length > 1 ? "they rule" : "it rules"}): ${houseList(houses)}.`,
  );
  if (shared.length > 0) {
    lines.push(`Houses both nodes touch: ${shared.map(({ house }) => `the ${ordinal(house)}`).join(", ")}.`);
  }
  lines.push(`What those houses stand for: ${houses.map((house) => `the ${ordinal(house)}: ${HOUSE_MEANINGS[house]}`).join("; ")}.`);
  lines.push(`Everyday ways they tend to show up: ${houses.map((house) => `the ${ordinal(house)}: ${HOUSE_LIFE[house]}`).join("; ")}.`);
  return lines.filter(Boolean).join("\n");
}

/**
 * A description of the chapter to search the passages with: its planets,
 * where they sit and rule, and what those houses stand for.
 */
export function chapterQueryText(chapter: ShiftChapter): string {
  const lines = chapter.facts.lords.map((lord) => {
    const rules = lord.rules.length > 0 ? `, ruling ${houseList(lord.rules)} house${lord.rules.length > 1 ? "s" : ""}` : "";
    return `${lord.lord} in ${lord.sign} in the ${ordinal(lord.house)} house${rules}`;
  });
  const topics = [...new Set(housesNamed(chapter.facts).flatMap((house) => HOUSE_MEANINGS[house].split(", ")))].slice(0, 12);
  const what =
    chapter.kind === "mahadasha"
      ? `the Maha Dasha of ${chapter.facts.lords[0].lord}`
      : chapter.kind === "nodal-return"
        ? "the return of Rahu and Ketu"
        : `the return of ${chapter.facts.lords[0].lord}`;
  return `What ${what} brings for a chart with ${lines.join("; ")}: ${topics.join(", ")}.`;
}

/* ── The passages ────────────────────────────────────────────────────────── */

/** A chapter with the passages chosen for it, grouped by planet and book. */
export type ShiftChapterPassages = { chapter: ShiftChapter; groups: PeriodDocumentGroup[] };

/**
 * The passages each chapter gets, chosen as a period's are (selectPeriodPassages)
 * from that chapter's candidates. A passage an earlier chapter took is not
 * offered again, so two chapters on one planet -- its Maha Dasha and its
 * return -- read different verses rather than repeating each other.
 */
export function chapterPassages(
  chapters: readonly ShiftChapter[],
  candidates: readonly (readonly PeriodCandidate[])[],
  chart: AreaChart,
  depth: LifeShiftDepth,
): ShiftChapterPassages[] {
  const used = new Set<string>();
  return chapters.map((chapter, index) => {
    const rows = (candidates[index] ?? []).filter((row) => !used.has(row.id));
    const chosen = selectPeriodPassages(rows, chart, chapter.facts, SHIFT_PASSAGE_LIMITS[depth]);
    for (const { passage } of chosen) used.add(passage.id);
    return { chapter, groups: periodDocumentGroups(chosen, chart, chapter.facts) };
  });
}

/** Every group in the order the listing numbers them, which is the order readingFromMarkers reads marks against. */
export const allGroups = (sets: readonly ShiftChapterPassages[]) => sets.flatMap((set) => set.groups);

/**
 * The passages as the model reads them: numbered across the whole set, under
 * the chapter each was chosen for, then the planet and the book, each group
 * saying which chart conditions and yogas its passages rest on.
 */
export function shiftPassageListing(sets: readonly ShiftChapterPassages[]): string {
  let number = 0;
  return sets
    .filter((set) => set.groups.length > 0)
    .map(({ chapter, groups }) => {
      const blocks = groups.map(({ lord, source, passages, conditions, yogaNames }) => {
        const book = KNOWLEDGE_SOURCES[source] ?? BRIHAT_JATAKA_1885;
        const lordFactsFor = chapter.facts.lords.find((entry) => entry.lord === lord);
        const voices = lordFactsFor ? voicesOf(lordFactsFor).filter((voice) => voice !== lord) : [];
        const header =
          `Chosen for ${lord}` +
          (voices.length > 0 ? `, whose results it gives through ${voices.join(" and ")}; the passages may concern them` : "") +
          `, from ${book.title}. ` +
          (conditions.length > 0 ? `Conditions met in the chart: ${conditions.map(describePlacement).join("; ")}. ` : "") +
          (yogaNames.length > 0 ? `Yogas the chart has that passages speak of: ${yogaNames.join(", ")}.` : "");
        const lines = passages.map((passage) => {
          number += 1;
          const text = passage.kind === "note" ? `${NOTE_PREFIX}${modelText(passage.text)}` : modelText(passage.text);
          return `[${number}] (${passageRef(passage)}) ${text}`;
        });
        return [header.trim(), ...lines].join("\n");
      });
      return [`For chapter ${chapter.id}:`, ...blocks].join("\n");
    })
    .join("\n\n");
}

/**
 * The chapters still ahead (active or upcoming), then the past: two batches,
 * written side by side, when a compact set holds both; else the set as one.
 * The results page's single headline chapter is never split.
 */
export function shiftBatches(chapters: readonly ShiftChapter[], depth: LifeShiftDepth): string[][] {
  const ahead = chapters.filter((chapter) => chapter.status !== "past").map((chapter) => chapter.id);
  const past = chapters.filter((chapter) => chapter.status === "past").map((chapter) => chapter.id);
  if (depth === "headline" || ahead.length === 0 || past.length === 0) return [chapters.map((chapter) => chapter.id)];
  return [ahead, past];
}

/* ── The prompt ───────────────────────────────────────────────────────────── */

/* Frozen, so it is the cacheable prefix; the chapters, the passages and the language follow in the user turn. */
export const LIFE_SHIFTS_SYSTEM_PROMPT = `You write the chapter readings for the "major life shifts" section of a Vedic astrology report.

How the chapters work, for your own understanding: the section picks the few turning points nearest to now in one birth chart. A Maha Dasha opening is when the Vimshottari dasha hands a life to a new planet for years: its period brings forward the matters of the houses that planet sits in and rules, coloured by its sign, its dignity and the planets with it, and the classical results of its placements. A return is when a slow planet comes back to the sign it held at birth -- Saturn every 29 or 30 years, Jupiter every 12, the nodes every 18 or 19 -- and goes over again what it stands for in the chart. Rahu and Ketu own no sign, and give the results of the lord of the sign they occupy and of the planets with them.

For each chapter you are given its id, what it is, where it sits in time, its pivot and planning window, where its planets stand in the chart, how it meets the Maha Dasha around it (the one it takes over from, or the one running at a return), the houses it brings forward with what they stand for and how they show up in ordinary life, and numbered passages from the classical books chosen for it: each passage's condition holds in the reader's chart and it concerns that chapter's planet. The books are ${BRIHAT_JATAKA_1885.described}, or, for a woman's chart, also ${STRIJATAKA_1931.described}.

Return exactly one reading for every chapter you are given -- no more, no fewer -- with "id" set to that chapter's id exactly as given.

The user turn names a length:

LENGTH "headline" -- two short paragraphs, 130 to 180 words in all and never more than 190. This is the single chapter on the reader's results page. The first paragraph: the one or two parts of life this chapter concentrates on for this chart, and how that tends to show up in ordinary life, choosing from the everyday examples given. The second: how it meets the Maha Dasha around it (ease or friction, from how the planets stand), what it makes easier and what it is a poor time to force, and the books' view.

LENGTH "compact" -- one paragraph of three or four sentences, 90 words at the outside: what it concentrates on and how that shows up, how it meets the Maha Dasha around it, and the books' view where a passage bears on it. It sits in a row with several others.

Rules for each reading:
- Open with what is particular to this chart: the houses the chapter brings forward and what they mean in ordinary life, never a general statement about the planet that would fit anyone.
- The card above the reading prints the chapter's name, its theme, the pivot, the window and the age, so do not open with them. You may name the pivot month or the window once, in a sentence; never give another date or age.
- Use a chart fact only to explain something, in a clause; never recite placements or list houses with their meanings.
- Bring in the books' view where a passage bears on the chapter: put it in your own words, attribute it to its book, and mark it with the passage's number in square brackets right after the words it supports, like [2] or [1,3]. Use the numbers listed for that chapter. Every classical result carries its number, nothing else carries one, never write a number you were not given, and never quote a passage's sentence. A passage that lists results of several kinds may be used only for the results that fit this chapter's planet and houses. When a chapter has passages, cite at least one.
- Match the tense to where the chapter sits: one already lived is something to recognise; one running now is present; one still to come is set to bring things forward.
- Avoid stock astrology phrasing. Never write ${STOCK_PHRASES.map((phrase) => `"${phrase}"`).join(", ")}.
- No predictions of specific events and nothing fatalistic; a chapter describes conditions, not outcomes.
- Words in square brackets inside a passage are the app's, not the book's: the opening words a passage needs to read alone, or a wording chosen in place of one too harsh to print. Follow them, and never restore what they replace.
- Speak of the 6th house as rivals, debts and daily work, the 8th as sudden change and what is hidden, and the 12th as spending, foreign places and retreat, never as illness, lifespan or loss of life.
${CLASSICAL_NOTE_RULES}

Across the set: the readings sit on one page. Do not repeat an observation, an image or an opening construction across two of them, and where two chapters overlap in time or pull against each other, say so in one of them only.`;

/**
 * The user turn's closing text: the chapters, the length, the language and
 * who the reader is. Written straight in the reader's language from English
 * facts and passages, as the other classical notes are. An unknown language
 * code is English.
 */
export function lifeShiftsInstruction(
  sets: readonly ShiftChapterPassages[],
  depth: LifeShiftDepth,
  sex?: BirthSex,
  languageCode = "en",
): string {
  const english = !Object.hasOwn(COMMENTARY_LANGUAGES, languageCode) || languageCode === "en";
  const language = english ? COMMENTARY_LANGUAGES.en : COMMENTARY_LANGUAGES[languageCode];
  const ids = sets.map(({ chapter }) => chapter.id);
  return (
    `${sets.map(({ chapter, groups }) => `${describeChapter(chapter)}\n${groups.length > 0 ? "Its passages are listed under its id above." : "The books have no passage for it in this chart: write it from the chart alone, with no marks."}`).join("\n\n")}\n\n` +
    `Write exactly ${ids.length} reading${ids.length === 1 ? "" : "s"} at LENGTH "${depth}" in ${language}, one for each of these chapter ids: ${ids.join(", ")}.` +
    (sex ? READER_LINES[sex] : "") +
    " Mark every classical result with its passage's number, say in your own plain words what the book ties to the placement, and never quote the passage's sentence:" +
    ' not "will be indifferent to work and will be merciless[1]" but "a cool, detached attitude to work[1]".' +
    " Give no advice or warnings of your own and do not end with a summary." +
    CLOSING_REMINDERS +
    (english ? "" : ` Write every sentence in ${language}, although the facts and the passages are in English.`)
  );
}

/** What two requests must share to be the same set of readings, before any passage is fetched: the chapters as described and the chart's conditions. */
export function shiftsCanonical(chapters: readonly ShiftChapter[], chart: AreaChart, depth: LifeShiftDepth): string {
  return [
    depth,
    [...chart.keys].sort().join(","),
    chart.yogas.map((yoga) => `${yoga.id}:${[...yoga.planets].sort().join("+")}`).sort().join(","),
    chapters.map((chapter) => describeChapter(chapter)).join("\n\n"),
  ].join("#");
}

