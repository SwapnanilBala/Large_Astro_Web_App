import type {
  ChartApiResponse,
  DashaPeriodInfo,
  PlanetPosition,
} from "@/lib/astro-types";

export type MajorShiftKind =
  | "mahadasha"
  | "antardasha"
  | "saturn-return"
  | "jupiter-return"
  | "nodal-return";

export type MajorShiftStatus = "past" | "active" | "upcoming";

export type MajorLifeShift = {
  index: number;
  kind: MajorShiftKind;
  label: string;
  planet: string;
  pivotIso: string;
  windowStartIso: string;
  windowEndIso: string;
  status: MajorShiftStatus;
  ageAtPivot: number;
  theme: string;
  narrative: string;
  evidence: string;
};

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.25;

const PLANET_THEMES: Record<string, string> = {
  Sun: "authority, identity, and visibility",
  Moon: "emotional foundations, family, and inner safety",
  Mars: "courage, conflict, and decisive action",
  Mercury: "communication, study, and adaptive thinking",
  Jupiter: "expansion, faith, teaching, and ethical growth",
  Venus: "love, partnership, money, and pleasure",
  Saturn: "discipline, responsibility, and karmic reckoning",
  Rahu: "ambition, hunger, and unfamiliar terrain",
  Ketu: "release, withdrawal, and inward mastery",
};

const PLANET_TONE: Record<string, string> = {
  Sun: "a re-set of who is in charge of your life",
  Moon: "a domestic and emotional re-tuning",
  Mars: "an action and conflict cycle that re-draws your boundaries",
  Mercury: "a communication, learning, and commerce reset",
  Jupiter: "an expansion window where teachers, study, or travel widen the field",
  Venus: "a relationship, money, and aesthetic recalibration",
  Saturn: "a long, structural rebuild that asks for maturity",
  Rahu: "an ambition spike that pulls you into unfamiliar rooms",
  Ketu: "a stripping-back where attachments quietly fall away",
};

const SATURN_RETURN_YEARS = 29.4571;
const JUPITER_RETURN_YEARS = 11.862;
const NODAL_RETURN_YEARS = 18.6129;

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function addYears(base: Date, years: number): Date {
  return new Date(base.getTime() + years * YEAR_DAYS * DAY_MS);
}

function diffYears(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (YEAR_DAYS * DAY_MS);
}

function clampWindow(pivot: Date, halfWidthDays: number): { start: Date; end: Date } {
  return {
    start: new Date(pivot.getTime() - halfWidthDays * DAY_MS),
    end: new Date(pivot.getTime() + halfWidthDays * DAY_MS),
  };
}

function statusFor(now: Date, start: Date, end: Date): MajorShiftStatus {
  if (now < start) return "upcoming";
  if (now > end) return "past";
  return "active";
}

function findBirthDate(payload: ChartApiResponse): Date | null {
  const audit = payload.chart.calculation_audit;
  const birthIso = audit?.birth_utc_iso ?? audit?.birth_local_iso;
  const direct = parseDate(birthIso ?? null);
  if (direct) return direct;
  const firstPeriod = payload.chart.dasha?.periods?.[0];
  return parseDate(firstPeriod?.sequence_start_date ?? firstPeriod?.start_date ?? null);
}

function planetHouseTag(planet: string, planets: PlanetPosition[]): string {
  const match = planets.find((p) => p.name === planet);
  if (!match) return "";
  return `${match.sign} / H${match.house}`;
}

type Candidate = Omit<MajorLifeShift, "index" | "status">;

