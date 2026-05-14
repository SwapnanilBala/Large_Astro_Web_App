import { buildForecast, type ForecastReading } from "./chart-service";
import { findMuhurta, type MuhurtaActivity } from "./muhurta-engine";
import type { BirthDetailsInput } from "./compatibility-service";
import type {
  CalendarPlannerDay,
  CalendarPlannerDashaContext,
  CalendarPlannerIntent,
  CalendarPlannerIntentAdvice,
  CalendarPlannerResponse,
  CalendarPlannerWatchout,
  CalendarPlannerWindow,
} from "@/lib/astro-types";

export const CALENDAR_PLANNER_INTENTS: CalendarPlannerIntent[] = [
  "action",
  "rest",
  "communication",
  "relationships",
  "money",
  "study",
  "travel",
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PRESSURE_PLANETS = new Set(["Saturn", "Mars", "Rahu", "Ketu"]);
const SECONDARY_PRESSURE_PLANETS = new Set(["Sun"]);

const INTENT_PLANETS: Record<CalendarPlannerIntent, string[]> = {
  action: ["Mars", "Sun", "Jupiter"],
  rest: ["Moon", "Venus", "Jupiter"],
  communication: ["Mercury", "Moon", "Jupiter"],
  relationships: ["Venus", "Moon", "Jupiter"],
  money: ["Venus", "Jupiter", "Mercury"],
  study: ["Mercury", "Jupiter", "Moon"],
  travel: ["Moon", "Mercury", "Jupiter"],
};

const INTENT_KEYWORDS: Record<CalendarPlannerIntent, string[]> = {
  action: ["initiative", "drive", "career", "leadership", "effort", "momentum"],
  rest: ["rest", "healing", "reflection", "spiritual", "emotional", "home"],
  communication: ["communication", "learning", "message", "writing", "network"],
  relationships: ["relationship", "love", "partner", "family", "support"],
  money: ["money", "wealth", "finance", "resources", "business", "investment"],
  study: ["study", "education", "learning", "skill", "knowledge"],
  travel: ["travel", "journey", "movement", "foreign", "relocation"],
};

const INTENT_TO_MUHURTA: Record<CalendarPlannerIntent, MuhurtaActivity> = {
  action: "job_interview",
  rest: "spiritual_practice",
  communication: "business_start",
  relationships: "marriage",
  money: "investment",
  study: "education",
  travel: "travel",
};

export function mapIntentToMuhurtaActivity(intent: CalendarPlannerIntent): MuhurtaActivity {
  return INTENT_TO_MUHURTA[intent];
}

export function enumerateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);

  while (cursor <= end) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += MS_PER_DAY;
  }

  return dates;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function qualityForScore(score: number): CalendarPlannerIntentAdvice["quality"] {
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 45) return "fair";
  return "poor";
}

function containsAnyKeyword(text: string, keywords: string[]): boolean {
  const lowered = text.toLowerCase();
  return keywords.some((keyword) => lowered.includes(keyword));
}

function transitMatchesIntent(
  transit: ForecastReading["supportive_transits"][number],
  intent: CalendarPlannerIntent,
): boolean {
  const planets = INTENT_PLANETS[intent];
  return planets.includes(transit.transit_planet) || planets.includes(transit.natal_planet);
}

export function getDashaPressure(
  forecast: Pick<ForecastReading, "target_date" | "dasha">,
): { pressure: CalendarPlannerDashaContext["pressure"]; score: number; reasons: string[] } {
  const reasons: string[] = [];
  const dashaPlanets = [
    forecast.dasha.current_dasha,
    forecast.dasha.current_antardasha,
    forecast.dasha.current_pratyantar,
  ].filter(Boolean) as string[];

  const hardCount = dashaPlanets.filter((planet) => PRESSURE_PLANETS.has(planet)).length;
  const secondaryCount = dashaPlanets.filter((planet) => SECONDARY_PRESSURE_PLANETS.has(planet)).length;
  if (hardCount > 0) {
    reasons.push(`${dashaPlanets.filter((planet) => PRESSURE_PLANETS.has(planet)).join("/")} period pressure`);
  }
  if (secondaryCount > 0) {
    reasons.push("Sun period asks for cleaner pacing and ego checks");
  }

  const antardashaEnd = Date.parse(`${forecast.dasha.current_antardasha_end}T00:00:00Z`);
  const target = Date.parse(`${forecast.target_date}T00:00:00Z`);
  if (Number.isFinite(antardashaEnd)) {
    const daysToChange = Math.floor((antardashaEnd - target) / MS_PER_DAY);
    if (daysToChange >= 0 && daysToChange <= 14) {
      reasons.push("antardasha transition is within two weeks");
    }
  }

  const score = hardCount * 25 + secondaryCount * 10 + (reasons.some((r) => r.includes("transition")) ? 15 : 0);
  return {
    pressure: score >= 45 ? "high" : score >= 20 ? "medium" : "low",
    score,
    reasons,
  };
}

