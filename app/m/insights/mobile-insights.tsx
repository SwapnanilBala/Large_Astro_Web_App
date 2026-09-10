"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ChartApiResponse, DeterministicRule } from "@/lib/astro-types";
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
import MobileChart from "./mobile-chart";
import MobileChartSync from "./mobile-chart-sync";
import styles from "./insights.module.css";

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
};

/* The translator useRouteMessages hands back. Passed down rather than each
   subcomponent calling the hook again: RuleCard renders once per finding, and
   the hook flattens the catalog per mount. */
type Translate = (key: string, params?: Record<string, string>) => string;

/* Only these two tags, matched literally. */
const EMPHASIS = /<(b|strong)>([\s\S]*?)<\/\1>/g;

/**
 * Renders a catalog string whose emphasis is marked up inside the string.
 *
 * The alternative is cutting the sentence at every tag boundary, which hands a
 * translator " and " as a key of its own and pins the word order to English --
 * the house-group legend below would arrive as twelve fragments. Keeping the
 * markup in the string keeps it one sentence, and a language that emphasises a
 * different word can move the tags.
 *
 * Real elements, not innerHTML: the tag set is fixed and the text between the
 * tags is only ever inserted as a child, so a translation cannot bring markup
 * of its own along.
 */
function Emphasise({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(EMPHASIS)) {
    const at = match.index ?? 0;
    if (at > cursor) parts.push(text.slice(cursor, at));
    const Tag = match[1] as "b" | "strong";
    parts.push(<Tag key={at}>{match[2]}</Tag>);
    cursor = at + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

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
      {open && <div className={styles.sectionBody}>{children}</div>}
    </section>
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
                    sign: house.sign,
                    bindus: String(house.bindus),
                  })}
                </span>
                <span aria-hidden="true">
                  {tr("mobileInsights.supportReadout", {
                    sign: house.sign,
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
  // Keyed by "section:instance_key" so the same rule appearing in both the
  // above-the-fold list and the full list opens independently.
  const [openEvidence, setOpenEvidence] = useState<Record<string, boolean>>({});
  const toggleEvidence = (key: string) =>
    setOpenEvidence((prev) => ({ ...prev, [key]: !prev[key] }));

  if (error || !payload) {
    return (
      <div className={shell.page}>
        <header className={shell.header}>
          <h1 className={`${shell.title} mGold`}>{tr("mobileInsights.errorHeading")}</h1>
          <p className={shell.lead}>{error || tr("mobileInsights.errorFallback")}</p>
        </header>
        <Link className={styles.textLink} href="/m">
          {tr("mobileInsights.backToIntake")}
        </Link>
      </div>
    );
  }

  const { client, chart } = payload;
  const { ascendant, planets, houses, nakshatra, dasha, deterministic_rules: rules } = chart;

  const highPriority = (rules ?? []).filter((rule) => rule.priority === "high");

  /* Gated the same way the desktop panel gates it: without a Sarvashtakavarga
     block there are no bindus to show, and a titled collapsible that opens
     onto nothing reads as a failure rather than as an omission. */
  const houseSupport = computeHouseSupport(payload.ashtakavarga, houses);

  return (
    <div className={shell.page}>
      <header className={shell.header}>
        <span className={shell.step}>{[client.city, client.country].filter(Boolean).join(", ")}</span>
        <h1 className={shell.title}>{client.name}</h1>
        <p className={shell.lead}>
          {tr("mobileInsights.ascendantLead", { sign: ascendant.sign })}
          {nakshatra
            ? ` · ${tr("mobileInsights.nakshatraLead", { name: nakshatra.name })}`
            : ""}
        </p>
      </header>

      <div className={styles.keyFacts}>
        <div className={styles.fact}>
          <span className={styles.factLabel}>{tr("mobileInsights.factLagna")}</span>
          <span className={styles.factValue}>{ascendant.sign}</span>
          <span className={styles.factMeta}>{formatDegree(ascendant.degree_in_sign)}</span>
        </div>
        {nakshatra && (
          <div className={styles.fact}>
            <span className={styles.factLabel}>{tr("mobileInsights.factNakshatra")}</span>
            <span className={styles.factValue}>{nakshatra.name}</span>
            <span className={styles.factMeta}>
              {tr("mobileInsights.padaLord", {
                pada: String(nakshatra.pada),
                lord: nakshatra.lord,
              })}
            </span>
          </div>
        )}
        {dasha && (
          <div className={styles.fact}>
            <span className={styles.factLabel}>{tr("mobileInsights.factMahadasha")}</span>
            <span className={styles.factValue}>{dasha.current_dasha}</span>
            <span className={styles.factMeta}>
              {tr("mobileInsights.toDate", { date: formatDate(dasha.current_dasha_end, dateFormat) })}
            </span>
          </div>
        )}
      </div>

      {/* The wheel sits above the table on purpose: it answers "what does my
          chart look like" at a glance, and the table answers "what exactly is
          where" for anyone who wants the numbers. */}
      <MobileChart
        ascendantSign={ascendant.sign}
        houses={houses}
        planets={planets}
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
            </tr>
          </thead>
          <tbody>
            {planets.map((planet) => (
              <tr key={planet.name}>
                {/* Plain spans, not <abbr title>: a tooltip is unreachable on
                    a touch screen, so the meaning goes in the legend below. */}
                <th scope="row" className={styles.planetName}>
                  {planet.name}
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
                        colour emoji, which ignores the gold and reads as a row
                        of purple boxes. */}
                    {SIGN_SYMBOLS[planet.sign] ? `${SIGN_SYMBOLS[planet.sign]}︎` : ""}
                  </span>
                  {planet.sign}
                </td>
                <td className={styles.numeric}>{formatDegree(planet.degree_in_sign)}</td>
                <td className={styles.numeric}>{planet.house}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {planets.some((p) => p.is_retrograde || p.is_combust) && (
          <p className={styles.legend}>{tr("mobileInsights.flagLegend")}</p>
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
            {highPriority.map((rule) => (
              <RuleCard
                key={rule.instance_key}
                rule={rule}
                open={Boolean(openEvidence[`top:${rule.instance_key}`])}
                onToggle={() => toggleEvidence(`top:${rule.instance_key}`)}
                tr={tr}
              />
            ))}
          </ul>
        </Section>
      )}

      {dasha && (
        <Section
          title={tr("mobileInsights.dashaTitle")}
          subtitle={tr("mobileInsights.dashaPeriodCount", {
            count: String(dasha.periods.length),
          })}
        >
          <p className={styles.currentDasha}>
            <Emphasise
              text={tr("mobileInsights.dashaCurrent", {
                dasha: dasha.current_dasha,
                antardasha: dasha.current_antardasha ? ` / ${dasha.current_antardasha}` : "",
                date: formatDate(dasha.current_antardasha_end || dasha.current_dasha_end, dateFormat),
              })}
            />
          </p>
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
                  className={period.planet === dasha.current_dasha ? styles.currentRow : undefined}
                >
                  <th scope="row" className={styles.planetName}>{period.planet}</th>
                  <td className={styles.numeric}>{formatDate(period.start_date, dateFormat)}</td>
                  <td className={styles.numeric}>{formatDate(period.end_date, dateFormat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {chart.summary && (
        <Section title={tr("mobileInsights.summaryTitle")}>
          <p className={styles.summary}>{chart.summary}</p>
        </Section>
      )}

      {(rules ?? []).length > highPriority.length && (
        <Section
          title={tr("mobileInsights.allReadingsTitle")}
          subtitle={tr("mobileInsights.allReadingsSubtitle", {
            count: String((rules ?? []).length),
          })}
        >
          <ul className={styles.rules}>
            {(rules ?? []).map((rule) => (
              <RuleCard
                key={rule.instance_key}
                rule={rule}
                open={Boolean(openEvidence[`all:${rule.instance_key}`])}
                onToggle={() => toggleEvidence(`all:${rule.instance_key}`)}
                tr={tr}
              />
            ))}
          </ul>
        </Section>
      )}

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
