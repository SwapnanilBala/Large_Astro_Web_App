"use client";

import type { AshtakavargaData, HousePlacement } from "@/lib/astro-types";
import {
  AVERAGE_BINDUS_PER_HOUSE,
  HOUSE_GROUPS,
  SAV_TOTAL_BINDUS,
  computeHouseSupport,
  type HouseSupport,
} from "@/lib/engines/house-support-engine";
import { useRouteMessages, useTranslation } from "@/lib/i18n-context";
import strengthMessages from "@/messages/en.strength.json";
import styles from "./house-support-panel.module.css";

/*
 * "use client" for the translator, but no dynamic() and no LazyPanel.
 *
 * The copy here reads through useRouteMessages, which is a hook, so the panel
 * has to sit in the client graph. Nothing else about it changed: it is still a
 * pure function of the chart — no clock, no randomness, no browser API, no
 * effect — so it pre-renders on the server in one pass and hydrates without
 * waiting on anything. The results page already imported it from a client
 * component, so only /insights/house-support gains a boundary, and its props
 * (SAV totals, house placements, a variant string) are plain JSON.
 *
 * What must not come back is a lazy gate. This sits directly under the
 * constellation, near the top of the page, which is exactly where the Major
 * Life Shifts panel's two serial gates were costing a visible wait.
 *
 * The bhava names, house themes and group names used to be read straight off
 * the shared tables in lib/. They are copy, so they now come from the catalog
 * keyed by house number and by group name; the tables stay the source of the
 * groupings themselves.
 */

/** Sign names live in the baseline `zodiacSigns` namespace, not in this catalog. */
function signLabel(t: (key: string) => string, sign: string): string {
  return t(`zodiacSigns.${sign.toLowerCase()}`);
}

/* The ring is drawn to 150% rather than 100% so an above-average ascendant has
 * somewhere to go: capping at 100 would render every strong chart identically
 * to an average one. Anything past 150 pins to full and the printed number
 * still tells the truth. */
const RING_MAX_PERCENT = 150;
const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/* Observed SAV sign totals run roughly 18–40; 45 leaves headroom without
 * flattening the differences that matter. */
const BAR_MAX_BINDUS = 45;

const BAND_CLASS: Record<HouseSupport["band"], string> = {
  strong: styles.barStrong,
  neutral: styles.barNeutral,
  weak: styles.barWeak,
};

const BAND_SWATCH: Record<HouseSupport["band"], string> = {
  strong: "#7fd8c4",
  neutral: "#d4a574",
  weak: "#b98a86",
};

function polarPoint(angleDeg: number, radius: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [70 + radius * Math.cos(rad), 70 + radius * Math.sin(rad)];
}

function AscendantRing({ support }: { support: HouseSupport }) {
  const tr = useRouteMessages(strengthMessages);
  const fraction = Math.min(support.percent, RING_MAX_PERCENT) / RING_MAX_PERCENT;
  const dash = RING_CIRCUMFERENCE * fraction;

  // Where 100% falls on a 0–150% dial.
  const baselineAngle = (100 / RING_MAX_PERCENT) * 360;
  const [bx1, by1] = polarPoint(baselineAngle, RING_RADIUS - 9);
  const [bx2, by2] = polarPoint(baselineAngle, RING_RADIUS + 9);
  const [lx, ly] = polarPoint(baselineAngle, RING_RADIUS + 17);

  return (
    <div className={styles.ringWrap}>
      <svg
        viewBox="0 0 140 140"
        className={styles.ring}
        role="img"
        aria-label={tr("strength.houseSupport.ringAriaLabel", {
          bindus: String(support.bindus),
          percent: String(support.percent),
          average: AVERAGE_BINDUS_PER_HOUSE.toFixed(1),
        })}
      >
        <defs>
          <linearGradient id="houseSupportRingGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f8e3a8" />
            <stop offset="55%" stopColor="#d4a574" />
            <stop offset="100%" stopColor="#6ce1d4" />
          </linearGradient>
        </defs>

        <circle className={styles.ringTrack} cx="70" cy="70" r={RING_RADIUS} />
        <circle
          className={styles.ringValue}
          cx="70"
          cy="70"
          r={RING_RADIUS}
          strokeDasharray={`${dash} ${RING_CIRCUMFERENCE}`}
          transform="rotate(-90 70 70)"
        />

        <line className={styles.ringBaseline} x1={bx1} y1={by1} x2={bx2} y2={by2} />
        <text className={styles.ringBaselineLabel} x={lx} y={ly + 3}>
          100%
        </text>

        <text className={styles.ringPercent} x="70" y="70">
          {support.percent}%
        </text>
        <text className={styles.ringCaption} x="70" y="86">
          {tr("strength.houseSupport.ringCaption")}
        </text>
      </svg>
    </div>
  );
}

