"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { VarshaphalResult } from "@/lib/engines/varshaphal-engine";
import { buildBirthProfileApiUrl } from "@/lib/chart-query";
import { useRouteMessages } from "@/lib/i18n-context";
import timingMessages from "@/messages/en.timing.json";
import styles from "./varshaphal-panel.module.css";

type VarshaphalPanelProps = {
  queryString: string;
  birthDate: string;
};

type Translator = (key: string, params?: Record<string, string>) => string;

const TIMEOUT_MS = 45_000;

/* Keys rather than labels, in month order — the index is the calendar month,
   so the array cannot be reordered. */
const MONTH_LABEL_KEYS = [
  "timing.varshaphal.months.jan",
  "timing.varshaphal.months.feb",
  "timing.varshaphal.months.mar",
  "timing.varshaphal.months.apr",
  "timing.varshaphal.months.may",
  "timing.varshaphal.months.jun",
  "timing.varshaphal.months.jul",
  "timing.varshaphal.months.aug",
  "timing.varshaphal.months.sep",
  "timing.varshaphal.months.oct",
  "timing.varshaphal.months.nov",
  "timing.varshaphal.months.dec",
];
const HOUSE_TIMELINE_KEYS: Record<number, string> = {
  1: "timing.varshaphal.houseThemes.1",
  2: "timing.varshaphal.houseThemes.2",
  3: "timing.varshaphal.houseThemes.3",
  4: "timing.varshaphal.houseThemes.4",
  5: "timing.varshaphal.houseThemes.5",
  6: "timing.varshaphal.houseThemes.6",
  7: "timing.varshaphal.houseThemes.7",
  8: "timing.varshaphal.houseThemes.8",
  9: "timing.varshaphal.houseThemes.9",
  10: "timing.varshaphal.houseThemes.10",
  11: "timing.varshaphal.houseThemes.11",
  12: "timing.varshaphal.houseThemes.12",
};

/* Translated at render, not when the request fails, so a language change
   carries the message with it. */
type VarshaphalError =
  | { kind: "api"; status: string }
  | { kind: "apiMessage"; text: string }
  | { kind: "timeout" }
  | { kind: "loadFailed" };

function varshaphalErrorText(error: VarshaphalError, tr: Translator): string {
  switch (error.kind) {
    case "api":
      return tr("timing.varshaphal.apiError", { status: error.status });
    case "apiMessage":
      return error.text;
    case "timeout":
      return tr("timing.varshaphal.timeoutMessage");
    default:
      return tr("timing.varshaphal.loadFailed");
  }
}

/** "H7" and friends — the abbreviation is copy, so it comes from the catalog. */
function houseShort(house: number, tr: Translator): string {
  return tr("timing.varshaphal.houseShort", { house: String(house) });
}

type TimelineTone = "setup" | "growth" | "peak" | "review";

type TimelineMonth = {
  month: string;
  title: string;
  note: string;
  tone: TimelineTone;
};

type SeasonalForecast = {
  label: string;
  phase: string;
  focus: string;
  guidance: string;
  tone: TimelineTone;
};

type TimingWindow = {
  month: string;
  title: string;
  note: string;
};

type WeatherMeter = {
  label: string;
  score: number;
  trend: "rising" | "steady" | "review";
  note: string;
};

/* `trend` doubles as a CSS-module class suffix, so it stays an id and the copy
   is looked up here. */
const TREND_KEYS: Record<WeatherMeter["trend"], string> = {
  rising: "timing.varshaphal.weather.trendRising",
  steady: "timing.varshaphal.weather.trendSteady",
  review: "timing.varshaphal.weather.trendReview",
};

function buildVarshaphalUrl(queryString: string, targetYear: number): string {
  return buildBirthProfileApiUrl("/api/varshaphal", window.location.origin, queryString, {
    target_year: targetYear,
  });
}

