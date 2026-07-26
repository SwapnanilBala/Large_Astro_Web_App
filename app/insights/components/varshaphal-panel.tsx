"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { VarshaphalResult } from "@/lib/engines/varshaphal-engine";
import { buildBirthProfileApiUrl } from "@/lib/chart-query";
import styles from "./varshaphal-panel.module.css";

type VarshaphalPanelProps = {
  queryString: string;
  birthDate: string;
};

const TIMEOUT_MS = 45_000;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HOUSE_TIMELINE_LABELS: Record<number, string> = {
  1: "Identity",
  2: "Money",
  3: "Voice",
  4: "Home",
  5: "Joy",
  6: "Routines",
  7: "Bonds",
  8: "Change",
  9: "Vision",
  10: "Career",
  11: "Allies",
  12: "Closure",
};

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

function buildYearTimeline(data: VarshaphalResult): TimelineMonth[] {
  const returnMonth = wrapMonth(new Date(data.solarReturnMoment).getMonth());
  const activatedHouse = data.profection.activatedHouse;
  const munthaHouse = data.muntha.house;
  const actionMonths = new Set(
    [activatedHouse, munthaHouse, 10].map((house) => wrapMonth(returnMonth + house - 1))
  );

  return MONTH_LABELS.map((month, index) => {
    const distanceFromReturn = wrapMonth(index - returnMonth);
    const house = ((activatedHouse + distanceFromReturn - 1) % 12) + 1;
    const houseTheme = HOUSE_TIMELINE_LABELS[house] ?? "Focus";

    if (index === returnMonth) {
      return {
        month,
        title: "Solar return",
        note: `${data.returnChart.ascendant.sign} rises; reset the year's operating rhythm.`,
        tone: "peak",
      };
    }

    if (index === wrapMonth(returnMonth + 3) || index === wrapMonth(returnMonth + 9)) {
      return {
        month,
        title: "Course correct",
        note: `${houseTheme} themes ask for adjustment before the next push.`,
        tone: "review",
      };
    }

    if (actionMonths.has(index)) {
      return {
        month,
        title: "Visible movement",
        note: `${houseTheme} matters become easier to act on and measure.`,
        tone: "growth",
      };
    }

    return {
      month,
      title: houseTheme,
      note: `Work the house ${house} thread through steady, practical choices.`,
      tone: "setup",
    };
  });
}

function getAnnualTheme(data: VarshaphalResult): string {
  const themes = data.profection.themes.slice(0, 2).join(" and ").toLowerCase();
  return `${data.varshesh.planet} leads a house ${data.profection.activatedHouse} year, pulling ${themes || "personal timing"} into the foreground.`;
}

function AnnualThemeHero({ data }: { data: VarshaphalResult }) {
  return (
    <section className={styles.themeHero} aria-labelledby="annual-compass-title">
      <div className={styles.themeHeroCopy}>
        <span className={styles.eyebrow}>Annual Compass</span>
        <h3 id="annual-compass-title">{getAnnualTheme(data)}</h3>
        <p>{data.yearSummary.yearLordInterpretation}</p>
        <span className={styles.cycleLabel}>
          Active cycle: birthday {data.year} to birthday {data.year + 1}
        </span>
      </div>
      <div className={styles.themeStats} aria-label={`${data.year} annual timing highlights`}>
        <div className={styles.themeStat}>
          <span>Profection</span>
          <strong>H{data.profection.activatedHouse}</strong>
          <small>{data.profection.activatedSign} · age {data.profection.age}</small>
        </div>
        <div className={styles.themeStat}>
          <span>Muntha</span>
          <strong>H{data.muntha.house}</strong>
          <small>{data.muntha.sign}</small>
        </div>
        <div className={styles.themeStat}>
          <span>Year Lord</span>
          <strong>{data.varshesh.planet}</strong>
          <small>{data.varshesh.reason}</small>
        </div>
      </div>
    </section>
  );
}