function HouseBars({ houses }: { houses: HouseSupport[] }) {
  const tr = useRouteMessages(strengthMessages);
  const width = 560;
  const height = 200;
  const padTop = 18;
  const padBottom = 34;
  const plotHeight = height - padTop - padBottom;
  const slot = width / houses.length;
  const barWidth = slot * 0.56;

  const baselineY = padTop + plotHeight * (1 - AVERAGE_BINDUS_PER_HOUSE / BAR_MAX_BINDUS);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={styles.bars}
      role="img"
      aria-label={tr("strength.houseSupport.barsAriaLabel")}
    >
      {houses.map((house, index) => {
        const barHeight = plotHeight * (Math.min(house.bindus, BAR_MAX_BINDUS) / BAR_MAX_BINDUS);
        const x = index * slot + (slot - barWidth) / 2;
        const y = padTop + plotHeight - barHeight;
        return (
          <g key={house.house}>
            <rect
              className={styles.barTrack}
              x={x}
              y={padTop}
              width={barWidth}
              height={plotHeight}
              rx="4"
            />
            <rect
              className={BAND_CLASS[house.band]}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="4"
            />
            <text className={styles.barValueLabel} x={x + barWidth / 2} y={y - 4}>
              {house.bindus}
            </text>
            <text
              className={styles.barHouseLabel}
              x={x + barWidth / 2}
              y={height - padBottom + 15}
            >
              {house.house}
            </text>
            <text
              className={styles.barHouseLabel}
              x={x + barWidth / 2}
              y={height - padBottom + 27}
            >
              {tr(`strength.signAbbr.${house.sign.toLowerCase()}`)}
            </text>
          </g>
        );
      })}

      <line
        className={styles.barBaseline}
        x1="0"
        y1={baselineY}
        x2={width - 34}
        y2={baselineY}
      />
      <text className={styles.barBaselineLabel} x={width - 30} y={baselineY + 3}>
        28.1
      </text>
    </svg>
  );
}