function formatReturnMoment(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function wrapMonth(index: number): number {
  return ((index % 12) + 12) % 12;
}

function joinThemes(themes: string[], tr: Translator): string {
  return themes.join(tr("timing.varshaphal.andSeparator"));
}

function buildYearTimeline(data: VarshaphalResult, tr: Translator): TimelineMonth[] {
  const returnMonth = wrapMonth(new Date(data.solarReturnMoment).getMonth());
  const activatedHouse = data.profection.activatedHouse;
  const munthaHouse = data.muntha.house;
  const actionMonths = new Set(
    [activatedHouse, munthaHouse, 10].map((house) => wrapMonth(returnMonth + house - 1))
  );

  return MONTH_LABEL_KEYS.map((monthKey, index) => {
    const month = tr(monthKey);
    const distanceFromReturn = wrapMonth(index - returnMonth);
    const house = ((activatedHouse + distanceFromReturn - 1) % 12) + 1;
    const houseTheme = tr(
      HOUSE_TIMELINE_KEYS[house] ?? "timing.varshaphal.houseThemes.fallback"
    );

    if (index === returnMonth) {
      return {
        month,
        title: tr("timing.varshaphal.timeline.solarReturn"),
        note: tr("timing.varshaphal.timeline.solarReturnNote", {
          sign: data.returnChart.ascendant.sign,
        }),
        tone: "peak",
      };
    }

    if (index === wrapMonth(returnMonth + 3) || index === wrapMonth(returnMonth + 9)) {
      return {
        month,
        title: tr("timing.varshaphal.timeline.courseCorrect"),
        note: tr("timing.varshaphal.timeline.courseCorrectNote", { theme: houseTheme }),
        tone: "review",
      };
    }

    if (actionMonths.has(index)) {
      return {
        month,
        title: tr("timing.varshaphal.timeline.visibleMovement"),
        note: tr("timing.varshaphal.timeline.visibleMovementNote", { theme: houseTheme }),
        tone: "growth",
      };
    }

    return {
      month,
      title: houseTheme,
      note: tr("timing.varshaphal.timeline.steadyNote", { house: String(house) }),
      tone: "setup",
    };
  });
}

function getAnnualTheme(data: VarshaphalResult, tr: Translator): string {
  const themes = joinThemes(data.profection.themes.slice(0, 2), tr).toLowerCase();
  return tr("timing.varshaphal.hero.theme", {
    planet: data.varshesh.planet,
    house: String(data.profection.activatedHouse),
    themes: themes || tr("timing.varshaphal.hero.themesFallback"),
  });
}

function AnnualThemeHero({ data }: { data: VarshaphalResult }) {
  const tr = useRouteMessages(timingMessages);

  return (
    <section className={styles.themeHero} aria-labelledby="annual-compass-title">
      <div className={styles.themeHeroCopy}>
        <span className={styles.eyebrow}>{tr("timing.varshaphal.hero.eyebrow")}</span>
        <h3 id="annual-compass-title">{getAnnualTheme(data, tr)}</h3>
        <p>{data.yearSummary.yearLordInterpretation}</p>
        <span className={styles.cycleLabel}>
          {tr("timing.varshaphal.hero.cycle", {
            from: String(data.year),
            to: String(data.year + 1),
          })}
        </span>
      </div>
      <div
        className={styles.themeStats}
        aria-label={tr("timing.varshaphal.hero.highlightsLabel", { year: String(data.year) })}
      >
        <div className={styles.themeStat}>
          <span>{tr("timing.varshaphal.hero.profection")}</span>
          <strong>{houseShort(data.profection.activatedHouse, tr)}</strong>
          <small>
            {tr("timing.varshaphal.hero.signAge", {
              sign: data.profection.activatedSign,
              age: String(data.profection.age),
            })}
          </small>
        </div>
        <div className={styles.themeStat}>
          <span>{tr("timing.varshaphal.hero.muntha")}</span>
          <strong>{houseShort(data.muntha.house, tr)}</strong>
          <small>{data.muntha.sign}</small>
        </div>
        <div className={styles.themeStat}>
          <span>{tr("timing.varshaphal.hero.yearLord")}</span>
          <strong>{data.varshesh.planet}</strong>
          <small>{data.varshesh.reason}</small>
        </div>
      </div>
    </section>
  );
}

function YearInFocus({ data }: { data: VarshaphalResult }) {
  const tr = useRouteMessages(timingMessages);
  const themes =
    joinThemes(data.profection.themes.slice(0, 2), tr).toLowerCase() ||
    tr("timing.varshaphal.yearInFocus.themesFallback");

  return (
    <section className={styles.overviewCard} aria-labelledby="year-in-focus-title">
      <div className={styles.overviewHeader}>
        <div>
          <span className={styles.eyebrow}>{tr("timing.varshaphal.yearInFocus.eyebrow")}</span>
          <h3 id="year-in-focus-title">{tr("timing.varshaphal.yearInFocus.title")}</h3>
        </div>
        <p>{data.yearSummary.ascendantComparison}</p>
      </div>
      <div className={styles.summaryCards}>
        <article className={styles.summaryCard}>
          <span>{tr("timing.varshaphal.yearInFocus.themeLabel")}</span>
          <strong>
            {tr("timing.varshaphal.yearInFocus.themeValue", {
              house: String(data.profection.activatedHouse),
              themes,
            })}
          </strong>
          <p>{tr("timing.varshaphal.yearInFocus.themeNote")}</p>
        </article>
        <article className={styles.summaryCard}>
          <span>{tr("timing.varshaphal.yearInFocus.bestUseLabel")}</span>
          <strong>
            {tr("timing.varshaphal.yearInFocus.bestUseValue", { planet: data.varshesh.planet })}
          </strong>
          <p>{data.yearSummary.yearLordInterpretation}</p>
        </article>
        <article className={styles.summaryCard}>
          <span>{tr("timing.varshaphal.yearInFocus.keepInMindLabel")}</span>
          <strong>{tr("timing.varshaphal.yearInFocus.keepInMindValue")}</strong>
          <p>{data.yearSummary.emotionalTone}</p>
        </article>
      </div>
    </section>
  );
}

type FocusCard = {
  title: string;
  source: string;
  detail: string;
  prompt: string;
};

function buildFocusCards(data: VarshaphalResult, tr: Translator): FocusCard[] {
  const themes =
    joinThemes(data.profection.themes.slice(0, 2), tr).toLowerCase() ||
    tr("timing.varshaphal.focusAreas.themesFallback");
  const cards: FocusCard[] = [
    {
      title: tr("timing.varshaphal.focusAreas.profectionTitle", {
        house: String(data.profection.activatedHouse),
        themes,
      }),
      source: tr("timing.varshaphal.focusAreas.profectionSource"),
      detail: tr("timing.varshaphal.focusAreas.profectionDetail", {
        sign: data.profection.activatedSign,
        lord: data.profection.lordOfYear,
      }),
      prompt: tr("timing.varshaphal.focusAreas.profectionPrompt"),
    },
    {
      title: tr("timing.varshaphal.focusAreas.munthaTitle", {
        house: String(data.muntha.house),
      }),
      source: tr("timing.varshaphal.focusAreas.munthaSource"),
      detail: tr("timing.varshaphal.focusAreas.munthaDetail", { sign: data.muntha.sign }),
      prompt: tr("timing.varshaphal.focusAreas.munthaPrompt"),
    },
  ];

  if (data.profection.activatedPlanets.length > 0) {
    cards.push({
      title: tr("timing.varshaphal.focusAreas.activatedTitle", {
        planets: joinThemes(data.profection.activatedPlanets, tr),
      }),
      source: tr("timing.varshaphal.focusAreas.activatedSource"),
      detail: tr("timing.varshaphal.focusAreas.activatedDetail", {
        sign: data.profection.activatedSign,
      }),
      prompt: tr("timing.varshaphal.focusAreas.activatedPrompt"),
    });
  } else {
    cards.push({
      title: tr("timing.varshaphal.focusAreas.yearLordTitle", { planet: data.varshesh.planet }),
      source: tr("timing.varshaphal.focusAreas.yearLordSource"),
      detail: data.varshesh.reason,
      prompt: tr("timing.varshaphal.focusAreas.yearLordPrompt"),
    });
  }

  return cards;
}

function FocusAreas({ data }: { data: VarshaphalResult }) {
  const tr = useRouteMessages(timingMessages);

  return (
    <section className={styles.prioritySection} aria-labelledby="focus-areas-title">
      <div className={styles.priorityHeader}>
        <span className={styles.eyebrow}>{tr("timing.varshaphal.focusAreas.eyebrow")}</span>
        <h3 id="focus-areas-title">{tr("timing.varshaphal.focusAreas.title")}</h3>
      </div>
      <div className={styles.priorityGrid}>
        {buildFocusCards(data, tr).map((item, index) => (
          <article key={item.source} className={styles.priorityCard}>
            <span className={styles.priorityNumber}>{String(index + 1).padStart(2, "0")}</span>
            <span className={styles.sourceLabel}>{item.source}</span>
            <h4>{item.title}</h4>
            <p>{item.detail}</p>
            <small>{item.prompt}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

type MajorForce = {
  planet: string;
  label: string;
  placement: string;
  detail: string;
};

function buildMajorForces(data: VarshaphalResult, tr: Translator): MajorForce[] {
  const placements = data.returnChart.planets;
  const seen = new Set<string>();
  const forces: MajorForce[] = [];
  const addForce = (planet: string, label: string, detail: string) => {
    const placement = placements.find((item) => item.name === planet);
    if (!placement || seen.has(planet)) return;
    seen.add(planet);
    forces.push({
      planet,
      label,
      placement: tr("timing.varshaphal.forces.placement", {
        sign: placement.sign,
        house: String(placement.house),
        degree: placement.degree_in_sign.toFixed(1),
      }),
      detail,
    });
  };

  addForce(
    data.varshesh.planet,
    tr("timing.varshaphal.forces.yearLord"),
    tr("timing.varshaphal.forces.yearLordDetail", { planet: data.varshesh.planet }),
  );

  const moon = placements.find((planet) => planet.name === "Moon");
  if (moon) {
    addForce(
      "Moon",
      tr("timing.varshaphal.forces.emotionalClimate"),
      tr("timing.varshaphal.forces.moonDetail", { house: String(moon.house) }),
    );
  }

  placements
    .filter((planet) => [1, 4, 7, 10].includes(planet.house))
    .forEach((planet) => {
      addForce(
        planet.name,
        tr("timing.varshaphal.forces.angular", { house: String(planet.house) }),
        tr("timing.varshaphal.forces.angularDetail"),
      );
    });

  return forces.slice(0, 4);
}

function MajorForces({ data }: { data: VarshaphalResult }) {
  const tr = useRouteMessages(timingMessages);

  return (
    <section className={styles.forceSection} aria-labelledby="major-forces-title">
      <div className={styles.priorityHeader}>
        <span className={styles.eyebrow}>{tr("timing.varshaphal.forces.eyebrow")}</span>
        <h3 id="major-forces-title">{tr("timing.varshaphal.forces.title")}</h3>
      </div>
      <div className={styles.forceGrid}>
        {buildMajorForces(data, tr).map((force) => (
          <article key={force.planet} className={styles.forceCard}>
            <span className={styles.sourceLabel}>{force.label}</span>
            <h4>{force.planet}</h4>
            <strong>{force.placement}</strong>
            <p>{force.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function buildSeasonalForecasts(data: VarshaphalResult, tr: Translator): SeasonalForecast[] {
  const timeline = buildYearTimeline(data, tr);
  const strongestInfluence = data.yearSummary.strongInfluences[0] ?? data.yearSummary.ascendantComparison;
  const focusArea = data.yearSummary.focusAreas[0] ?? data.yearSummary.emotionalTone;
  const quarters = [
    {
      label: tr("timing.varshaphal.seasons.q1Label"),
      phase: tr("timing.varshaphal.seasons.q1Phase"),
      months: timeline.slice(0, 3),
      guidance: tr("timing.varshaphal.seasons.q1Guidance"),
    },
    {
      label: tr("timing.varshaphal.seasons.q2Label"),
      phase: tr("timing.varshaphal.seasons.q2Phase"),
      months: timeline.slice(3, 6),
      guidance: tr("timing.varshaphal.seasons.q2Guidance"),
    },
    {
      label: tr("timing.varshaphal.seasons.q3Label"),
      phase: tr("timing.varshaphal.seasons.q3Phase"),
      months: timeline.slice(6, 9),
      guidance: tr("timing.varshaphal.seasons.q3Guidance"),
    },
    {
      label: tr("timing.varshaphal.seasons.q4Label"),
      phase: tr("timing.varshaphal.seasons.q4Phase"),
      months: timeline.slice(9, 12),
      guidance: tr("timing.varshaphal.seasons.q4Guidance"),
    },
  ];

  return quarters.map((quarter, index) => {
    const peakMonth = quarter.months.find((month) => month.tone === "peak" || month.tone === "growth") ?? quarter.months[0];
    return {
      label: quarter.label,
      phase: quarter.phase,
      focus: index % 2 === 0 ? focusArea : strongestInfluence,
      guidance: tr("timing.varshaphal.seasons.guidance", {
        month: peakMonth.month,
        title: peakMonth.title,
        guidance: quarter.guidance,
      }),
      tone: peakMonth.tone,
    };
  });
}

function SeasonalForecastCards({ data }: { data: VarshaphalResult }) {
  const tr = useRouteMessages(timingMessages);

  return (
    <div className={styles.seasonGrid}>
      {buildSeasonalForecasts(data, tr).map((season) => (
        <article
          key={season.label}
          className={`${styles.seasonCard} ${styles[`seasonCard${season.tone[0].toUpperCase()}${season.tone.slice(1)}`]}`}
        >
          <div className={styles.seasonTopline}>
            <span>{season.label}</span>
            <strong>{season.phase}</strong>
          </div>
          <p>{season.focus}</p>
          <small>{season.guidance}</small>
        </article>
      ))}
    </div>
  );
}

function buildTimingWindows(
  data: VarshaphalResult,
  tr: Translator,
): { best: TimingWindow[]; watch: TimingWindow[] } {
  const timeline = buildYearTimeline(data, tr);
  const best = timeline
    .filter((month) => month.tone === "peak" || month.tone === "growth")
    .slice(0, 4)
    .map((month) => ({
      month: month.month,
      title: month.title,
      note: month.tone === "peak"
        ? tr("timing.varshaphal.windows.launchNote", {
            sign: data.returnChart.ascendant.sign,
          })
        : month.note,
    }));

  const watch = timeline
    .filter((month) => month.tone === "review")
    .slice(0, 3)
    .map((month) => ({
      month: month.month,
      title: month.title,
      note: tr("timing.varshaphal.windows.watchNote", { note: month.note }),
    }));

  if (watch.length < 3) {
    watch.push({
      month: timeline[11].month,
      title: tr("timing.varshaphal.windows.closeLoops"),
      note: tr("timing.varshaphal.windows.closeLoopsNote"),
    });
  }

  return { best, watch };
}

function TimingWindows({ data }: { data: VarshaphalResult }) {
  const tr = useRouteMessages(timingMessages);
  const windows = buildTimingWindows(data, tr);
  return (
    <div className={styles.windowsGrid}>
      <div className={styles.windowColumn}>
        <div className={styles.windowColumnHeader}>
          <span className={styles.windowSignalBest} aria-hidden="true" />
          <h3>{tr("timing.varshaphal.windows.best")}</h3>
        </div>
        {windows.best.map((window) => (
          <article key={`${window.month}-${window.title}`} className={styles.windowCard}>
            <span>{window.month}</span>
            <strong>{window.title}</strong>
            <p>{window.note}</p>
          </article>
        ))}
      </div>
      <div className={styles.windowColumn}>
        <div className={styles.windowColumnHeader}>
          <span className={styles.windowSignalWatch} aria-hidden="true" />
          <h3>{tr("timing.varshaphal.windows.watch")}</h3>
        </div>
        {windows.watch.map((window) => (
          <article key={`${window.month}-${window.title}`} className={`${styles.windowCard} ${styles.windowCardWatch}`}>
            <span>{window.month}</span>
            <strong>{window.title}</strong>
            <p>{window.note}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function clampScore(score: number): number {
  return Math.max(35, Math.min(96, score));
}

function scoreDomain(data: VarshaphalResult, houses: number[], planets: string[]): number {
  let score = 52;
  if (houses.includes(data.profection.activatedHouse)) score += 18;
  if (houses.includes(data.muntha.house)) score += 14;
  score += data.returnChart.planets.filter((planet) => houses.includes(planet.house)).length * 4;
  score += data.returnChart.planets.filter((planet) => planets.includes(planet.name)).length * 3;
  if (planets.includes(data.varshesh.planet)) score += 8;
  return clampScore(score);
}

function buildWeatherMeters(data: VarshaphalResult, tr: Translator): WeatherMeter[] {
  /* `houses` and `planets` are engine identifiers, not copy. */
  const configs = [
    { labelKey: "timing.varshaphal.weather.careerLabel", noteKey: "timing.varshaphal.weather.careerNote", houses: [10, 6, 11], planets: ["Sun", "Saturn", "Mars"] },
    { labelKey: "timing.varshaphal.weather.moneyLabel", noteKey: "timing.varshaphal.weather.moneyNote", houses: [2, 8, 11], planets: ["Venus", "Jupiter", "Mercury"] },
    { labelKey: "timing.varshaphal.weather.relationshipsLabel", noteKey: "timing.varshaphal.weather.relationshipsNote", houses: [5, 7], planets: ["Venus", "Moon", "Jupiter"] },
    { labelKey: "timing.varshaphal.weather.healthLabel", noteKey: "timing.varshaphal.weather.healthNote", houses: [1, 6, 12], planets: ["Moon", "Mars", "Saturn"] },
    { labelKey: "timing.varshaphal.weather.innerGrowthLabel", noteKey: "timing.varshaphal.weather.innerGrowthNote", houses: [4, 8, 9, 12], planets: ["Moon", "Jupiter", "Saturn", "Ketu"] },
  ];

  return configs.map((config) => {
    const score = scoreDomain(data, config.houses, config.planets);
    return {
      label: tr(config.labelKey),
      score,
      trend: score >= 76 ? "rising" : score >= 58 ? "steady" : "review",
      note: tr(config.noteKey),
    };
  });
}

function PlanetaryWeatherMeters({ data }: { data: VarshaphalResult }) {
  const tr = useRouteMessages(timingMessages);

  return (
    <div className={styles.weatherPanel}>
      <div className={styles.weatherHeader}>
        <span className={styles.eyebrow}>{tr("timing.varshaphal.weather.eyebrow")}</span>
        <h3>{tr("timing.varshaphal.weather.title")}</h3>
      </div>
      <div className={styles.weatherGrid}>
        {buildWeatherMeters(data, tr).map((meter) => (
          <article key={meter.label} className={styles.weatherMeter}>
            <div className={styles.weatherMeterTop}>
              <strong>{meter.label}</strong>
              <span className={styles[`weatherTrend${meter.trend[0].toUpperCase()}${meter.trend.slice(1)}`]}>
                {tr(TREND_KEYS[meter.trend])}
              </span>
            </div>
            <div
              className={styles.weatherTrack}
              aria-label={tr("timing.varshaphal.weather.trackLabel", {
                label: meter.label,
                score: String(meter.score),
              })}
            >
              <span style={{ width: `${meter.score}%` }} />
            </div>
            <p>{meter.note}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

/** Generate year options from birth year to current + 5. */
function yearRange(birthDate: string): number[] {
  const [birthYear] = birthDate.split("-").map(Number);
  const currentYear = new Date().getFullYear();
  const endYear = currentYear + 5;
  const years: number[] = [];
  for (let y = birthYear; y <= endYear; y++) {
    years.push(y);
  }
  return years;
}

// --------------------------------------------------------------------------
// Profection Wheel SVG
// --------------------------------------------------------------------------

function ProfectionWheel({
  activatedHouse,
  signs,
  age,
}: {
  activatedHouse: number;
  signs: Record<number, string>;
  age: number;
}) {
  const tr = useRouteMessages(timingMessages);
  const cx = 50;
  const cy = 50;
  const outerR = 42;
  const innerR = 18;
  const [selectedHouse, setSelectedHouse] = useState(activatedHouse);

  useEffect(() => {
    setSelectedHouse(activatedHouse);
  }, [activatedHouse]);

  const segments: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];

  for (let i = 0; i < 12; i++) {
    const houseNum = i + 1;
    const startAngle = (i * 30 - 90) * (Math.PI / 180);
    const endAngle = ((i + 1) * 30 - 90) * (Math.PI / 180);
    const midAngle = ((i + 0.5) * 30 - 90) * (Math.PI / 180);

    const isActive = houseNum === activatedHouse;
    const isSelected = houseNum === selectedHouse;

    // Outer arc points
    const ox1 = cx + outerR * Math.cos(startAngle);
    const oy1 = cy + outerR * Math.sin(startAngle);
    const ox2 = cx + outerR * Math.cos(endAngle);
    const oy2 = cy + outerR * Math.sin(endAngle);

    // Inner arc points
    const ix1 = cx + innerR * Math.cos(startAngle);
    const iy1 = cy + innerR * Math.sin(startAngle);
    const ix2 = cx + innerR * Math.cos(endAngle);
    const iy2 = cy + innerR * Math.sin(endAngle);

    const path = [
      `M ${ix1} ${iy1}`,
      `L ${ox1} ${oy1}`,
      `A ${outerR} ${outerR} 0 0 1 ${ox2} ${oy2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerR} ${innerR} 0 0 0 ${ix1} ${iy1}`,
      "Z",
    ].join(" ");

    segments.push(
      <path
        key={`seg-${houseNum}`}
        d={path}
        className={
          isActive
            ? styles.wheelSegmentActive
            : isSelected
              ? styles.wheelSegmentSelected
              : styles.wheelSegment
        }
        role="button"
        tabIndex={0}
        aria-label={tr(
          isActive
            ? "timing.varshaphal.wheel.segmentLabelActive"
            : "timing.varshaphal.wheel.segmentLabel",
          {
            house: String(houseNum),
            sign: signs[houseNum] ?? tr("timing.varshaphal.wheel.signUnavailable"),
          }
        )}
        onClick={() => setSelectedHouse(houseNum)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedHouse(houseNum);
          }
        }}
      />
    );

    // Label at midpoint of segment
    const labelR = (outerR + innerR) / 2 + 1;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);

    const sign = signs[houseNum] ?? "";
    // Abbreviate sign to 3 letters
    const abbrev = sign.slice(0, 3);

    labels.push(
      <text
        key={`lbl-${houseNum}`}
        x={lx}
        y={ly - 1.5}
        className={isActive || isSelected ? styles.wheelLabelActive : styles.wheelLabel}
      >
        {houseNum}
      </text>
    );
    labels.push(
      <text
        key={`sign-${houseNum}`}
        x={lx}
        y={ly + 2}
        className={isActive || isSelected ? styles.wheelLabelActive : styles.wheelLabel}
        style={{ fontSize: isActive || isSelected ? "2.8px" : "2.5px" }}
      >
        {abbrev}
      </text>
    );
  }

  const yearsUntilSelected = (selectedHouse - activatedHouse + 12) % 12;
  const selectedAge = age + yearsUntilSelected;

  return (
    <div className={styles.wheelWrapper}>
      <svg viewBox="0 0 100 100" className={styles.wheel} aria-describedby="profection-wheel-help">
        <title>{tr("timing.varshaphal.wheel.svgTitle")}</title>
        {segments}
        {labels}
        <text x={cx} y={cy - 2} className={styles.wheelCenter}>
          {houseShort(selectedHouse, tr)}
        </text>
        <text x={cx} y={cy + 3} className={styles.wheelCenterSub}>
          {selectedHouse === activatedHouse
            ? tr("timing.varshaphal.wheel.activeNow")
            : tr("timing.varshaphal.wheel.age", { age: String(selectedAge) })}
        </text>
      </svg>
      <p id="profection-wheel-help" className={styles.wheelHint}>
        {selectedHouse === activatedHouse
          ? tr("timing.varshaphal.wheel.hintActive", { house: String(activatedHouse) })
          : tr("timing.varshaphal.wheel.hintSelected", {
              house: String(selectedHouse),
              age: String(selectedAge),
            })}
      </p>
    </div>
  );
}

const RETURN_PLANET_ORDER = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];

/*
 * Placement badges, as ids rather than sentences.
 *
 * The ranking below reads these to decide which planet leads the list, so they
 * have to be stable across languages — comparing translated display text would
 * silently reorder the cards the moment the interface stopped being English.
 */
type PlacementLabelId =
  | "yearLord"
  | "emotionalClimate"
  | "angular"
  | "solarReturnSun"
  | "returnPlacement";

type PlacementLabel = { id: PlacementLabelId; house?: number };

const PLACEMENT_LABEL_KEYS: Record<PlacementLabelId, string> = {
  yearLord: "timing.varshaphal.placements.yearLord",
  emotionalClimate: "timing.varshaphal.placements.emotionalClimate",
  angular: "timing.varshaphal.placements.angular",
  solarReturnSun: "timing.varshaphal.placements.solarReturnSun",
  returnPlacement: "timing.varshaphal.placements.returnPlacement",
};

function getPlacementLabels(
  planet: VarshaphalResult["returnChart"]["planets"][number],
  data: VarshaphalResult,
): PlacementLabel[] {
  const labels: PlacementLabel[] = [];
  if (planet.name === data.varshesh.planet) labels.push({ id: "yearLord" });
  if (planet.name === "Moon") labels.push({ id: "emotionalClimate" });
  if ([1, 4, 7, 10].includes(planet.house)) labels.push({ id: "angular", house: planet.house });
  if (planet.name === "Sun") labels.push({ id: "solarReturnSun" });
  return labels.length > 0 ? labels : [{ id: "returnPlacement" }];
}

function placementLabelText(label: PlacementLabel, tr: Translator): string {
  if (label.id === "angular") {
    return tr(PLACEMENT_LABEL_KEYS.angular, {
      house: houseShort(label.house ?? 0, tr),
    });
  }
  return tr(PLACEMENT_LABEL_KEYS[label.id]);
}

function KeyReturnPlacements({ data }: { data: VarshaphalResult }) {
  const tr = useRouteMessages(timingMessages);
  const placements = data.returnChart.planets
    .filter((planet) => RETURN_PLANET_ORDER.includes(planet.name))
    .sort((left, right) => {
      const leftLabels = getPlacementLabels(left, data);
      const rightLabels = getPlacementLabels(right, data);
      const score = (labels: PlacementLabel[]) =>
        labels.some((label) => label.id === "yearLord") ? 0 : labels.some((label) => label.id === "emotionalClimate") ? 1 : labels.some((label) => label.id === "angular") ? 2 : labels.some((label) => label.id === "solarReturnSun") ? 3 : 4;
      return score(leftLabels) - score(rightLabels);
    });

  return (
    <div className={styles.placementContent}>
      <p className={styles.sectionIntro}>{tr("timing.varshaphal.placements.intro")}</p>
      <div className={styles.placementGrid}>
        {placements.slice(0, 4).map((planet) => {
          const labels = getPlacementLabels(planet, data);
          return (
            <article key={planet.name} className={styles.placementCard}>
              <span className={styles.sourceLabel}>{placementLabelText(labels[0], tr)}</span>
              <h4>{planet.name}</h4>
              <strong>
                {tr("timing.varshaphal.placements.signHouse", {
                  sign: planet.sign,
                  house: String(planet.house),
                })}
              </strong>
              <p>
                {planet.degree_in_sign.toFixed(1)}° {planet.is_retrograde ? tr("timing.varshaphal.placements.retrograde") : ""}
                {labels.length > 1
                  ? ` · ${labels.slice(1).map((label) => placementLabelText(label, tr)).join(" · ")}`
                  : ""}
              </p>
            </article>
          );
        })}
      </div>
      <details className={styles.allPlacements}>
        <summary>{tr("timing.varshaphal.placements.viewAll")}</summary>
        <div className={styles.placementTable}>
          {placements.map((planet) => (
            <div key={planet.name} className={styles.placementRow}>
              <strong>{planet.name}</strong>
              <span>{planet.sign}</span>
              <span>{houseShort(planet.house, tr)}</span>
              <span>{planet.degree_in_sign.toFixed(1)}°</span>
              <span>
                {planet.is_retrograde
                  ? tr("timing.varshaphal.placements.retrogradeLabel")
                  : tr("timing.varshaphal.placements.directLabel")}
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

// --------------------------------------------------------------------------
// Main Panel
// --------------------------------------------------------------------------

export default function VarshaphalPanel({ queryString, birthDate }: VarshaphalPanelProps) {
  const tr = useRouteMessages(timingMessages);
  const currentYear = new Date().getFullYear();
  const years = yearRange(birthDate);
  const minYear = years[0] ?? currentYear;
  const maxYear = years[years.length - 1] ?? currentYear;

  const [targetYear, setTargetYear] = useState(currentYear);
  const [data, setData] = useState<VarshaphalResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<VarshaphalError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadData = useCallback(
    async (year: number) => {
      abortRef.current?.abort();
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const res = await fetch(buildVarshaphalUrl(queryString, year), {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const message = body?.error?.message;
          setData(null);
          setError(
            typeof message === "string" && message
              ? { kind: "apiMessage", text: message }
              : { kind: "api", status: String(res.status) }
          );
          return;
        }
        const json = (await res.json()) as VarshaphalResult;
        setData(json);
      } catch (err) {
        clearTimeout(timeout);
        setData(null);
        if (err instanceof DOMException && err.name === "AbortError") {
          setError({ kind: "timeout" });
        } else {
          setError(
            err instanceof Error
              ? { kind: "apiMessage", text: err.message }
              : { kind: "loadFailed" }
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [queryString],
  );

  useEffect(() => {
    void loadData(targetYear);
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const chooseYear = (year: number) => {
    const nextYear = Math.min(maxYear, Math.max(minYear, year));
    setTargetYear(nextYear);
    void loadData(nextYear);
  };

  const quickYears = Array.from(
    new Set([targetYear - 1, targetYear, targetYear + 1, currentYear, currentYear + 1])
  )
    .filter((year) => year >= minYear && year <= maxYear)
    .sort((a, b) => a - b);

  // Build house->sign map for the wheel
  const houseSignMap: Record<number, string> = {};
  if (data) {
    for (const h of data.returnChart.houses) {
      houseSignMap[h.house_number] = h.sign;
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.kicker}>{tr("timing.varshaphal.kicker")}</p>
        <h2 className={styles.heading}>{tr("timing.varshaphal.heading")}</h2>
      </div>
      <p className={styles.intro}>{tr("timing.varshaphal.intro")}</p>

      {/* Year selector */}
      <form
        className={styles.yearForm}
        onSubmit={(e) => {
          e.preventDefault();
          void loadData(targetYear);
        }}
      >
        <div className={styles.yearStepper} aria-label={tr("timing.varshaphal.yearControlsLabel")}>
          <button
            type="button"
            className={styles.yearStepBtn}
            onClick={() => chooseYear(targetYear - 1)}
            disabled={isLoading || targetYear <= minYear}
            aria-label={tr("timing.varshaphal.prevYear")}
          >
            {tr("timing.varshaphal.prev")}
          </button>
          <div className={styles.yearQuickList}>
            {quickYears.map((year) => (
              <button
                key={year}
                type="button"
                className={year === targetYear ? styles.yearQuickActive : styles.yearQuick}
                onClick={() => chooseYear(year)}
                disabled={isLoading}
              >
                {year}
                {year === currentYear && <span>{tr("timing.varshaphal.now")}</span>}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.yearStepBtn}
            onClick={() => chooseYear(targetYear + 1)}
            disabled={isLoading || targetYear >= maxYear}
            aria-label={tr("timing.varshaphal.nextYear")}
          >
            {tr("timing.varshaphal.next")}
          </button>
        </div>
        <label className={styles.yearField}>
          {tr("timing.varshaphal.jumpToYear")}
          <select
            value={targetYear}
            onChange={(e) => chooseYear(Number(e.target.value))}
            disabled={isLoading}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y === currentYear
                  ? tr("timing.varshaphal.yearOptionCurrent", { year: String(y) })
                  : y}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={styles.yearBtn} disabled={isLoading}>
          {isLoading ? tr("timing.varshaphal.calculating") : tr("timing.varshaphal.readYear")}
        </button>
      </form>

      {error && <div className={styles.error}>{varshaphalErrorText(error, tr)}</div>}

      {isLoading && !data && (
        <div className={styles.loading}>{tr("timing.varshaphal.loading")}</div>
      )}

      {data && (
        <>
          <AnnualThemeHero data={data} />

          <YearInFocus data={data} />

          <FocusAreas data={data} />

          <MajorForces data={data} />

          <div className={styles.timelineCard}>
            <div className={styles.timelineHeader}>
              <div>
                <span className={styles.eyebrow}>{tr("timing.varshaphal.timeline.eyebrow")}</span>
                <h3 className={styles.timelineTitle}>
                  {tr("timing.varshaphal.timeline.title", { year: String(data.year) })}
                </h3>
              </div>
              <span className={styles.timelineBadge}>
                {tr("timing.varshaphal.timeline.returnBadge", {
                  date: formatReturnMoment(data.solarReturnMoment).split(",")[0],
                })}
              </span>
            </div>
            <div className={styles.timelineTrack}>
              {buildYearTimeline(data, tr).map((item) => (
                <article
                  key={item.month}
                  className={`${styles.timelineMonth} ${styles[`timelineMonth${item.tone[0].toUpperCase()}${item.tone.slice(1)}`]}`}
                >
                  <span className={styles.timelineDot} aria-hidden="true" />
                  <span className={styles.timelineMonthLabel}>{item.month}</span>
                  <strong>{item.title}</strong>
                  <p>{item.note}</p>
                </article>
              ))}
            </div>
          </div>
          <div className={styles.sectionFull}>
            <h3 className={styles.sectionTitle}>{tr("timing.varshaphal.seasons.title")}</h3>
            <SeasonalForecastCards data={data} />
          </div>

          <TimingWindows data={data} />

          <PlanetaryWeatherMeters data={data} />

          <div className={styles.exploreHeader}>
            <span className={styles.eyebrow}>{tr("timing.varshaphal.explore.eyebrow")}</span>
            <h3>{tr("timing.varshaphal.explore.title")}</h3>
          </div>

          <div className={styles.sectionGrid}>
            <section className={styles.section}>
              <span className={styles.eyebrow}>{tr("timing.varshaphal.profection.eyebrow")}</span>
              <h3 className={styles.sectionTitle}>{tr("timing.varshaphal.profection.title")}</h3>
              <p className={styles.sectionIntro}>{tr("timing.varshaphal.profection.intro")}</p>
              <div className={styles.profectionFlow}>
                <div>
                  <span>{tr("timing.varshaphal.profection.activatedHouse")}</span>
                  <strong>{houseShort(data.profection.activatedHouse, tr)}</strong>
                  <small>
                    {tr("timing.varshaphal.profection.age", {
                      age: String(data.profection.age),
                    })}
                  </small>
                </div>
                <div>
                  <span>{tr("timing.varshaphal.profection.natalSign")}</span>
                  <strong>{data.profection.activatedSign}</strong>
                  <small>
                    {tr("timing.varshaphal.profection.signOnHouse", {
                      house: houseShort(data.profection.activatedHouse, tr),
                    })}
                  </small>
                </div>
                <div>
                  <span>{tr("timing.varshaphal.profection.lordOfYear")}</span>
                  <strong>{data.profection.lordOfYear}</strong>
                  <small>{tr("timing.varshaphal.profection.lordNote")}</small>
                </div>
                <div>
                  <span>{tr("timing.varshaphal.profection.natalActivation")}</span>
                  <strong>
                    {data.profection.activatedPlanets.join(", ") ||
                      tr("timing.varshaphal.profection.none")}
                  </strong>
                  <small>{tr("timing.varshaphal.profection.natalActivationNote")}</small>
                </div>
              </div>
              <div className={styles.profectionThemes}>
                {data.profection.themes.map((theme) => (
                  <span key={theme}>{theme}</span>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <span className={styles.eyebrow}>{tr("timing.varshaphal.wheel.eyebrow")}</span>
              <h3 className={styles.sectionTitle}>{tr("timing.varshaphal.wheel.title")}</h3>
              <ProfectionWheel
                activatedHouse={data.profection.activatedHouse}
                signs={data.profection.natalHouseSigns}
                age={data.profection.age}
              />
            </section>
          </div>

          <div className={styles.sectionGrid}>
            <section className={styles.section}>
              <span className={styles.eyebrow}>{tr("timing.varshaphal.returnChart.eyebrow")}</span>
              <h3 className={styles.sectionTitle}>{tr("timing.varshaphal.returnChart.title")}</h3>
              <p className={styles.sectionIntro}>{tr("timing.varshaphal.returnChart.intro")}</p>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>
                  {tr("timing.varshaphal.returnChart.returnMoment")}
                </span>
                <span className={styles.detailValue}>
                  {formatReturnMoment(data.solarReturnMoment)}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>
                  {tr("timing.varshaphal.returnChart.returnAscendant")}
                </span>
                <span className={styles.detailValue}>
                  {data.returnChart.ascendant.sign}{" "}
                  {data.returnChart.ascendant.degree_in_sign.toFixed(2)}°
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>
                  {tr("timing.varshaphal.returnChart.muntha")}
                </span>
                <span className={styles.detailValue}>
                  {tr("timing.varshaphal.returnChart.munthaValue", {
                    sign: data.muntha.sign,
                    house: String(data.muntha.house),
                  })}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>
                  {tr("timing.varshaphal.returnChart.varshesh")}
                </span>
                <span className={styles.detailValue}>
                  {data.varshesh.planet}
                </span>
              </div>
              <div className={styles.returnReason}>
                {data.varshesh.reason}
              </div>
            </section>

            <section className={styles.section}>
              <span className={styles.eyebrow}>{tr("timing.varshaphal.placements.eyebrow")}</span>
              <h3 className={styles.sectionTitle}>{tr("timing.varshaphal.placements.title")}</h3>
              <KeyReturnPlacements data={data} />
            </section>
          </div>

          {/* ── Year Lord Interpretation ── */}
          <div className={styles.interpretation}>
            <p>
              <strong>
                {tr("timing.varshaphal.interpretation.asYearLord", {
                  planet: data.varshesh.planet,
                })}
              </strong>{" "}
              {data.yearSummary.yearLordInterpretation}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
