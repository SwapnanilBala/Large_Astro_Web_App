"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ChartApiResponse, DashaInfo, DeterministicRule } from "@/lib/astro-types";
import type { KalatraFacet, KalatraResult } from "@/lib/engines/kalatra-engine";
import { useRouteMessages, useTranslation, LOCALE_TAGS } from "@/lib/i18n-context";
import insightsMessages from "@/messages/en.mobile-insights.json";
import shell from "../mobile.module.css";
import { SIGN_SYMBOLS } from "@/lib/constellation-geometry";
import {
  BHAVA_NAMES,
  HOUSE_GROUPS,
  computeHouseSupport,
  type HouseSupport,
} from "@/lib/engines/house-support-engine";
import { HOUSE_THEMES } from "@/lib/rules/tables";
import { nakshatraName, planetAbbreviation, planetName, signName } from "@/lib/chart-labels";
import Emphasise from "@/app/components/Emphasise";
import MobileRasiChart, { bhavaSystemName, signHouse } from "./mobile-rasi-chart";
import MobileChartSync from "./mobile-chart-sync";
import { useHydrated } from "@/lib/use-hydrated";
import { MobileMeaning, MobileTurningPoint } from "./mobile-today";
import tabStyles from "./mobile-tabs.module.css";
import styles from "./insights.module.css";

/* The full reading's three rooms, fetched when their section is opened. All
   three start closed, and they bring two route catalogs and the karma tables
   with them, so the reading's first load does not pay for them. */
const MobileFindingsRoom = dynamic(() =>
  import("./mobile-reading-rooms").then((module) => module.MobileFindingsRoom),
);
const MobileYogasRoom = dynamic(() =>
  import("./mobile-reading-rooms").then((module) => module.MobileYogasRoom),
);
const MobileKarmaRoom = dynamic(() =>
  import("./mobile-reading-rooms").then((module) => module.MobileKarmaRoom),
);
/* Ask the classics brings its questions list and the cited-reading view; only
   a reader who opens the tab pays for them. */
const MobileAsk = dynamic(() => import("./mobile-ask").then((module) => module.MobileAsk));

/*
 * The tabs, since 2026-10-27 (the owner chose this layout from three drawn
 * options): Today, Chart, Timing, Readings, Ask. The page had grown to some
 * fifteen screens in one column, and the written readings the desktop gives
 * -- what the current periods mean, the life chapter running now, the
 * classics -- were not on the phone at all.
 *
 * The tab is the URL's hash (#timing), read with useSyncExternalStore, so a
 * shared link or a reload opens on the same tab and render reads no browser
 * state. Its server snapshot is Today.
 */
const TABS = ["today", "chart", "timing", "readings", "ask"] as const;
type TabId = (typeof TABS)[number];

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function tabFromHash(): TabId {
  const hash = window.location.hash.slice(1);
  return (TABS as readonly string[]).includes(hash) ? (hash as TabId) : "today";
}

/* Readings shown before "N more readings": the rest are a tap away. */
const ATTENTION_SHOWN = 4;

/*
 * Mobile results view.
 *
 * The chart itself is computed by the same getChartPayload the desktop route
 * calls — this only decides how it is presented. The differences are the ones
 * that actually matter on a handset:
 *
 *   - sections collapse, so the page opens as a scannable table of contents
 *     rather than several thousand pixels of prose
 *   - planetary positions are a table with tabular figures instead of a row
 *     of hover cards, since there is no hover on a touch screen
 *   - nothing depends on pointer position or viewport width
 */

type Props = {
  payload: ChartApiResponse | null;
  error: string;
  desktopHref: string;
  historyQs: string;
  birthDate: string;
  /** As entered, HH:MM; the payload carries the zone but not the time. */
  birthTime: string;
  /** Married-life detail, computed on the server. */
  kalatra: KalatraResult | null;
  /**
   * The request's time, in milliseconds. Taken on the server and passed down,
   * so "how far through this period" is the same number in the server's HTML
   * and in the render that hydrates it, and render reads no clock.
   */
  asOf: number;
};

/* How far through a period `asOf` is, 0 to 1, or null when the dates do not
   describe one. The engine's dates are bare YYYY-MM-DD, read as UTC midnight,
   the same way formatDate below reads them. */
function periodProgress(start: string, end: string, asOf: number): number | null {
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  return Math.min(1, Math.max(0, (asOf - from) / (to - from)));
}