function HouseRoles({
  houses,
  strongestHouse,
  weakestHouse,
}: {
  houses: HouseSupport[];
  strongestHouse: number;
  weakestHouse: number;
}) {
  const { t } = useTranslation();
  const tr = useRouteMessages(strengthMessages);

  return (
    <section className={styles.roles} aria-labelledby="house-support-roles-title">
      <div className={styles.rolesHead}>
        <span className={styles.cardKicker}>{tr("strength.roles.kicker")}</span>
        <h3 className={styles.rolesTitle} id="house-support-roles-title">
          {tr("strength.roles.title")}
        </h3>
        <p className={styles.rolesIntro}>
          {tr("strength.roles.introA")} <em>{tr("strength.roles.introEm")}</em>
          {tr("strength.roles.introB")}
        </p>
      </div>

      <ul className={styles.roleGrid}>
        {houses.map((house) => (
          <li
            key={house.house}
            className={styles.role}
            data-band={house.band}
            data-peak={
              house.house === strongestHouse
                ? "strongest"
                : house.house === weakestHouse
                  ? "weakest"
                  : undefined
            }
          >
            <div className={styles.roleTop}>
              <span className={styles.roleNumber} aria-hidden="true">
                {house.house}
              </span>
              <span className={styles.roleName}>
                <span className={styles.srOnly}>
                  {tr("strength.roles.srHouse", { house: String(house.house) })}{" "}
                </span>
                {tr("strength.roles.bhavaLabel", {
                  name: tr(`strength.bhavaNames.${house.house}`),
                })}
              </span>
              <span className={styles.roleReadout}>
                <span className={styles.srOnly}>
                  {tr("strength.roles.srReadout", {
                    sign: signLabel(t, house.sign),
                    bindus: String(house.bindus),
                  })}
                </span>
                <span aria-hidden="true">
                  {tr("strength.roles.readout", {
                    sign: signLabel(t, house.sign),
                    bindus: String(house.bindus),
                  })}
                </span>
              </span>
            </div>

            <p className={styles.roleTheme}>
              {tr(`strength.houseThemes.${house.house}`)}
            </p>

            <p className={styles.roleTags}>
              {HOUSE_GROUPS[house.house].map((group) => (
                <span key={group} className={styles.roleTag}>
                  {tr(`strength.houseGroups.${group.toLowerCase()}`)}
                </span>
              ))}
              {house.house === strongestHouse && (
                <span className={styles.rolePeak}>{tr("strength.roles.peakBest")}</span>
              )}
              {house.house === weakestHouse && (
                <span className={styles.rolePeak}>{tr("strength.roles.peakLeast")}</span>
              )}
            </p>
          </li>
        ))}
      </ul>

      {/* Six segments rather than one string: the group names stay <b>, and a
          translator cannot bold anything through t(), which returns a string. */}
      <p className={styles.rolesLegend}>
        <b>{tr("strength.houseGroups.kendra")}</b> {tr("strength.roles.legendA")}{" "}
        <b>{tr("strength.houseGroups.panaphara")}</b> {tr("strength.roles.legendB")}{" "}
        <b>{tr("strength.houseGroups.apoklima")}</b> {tr("strength.roles.legendC")}{" "}
        <b>{tr("strength.houseGroups.trikona")}</b> {tr("strength.roles.legendD")}{" "}
        <b>{tr("strength.houseGroups.upachaya")}</b> {tr("strength.roles.legendE")}{" "}
        <b>{tr("strength.houseGroups.dusthana")}</b> {tr("strength.roles.legendF")}
      </p>
    </section>
  );
}

/*
 * `brief` is what the results page gets: the two instruments and one sentence
 * of scaffolding. `full` is /insights/house-support, which adds the derivation
 * and the twelve-house reference.
 *
 * A variant rather than two components. The ring, the bars and the band
 * thresholds are the reading itself -- a second copy would be a second place
 * for 28.1 to go stale.
 */
