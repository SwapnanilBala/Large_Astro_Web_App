"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChartApiResponse, DeterministicRule } from "@/lib/astro-types";
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
}: {
  rule: DeterministicRule;
  open: boolean;
  onToggle: () => void;
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
        <span>Why this reading</span>
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
function HouseRoleList({ houses }: { houses: HouseSupport[] }) {
  return (
    <>
      <p className={styles.legend}>
        Bindus are Ashtakavarga&rsquo;s support score for the sign sitting on
        that house, out of a fixed pool of 337. Dead average is 28.1, so a house
        is read against that rather than against a maximum.
      </p>

      <ul className={styles.roles}>
        {houses.map((house) => (
          <li key={house.house} className={styles.role} data-band={house.band}>
            <div className={styles.roleTop}>
              <span className={styles.roleNumber} aria-hidden="true">
                {house.house}
              </span>
              <span className={styles.roleName}>
                <span className={styles.srOnly}>House {house.house}, </span>
                {BHAVA_NAMES[house.house]} Bhava
              </span>
              <span className={styles.roleReadout}>
                <span className={styles.srOnly}>
                  {house.sign}, {house.bindus} bindus
                </span>
                <span aria-hidden="true">
                  {house.sign} · {house.bindus}
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
        <b>Kendra</b> are the four angles the chart is built on; <b>Panaphara</b>{" "}
        and <b>Apoklima</b> are the houses that follow them and fall away from
        them. On top of that, <b>Trikona</b> houses are read as where merit
        arrives, <b>Upachaya</b> as the ones that improve with age and effort,
        and <b>Dusthana</b> as the ones that ask for something first. A house can
        be more than one — the 6th is an Upachaya and a Dusthana both.
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
  // Keyed by "section:instance_key" so the same rule appearing in both the
  // above-the-fold list and the full list opens independently.
  const [openEvidence, setOpenEvidence] = useState<Record<string, boolean>>({});
  const toggleEvidence = (key: string) =>
    setOpenEvidence((prev) => ({ ...prev, [key]: !prev[key] }));

  if (error || !payload) {
    return (
      <div className={shell.page}>
        <header className={shell.header}>
          <h1 className={`${shell.title} mGold`}>Could not build this chart</h1>
          <p className={shell.lead}>{error || "The chart could not be calculated."}</p>
        </header>
        <Link className={styles.textLink} href="/m">
          Back to intake
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

      {/* The wheel sits above the table on purpose: it answers "what does my
          chart look like" at a glance, and the table answers "what exactly is
          where" for anyone who wants the numbers. */}
      <MobileChart
        ascendantSign={ascendant.sign}
        houses={houses}
        planets={planets}
      />

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
                {/* Plain spans, not <abbr title>: a tooltip is unreachable on
                    a touch screen, so the meaning goes in the legend below. */}
                <th scope="row" className={styles.planetName}>
                  {planet.name}
                  {planet.is_retrograde && <span className={styles.flag}>Rx</span>}
                  {planet.is_combust && <span className={styles.flag}>Cmb</span>}
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
          <p className={styles.legend}>
            Rx = moving backwards from here · Cmb = too close to the Sun to act freely
          </p>
        )}
      </Section>

      {houseSupport && (
        <Section
          title="Which house is responsible for what"
          subtitle="All twelve, and the support each holds"
        >
          <HouseRoleList houses={houseSupport.houses} />
        </Section>
      )}

      {highPriority.length > 0 && (
        <Section
          title="What deserves attention"
          subtitle={`${highPriority.length} high-priority reading${highPriority.length === 1 ? "" : "s"}`}
          defaultOpen
        >
          <ul className={styles.rules}>
            {highPriority.map((rule) => (
              <RuleCard
                key={rule.instance_key}
                rule={rule}
                open={Boolean(openEvidence[`top:${rule.instance_key}`])}
                onToggle={() => toggleEvidence(`top:${rule.instance_key}`)}
              />
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
              <RuleCard
                key={rule.instance_key}
                rule={rule}
                open={Boolean(openEvidence[`all:${rule.instance_key}`])}
                onToggle={() => toggleEvidence(`all:${rule.instance_key}`)}
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