/* The translator useRouteMessages hands back. Passed down rather than each
   subcomponent calling the hook again: RuleCard renders once per finding, and
   the hook flattens the catalog per mount. */
type Translate = (key: string, params?: Record<string, string>) => string;

function formatDegree(value: number): string {
  const degrees = Math.floor(value);
  const minutes = Math.round((value - degrees) * 60);
  /* Carry 60' up to the next degree rather than printing 12°60'. */
  return minutes === 60 ? `${degrees + 1}°00'` : `${degrees}°${String(minutes).padStart(2, "0")}'`;
}

/*
 * A dasha boundary, as the calendar date the engine emitted.
 *
 * The formatter is built by the component and handed in, because the locale
 * has to follow the selected language: the prose around these dates is
 * translated, so a hardcoded "en-US" left a Hindi reader with Devanagari
 * wrapped around "12 Mar 2030". LOCALE_TAGS carries the note on why the tag is
 * derived from `language` rather than left as `undefined`, which is what
 * originally broke hydration on this page -- and, with it, the theme
 * bootstrap's writes in app/layout.tsx, stranding a reader who had chosen
 * Ethereal Dawn in the dark theme with no toggle on a handset to escape it.
 *
 * The zone stays pinned to UTC for a separate reason: nakshatra-engine emits
 * bare YYYY-MM-DD from UTC parts (msToDateStr), which `new Date` reads as UTC
 * midnight, so formatting in the reader's own zone moves every period boundary
 * to the day before anywhere west of Greenwich. Same trap
 * lib/format-birth-date.ts documents.
 */
function formatDate(value: string, format: Intl.DateTimeFormat): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format.format(date);
}

function Section({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={styles.section}>
      {/* The heading wraps the toggle, the accessible accordion pattern: each
          section is an h2 in the outline, and its findings' h3s sit under it. */}
      <h2 className={styles.sectionHeading}>
        <button
          type="button"
          className={styles.sectionHeader}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <span className={styles.sectionTitles}>
            <span className={styles.sectionTitle}>{title}</span>
            {subtitle && <span className={styles.sectionSubtitle}>{subtitle}</span>}
          </span>
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true">
            ⌄
          </span>
        </button>
      </h2>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </section>
  );
}

/**
 * The whole vimshottari cycle on one line: every period as wide as it is long,
 * the current one in vermilion, and where today falls marked under it.
 *
 * Hidden from assistive technology on purpose. It is a picture of the table
 * that follows it, which carries every date in words.
 */
function DashaLifeBar({
  periods,
  asOf,
  tr,
}: {
  periods: DashaInfo["periods"];
  asOf: number;
  tr: Translate;
}) {
  const first = Date.parse(periods[0]?.start_date ?? "");
  const last = Date.parse(periods[periods.length - 1]?.end_date ?? "");
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) return null;
  const span = last - first;
  const nowAt = Math.min(1, Math.max(0, (asOf - first) / span));

  return (
    <div aria-hidden="true">
      <div className={styles.lifeBar}>
        {periods.map((period) => {
          const start = Date.parse(period.start_date);
          const end = Date.parse(period.end_date);
          const length = Math.max(0, end - start);
          const isNow = asOf >= start && asOf < end;
          return (
            <span
              key={`${period.planet}-${period.start_date}`}
              className={`${styles.lifeSegment} ${isNow ? styles.lifeSegmentNow : ""}`}
              style={{ flexGrow: length, flexBasis: 0 }}
            >
              {/* Named only where a period is wide enough to hold the name. */}
              {length / span >= 0.075 ? planetAbbreviation(period.planet, tr) : ""}
            </span>
          );
        })}
      </div>
      <div className={styles.lifeScale}>
        <span>{new Date(first).getUTCFullYear()}</span>
        {/* Anchored in proportion to where it sits, so a marker near either
            end leans inward instead of running off the page. */}
        <span
          className={styles.lifeNow}
          style={{ left: `${(nowAt * 100).toFixed(1)}%`, transform: `translateX(-${(nowAt * 100).toFixed(1)}%)` }}
        >
          {tr("mobileInsights.nowMarker")}
        </span>
        <span>{new Date(last).getUTCFullYear()}</span>
      </div>
    </div>
  );
}