function YearInFocus({ data }: { data: VarshaphalResult }) {
  const themes = data.profection.themes.slice(0, 2).join(" and ").toLowerCase() || "the matters in front of you";

  return (
    <section className={styles.overviewCard} aria-labelledby="year-in-focus-title">
      <div className={styles.overviewHeader}>
        <div>
          <span className={styles.eyebrow}>Your priorities</span>
          <h3 id="year-in-focus-title">Year in Focus</h3>
        </div>
        <p>{data.yearSummary.ascendantComparison}</p>
      </div>
      <div className={styles.summaryCards}>
        <article className={styles.summaryCard}>
          <span>Theme</span>
          <strong>House {data.profection.activatedHouse}: {themes}</strong>
          <p>Your annual profection makes these the work worth returning to all year.</p>
        </article>
        <article className={styles.summaryCard}>
          <span>Best use</span>
          <strong>Follow {data.varshesh.planet}&apos;s lead</strong>
          <p>{data.yearSummary.yearLordInterpretation}</p>
        </article>
        <article className={styles.summaryCard}>
          <span>Keep in mind</span>
          <strong>Emotional climate</strong>
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

function buildFocusCards(data: VarshaphalResult): FocusCard[] {
  const themes = data.profection.themes.slice(0, 2).join(" and ").toLowerCase() || "this house's themes";
  const cards: FocusCard[] = [
    {
      title: `House ${data.profection.activatedHouse}: ${themes}`,
      source: "Annual Profection",
      detail: `${data.profection.activatedSign} is activated, with ${data.profection.lordOfYear} as the Lord of the Year.`,
      prompt: "What one recurring commitment would make this area feel more intentional?",
    },
    {
      title: `Muntha in house ${data.muntha.house}`,
      source: "Muntha",
      detail: `${data.muntha.sign} draws the year’s attention to the themes of this return-chart house.`,
      prompt: "Where is steady attention more useful than a dramatic change?",
    },
  ];

  if (data.profection.activatedPlanets.length > 0) {
    cards.push({
      title: `${data.profection.activatedPlanets.join(" and ")} activated`,
      source: "Natal activation",
      detail: `These natal planets sit in ${data.profection.activatedSign}, giving the profected house extra weight.`,
      prompt: "How can you use these planetary strengths deliberately?",
    });
  } else {
    cards.push({
      title: `${data.varshesh.planet} sets the pace`,
      source: "Year Lord",
      detail: data.varshesh.reason,
      prompt: "Which decision would benefit from this planet’s qualities?",
    });
  }

  return cards;
}

function FocusAreas({ data }: { data: VarshaphalResult }) {
  return (
    <section className={styles.prioritySection} aria-labelledby="focus-areas-title">
      <div className={styles.priorityHeader}>
        <span className={styles.eyebrow}>Where to invest your attention</span>
        <h3 id="focus-areas-title">Focus Areas</h3>
      </div>
      <div className={styles.priorityGrid}>
        {buildFocusCards(data).map((item, index) => (
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

function buildMajorForces(data: VarshaphalResult): MajorForce[] {
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
      placement: `${placement.sign} · house ${placement.house} · ${placement.degree_in_sign.toFixed(1)}°`,
      detail,
    });
  };

  addForce(
    data.varshesh.planet,
    "Year Lord",
    `${data.varshesh.planet} directs the year’s larger choices through its solar-return placement.`,
  );

  const moon = placements.find((planet) => planet.name === "Moon");
  if (moon) {
    addForce("Moon", "Emotional climate", `Your Moon in house ${moon.house} colors the habits and needs that feel most immediate.`);
  }

  placements
    .filter((planet) => [1, 4, 7, 10].includes(planet.house))
    .forEach((planet) => {
      addForce(planet.name, `Angular · house ${planet.house}`, "Angular placements are especially visible and tend to shape the year’s events directly.");
    });

  return forces.slice(0, 4);
}

function MajorForces({ data }: { data: VarshaphalResult }) {
  return (
    <section className={styles.forceSection} aria-labelledby="major-forces-title">
      <div className={styles.priorityHeader}>
        <span className={styles.eyebrow}>The signals that carry the most weight</span>
        <h3 id="major-forces-title">Major Forces This Year</h3>
      </div>
      <div className={styles.forceGrid}>
        {buildMajorForces(data).map((force) => (
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

function buildSeasonalForecasts(data: VarshaphalResult): SeasonalForecast[] {
  const timeline = buildYearTimeline(data);
  const strongestInfluence = data.yearSummary.strongInfluences[0] ?? data.yearSummary.ascendantComparison;
  const focusArea = data.yearSummary.focusAreas[0] ?? data.yearSummary.emotionalTone;
  const quarters = [
    { label: "Q1", phase: "Setup", months: timeline.slice(0, 3), guidance: "Set the rhythm and choose what deserves attention first." },
    { label: "Q2", phase: "Momentum", months: timeline.slice(3, 6), guidance: "Move visible priorities forward while support is easier to gather." },
    { label: "Q3", phase: "Pressure Test", months: timeline.slice(6, 9), guidance: "Simplify commitments and correct what has drifted off course." },
    { label: "Q4", phase: "Harvest", months: timeline.slice(9, 12), guidance: "Collect results, close loops, and prepare the next yearly cycle." },
  ];

  return quarters.map((quarter, index) => {
    const peakMonth = quarter.months.find((month) => month.tone === "peak" || month.tone === "growth") ?? quarter.months[0];
    return {
      label: quarter.label,
      phase: quarter.phase,
      focus: index % 2 === 0 ? focusArea : strongestInfluence,
      guidance: `${peakMonth.month}: ${peakMonth.title}. ${quarter.guidance}`,
      tone: peakMonth.tone,
    };
  });
}

function SeasonalForecastCards({ data }: { data: VarshaphalResult }) {
  return (
    <div className={styles.seasonGrid}>
      {buildSeasonalForecasts(data).map((season) => (
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

function buildTimingWindows(data: VarshaphalResult): { best: TimingWindow[]; watch: TimingWindow[] } {
  const timeline = buildYearTimeline(data);
  const best = timeline
    .filter((month) => month.tone === "peak" || month.tone === "growth")
    .slice(0, 4)
    .map((month) => ({
      month: month.month,
      title: month.title,
      note: month.tone === "peak"
        ? `Launch or reset around the solar return signature: ${data.returnChart.ascendant.sign} rising.`
        : month.note,
    }));

  const watch = timeline
    .filter((month) => month.tone === "review")
    .slice(0, 3)
    .map((month) => ({
      month: month.month,
      title: month.title,
      note: `${month.note} Avoid forcing outcomes before the signal is clear.`,
    }));

  if (watch.length < 3) {
    watch.push({
      month: timeline[11].month,
      title: "Close loops",
      note: "Review unfinished commitments before the next solar return cycle starts.",
    });
  }

  return { best, watch };
}

function TimingWindows({ data }: { data: VarshaphalResult }) {
  const windows = buildTimingWindows(data);
  return (
    <div className={styles.windowsGrid}>
      <div className={styles.windowColumn}>
        <div className={styles.windowColumnHeader}>
          <span className={styles.windowSignalBest} aria-hidden="true" />
          <h3>Best Windows</h3>
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
          <h3>Watch Windows</h3>
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

function buildWeatherMeters(data: VarshaphalResult): WeatherMeter[] {
  const configs = [
    { label: "Career", houses: [10, 6, 11], planets: ["Sun", "Saturn", "Mars"], note: "Visibility, responsibility, and execution power." },
    { label: "Money", houses: [2, 8, 11], planets: ["Venus", "Jupiter", "Mercury"], note: "Resources, gains, shared assets, and trade." },
    { label: "Relationships", houses: [5, 7], planets: ["Venus", "Moon", "Jupiter"], note: "Partnership clarity, romance, and emotional exchange." },
    { label: "Health", houses: [1, 6, 12], planets: ["Moon", "Mars", "Saturn"], note: "Energy management, routines, and recovery needs." },
    { label: "Inner Growth", houses: [4, 8, 9, 12], planets: ["Moon", "Jupiter", "Saturn", "Ketu"], note: "Reflection, faith, transformation, and closure." },
  ];

  return configs.map((config) => {
    const score = scoreDomain(data, config.houses, config.planets);
    return {
      label: config.label,
      score,
      trend: score >= 76 ? "rising" : score >= 58 ? "steady" : "review",
      note: config.note,
    };
  });
}

function PlanetaryWeatherMeters({ data }: { data: VarshaphalResult }) {
  return (
    <div className={styles.weatherPanel}>
      <div className={styles.weatherHeader}>
        <span className={styles.eyebrow}>Planetary Weather</span>
        <h3>Domain Meters</h3>
      </div>
      <div className={styles.weatherGrid}>
        {buildWeatherMeters(data).map((meter) => (
          <article key={meter.label} className={styles.weatherMeter}>
            <div className={styles.weatherMeterTop}>
              <strong>{meter.label}</strong>
              <span className={styles[`weatherTrend${meter.trend[0].toUpperCase()}${meter.trend.slice(1)}`]}>
                {meter.trend}
              </span>
            </div>
            <div className={styles.weatherTrack} aria-label={`${meter.label} score ${meter.score} percent`}>
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
        aria-label={`House ${houseNum}, ${signs[houseNum] ?? "sign unavailable"}${isActive ? ", active now" : ""}`}
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
        <title>Interactive annual profection wheel</title>
        {segments}
        {labels}
        <text x={cx} y={cy - 2} className={styles.wheelCenter}>
          H{selectedHouse}
        </text>
        <text x={cx} y={cy + 3} className={styles.wheelCenterSub}>
          {selectedHouse === activatedHouse ? "Active now" : `Age ${selectedAge}`}
        </text>
      </svg>
      <p id="profection-wheel-help" className={styles.wheelHint}>
        {selectedHouse === activatedHouse
          ? `House ${activatedHouse} is active in this birthday-to-birthday cycle.`
          : `House ${selectedHouse} returns at age ${selectedAge}. Select a house to explore the 12-year rhythm.`}
      </p>
    </div>
  );
}

const RETURN_PLANET_ORDER = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];

function getPlacementLabels(
  planet: VarshaphalResult["returnChart"]["planets"][number],
  data: VarshaphalResult,
): string[] {
  const labels: string[] = [];
  if (planet.name === data.varshesh.planet) labels.push("Year Lord");
  if (planet.name === "Moon") labels.push("Emotional climate");
  if ([1, 4, 7, 10].includes(planet.house)) labels.push(`Angular · H${planet.house}`);
  if (planet.name === "Sun") labels.push("Solar return Sun");
  return labels.length > 0 ? labels : ["Return placement"];
}

function KeyReturnPlacements({ data }: { data: VarshaphalResult }) {
  const placements = data.returnChart.planets
    .filter((planet) => RETURN_PLANET_ORDER.includes(planet.name))
    .sort((left, right) => {
      const leftLabels = getPlacementLabels(left, data);
      const rightLabels = getPlacementLabels(right, data);
      const score = (labels: string[]) =>
        labels.includes("Year Lord") ? 0 : labels.includes("Emotional climate") ? 1 : labels.some((label) => label.startsWith("Angular")) ? 2 : labels.includes("Solar return Sun") ? 3 : 4;
      return score(leftLabels) - score(rightLabels);
    });

  return (
    <div className={styles.placementContent}>
      <p className={styles.sectionIntro}>
        The placements with the clearest connection to this year&apos;s direction come first.
      </p>
      <div className={styles.placementGrid}>
        {placements.slice(0, 4).map((planet) => {
          const labels = getPlacementLabels(planet, data);
          return (
            <article key={planet.name} className={styles.placementCard}>
              <span className={styles.sourceLabel}>{labels[0]}</span>
              <h4>{planet.name}</h4>
              <strong>{planet.sign} · house {planet.house}</strong>
              <p>
                {planet.degree_in_sign.toFixed(1)}° {planet.is_retrograde ? "· retrograde" : ""}
                {labels.length > 1 ? ` · ${labels.slice(1).join(" · ")}` : ""}
              </p>
            </article>
          );
        })}
      </div>
      <details className={styles.allPlacements}>
        <summary>View all return placements</summary>
        <div className={styles.placementTable}>
          {placements.map((planet) => (
            <div key={planet.name} className={styles.placementRow}>
              <strong>{planet.name}</strong>
              <span>{planet.sign}</span>
              <span>H{planet.house}</span>
              <span>{planet.degree_in_sign.toFixed(1)}°</span>
              <span>{planet.is_retrograde ? "Retrograde" : "Direct"}</span>
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
  const currentYear = new Date().getFullYear();
  const years = yearRange(birthDate);
  const minYear = years[0] ?? currentYear;
  const maxYear = years[years.length - 1] ?? currentYear;

  const [targetYear, setTargetYear] = useState(currentYear);
  const [data, setData] = useState<VarshaphalResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const loadData = useCallback(
    async (year: number) => {
      abortRef.current?.abort();
      setIsLoading(true);
      setError("");

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
          throw new Error(
            body?.error?.message ?? `API error (${res.status})`
          );
        }
        const json = (await res.json()) as VarshaphalResult;
        setData(json);
      } catch (err) {
        clearTimeout(timeout);
        setData(null);
        if (err instanceof DOMException && err.name === "AbortError") {
          setError("Request timed out. The solar return search can be intensive. Please try again.");
        } else {
          setError(err instanceof Error ? err.message : "Could not load Varshaphal data.");
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
        <p className={styles.kicker}>Annual Timing</p>
        <h2 className={styles.heading}>Varshaphal &amp; Annual Profections</h2>
      </div>
      <p className={styles.intro}>
        Select a year to see which house and sign are activated through annual profections,
        plus the full Vedic solar return (Varshaphal) chart with Muntha and year lord analysis.
      </p>

      {/* Year selector */}
      <form
        className={styles.yearForm}
        onSubmit={(e) => {
          e.preventDefault();
          void loadData(targetYear);
        }}
      >
        <div className={styles.yearStepper} aria-label="Annual timing year controls">
          <button
            type="button"
            className={styles.yearStepBtn}
            onClick={() => chooseYear(targetYear - 1)}
            disabled={isLoading || targetYear <= minYear}
            aria-label="Previous year"
          >
            Prev
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
                {year === currentYear && <span>Now</span>}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.yearStepBtn}
            onClick={() => chooseYear(targetYear + 1)}
            disabled={isLoading || targetYear >= maxYear}
            aria-label="Next year"
          >
            Next
          </button>
        </div>
        <label className={styles.yearField}>
          Jump to year
          <select
            value={targetYear}
            onChange={(e) => chooseYear(Number(e.target.value))}
            disabled={isLoading}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
                {y === currentYear ? " (current)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={styles.yearBtn} disabled={isLoading}>
          {isLoading ? "Calculating..." : "Read this year"}
        </button>
      </form>

      {error && <div className={styles.error}>{error}</div>}

      {isLoading && !data && (
        <div className={styles.loading}>Calculating solar return...</div>
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
                <span className={styles.eyebrow}>Year Timeline</span>
                <h3 className={styles.timelineTitle}>{data.year} Annual Arc</h3>
              </div>
              <span className={styles.timelineBadge}>
                Return {formatReturnMoment(data.solarReturnMoment).split(",")[0]}
              </span>
            </div>
            <div className={styles.timelineTrack}>
              {buildYearTimeline(data).map((item) => (
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
            <h3 className={styles.sectionTitle}>Seasonal Forecast</h3>
            <SeasonalForecastCards data={data} />
          </div>

          <TimingWindows data={data} />

          <PlanetaryWeatherMeters data={data} />

          <div className={styles.exploreHeader}>
            <span className={styles.eyebrow}>Explore the mechanics</span>
            <h3>How this annual picture is built</h3>
          </div>

          <div className={styles.sectionGrid}>
            <section className={styles.section}>
              <span className={styles.eyebrow}>Annual Profection</span>
              <h3 className={styles.sectionTitle}>Annual Profection</h3>
              <p className={styles.sectionIntro}>
                This birthday-to-birthday cycle activates one natal house and the planet that rules its sign.
              </p>
              <div className={styles.profectionFlow}>
                <div>
                  <span>Activated house</span>
                  <strong>H{data.profection.activatedHouse}</strong>
                  <small>Age {data.profection.age}</small>
                </div>
                <div>
                  <span>Natal sign</span>
                  <strong>{data.profection.activatedSign}</strong>
                  <small>The sign on H{data.profection.activatedHouse}</small>
                </div>
                <div>
                  <span>Lord of the Year</span>
                  <strong>{data.profection.lordOfYear}</strong>
                  <small>Directs the house&apos;s themes</small>
                </div>
                <div>
                  <span>Natal activation</span>
                  <strong>{data.profection.activatedPlanets.join(", ") || "None"}</strong>
                  <small>Planets already in the activated sign</small>
                </div>
              </div>
              <div className={styles.profectionThemes}>
                {data.profection.themes.map((theme) => (
                  <span key={theme}>{theme}</span>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <span className={styles.eyebrow}>12-year rhythm</span>
              <h3 className={styles.sectionTitle}>Profection Wheel</h3>
              <ProfectionWheel
                activatedHouse={data.profection.activatedHouse}
                signs={data.profection.natalHouseSigns}
                age={data.profection.age}
              />
            </section>
          </div>

          <div className={styles.sectionGrid}>
            <section className={styles.section}>
              <span className={styles.eyebrow}>Return chart</span>
              <h3 className={styles.sectionTitle}>Solar Return Snapshot</h3>
              <p className={styles.sectionIntro}>
                Cast for the precise moment the Sun returns to its natal position.
              </p>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Return Moment</span>
                <span className={styles.detailValue}>
                  {formatReturnMoment(data.solarReturnMoment)}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Return Ascendant</span>
                <span className={styles.detailValue}>
                  {data.returnChart.ascendant.sign}{" "}
                  {data.returnChart.ascendant.degree_in_sign.toFixed(2)}°
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Muntha</span>
                <span className={styles.detailValue}>
                  {data.muntha.sign} (House {data.muntha.house})
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Varshesh (Year Lord)</span>
                <span className={styles.detailValue}>
                  {data.varshesh.planet}
                </span>
              </div>
              <div className={styles.returnReason}>
                {data.varshesh.reason}
              </div>
            </section>

            <section className={styles.section}>
              <span className={styles.eyebrow}>Ranked signals</span>
              <h3 className={styles.sectionTitle}>Key Return Placements</h3>
              <KeyReturnPlacements data={data} />
            </section>
          </div>

          {/* ── Year Lord Interpretation ── */}
          <div className={styles.interpretation}>
            <p>
              <strong>{data.varshesh.planet} as Year Lord:</strong>{" "}
              {data.yearSummary.yearLordInterpretation}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