export function scoreIntentForForecast(
  intent: CalendarPlannerIntent,
  forecast: ForecastReading,
): CalendarPlannerIntentAdvice {
  const planets = INTENT_PLANETS[intent];
  const keywords = INTENT_KEYWORDS[intent];
  const dashaPressure = getDashaPressure(forecast);
  const reasons: string[] = [];
  let score = 55;

  for (const transit of forecast.supportive_transits) {
    if (transitMatchesIntent(transit, intent)) {
      score += 12;
      reasons.push(`${transit.transit_planet} supports ${transit.natal_planet}`);
    } else {
      score += 5;
    }
  }

  for (const transit of forecast.challenging_transits) {
    if (transitMatchesIntent(transit, intent)) {
      score -= 14;
      reasons.push(`${transit.transit_planet} pressures ${transit.natal_planet}`);
    } else {
      score -= 7;
    }
  }

  if (planets.includes(forecast.dasha.current_dasha)) {
    score += 8;
    reasons.push(`${forecast.dasha.current_dasha} Mahadasha favors this intent`);
  }
  if (planets.includes(forecast.dasha.current_antardasha)) {
    score += 10;
    reasons.push(`${forecast.dasha.current_antardasha} Antardasha favors this intent`);
  }

  const forecastText = [
    forecast.headline,
    forecast.overview,
    ...forecast.focus_areas,
    ...forecast.opportunities,
  ].join(" ");
  if (containsAnyKeyword(forecastText, keywords)) {
    score += 8;
    reasons.push("daily themes match this intent");
  }

  if (dashaPressure.pressure === "high") score -= 8;
  if (dashaPressure.pressure === "medium") score -= 4;

  const finalScore = clampScore(score);
  const quality = qualityForScore(finalScore);
  const summary =
    quality === "excellent" ? "Prioritize this while timing is unusually cooperative." :
    quality === "good" ? "Good fit for deliberate progress." :
    quality === "fair" ? "Usable with pacing and simpler expectations." :
    "Keep this light or defer high-stakes moves.";

  return {
    intent,
    score: finalScore,
    quality,
    summary,
    reasons: reasons.slice(0, 3),
  };
}

export function buildWatchoutForForecast(forecast: ForecastReading): CalendarPlannerWatchout | null {
  const pressure = getDashaPressure(forecast);
  const reasons = [...pressure.reasons];
  let score = pressure.score;

  for (const transit of forecast.challenging_transits) {
    const orbPressure = transit.orb <= 2 ? 30 : transit.orb <= 5 ? 22 : 14;
    score += orbPressure;
    reasons.push(`${transit.transit_planet} ${transit.aspect_type.toLowerCase()} natal ${transit.natal_planet}`);
  }

  if (score < 35) return null;

  return {
    date: forecast.target_date,
    severity: score >= 70 ? "high" : score >= 45 ? "medium" : "low",
    score: clampScore(score),
    reasons: reasons.slice(0, 4),
  };
}