export default function HouseSupportPanel({
  ashtakavarga,
  houses,
  variant = "full",
}: {
  ashtakavarga: AshtakavargaData | null | undefined;
  houses: HousePlacement[] | null | undefined;
  variant?: "brief" | "full";
}) {
  const { t } = useTranslation();
  const tr = useRouteMessages(strengthMessages);
  const support = computeHouseSupport(ashtakavarga, houses);
  if (!support) return null;

  const { ascendant, whole } = support;
  const isBrief = variant === "brief";

  return (
    <div className={styles.panel}>
      {isBrief ? (
        <p className={styles.intro}>
          {tr("strength.houseSupport.introBriefA")}{" "}
          <code>{SAV_TOTAL_BINDUS}</code>{" "}
          {tr("strength.houseSupport.introBriefB")} <code>28.1</code>
          {tr("strength.houseSupport.introBriefC")}
        </p>
      ) : (
        <p className={styles.intro}>
          {tr("strength.houseSupport.introFullA")}{" "}
          <code>{SAV_TOTAL_BINDUS}</code>{" "}
          {tr("strength.houseSupport.introFullB")}{" "}
          <code>337 ÷ 12 = 28.1</code>{" "}
          {tr("strength.houseSupport.introFullC")}{" "}
          <code>{tr("strength.houseSupport.introFullRatioFormula")}</code>
          {tr("strength.houseSupport.introFullD")}
        </p>
      )}

      <div className={styles.columns}>
        <section className={styles.card} aria-labelledby="house-support-asc-title">
          <div className={styles.cardHead}>
            <span className={styles.cardKicker}>
              {tr("strength.houseSupport.ascKicker")}
            </span>
            <h3 className={styles.cardTitle} id="house-support-asc-title">
              {tr("strength.houseSupport.ascTitle")}
            </h3>
            <p className={styles.formula}>
              {tr("strength.houseSupport.ascFormula", {
                bindus: String(ascendant.bindus),
                sign: signLabel(t, ascendant.sign),
              })}
            </p>
          </div>

          <AscendantRing support={ascendant} />

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>
                {tr("strength.houseSupport.ascSignLabel")}
              </dt>
              <dd className={styles.factValue}>{signLabel(t, ascendant.sign)}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>
                {tr("strength.houseSupport.ascBindusLabel")}
              </dt>
              <dd className={styles.factValue}>
                {tr("strength.houseSupport.ascBindusValue", {
                  bindus: String(ascendant.bindus),
                })}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>
                {tr("strength.houseSupport.ascAgainstAverageLabel")}
              </dt>
              <dd className={styles.factValue}>
                {ascendant.bindus > AVERAGE_BINDUS_PER_HOUSE ? "+" : ""}
                {Math.round((ascendant.bindus - AVERAGE_BINDUS_PER_HOUSE) * 10) / 10}
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.card} aria-labelledby="house-support-whole-title">
          <div className={styles.cardHead}>
            <span className={styles.cardKicker}>
              {tr("strength.houseSupport.wholeKicker")}
            </span>
            <h3 className={styles.cardTitle} id="house-support-whole-title">
              {tr("strength.houseSupport.wholeTitle", {
                bindus: String(whole.bindus),
              })}
            </h3>
            <p className={styles.formula}>
              {tr("strength.houseSupport.wholeFormula", {
                bindus: String(whole.bindus),
                percent: String(whole.percent),
              })}
              {whole.totalIsExact
                ? ` ${tr("strength.houseSupport.wholeFormulaExact")}`
                : ""}
            </p>
          </div>

          <HouseBars houses={support.houses} />

          <ul className={styles.legend}>
            {(["strong", "neutral", "weak"] as const).map((band) => (
              <li key={band} className={styles.legendItem}>
                <span
                  className={styles.legendSwatch}
                  style={{ background: BAND_SWATCH[band] }}
                  aria-hidden="true"
                />
                {band === "strong" && tr("strength.houseSupport.bandStrong")}
                {band === "neutral" && tr("strength.houseSupport.bandNeutral")}
                {band === "weak" && tr("strength.houseSupport.bandWeak")}
              </li>
            ))}
          </ul>

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>
                {tr("strength.houseSupport.aboveAverageLabel")}
              </dt>
              <dd className={styles.factValue}>
                {tr("strength.houseSupport.aboveAverageValue", {
                  count: String(whole.housesAbove),
                })}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>
                {tr("strength.houseSupport.bestSupportedLabel")}
              </dt>
              <dd className={styles.factValue}>
                {tr("strength.houseSupport.houseReadout", {
                  house: String(whole.strongest.house),
                  sign: signLabel(t, whole.strongest.sign),
                  bindus: String(whole.strongest.bindus),
                })}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>
                {tr("strength.houseSupport.leastSupportedLabel")}
              </dt>
              <dd className={styles.factValue}>
                {tr("strength.houseSupport.houseReadout", {
                  house: String(whole.weakest.house),
                  sign: signLabel(t, whole.weakest.sign),
                  bindus: String(whole.weakest.bindus),
                })}
              </dd>
            </div>
          </dl>

          {!whole.totalIsExact && (
            <p className={styles.caveat}>
              {tr("strength.houseSupport.caveat", {
                bindus: String(whole.bindus),
              })}
            </p>
          )}
        </section>
      </div>

      {/* The twelve-house reference is 2,084 of this panel's 3,478 characters.
          It is a lookup table, not a reading, so the results page links to it
          instead of printing it under a section that opens by default. */}
      {!isBrief && (
        <HouseRoles
          houses={support.houses}
          strongestHouse={whole.strongest.house}
          weakestHouse={whole.weakest.house}
        />
      )}

      <table className={styles.srOnly}>
        <caption>{tr("strength.houseSupport.tableCaption")}</caption>
        <thead>
          <tr>
            <th scope="col">{tr("strength.houseSupport.tableHouse")}</th>
            <th scope="col">{tr("strength.houseSupport.tableSign")}</th>
            <th scope="col">{tr("strength.houseSupport.tableBindus")}</th>
            <th scope="col">{tr("strength.houseSupport.tablePercent")}</th>
          </tr>
        </thead>
        <tbody>
          {support.houses.map((house) => (
            <tr key={house.house}>
              <th scope="row">{house.house}</th>
              <td>{signLabel(t, house.sign)}</td>
              <td>{house.bindus}</td>
              <td>{house.percent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
