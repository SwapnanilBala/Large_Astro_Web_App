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
}: {
  activatedHouse: number;
  signs: Record<number, string>;
}) {
  const cx = 50;
  const cy = 50;
  const outerR = 42;
  const innerR = 18;

  const segments: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];

  for (let i = 0; i < 12; i++) {
    const houseNum = i + 1;
    const startAngle = (i * 30 - 90) * (Math.PI / 180);
    const endAngle = ((i + 1) * 30 - 90) * (Math.PI / 180);
    const midAngle = ((i + 0.5) * 30 - 90) * (Math.PI / 180);

    const isActive = houseNum === activatedHouse;

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
        className={isActive ? styles.wheelSegmentActive : styles.wheelSegment}
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
        className={isActive ? styles.wheelLabelActive : styles.wheelLabel}
      >
        {houseNum}
      </text>
    );
    labels.push(
      <text
        key={`sign-${houseNum}`}
        x={lx}
        y={ly + 2}
        className={isActive ? styles.wheelLabelActive : styles.wheelLabel}
        style={{ fontSize: isActive ? "2.8px" : "2.5px" }}
      >
        {abbrev}
      </text>
    );
  }

  return (
    <div className={styles.wheelWrapper}>
      <svg viewBox="0 0 100 100" className={styles.wheel}>
        {segments}
        {labels}
        <text x={cx} y={cy - 2} className={styles.wheelCenter}>
          H{activatedHouse}
        </text>
        <text x={cx} y={cy + 3} className={styles.wheelCenterSub}>
          Active
        </text>
      </svg>
    </div>
  );
}

// --------------------------------------------------------------------------
// Main Panel
// --------------------------------------------------------------------------

export default function VarshaphalPanel({ queryString, birthDate }: VarshaphalPanelProps) {
  const currentYear = new Date().getFullYear();
  const years = yearRange(birthDate);

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
        <label className={styles.yearField}>
          Year
          <select
            value={targetYear}
            onChange={(e) => setTargetYear(Number(e.target.value))}
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
          {/* ── Profection Section ── */}
          <div className={styles.sectionGrid}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Annual Profection</h3>
              <div className={styles.profectionRow}>
                <span className={styles.tagGold}>
                  Age {data.profection.age}
                </span>
                <span className={styles.tagGold}>
                  House {data.profection.activatedHouse}
                </span>
                <span className={styles.tagAqua}>
                  {data.profection.activatedSign}
                </span>
              </div>
              <div className={styles.profectionRow}>
                <span className={styles.tag}>
                  Lord of Year: {data.profection.lordOfYear}
                </span>
              </div>
              {data.profection.activatedPlanets.length > 0 && (
                <div className={styles.profectionRow}>
                  {data.profection.activatedPlanets.map((p) => (
                    <span key={p} className={styles.tagAqua}>
                      {p} activated
                    </span>
                  ))}
                </div>
              )}
              <ul className={styles.themesList}>
                {data.profection.themes.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>

            {/* ── Profection Wheel ── */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Profection Wheel</h3>
              <ProfectionWheel
                activatedHouse={data.profection.activatedHouse}
                signs={(() => {
                  const m: Record<number, string> = {};
                  // Use natal houses from the return chart for display
                  // (profection houses map to natal house signs)
                  for (const h of data.returnChart.houses) {
                    m[h.house_number] = h.sign;
                  }
                  return m;
                })()}
              />
            </div>
          </div>

          {/* ── Solar Return Chart ── */}
          <div className={styles.sectionGrid}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Solar Return Chart</h3>
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
              <div style={{ marginTop: "0.25rem" }}>
                <small style={{ color: "var(--ink-soft)", fontSize: "0.78rem" }}>
                  {data.varshesh.reason}
                </small>
              </div>
            </div>

            {/* ── Key Planets in Return Chart ── */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Key Return Placements</h3>
              {data.returnChart.planets
                .filter((p) =>
                  ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"].includes(p.name)
                )
                .map((p) => (
                  <div key={p.name} className={styles.detailRow}>
                    <span className={styles.detailLabel}>{p.name}</span>
                    <span className={styles.detailValue}>
                      {p.sign} {p.degree_in_sign.toFixed(1)}° (H{p.house})
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* ── Year Summary ── */}
          <div className={styles.sectionGrid}>
            <div className={styles.sectionFull}>
              <h3 className={styles.sectionTitle}>Year Summary</h3>
              <p className={styles.summaryText}>
                {data.yearSummary.ascendantComparison}
              </p>
              <p className={styles.summaryText}>
                {data.yearSummary.emotionalTone}
              </p>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Focus Areas</h3>
              <ul className={styles.summaryList}>
                {data.yearSummary.focusAreas.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Strong Influences</h3>
              <ul className={styles.summaryList}>
                {data.yearSummary.strongInfluences.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
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