function toLocalRange(startDate: string, endDate: string, timezoneOffsetMinutes: number): { start: Date; end: Date } {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T23:59:59Z`);
  return {
    start: new Date(start.getTime() - timezoneOffsetMinutes * 60000),
    end: new Date(end.getTime() - timezoneOffsetMinutes * 60000),
  };
}

function indexMuhurtaWindows(
  birth: BirthDetailsInput,
  startDate: string,
  endDate: string,
  intents: CalendarPlannerIntent[],
): Map<string, CalendarPlannerWindow[]> {
  const { start, end } = toLocalRange(startDate, endDate, birth.timezone_offset_minutes ?? 0);
  const byDate = new Map<string, CalendarPlannerWindow[]>();

  for (const intent of intents) {
    const activity = mapIntentToMuhurtaActivity(intent);
    const windows = findMuhurta(
      activity,
      start,
      end,
      birth.latitude,
      birth.longitude,
      birth.timezone_offset_minutes ?? 0,
    );

    for (const window of windows) {
      const date = window.start.slice(0, 10);
      const mapped: CalendarPlannerWindow = {
        intent,
        start: window.start,
        end: window.end,
        score: window.score,
        quality: window.quality,
        recommendation: window.recommendation,
      };
      byDate.set(date, [...(byDate.get(date) ?? []), mapped]);
    }
  }

  for (const [date, windows] of byDate.entries()) {
    byDate.set(date, windows.sort((a, b) => b.score - a.score).slice(0, 6));
  }

  return byDate;
}

export function buildWeeklyDashaContext(
  dates: string[],
  forecasts: ForecastReading[],
): CalendarPlannerDashaContext[] {
  const contexts: CalendarPlannerDashaContext[] = [];

  for (let i = 0; i < dates.length; i += 7) {
    const weekDates = dates.slice(i, i + 7);
    const forecast = forecasts[i];
    if (!forecast) continue;
    const pressure = getDashaPressure(forecast);

    contexts.push({
      week_start: weekDates[0],
      week_end: weekDates[weekDates.length - 1],
      current_dasha: forecast.dasha.current_dasha,
      current_antardasha: forecast.dasha.current_antardasha,
      current_dasha_start: forecast.dasha.current_dasha_start,
      current_dasha_end: forecast.dasha.current_dasha_end,
      current_antardasha_start: forecast.dasha.current_antardasha_start,
      current_antardasha_end: forecast.dasha.current_antardasha_end,
      pressure: pressure.pressure,
      summary: `${forecast.dasha.current_dasha} Mahadasha with ${forecast.dasha.current_antardasha} Antardasha frames this week; pressure reads ${pressure.pressure}.`,
    });
  }

  return contexts;
}

export interface CalendarPlannerBuildInput extends BirthDetailsInput {
  start_date: string;
  end_date: string;
  intent?: CalendarPlannerIntent;
}

export function buildCalendarPlanner(input: CalendarPlannerBuildInput): CalendarPlannerResponse {
  const { start_date, end_date, intent, ...birth } = input;
  const intents = intent ? [intent] : CALENDAR_PLANNER_INTENTS;
  const dates = enumerateDateRange(start_date, end_date);
  const forecasts = dates.map((date) => buildForecast(birth, date));
  const windowsByDate = indexMuhurtaWindows(birth, start_date, end_date, intents);

  const days: CalendarPlannerDay[] = forecasts.map((forecast) => {
    const pressure = getDashaPressure(forecast);
    return {
      date: forecast.target_date,
      headline: forecast.headline,
      overview: forecast.overview,
      intents: intents.map((plannerIntent) => scoreIntentForForecast(plannerIntent, forecast)),
      watchout: buildWatchoutForForecast(forecast) ?? undefined,
      muhurta_windows: windowsByDate.get(forecast.target_date) ?? [],
      dasha: {
        current_dasha: forecast.dasha.current_dasha,
        current_antardasha: forecast.dasha.current_antardasha,
        pressure: pressure.pressure,
      },
    };
  });

  const watchouts = days
    .map((day) => day.watchout)
    .filter((watchout): watchout is CalendarPlannerWatchout => Boolean(watchout));

  return {
    generated_at_utc: new Date().toISOString(),
    client: {
      name: birth.name,
      latitude: birth.latitude,
      longitude: birth.longitude,
      timezone_offset_minutes: birth.timezone_offset_minutes,
      country: birth.country,
      state: birth.state,
      city: birth.city,
      town: birth.town,
      time_zone_id: birth.time_zone_id,
    },
    search_window: {
      start_date,
      end_date,
      day_count: dates.length,
    },
    requested_intent: intent,
    intents,
    weekly_dasha_context: buildWeeklyDashaContext(dates, forecasts),
    watchouts,
    days,
  };
}