function describeMahadasha(
  period: DashaPeriodInfo,
  birth: Date,
  payload: ChartApiResponse,
): Candidate | null {
  const pivot = parseDate(period.start_date);
  if (!pivot) return null;
  const halfWidth = 270;
  const window = clampWindow(pivot, halfWidth);
  const planet = period.planet;
  const ageAtPivot = Math.max(0, Math.round(diffYears(pivot, birth)));
  const placement = planetHouseTag(planet, payload.chart.planets);
  const tone = PLANET_TONE[planet] ?? `a ${planet} cycle that re-orders priorities`;
  const theme = PLANET_THEMES[planet] ?? "a new chapter";
  const narrative = `The ${planet} mahadasha opens around age ${ageAtPivot} — ${tone}. Its themes are ${theme}, and they tend to surface most clearly in the area where ${planet} sits in your chart${placement ? ` (${placement})` : ""}. The 12 to 18 months around the start are usually where the new chapter announces itself.`;
  return {
    kind: "mahadasha",
    label: `${planet} mahadasha begins`,
    planet,
    pivotIso: pivot.toISOString(),
    windowStartIso: window.start.toISOString(),
    windowEndIso: window.end.toISOString(),
    ageAtPivot,
    theme,
    narrative,
    evidence: [
      `Mahadasha lord: ${planet}`,
      `Lasts ~${period.years} years`,
      placement ? `Natal ${planet}: ${placement}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
  };
}

function describePlanetaryReturn(
  kind: Extract<MajorShiftKind, "saturn-return" | "jupiter-return" | "nodal-return">,
  birth: Date,
  occurrence: number,
  payload: ChartApiResponse,
): Candidate {
  const ordinal = ["first", "second", "third", "fourth"][occurrence - 1] ?? `${occurrence}th`;
  let pivot: Date;
  let label: string;
  let planet: string;
  let theme: string;
  let halfWidth: number;
  let narrative: string;
  let evidence: string;

  if (kind === "saturn-return") {
    pivot = addYears(birth, SATURN_RETURN_YEARS * occurrence);
    planet = "Saturn";
    label = `Saturn return (${ordinal})`;
    theme = "structure, responsibility, and the cost of choices";
    halfWidth = 365;
    const placement = planetHouseTag("Saturn", payload.chart.planets);
    narrative = `Saturn comes back to its birth position around age ${Math.round(diffYears(pivot, birth))}. This is the classic life pivot: commitments harden, false structures crack, and the area where Saturn sits in your chart${placement ? ` (${placement})` : ""} demands a more honest version. Expect a 9 to 18 month rebuild, not an event.`;
    evidence = ["Cycle: ~29.5 years", placement ? `Natal Saturn: ${placement}` : ""]
      .filter(Boolean)
      .join(" | ");
  } else if (kind === "jupiter-return") {
    pivot = addYears(birth, JUPITER_RETURN_YEARS * occurrence);
    planet = "Jupiter";
    label = `Jupiter return (${ordinal})`;
    theme = "expansion, meaning, and a wider field of play";
    halfWidth = 240;
    const placement = planetHouseTag("Jupiter", payload.chart.planets);
    narrative = `Jupiter completes its 12-year cycle near age ${Math.round(diffYears(pivot, birth))}. Doors that felt locked tend to open; teachers, study, travel, or new ethical frames arrive. Where Jupiter sits in your chart${placement ? ` (${placement})` : ""} is the room that gets enlarged.`;
    evidence = ["Cycle: ~11.9 years", placement ? `Natal Jupiter: ${placement}` : ""]
      .filter(Boolean)
      .join(" | ");
  } else {
    pivot = addYears(birth, NODAL_RETURN_YEARS * occurrence);
    planet = "Rahu / Ketu";
    label = `Nodal return (${ordinal})`;
    theme = "fate axis — what you reach for and what you release";
    halfWidth = 270;
    const rahuPlacement = planetHouseTag("Rahu", payload.chart.planets);
    const ketuPlacement = planetHouseTag("Ketu", payload.chart.planets);
    narrative = `The lunar nodes return to their natal axis around age ${Math.round(diffYears(pivot, birth))}. This is when the soul direction asserts itself — Rahu's hunger${rahuPlacement ? ` (${rahuPlacement})` : ""} pulls you forward while Ketu${ketuPlacement ? ` (${ketuPlacement})` : ""} loosens what is finished. Decisions made here often look obvious in hindsight.`;
    evidence = [
      "Cycle: ~18.6 years",
      rahuPlacement ? `Rahu: ${rahuPlacement}` : "",
      ketuPlacement ? `Ketu: ${ketuPlacement}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  const window = clampWindow(pivot, halfWidth);
  return {
    kind,
    label,
    planet,
    pivotIso: pivot.toISOString(),
    windowStartIso: window.start.toISOString(),
    windowEndIso: window.end.toISOString(),
    ageAtPivot: Math.max(0, Math.round(diffYears(pivot, birth))),
    theme,
    narrative,
    evidence,
  };
}

export function computeMajorLifeShifts(payload: ChartApiResponse): MajorLifeShift[] {
  const birth = findBirthDate(payload);
  if (!birth) return [];
  const now = new Date();
  const dashaPeriods = payload.chart.dasha?.periods ?? [];

  const candidates: Candidate[] = [];

  for (const period of dashaPeriods) {
    if (period.is_partial) continue;
    const pivot = parseDate(period.start_date);
    if (!pivot) continue;
    if (Math.abs(diffYears(pivot, birth)) < 0.5) continue;
    const candidate = describeMahadasha(period, birth, payload);
    if (candidate) candidates.push(candidate);
  }

  for (let n = 1; n <= 3; n++) {
    candidates.push(describePlanetaryReturn("saturn-return", birth, n, payload));
  }
  for (let n = 1; n <= 8; n++) {
    candidates.push(describePlanetaryReturn("jupiter-return", birth, n, payload));
  }
  for (let n = 1; n <= 5; n++) {
    candidates.push(describePlanetaryReturn("nodal-return", birth, n, payload));
  }

  const dedupedByPivot = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = `${candidate.kind}:${candidate.pivotIso.slice(0, 10)}`;
    if (!dedupedByPivot.has(key)) dedupedByPivot.set(key, candidate);
  }
  const all = Array.from(dedupedByPivot.values());

  all.sort((left, right) => {
    const lDist = Math.abs(new Date(left.pivotIso).getTime() - now.getTime());
    const rDist = Math.abs(new Date(right.pivotIso).getTime() - now.getTime());
    return lDist - rDist;
  });

  const picked = all.slice(0, 5);
  picked.sort(
    (left, right) =>
      new Date(left.pivotIso).getTime() - new Date(right.pivotIso).getTime(),
  );

  return picked.map((candidate, idx) => ({
    ...candidate,
    index: idx + 1,
    status: statusFor(
      now,
      new Date(candidate.windowStartIso),
      new Date(candidate.windowEndIso),
    ),
  }));
}
