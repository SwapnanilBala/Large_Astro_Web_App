"use client";

import { useState, useEffect } from "react";
import s from "../skeleton.module.css";

/* ─── Rotating loading messages ─── */
const LOADING_MESSAGES = [
  "Calculating your birth chart\u2026",
  "Mapping planetary positions\u2026",
  "Analyzing house placements\u2026",
  "Reading nakshatra alignments\u2026",
  "Computing dasha periods\u2026",
  "Interpreting aspect patterns\u2026",
  "Generating your cosmic blueprint\u2026",
  "Almost there \u2014 assembling insights\u2026",
];

/* ── Planet left-border accent colours (mirrors actual panel) ── */
const PLANET_ACCENTS = [
  "#f2c26c", // Sun – gold
  "#c8d8e8", // Moon – silver-blue
  "#ff6b5b", // Mars – coral-red
  "#6ce1a0", // Mercury – green
  "#ffd966", // Jupiter – yellow
  "#f0a0c8", // Venus – pink
  "#7eaadf", // Saturn – steel-blue
  "#a0a8b0", // Rahu – grey
  "#c49a6c", // Ketu – amber
];

/* ── Dasha period widths that roughly mirror a Vimsottari sequence ── */
const DASHA_SEGMENTS = [
  { w: "15%", color: "#f5a623" }, // Sun    6 yr
  { w: "8%",  color: "#a8d8ea" }, // Moon   10 yr → proportional
  { w: "6%",  color: "#e74c3c" }, // Mars   7 yr
  { w: "14%", color: "#8e44ad" }, // Rahu   18 yr
  { w: "13%", color: "#f1c40f" }, // Jupiter 16 yr
  { w: "15%", color: "#7f8c8d" }, // Saturn  19 yr
  { w: "13%", color: "#2ecc71" }, // Mercury 17 yr
  { w: "6%",  color: "#e67e22" }, // Ketu    7 yr
  { w: "10%", color: "#e91e8c" }, // Venus   20 yr
];

/* ─── Small helper: a shimmer bar with custom dimensions ─── */
function Bar({
  w = "100%",
  h = "1rem",
  radius = "8px",
  delay = 0,
  className = "",
}: {
  w?: string;
  h?: string;
  radius?: string;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={`${s.bar} ${className}`}
      style={{ width: w, height: h, borderRadius: radius, animationDelay: `${delay}s` }}
    />
  );
}

