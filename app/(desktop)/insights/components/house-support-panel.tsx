import type { AshtakavargaData, HousePlacement } from "@/lib/astro-types";
import {
  AVERAGE_BINDUS_PER_HOUSE,
  BHAVA_NAMES,
  HOUSE_GROUPS,
  SAV_TOTAL_BINDUS,
  computeHouseSupport,
  type HouseSupport,
} from "@/lib/engines/house-support-engine";
import { HOUSE_THEMES } from "@/lib/rules/tables";
import styles from "./house-support-panel.module.css";

/*
 * No "use client", no dynamic(), no LazyPanel.
 *
 * This is a pure function of the chart — no clock, no randomness, no browser
 * API — so it server-renders and needs no hydration gate. It sits directly
 * under the constellation, near the top of the page, which is exactly where
 * the Major Life Shifts panel's two serial gates were costing a visible wait.
 * Repeating that here would be the same bug in a worse place.
 */

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
        aria-label={`House 1 holds ${support.bindus} bindus, ${support.percent}% of the ${AVERAGE_BINDUS_PER_HOUSE.toFixed(1)} average.`}
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
          of average
        </text>
      </svg>
    </div>
  );
}

function HouseBars({ houses }: { houses: HouseSupport[] }) {
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
      aria-label="Bindus in each of the twelve houses, against the 28.1 average."
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
              {house.sign.slice(0, 3)}
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
  return (
    <section className={styles.roles} aria-labelledby="house-support-roles-title">
      <div className={styles.rolesHead}>
        <span className={styles.cardKicker}>What each house answers for</span>
        <h3 className={styles.rolesTitle} id="house-support-roles-title">
          Which house is responsible for what
        </h3>
        <p className={styles.rolesIntro}>
          The bars above say how much support a house holds. This says what it
          holds it <em>for</em>. Each row carries the sign your chart puts on
          that house and the bindus that came with it, so a number above and a
          subject here are the same house.
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
              {house.house === strongestHouse && (
                <span className={styles.rolePeak}>best supported</span>
              )}
              {house.house === weakestHouse && (
                <span className={styles.rolePeak}>least supported</span>
              )}
            </p>
          </li>
        ))}
      </ul>

      <p className={styles.rolesLegend}>
        <b>Kendra</b> are the four angles the chart is built on;{" "}
        <b>Panaphara</b> and <b>Apoklima</b> are the houses that follow them and
        fall away from them. On top of that, <b>Trikona</b> houses are read as
        where merit arrives, <b>Upachaya</b> as the ones that improve with age
        and effort, and <b>Dusthana</b> as the ones that ask for something
        first. A house can be more than one — the 6th is an Upachaya and a
        Dusthana both, which is why difficulty there is usually read as the kind
        you grow out of.
      </p>
    </section>
  );
}

export default function HouseSupportPanel({
  ashtakavarga,
  houses,
}: {
  ashtakavarga: AshtakavargaData | null | undefined;
  houses: HousePlacement[] | null | undefined;
}) {
  const support = computeHouseSupport(ashtakavarga, houses);
  if (!support) return null;

  const { ascendant, whole } = support;

  return (
    <div className={styles.panel}>
      <p className={styles.intro}>
        Ashtakavarga scores every sign out of a fixed pool of{" "}
        <code>{SAV_TOTAL_BINDUS}</code> bindus — points of planetary support —
        and each house inherits the score of the sign on it. Dead average is{" "}
        <code>337 ÷ 12 = 28.1</code> bindus per house, so a house is read
        against that number rather than against a maximum. On the left, the
        first house alone: <code>bindus ÷ 28.1</code>, the support your chart
        gives the self. On the right, all twelve added back up against the same
        337 pool, which is where that support actually sits.
      </p>

      <div className={styles.columns}>
        <section className={styles.card} aria-labelledby="house-support-asc-title">
          <div className={styles.cardHead}>
            <span className={styles.cardKicker}>First house</span>
            <h3 className={styles.cardTitle} id="house-support-asc-title">
              Support for the self
            </h3>
            <p className={styles.formula}>
              {ascendant.bindus} bindus in {ascendant.sign} ÷ 28.1 average
            </p>
          </div>

          <AscendantRing support={ascendant} />

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>Sign on the 1st</dt>
              <dd className={styles.factValue}>{ascendant.sign}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>Bindus held</dt>
              <dd className={styles.factValue}>{ascendant.bindus} of 337</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>Against average</dt>
              <dd className={styles.factValue}>
                {ascendant.bindus > AVERAGE_BINDUS_PER_HOUSE ? "+" : ""}
                {Math.round((ascendant.bindus - AVERAGE_BINDUS_PER_HOUSE) * 10) / 10}
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.card} aria-labelledby="house-support-whole-title">
          <div className={styles.cardHead}>
            <span className={styles.cardKicker}>All twelve houses</span>
            <h3 className={styles.cardTitle} id="house-support-whole-title">
              Where the {whole.bindus} bindus sit
            </h3>
            <p className={styles.formula}>
              {whole.bindus} bindus across 12 houses ÷ 337 pool = {whole.percent}%
              {whole.totalIsExact ? " — the pool is fixed, so the reading is the spread" : ""}
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
                {band === "strong" && "28+ bindus"}
                {band === "neutral" && "26–27 bindus"}
                {band === "weak" && "25 or fewer"}
              </li>
            ))}
          </ul>

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>Above average</dt>
              <dd className={styles.factValue}>
                {whole.housesAbove} of 12 houses
              </dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>Best supported</dt>
              <dd className={styles.factValue}>
                House {whole.strongest.house} · {whole.strongest.sign} ·{" "}
                {whole.strongest.bindus}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>Least supported</dt>
              <dd className={styles.factValue}>
                House {whole.weakest.house} · {whole.weakest.sign} ·{" "}
                {whole.weakest.bindus}
              </dd>
            </div>
          </dl>

          {!whole.totalIsExact && (
            <p className={styles.caveat}>
              This chart&rsquo;s house system puts one sign on two cusps and
              leaves another with none, so the twelve houses do not add back to
              a clean 337 — {whole.bindus} here. The per-house figures stand;
              the total is reporting the house division as much as the chart.
            </p>
          )}
        </section>
      </div>

      <HouseRoles
        houses={support.houses}
        strongestHouse={whole.strongest.house}
        weakestHouse={whole.weakest.house}
      />

      <table className={styles.srOnly}>
        <caption>Bindus and support percentage by house</caption>
        <thead>
          <tr>
            <th scope="col">House</th>
            <th scope="col">Sign</th>
            <th scope="col">Bindus</th>
            <th scope="col">Percent of average</th>
          </tr>
        </thead>
        <tbody>
          {support.houses.map((house) => (
            <tr key={house.house}>
              <th scope="row">{house.house}</th>
              <td>{house.sign}</td>
              <td>{house.bindus}</td>
              <td>{house.percent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
