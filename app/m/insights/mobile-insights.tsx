"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChartApiResponse } from "@/lib/astro-types";
import shell from "../mobile.module.css";
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
};

function formatDegree(value: number): string {
  const degrees = Math.floor(value);
  const minutes = Math.round((value - degrees) * 60);
  /* Carry 60' up to the next degree rather than printing 12°60'. */
  return minutes === 60 ? `${degrees + 1}°00'` : `${degrees}°${String(minutes).padStart(2, "0")}'`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
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

export default function MobileInsights({ payload, error, desktopHref }: Props) {
  if (error || !payload) {
    return (
      <div className={shell.page}>
        <header className={shell.header}>
          <h1 className={shell.title}>Could not build this chart</h1>
          <p className={shell.lead}>{error || "The chart could not be calculated."}</p>
        </header>
        <Link className={styles.textLink} href="/m">
          Back to intake
        </Link>
      </div>
    );
  }

  const { client, chart } = payload;
  const { ascendant, planets, nakshatra, dasha, deterministic_rules: rules } = chart;

  const highPriority = (rules ?? []).filter((rule) => rule.priority === "high");

  return (
    <div className={shell.page}>
      <header className={shell.header}>
        <span className={shell.step}>{[client.city, client.country].filter(Boolean).join(", ")}</span>
        <h1 className={shell.title}>{client.name}</h1>
        <p className={shell.lead}>
          {ascendant.sign} ascendant
          {nakshatra ? ` · ${nakshatra.name} nakshatra` : ""}
        </p>
      </header>

      <div className={styles.keyFacts}>
        <div className={styles.fact}>
          <span className={styles.factLabel}>Lagna</span>
          <span className={styles.factValue}>{ascendant.sign}</span>
          <span className={styles.factMeta}>{formatDegree(ascendant.degree_in_sign)}</span>
        </div>
        {nakshatra && (
          <div className={styles.fact}>
            <span className={styles.factLabel}>Nakshatra</span>
            <span className={styles.factValue}>{nakshatra.name}</span>
            <span className={styles.factMeta}>Pada {nakshatra.pada} · {nakshatra.lord}</span>
          </div>
        )}
        {dasha && (
          <div className={styles.fact}>
            <span className={styles.factLabel}>Mahadasha</span>
            <span className={styles.factValue}>{dasha.current_dasha}</span>
            <span className={styles.factMeta}>to {formatDate(dasha.current_dasha_end)}</span>
          </div>
        )}
      </div>

      <Section title="Planetary positions" subtitle={`${planets.length} grahas`} defaultOpen>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Graha</th>
              <th scope="col">Sign</th>
              <th scope="col" className={styles.numeric}>Deg</th>
              <th scope="col" className={styles.numeric}>Hse</th>
            </tr>
          </thead>
          <tbody>
            {planets.map((planet) => (
              <tr key={planet.name}>
                <th scope="row" className={styles.planetName}>
                  {planet.name}
                  {planet.is_retrograde && (
                    <abbr className={styles.flag} title="Retrograde">R</abbr>
                  )}
                  {planet.is_combust && (
                    <abbr className={styles.flag} title="Combust">C</abbr>
                  )}
                </th>
                <td>{planet.sign}</td>
                <td className={styles.numeric}>{formatDegree(planet.degree_in_sign)}</td>
                <td className={styles.numeric}>{planet.house}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {highPriority.length > 0 && (
        <Section
          title="What deserves attention"
          subtitle={`${highPriority.length} high-priority reading${highPriority.length === 1 ? "" : "s"}`}
          defaultOpen
        >
          <ul className={styles.rules}>
            {highPriority.map((rule) => (
              <li key={rule.title} className={styles.rule}>
                <h3 className={styles.ruleTitle}>{rule.title}</h3>
                <p className={styles.ruleInsight}>{rule.insight}</p>
                <p className={styles.ruleBasis}>{rule.basis}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {dasha && (
        <Section title="Dasha timeline" subtitle={`${dasha.periods.length} periods`}>
          <p className={styles.currentDasha}>
            Currently <strong>{dasha.current_dasha}</strong>
            {dasha.current_antardasha ? ` / ${dasha.current_antardasha}` : ""} until{" "}
            {formatDate(dasha.current_antardasha_end || dasha.current_dasha_end)}
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">From</th>
                <th scope="col">To</th>
              </tr>
            </thead>
            <tbody>
              {dasha.periods.map((period) => (
                <tr
                  key={`${period.planet}-${period.start_date}`}
                  className={period.planet === dasha.current_dasha ? styles.currentRow : undefined}
                >
                  <th scope="row" className={styles.planetName}>{period.planet}</th>
                  <td className={styles.numeric}>{formatDate(period.start_date)}</td>
                  <td className={styles.numeric}>{formatDate(period.end_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {chart.summary && (
        <Section title="Summary">
          <p className={styles.summary}>{chart.summary}</p>
        </Section>
      )}

      {(rules ?? []).length > highPriority.length && (
        <Section
          title="All readings"
          subtitle={`${(rules ?? []).length} total`}
        >
          <ul className={styles.rules}>
            {(rules ?? []).map((rule) => (
              <li key={rule.title} className={styles.rule}>
                <h3 className={styles.ruleTitle}>
                  {rule.title}
                  <span className={styles.priority}>{rule.priority}</span>
                </h3>
                <p className={styles.ruleInsight}>{rule.insight}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <footer className={styles.footer}>
        <Link className={styles.textLink} href="/m">
          New chart
        </Link>
        {/* ?view=desktop is honoured over the User-Agent guess and remembered,
            so this is a real escape hatch rather than a redirect loop. */}
        <Link className={styles.textLink} href={desktopHref} prefetch={false}>
          Full desktop view
        </Link>
      </footer>
    </div>
  );
}