/* ─── Section header: kicker label + heading ─── */
function SkelSectionHeader({ kickerW = "6rem", headingW = "45%", delay = 0 }: {
  kickerW?: string;
  headingW?: string;
  delay?: number;
}) {
  return (
    <div className={s.sectionHeader}>
      <Bar w={kickerW} h="0.7rem" delay={delay} />
      <Bar w={headingW} h="1.6rem" delay={delay + 0.05} radius="10px" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   LAGNA CHART SKELETON
   North-Indian diamond: outer square + diagonals + inner
   diamond + midlines + planet dots + centre circle
   ════════════════════════════════════════════════════════ */

/* Planet dot positions as percentage offsets within the square.
   Each corresponds roughly to one of the 12 house centres. */
const LAGNA_DOTS: Array<{ top: string; left: string; delay: number }> = [
  { top: "14%", left: "50%",  delay: 0.0 },  // H1  – top centre diamond
  { top: "14%", left: "12%",  delay: 0.1 },  // H12 – top-left triangle
  { top: "50%", left: "8%",   delay: 0.2 },  // H2  – left-top tri
  { top: "50%", left: "12%",  delay: 0.3 },  // H3  – left-mid diamond
  { top: "86%", left: "12%",  delay: 0.4 },  // H4  – left-bot tri
  { top: "86%", left: "25%",  delay: 0.5 },  // H10 – bottom-left tri
  { top: "86%", left: "50%",  delay: 0.6 },  // H5  – bottom centre diamond
  { top: "86%", left: "75%",  delay: 0.7 },  // H11 – bottom-right tri
  { top: "50%", left: "88%",  delay: 0.8 },  // H7  – right-mid diamond
  { top: "14%", left: "88%",  delay: 0.9 },  // H8  – right-top tri
  { top: "14%", left: "75%",  delay: 1.0 },  // H9  – top-right tri
];

function LagnaChartSkeleton() {
  /* Circular, and with no toggle row: the diamond chart and the view switch
     were both removed, so a skeleton that drew a square with diagonals
     promised a layout that never arrives. */
  return (
    <div className={s.lagnaCard}>
      <div className={s.lagnaInner}>
        <div className={s.lagnaChart} aria-hidden="true">
          <div className={s.constellationDisc} />
          <div className={s.constellationRing} />

          {LAGNA_DOTS.map((dot, i) => (
            <div
              key={i}
              className={s.lagnaDot}
              style={{
                top: dot.top,
                left: dot.left,
                transform: "translate(-50%, -50%)",
                animationDelay: `${dot.delay}s`,
              }}
            />
          ))}

          <div className={s.lagnaCenter} />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   PLANETARY SNAPSHOTS SKELETON
   9 pill cards with circular glyph + two text lines
   ════════════════════════════════════════════════════════ */
function PlanetarySnapshotsSkeleton() {
  return (
    <div className={s.planetsCard}>
      <div className={s.planetsHeader}>
        <SkelSectionHeader kickerW="5rem" headingW="70%" />
      </div>

      {/* Introductory line */}
      <Bar w="85%" h="0.85rem" delay={0.1} />

      <div className={s.planetGrid}>
        {PLANET_ACCENTS.map((color, i) => (
          <div
            key={i}
            className={s.planetPill}
            style={{
              borderLeftColor: `${color}55` /* 33% opacity of accent */,
              animationDelay: `${i * 0.06}s`,
            }}
          >
            <div
              className={s.planetGlyph}
              style={{ animationDelay: `${i * 0.06}s` }}
            />
            <div className={s.planetLines}>
              <div className={s.planetLine1} style={{ animationDelay: `${i * 0.06 + 0.05}s` }} />
              <div className={s.planetLine2} style={{ animationDelay: `${i * 0.06 + 0.1}s` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   DASHA TIMELINE SKELETON (full width)
   Nakshatra wheel + info cards + Gantt bar
   ════════════════════════════════════════════════════════ */
function DashaPanelSkeleton() {
  return (
    <div className={`${s.dashaCard} ${s.fullWidth}`}>
      <SkelSectionHeader kickerW="7rem" headingW="40%" />

      {/* Two nakshatra info cards */}
      <div className={s.nakshatraGrid}>
        {/* Left card: nakshatra wheel + text lines */}
        <div className={s.nakshatraCard}>
          <div className={s.nakshatraWheel} aria-hidden="true" />
          <Bar w="60%" h="1rem" delay={0.05} />
          <Bar w="80%" h="0.8rem" delay={0.1} />
          <Bar w="50%" h="0.75rem" delay={0.15} />
        </div>

        {/* Right card: current period info */}
        <div className={s.nakshatraCard}>
          <Bar w="55%" h="0.9rem" delay={0.05} />
          <Bar w="90%" h="1rem" delay={0.1} />
          <Bar w="70%" h="0.8rem" delay={0.15} />
          <Bar w="75%" h="0.8rem" delay={0.2} />
          {/* Progress bar */}
          <div style={{ marginTop: "0.5rem" }}>
            <Bar w="100%" h="4px" radius="4px" delay={0.25} />
          </div>
        </div>
      </div>

      {/* Dasha Gantt timeline */}
      <div>
        <div className={s.dashaTimelineLabel} style={{ marginBottom: "0.5rem" }} />
        <div className={s.dashaTimeline} aria-hidden="true">
          {DASHA_SEGMENTS.map((seg, i) => (
            <div
              key={i}
              className={s.dashaBar}
              style={{
                width: seg.w,
                /* Use the planet colour at low opacity so segments are distinguishable */
                background: `linear-gradient(90deg, ${seg.color}30 0%, ${seg.color}55 50%, ${seg.color}30 100%)`,
                backgroundSize: "200% 100%",
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ASPECTS PANEL SKELETON (half-width)
   Matrix grid of small square cells
   ════════════════════════════════════════════════════════ */
function AspectsPanelSkeleton() {
  return (
    <div className={s.aspectsCard}>
      <SkelSectionHeader kickerW="5rem" headingW="55%" />
      <div className={s.aspectsGrid} aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={s.aspectCell}
            style={{ animationDelay: `${i * 0.07}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   NAVAMSA D9 SKELETON (half-width)
   Smaller diamond chart + text lines
   ════════════════════════════════════════════════════════ */
function NavamsaChartSkeleton() {
  return (
    <div className={s.navamsaCard}>
      <SkelSectionHeader kickerW="4rem" headingW="50%" />

      <div className={s.navamsaChart} aria-hidden="true">
        <div className={s.navamsaSquare} />
        <div className={s.navamsaDiag1} />
        <div className={s.navamsaDiag2} />
        <div className={s.navamsaInnerDiamond} />
      </div>

      <Bar w="70%" h="0.85rem" delay={0.1} />
      <Bar w="55%" h="0.75rem" delay={0.15} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   TRANSITS PANEL SKELETON (full-width)
   Rows of planet dot + two text lines
   ════════════════════════════════════════════════════════ */
function TransitsPanelSkeleton() {
  return (
    <div className={`${s.transitsCard} ${s.fullWidth}`}>
      <SkelSectionHeader kickerW="5rem" headingW="35%" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={s.transitRow} style={{ animationDelay: `${i * 0.08}s` }}>
          <div className={s.transitDot} style={{ animationDelay: `${i * 0.08}s` }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <Bar w="55%" h="0.85rem" delay={i * 0.08 + 0.05} />
            <Bar w="40%" h="0.7rem" delay={i * 0.08 + 0.1} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   RULE CARD SKELETON (title + priority badge + 2 lines)
   ════════════════════════════════════════════════════════ */
function RuleCardSkeleton({ index }: { index: number }) {
  const delay = index * 0.08;
  return (
    <div className={s.ruleCard}>
      <div className={s.ruleCardHeader}>
        <Bar w="55%" h="1.05rem" delay={delay} />
        <Bar w="3.5rem" h="1.4rem" radius="12px" delay={delay + 0.05} />
      </div>
      <Bar w="90%" h="0.9rem" delay={delay + 0.1} />
      <Bar w="72%" h="0.9rem" delay={delay + 0.15} />
      <Bar w="45%" h="0.75rem" delay={delay + 0.2} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   FORECAST CARD SKELETON
   ════════════════════════════════════════════════════════ */
function ForecastCardSkeleton() {
  return (
    <div className={s.forecastCard}>
      <SkelSectionHeader kickerW="6rem" headingW="50%" />
      <Bar w="95%" h="0.9rem" delay={0.1} />
      <Bar w="80%" h="0.9rem" delay={0.15} />
      <Bar w="60%" h="0.9rem" delay={0.2} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN SKELETON EXPORT
   Mirrors the actual InsightsContent bento grid order:
   1. Loading hero (spinner + message + progress)
   2. Hero heading section
   3. Metric cards row (3 cards)
   4. Main bento: Lagna chart (2fr) + Planetary snapshots (1fr)
   5. Future Forecast (full width)
   6. Core rules collapsible (4 cards)
   7. Advanced grid: Dasha (full), Aspects, Navamsa, Transits (full)
   ════════════════════════════════════════════════════════ */
export default function InsightsSkeleton() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <section className={`dashboard-shell ${s.shell}`}>

        {/* ── Star particles ── */}
        <div className={s.stars} aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className={s.star}
              style={{
                left: `${(i * 37 + 11) % 100}%`,
                top:  `${(i * 53 + 7)  % 100}%`,
                animationDelay:    `${(i * 0.6) % 4}s`,
                animationDuration: `${2.5 + (i % 3)}s`,
              }}
            />
          ))}
        </div>

        {/* 1 ── Orbital spinner + rotating message + progress bar ── */}
        <div className={s.loadingHero}>
          <div className={s.orbitalSpinner} aria-hidden="true">
            <div className={s.orbit1}><span className={s.planet} /></div>
            <div className={s.orbit2}><span className={s.planet} /></div>
            <div className={s.orbit3}><span className={s.planet} /></div>
            <div className={s.sun} />
          </div>
          <p className={s.message} key={msgIndex}>
            {LOADING_MESSAGES[msgIndex]}
          </p>
          <div className={s.progressTrack}>
            <div className={s.progressFill} />
          </div>
        </div>

        {/* 2 ── Hero heading area ── */}
        <div className={s.hero}>
          <Bar w="8rem"  h="0.7rem"  delay={0}    />
          <Bar w="55%"   h="2.2rem"  radius="12px" delay={0.08} />
          <Bar w="80%"   h="0.95rem" delay={0.14} />
          <Bar w="65%"   h="0.95rem" delay={0.18} />
          <Bar w="48%"   h="0.95rem" delay={0.22} />
        </div>

        {/* 3 ── Metric cards row ── */}
        <div className={s.gridHero}>
          {/* Lagna card (gold accent) */}
          <div className={`${s.metricCard} ${s.metricCardGold}`}>
            <div className={s.metricIcon} />
            <Bar w="4rem"  h="0.7rem"  delay={0.05} />
            <Bar w="7rem"  h="1.5rem"  radius="10px" delay={0.1} />
            <Bar w="5.5rem" h="0.7rem" delay={0.15} />
          </div>

          {/* Engine card (aqua accent) */}
          <div className={`${s.metricCard} ${s.metricCardAqua}`}>
            <div className={s.metricIcon} style={{ animationDelay: "0.05s" }} />
            <Bar w="4rem"  h="0.7rem"  delay={0.07} />
            <Bar w="8rem"  h="1.5rem"  radius="10px" delay={0.12} />
            <Bar w="7rem"  h="0.7rem"  delay={0.17} />
          </div>

          {/* Access card */}
          <div className={`${s.metricCard} ${s.metricCardPlain}`}>
            <Bar w="6rem"  h="1.4rem"  radius="20px" delay={0.1} />
            <Bar w="5rem"  h="0.7rem"  delay={0.15} />
            <Bar w="8rem"  h="0.7rem"  delay={0.2}  />
          </div>
        </div>

        {/* 4 ── Main bento: Lagna chart + Planetary snapshots ── */}
        <div className={s.gridMain}>
          <LagnaChartSkeleton />
          <PlanetarySnapshotsSkeleton />
        </div>

        {/* 5 ── Future Forecast ── */}
        <ForecastCardSkeleton />

        {/* 6 ── Core rules collapsible ── */}
        <div className={s.rulesCard}>
          <SkelSectionHeader kickerW="6rem" headingW="52%" />
          <Bar w="88%" h="0.9rem"  delay={0.08} />
          <div className={s.ruleCardGrid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <RuleCardSkeleton key={i} index={i} />
            ))}
          </div>
        </div>

        {/* 7 ── Advanced modules grid ── */}
        <div className={s.gridAdvanced}>
          <DashaPanelSkeleton />
          <AspectsPanelSkeleton />
          <NavamsaChartSkeleton />
          <TransitsPanelSkeleton />
        </div>

      </section>
    </>
  );
}