/**
 * One married-life facet.
 *
 * Flatter than the desktop card: no score meter, because at this width a
 * 4.5rem bar beside a wrapping title is two things fighting for one line and
 * the band label already says what the bar would. The per-finding citation
 * stays -- it is the reason this reading is worth more than a horoscope, and
 * dropping it on mobile would be dropping the part that is hard to fake.
 */
function KalatraFacetCard({ facet, tr }: { facet: KalatraFacet; tr: Translate }) {
  /* Spelled out rather than interpolated, for the same reason the attention
     section spells its two out: the mobile coverage test matches plain-string
     arguments, so `tr(`...${band}`)` is invisible to it and would pass by not
     being seen rather than by being covered. */
  const bandLabel =
    facet.band === "strong"
      ? tr("mobileInsights.kalatraBand.strong")
      : facet.band === "mixed"
        ? tr("mobileInsights.kalatraBand.mixed")
        : tr("mobileInsights.kalatraBand.tender");

  return (
    <li className={styles.facet}>
      <p className={styles.facetTitle}>
        {facet.label}
        <span data-band={facet.band}>{bandLabel}</span>
      </p>
      <p className={styles.facetSummary}>{facet.summary}</p>
      {facet.findings.length > 0 && (
        <ul className={styles.facetFindings}>
          {facet.findings.map((finding) => (
            <li key={finding.basis} data-polarity={finding.polarity}>
              <p>{finding.text}</p>
              <cite>{finding.basis}</cite>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.facetSourcing}>
        <span>{tr("mobileInsights.kalatraReadFrom")}</span> {facet.sourcing}
      </p>
    </li>
  );
}

/**
 * One reading, with its technical basis behind a disclosure.
 *
 * The open state is owned by MobileInsights rather than by this component:
 * `Section` unmounts its body when collapsed, so a `useState` in here would
 * reset every time the parent section was closed and reopened.
 */
function RuleCard({
  rule,
  open,
  onToggle,
  tr,
}: {
  rule: DeterministicRule;
  open: boolean;
  onToggle: () => void;
  tr: Translate;
}) {
  return (
    <li className={styles.rule}>
      <h3 className={styles.ruleTitle}>{rule.display.headline}</h3>
      <span className={styles.rarity}>{rule.display.rarity_label}</span>
      <p className={styles.ruleInsight}>{rule.display.body}</p>
      {rule.display.tension && <p className={styles.ruleTension}>{rule.display.tension}</p>}

      <button
        type="button"
        className={styles.evidenceToggle}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{tr("mobileInsights.whyThisReading")}</span>
        <span
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      {open && (
        <div className={styles.evidenceBody}>
          <p className={styles.ruleBasis}>{rule.evidence.technical_note}</p>
          <dl className={styles.claims}>
            {rule.evidence.claims.map((claim) => (
              <div key={claim.label} className={styles.claim}>
                <dt className={styles.claimLabel}>{claim.label}</dt>
                <dd className={styles.claimValue}>
                  {claim.value}
                  {claim.detail && <span className={styles.claimDetail}>{claim.detail}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </li>
  );
}

/**
 * What each house is responsible for — the /m twin of the block attached under
 * House Support on the desktop route.
 *
 * The desktop version sits beneath a bar chart that defines a bindu, and can
 * lean on it. There is no such chart here, so the count carries a one-line
 * explanation of its own; without it "Virgo · 27" is a number with no units.
 *
 * One row per house rather than the desktop's card grid: a handset column is
 * too narrow to put a name and a readout side by side without one of them
 * wrapping mid-word.
 */
function HouseRoleList({ houses, tr }: { houses: HouseSupport[]; tr: Translate }) {
  return (
    <>
      <p className={styles.legend}>{tr("mobileInsights.bindusLegend")}</p>

      <ul className={styles.roles}>
        {houses.map((house) => (
          <li key={house.house} className={styles.role} data-band={house.band}>
            <div className={styles.roleTop}>
              <span className={styles.roleNumber} aria-hidden="true">
                {house.house}
              </span>
              <span className={styles.roleName}>
                <span className={styles.srOnly}>
                  {tr("mobileInsights.srHouse", { house: String(house.house) })}
                </span>
                {tr("mobileInsights.bhava", { name: BHAVA_NAMES[house.house] })}
              </span>
              <span className={styles.roleReadout}>
                <span className={styles.srOnly}>
                  {tr("mobileInsights.srSupport", {
                    sign: signName(house.sign, tr),
                    bindus: String(house.bindus),
                  })}
                </span>
                <span aria-hidden="true">
                  {tr("mobileInsights.supportReadout", {
                    sign: signName(house.sign, tr),
                    bindus: String(house.bindus),
                  })}
                </span>
              </span>
            </div>

            <p className={styles.roleTheme}>{HOUSE_THEMES[house.house]}</p>

            <p className={styles.roleTags}>
              {HOUSE_GROUPS[house.house].map((group) => (
                <span key={group} className={styles.roleTag}>
                  {group}
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>

      <p className={styles.legend}>
        <Emphasise text={tr("mobileInsights.houseGroupLegend")} />
      </p>
    </>
  );
}

export default function MobileInsights({
  payload,
  error,
  desktopHref,
  historyQs,
  birthDate,
  birthTime,
  kalatra,
  asOf,
}: Props) {
  /* tr, not t: this page's copy is a namespace of its own that ships with the
     route rather than riding in the layout's baseline, where every mobile page
     would download it. tr reads the shared baseline first and falls back to
     that catalog. */
  const tr = useRouteMessages(insightsMessages);
  /* One formatter for the whole page rather than one per date: the dasha table
     alone prints two per period, and constructing an Intl.DateTimeFormat is
     the expensive half of formatting one. */
  const { language } = useTranslation();
  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(LOCALE_TAGS[language], {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    [language]
  );
  // Keyed by "section:instance_key". Only the attention list uses it now; the
  // full list below is a reading room, which keeps its own open item.
  const [openEvidence, setOpenEvidence] = useState<Record<string, boolean>>({});
  const toggleEvidence = (key: string) =>
    setOpenEvidence((prev) => ({ ...prev, [key]: !prev[key] }));
  const [showAllAttention, setShowAllAttention] = useState(false);

  const tab = useSyncExternalStore<TabId>(subscribeToHash, tabFromHash, () => "today");
  const hydrated = useHydrated();
  /* Every tab the reader has opened stays mounted, hidden, so going back to
     one keeps its open sections and the readings it has written. Today is the
     server's; the rest are added as they are shown, during render (the
     sanctioned way to adjust state to a value read in render). */
  const [visited, setVisited] = useState<ReadonlySet<TabId>>(() => new Set<TabId>(["today"]));
  if (!visited.has(tab)) setVisited(new Set([...visited, tab]));
  /* Today's written readings come out of the reader's daily allowance, so they
     start only once Today is on screen in the browser. Hydration reads the
     server's tab (Today) whatever the hash says, which would have spent them
     for a link to #chart. */
  const [todaySeen, setTodaySeen] = useState(false);
  if (hydrated && tab === "today" && !todaySeen) setTodaySeen(true);
  const tabsRef = useRef<HTMLDivElement>(null);

  /* The bar's edge fade, while there is more of it to scroll to, and the
     selected tab kept in view -- both on the element itself, not in state. */
  useEffect(() => {
    const bar = tabsRef.current;
    if (!bar) return;
    const mark = () => {
      bar.dataset.more = String(bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 1);
    };
    mark();
    bar.addEventListener("scroll", mark, { passive: true });
    /* The labels widen when the web font lands and when the language
       changes; the bar itself does not resize, so watch the tabs. */
    const resized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(mark);
    for (const button of bar.children) resized?.observe(button);
    resized?.observe(bar);
    return () => {
      bar.removeEventListener("scroll", mark);
      resized?.disconnect();
    };
  }, [hydrated, language]);

  useEffect(() => {
    document.getElementById(`m-tab-${tab}`)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [tab]);

  const selectTab = (next: TabId) => {
    if (next === tab) return;
    window.history.replaceState(null, "", `#${next}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    /* A tab opens at its top. From deep in a long tab, where the bar is stuck
       to the top of the screen, scroll back to just under the header -- where
       the bar sits unstuck. */
    const bar = tabsRef.current;
    const header = bar?.previousElementSibling;
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    if (bar && headerBottom < 0) window.scrollTo({ top: window.scrollY + headerBottom });
  };

  /* The tablist pattern: the arrows move between tabs, Home and End to the ends. */
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = TABS.indexOf(tab);
    const to =
      event.key === "ArrowRight" ? (at + 1) % TABS.length
        : event.key === "ArrowLeft" ? (at - 1 + TABS.length) % TABS.length
          : event.key === "Home" ? 0
            : event.key === "End" ? TABS.length - 1
              : -1;
    if (to < 0) return;
    event.preventDefault();
    selectTab(TABS[to]);
    document.getElementById(`m-tab-${TABS[to]}`)?.focus();
  };

  if (error || !payload) {
    return (
      <div className={shell.page}>
        <header className={shell.header}>
          <h1 className={shell.title}>{tr("mobileInsights.errorHeading")}</h1>
          <p className={shell.lead}>{error || tr("mobileInsights.errorFallback")}</p>
        </header>
        <Link className={styles.textLink} href="/m">
          {tr("mobileInsights.backToIntake")}
        </Link>
      </div>
    );
  }

  const { client, chart } = payload;
  const {
    ascendant,
    planets,
    houses,
    house_system: houseSystem,
    nakshatra,
    dasha,
    deterministic_rules: rules,
  } = chart;
  /* Null under Whole Sign, where a planet's bhava is its sign house and the
     table needs only the one column. */
  const bhavaSystem = bhavaSystemName(houseSystem, tr);

  const highPriority = (rules ?? []).filter((rule) => rule.priority === "high");

  /* Gated the same way the desktop panel gates it: without a Sarvashtakavarga
     block there are no bindus to show, and a titled collapsible that opens
     onto nothing reads as a failure rather than as an omission. */
  const houseSupport = computeHouseSupport(payload.ashtakavarga, houses);
  const moon = planets.find((planet) => planet.name === "Moon");

  /* The period the reader is in, narrowest first: the antardasha when the
     engine gave one, the mahadasha otherwise. */
  const nowStart = dasha ? dasha.current_antardasha_start || dasha.current_dasha_start : "";
  const nowEnd = dasha ? dasha.current_antardasha_end || dasha.current_dasha_end : "";
  const nowProgress = dasha ? periodProgress(nowStart, nowEnd, asOf) : null;

  const tabLabel: Record<TabId, string> = {
    today: tr("mobileInsights.tabToday"),
    chart: tr("mobileInsights.tabChart"),
    timing: tr("mobileInsights.tabTiming"),
    readings: tr("mobileInsights.tabReadings"),
    ask: tr("mobileInsights.tabAsk"),
  };

  /* The Antardasha's share gone, as a percentage: what the current-period
     route is told about where in the period the reader stands. */
  const antardashaPercent = nowProgress === null ? 0 : Math.round(nowProgress * 100);

  const panel = (id: TabId) => ({
    id: `m-tab-${id}-panel`,
    role: "tabpanel" as const,
    "aria-labelledby": `m-tab-${id}`,
    className: tabStyles.panel,
    hidden: tab !== id,
  });

  return (
    <div className={shell.page}>
      <header className={shell.header}>
        <h1 className={shell.title}>{client.name}</h1>
        <p className={styles.birthLine}>
          {[
            [client.city, client.country].filter(Boolean).join(", "),
            birthDate ? formatDate(birthDate, dateFormat) : "",
            birthTime,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <div ref={tabsRef} className={tabStyles.tabs} role="tablist" aria-label={tr("mobileInsights.tabsLabel")} onKeyDown={onTabKey}>
        {TABS.map((id) => (
          <button
            key={id}
            id={`m-tab-${id}`}
            type="button"
            role="tab"
            className={tabStyles.tab}
            aria-selected={tab === id}
            aria-controls={`m-tab-${id}-panel`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => selectTab(id)}
          >
            {tabLabel[id]}
          </button>
        ))}
      </div>

      {/* Today: where the reader is, what it means, the chapter running now. */}
      <div {...panel("today")}>
          {/* The answer before the reference: where the reader is in their
              timeline, then who the chart says they are, then the chart. */}
          {dasha && (
            <section className={styles.now} aria-labelledby="m-now-heading">
              <h2 id="m-now-heading" className={styles.nowLabel}>
                {tr("mobileInsights.nowLabel")}
              </h2>
              <p className={styles.nowTitle}>
                {planetName(dasha.current_dasha, tr)}
                {dasha.current_antardasha && (
                  <>
                    <span className={styles.nowJoin} aria-hidden="true">
                      {" · "}
                    </span>
                    {planetName(dasha.current_antardasha, tr)}
                  </>
                )}
              </p>
              <p className={styles.nowMeta}>
                {tr("mobileInsights.toDate", { date: formatDate(nowEnd, dateFormat) })}
              </p>
              {nowProgress !== null && (
                <div className={styles.nowTrack} aria-hidden="true">
                  <span className={styles.nowFill} style={{ width: `${(nowProgress * 100).toFixed(1)}%` }} />
                  <span className={styles.nowDot} style={{ left: `${(nowProgress * 100).toFixed(1)}%` }} />
                </div>
              )}
              {nowProgress !== null && (
                <p className={styles.nowRange} aria-hidden="true">
                  <span>{formatDate(nowStart, dateFormat)}</span>
                  <span>{formatDate(nowEnd, dateFormat)}</span>
                </p>
              )}
            </section>
          )}
        {/* Written for this chart, so mounted once the tab has been shown in
            the browser: a link to another tab does not spend a reading here. */}
        {todaySeen && dasha && nakshatra && (
          <MobileMeaning
            dasha={dasha}
            nakshatra={nakshatra}
            planets={planets}
            ascendantSign={ascendant.sign}
            antardashaPercent={antardashaPercent}
            tr={tr}
          />
        )}
        {todaySeen && <MobileTurningPoint payload={payload} historyQs={historyQs} tr={tr} />}
          {/* Below the reading, above the footer: the question is worth asking
              where somebody has finished, not in front of what they came for. */}
          <MobileChartSync
            historyQs={historyQs}
            name={client.name}
            city={client.city}
            birthDate={birthDate}
            ascendantSign={ascendant.sign}
            sunSign={planets.find((planet) => planet.name === "Sun")?.sign ?? null}
            moonSign={planets.find((planet) => planet.name === "Moon")?.sign ?? null}
          />
      </div>

      {/* Chart: who the chart says the reader is, and what exactly is where. */}
      {visited.has("chart") && (
        <div {...panel("chart")}>
            <dl className={styles.identity}>
              <div className={styles.identityItem}>
                <dt className={styles.identityLabel}>{tr("mobileInsights.factLagna")}</dt>
                <dd className={styles.identityValue}>{signName(ascendant.sign, tr)}</dd>
                <dd className={styles.identityMeta}>{formatDegree(ascendant.degree_in_sign)}</dd>
              </div>
              {nakshatra && (
                <div className={styles.identityItem}>
                  <dt className={styles.identityLabel}>{tr("mobileInsights.factNakshatra")}</dt>
                  <dd className={styles.identityValue}>{nakshatraName(nakshatra.name, tr)}</dd>
                  <dd className={styles.identityMeta}>
                    {tr("mobileInsights.padaLord", {
                      pada: String(nakshatra.pada),
                      lord: planetName(nakshatra.lord, tr),
                    })}
                  </dd>
                </div>
              )}
              {moon && (
                <div className={styles.identityItem}>
                  <dt className={styles.identityLabel}>{tr("mobileInsights.factMoonSign")}</dt>
                  <dd className={styles.identityValue}>{signName(moon.sign, tr)}</dd>
                  <dd className={styles.identityMeta}>{formatDegree(moon.degree_in_sign)}</dd>
                </div>
              )}
            </dl>
            {/* The chart above the table on purpose: it answers "what does my chart
                look like" at a glance, and the table answers "what exactly is where"
                for anyone who wants the numbers. */}
            <MobileRasiChart
              ascendantSign={ascendant.sign}
              planets={planets}
              houseSystem={houseSystem}
              tr={tr}
              formatDegree={formatDegree}
            />

            <Section
              title={tr("mobileInsights.planetaryPositions")}
              subtitle={tr("mobileInsights.grahaCount", { count: String(planets.length) })}
              defaultOpen
            >
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{tr("mobileInsights.colGraha")}</th>
                    <th scope="col">{tr("mobileInsights.colSign")}</th>
                    <th scope="col" className={styles.numeric}>{tr("mobileInsights.colDeg")}</th>
                    <th scope="col" className={styles.numeric}>{tr("mobileInsights.colHouse")}</th>
                    {bhavaSystem && (
                      <th scope="col" className={styles.numeric}>{tr("mobileInsights.colBhava")}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {planets.map((planet) => (
                    <tr key={planet.name}>
                      {/* Plain spans, not <abbr title>: a tooltip is unreachable on
                          a touch screen, so the meaning goes in the legend below. */}
                      <th scope="row" className={styles.planetName}>
                        {planetName(planet.name, tr)}
                        {planet.is_retrograde && (
                          <span className={styles.flag}>{tr("mobileInsights.flagRetrograde")}</span>
                        )}
                        {planet.is_combust && (
                          <span className={styles.flag}>{tr("mobileInsights.flagCombust")}</span>
                        )}
                      </th>
                      <td>
                        {/* The glyph is the fastest way to scan a column of signs;
                            the name stays because the glyph alone is not legible to
                            everyone. aria-hidden so it is not read twice. */}
                        <span className={styles.signGlyph} aria-hidden="true">
                          {/* U+FE0E forces text presentation. Without it the system
                              emoji font claims the zodiac symbols and renders them as
                              colour emoji, which ignores the text colour and reads
                              as a row of purple boxes. */}
                          {SIGN_SYMBOLS[planet.sign] ? `${SIGN_SYMBOLS[planet.sign]}︎` : ""}
                        </span>
                        {signName(planet.sign, tr)}
                      </td>
                      <td className={styles.numeric}>{formatDegree(planet.degree_in_sign)}</td>
                      {/* Counted by sign, so it matches the number in the chart's
                          cell above; the bhava, where it can differ, has its own
                          column. */}
                      <td className={styles.numeric}>{signHouse(planet.sign, ascendant.sign) ?? planet.house}</td>
                      {bhavaSystem && <td className={styles.numeric}>{planet.house}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {planets.some((p) => p.is_retrograde || p.is_combust) && (
                <p className={styles.legend}>{tr("mobileInsights.flagLegend")}</p>
              )}
              {bhavaSystem && (
                <p className={styles.legend}>{tr("mobileInsights.bhavaLegend", { system: bhavaSystem })}</p>
              )}
            </Section>

            {houseSupport && (
              <Section
                title={tr("mobileInsights.houseRolesTitle")}
                subtitle={tr("mobileInsights.houseRolesSubtitle")}
              >
                <HouseRoleList houses={houseSupport.houses} tr={tr} />
              </Section>
            )}
        </div>
      )}

      {/* Timing: the whole dasha cycle, and the way on to the timing tools and
          every life chapter, which are full pages of their own. */}
      {visited.has("timing") && (
        <div {...panel("timing")}>
            {dasha && (
              <Section
                title={tr("mobileInsights.dashaTitle")}
                subtitle={tr("mobileInsights.dashaPeriodCount", {
                  count: String(dasha.periods.length),
                })}
                /* Open, to match the timing detail on the desktop page: the current
                   dasha is the timing answer both pages exist to give, and it was
                   the one thing you had to tap for. */
                defaultOpen
              >
                <p className={styles.currentDasha}>
                  <Emphasise
                    text={tr("mobileInsights.dashaCurrent", {
                      dasha: planetName(dasha.current_dasha, tr),
                      antardasha: dasha.current_antardasha ? ` / ${planetName(dasha.current_antardasha, tr)}` : "",
                      date: formatDate(dasha.current_antardasha_end || dasha.current_dasha_end, dateFormat),
                    })}
                  />
                </p>
                <DashaLifeBar periods={dasha.periods} asOf={asOf} tr={tr} />
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{tr("mobileInsights.colPeriod")}</th>
                      <th scope="col">{tr("mobileInsights.colFrom")}</th>
                      <th scope="col">{tr("mobileInsights.colTo")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dasha.periods.map((period) => (
                      <tr
                        key={`${period.planet}-${period.start_date}`}
                        /* By date, not by planet: the cycle can name a planet twice
                           (Mercury opens and closes this one), and only one of the
                           two rows is now. */
                        className={
                          asOf >= Date.parse(period.start_date) && asOf < Date.parse(period.end_date)
                            ? styles.currentRow
                            : undefined
                        }
                      >
                        <th scope="row" className={styles.planetName}>{planetName(period.planet, tr)}</th>
                        <td className={styles.numeric}>{formatDate(period.start_date, dateFormat)}</td>
                        <td className={styles.numeric}>{formatDate(period.end_date, dateFormat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}
          <nav className={tabStyles.links}>
            <Link href={`/insights/timing?${historyQs}`} className={tabStyles.onward} prefetch={false}>
              <span>{tr("mobileInsights.timingToolsLink")}</span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link href={`/insights/life-shifts?${historyQs}`} className={tabStyles.onward} prefetch={false}>
              <span>{tr("mobileInsights.shiftsLink")}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </nav>
        </div>
      )}

      {/* Readings: what deserves attention, then everything the chart holds. */}
      {visited.has("readings") && (
        <div {...panel("readings")}>
            {highPriority.length > 0 && (
              <Section
                title={tr("mobileInsights.attentionTitle")}
                /* Both keys spelled out rather than picked by expression: the mobile
                   coverage test reads plain-string arguments, and a key assembled
                   from a ternary inside the call would be invisible to it. */
                subtitle={
                  highPriority.length === 1
                    ? tr("mobileInsights.attentionSubtitleOne", { count: "1" })
                    : tr("mobileInsights.attentionSubtitleOther", {
                        count: String(highPriority.length),
                      })
                }
                defaultOpen
              >
                <ul className={styles.rules}>
                  {(showAllAttention ? highPriority : highPriority.slice(0, ATTENTION_SHOWN)).map((rule) => (
                    <RuleCard
                      key={rule.instance_key}
                      rule={rule}
                      open={Boolean(openEvidence[`top:${rule.instance_key}`])}
                      onToggle={() => toggleEvidence(`top:${rule.instance_key}`)}
                      tr={tr}
                    />
                  ))}
                </ul>
                {!showAllAttention && highPriority.length > ATTENTION_SHOWN && (
                  <button type="button" className={tabStyles.moreButton} onClick={() => setShowAllAttention(true)}>
                    <span>
                      {highPriority.length - ATTENTION_SHOWN === 1
                        ? tr("mobileInsights.moreReadingsOne", { count: "1" })
                        : tr("mobileInsights.moreReadingsOther", { count: String(highPriority.length - ATTENTION_SHOWN) })}
                    </span>
                    <span aria-hidden="true">↓</span>
                  </button>
                )}
              </Section>
            )}
            {/* After the dasha table and before the summary: it is a deep read rather
                than a headline, and the sections above it are the ones somebody opens
                the page for. Closed by default -- unlike the dasha table above it,
                which is one of those headlines. */}
            {kalatra && (
              <Section
                title={tr("mobileInsights.kalatraTitle")}
                subtitle={tr("mobileInsights.kalatraSubtitle", {
                  count: String(kalatra.facets.length),
                })}
              >
                <ul className={styles.facets}>
                  {kalatra.facets.map((facet) => (
                    <KalatraFacetCard key={facet.key} facet={facet} tr={tr} />
                  ))}
                </ul>
                <p className={styles.facetMethod}>{kalatra.method}</p>
                {kalatra.mangal.present && (
                  <p className={styles.facetMethod}>{tr("mobileInsights.kalatraMangalCaveat")}</p>
                )}
              </Section>
            )}

            {chart.summary && (
              <Section title={tr("mobileInsights.summaryTitle")}>
                <p className={styles.summary}>{chart.summary}</p>
              </Section>
            )}

            {/* The full reading, as the desktop page lays it out: one line per item,
                and the item tapped opens underneath its row with its evidence. */}
            {(rules ?? []).length > highPriority.length && (
              <Section
                title={tr("mobileInsights.allReadingsTitle")}
                subtitle={tr("mobileInsights.allReadingsSubtitle", {
                  count: String((rules ?? []).length),
                })}
              >
                <MobileFindingsRoom rules={rules ?? []} />
              </Section>
            )}

            {(chart.yogas ?? []).length > 0 && (
              <Section
                title={tr("mobileInsights.yogasTitle")}
                subtitle={tr("mobileInsights.allReadingsSubtitle", {
                  count: String((chart.yogas ?? []).length),
                })}
              >
                <MobileYogasRoom yogas={chart.yogas ?? []} />
              </Section>
            )}

            <Section title={tr("mobileInsights.karmaTitle")} subtitle={tr("mobileInsights.karmaSubtitle")}>
              <MobileKarmaRoom payload={payload} />
            </Section>
        </div>
      )}

      {visited.has("ask") && (
        <div {...panel("ask")}>
          <MobileAsk historyQs={historyQs} tr={tr} />
        </div>
      )}

      <footer className={styles.footer}>
        <Link className={styles.textLink} href="/m">
          {tr("mobileInsights.newChart")}
        </Link>
        {/* ?view=desktop is honoured over the User-Agent guess and remembered,
            so this is a real escape hatch rather than a redirect loop. */}
        <Link className={styles.textLink} href={desktopHref} prefetch={false}>
          {tr("mobileInsights.desktopView")}
        </Link>
      </footer>
    </div>
  );
}
