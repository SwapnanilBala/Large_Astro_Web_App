import type { MajorLifeShift, MajorShiftKind, MajorShiftStatus } from "@/lib/engines/major-shifts-engine";
import { planetName, signName } from "@/lib/chart-labels";

/*
 * How a life chapter is named and themed in the reader's language, shared by
 * the desktop life shifts panel and the phone results page, which draws the
 * chapter in its own style. Imports nothing but the label helpers, so the
 * phone does not pull in the desktop panel to use them.
 */

type Translate = (key: string, params?: Record<string, string>) => string;

/*
 * Where the strings live: the desktop's under "insights.shifts", the phone's
 * under "mobileInsights.shifts" -- the phone's results catalog is the only
 * English source for its keys, so it holds its own copy, with the same
 * translations, rather than reaching into the desktop's.
 */
const DESKTOP = "insights.shifts";

export const STATUS_LABEL_KEY: Record<MajorShiftStatus, string> = {
  past: "insights.shifts.past",
  active: "insights.shifts.active",
  upcoming: "insights.shifts.upcoming",
};

/** The status's key under a given prefix: "Past chapter", "Active now", "Upcoming". */
export const statusLabelKey = (status: MajorShiftStatus, prefix: string = DESKTOP) => `${prefix}.${status}`;

/*
 * The engine's chapter names and themes are a closed set: a mahadasha for each
 * planet and three returns. They print through insights.shifts.labels and
 * .themes; anything else prints as the engine wrote it. The narrative and the
 * evidence line stay the engine's English, as its reading prose does.
 */
export const RETURN_KEYS: Partial<Record<MajorShiftKind, string>> = {
  "saturn-return": "saturnReturn",
  "jupiter-return": "jupiterReturn",
  "nodal-return": "nodalReturn",
};

/* The engine names a return's occurrence in words, then falls back to "5th". */
export const SHIFT_ORDINALS = ["first", "second", "third", "fourth"] as const;

function worded(t: Translate, key: string, fallback: string, params?: Record<string, string>): string {
  const text = t(key, params);
  return text === key ? fallback : text;
}

/** "Saturn return (first)", "Venus mahadasha begins", in the reader's language. */
export function shiftLabel(shift: MajorLifeShift, t: Translate, prefix: string = DESKTOP): string {
  if (shift.kind === "mahadasha") {
    return worded(t, `${prefix}.labels.mahadasha`, shift.label, { planet: planetName(shift.planet, t) });
  }
  const kind = RETURN_KEYS[shift.kind];
  const ordinal = /\((\w+)\)$/.exec(shift.label)?.[1] as (typeof SHIFT_ORDINALS)[number] | undefined;
  if (!kind || !ordinal || !SHIFT_ORDINALS.includes(ordinal)) return shift.label;
  return worded(t, `${prefix}.labels.${kind}`, shift.label, {
    ordinal: worded(t, `${prefix}.ordinals.${ordinal}`, ordinal),
  });
}

/** The chapter's standing theme, in the reader's language. */
export function shiftTheme(shift: MajorLifeShift, t: Translate, prefix: string = DESKTOP): string {
  const id = shift.kind === "mahadasha" ? shift.planet.toLowerCase() : RETURN_KEYS[shift.kind];
  return id ? worded(t, `${prefix}.themes.${id}`, shift.theme) : shift.theme;
}

/**
 * The chapters a page shows first: those running now or still to come, up to
 * `count`, or the latest past one when nothing lies ahead. The results page,
 * desktop and phone, shows one.
 */
export function featuredShifts(shifts: readonly MajorLifeShift[], count: number): MajorLifeShift[] {
  const forward = shifts.filter((shift) => shift.status === "active" || shift.status === "upcoming").slice(0, count);
  return forward.length > 0 ? forward : shifts.slice(-1);
}

/*
 * The evidence line under a chapter ("Cycle: ~18.6 years | Rahu: Capricorn /
 * H6") in the reader's language, from the parts the engine sends beside its
 * English (MajorLifeShift.evidenceParts). The wording is the Android app's
 * (strings_life_chapters.xml), so the two read alike. Without parts, or with a
 * catalog that lacks a key, the engine's English is printed.
 */
export function shiftEvidence(shift: MajorLifeShift, t: Translate, locale: string, prefix: string = DESKTOP): string {
  const parts = shift.evidenceParts;
  if (!parts || parts.length === 0) return shift.evidence;
  const key = (name: string) => `${prefix}.evidence.${name}`;
  /* Latin digits in every language, as the rest of the page prints them;
     only the decimal mark follows the reader (29,5 in German). */
  const years = (value: string) => {
    const number = Number(value);
    return Number.isFinite(number)
      ? new Intl.NumberFormat(`${locale}-u-nu-latn`, { maximumFractionDigits: 1 }).format(number)
      : value;
  };
  const placement = (sign: string, house: number) =>
    t(key("placement"), { sign: signName(sign, t), house: String(house) });
  const words = parts.map((part) => {
    switch (part.kind) {
      case "cycle":
        return t(key("cycle"), { years: years(part.years) });
      case "lasts":
        return t(key("lasts"), { years: years(part.years) });
      case "lord":
        return t(key("lord"), { planet: planetName(part.planet, t) });
      case "natal":
        return t(key("natal"), { planet: planetName(part.planet, t), placement: placement(part.sign, part.house) });
      case "node":
        return t(key("node"), { planet: planetName(part.planet, t), placement: placement(part.sign, part.house) });
    }
  });
  return words.some((word) => word.startsWith(`${prefix}.evidence.`)) ? shift.evidence : words.join(" | ");
}
