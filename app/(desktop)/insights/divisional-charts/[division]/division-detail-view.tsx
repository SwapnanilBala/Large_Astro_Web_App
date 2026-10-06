"use client";

import Link from "next/link";
import {
  IMPORTANT_DIVISIONAL_CHARTS,
  divisionalGuideKey,
  type DivisionalChartSensitivity,
  type DivisionalGuideField,
} from "@/lib/divisional-chart-guide";
import type {
  DivisionalBoundaryDistance,
  DivisionalChartDetail,
  DivisionalDetailPosition,
} from "@/lib/divisional-chart-detail";
import { LOCALE_TAGS, useRouteMessages, useTranslation } from "@/lib/i18n-context";
import { planetName, pointName, signName } from "@/lib/chart-labels";
import divisionalMessages from "@/messages/en.divisional.json";
import styles from "./divisional-chart-detail.module.css";

/*
 * Everything the key-varga detail page renders.
 *
 * The page next to this file stays a server component: it awaits params and
 * searchParams and calls getChartPayload, none of which survives
 * "use client". Its copy — the largest single body of it in this area — has to
 * reach useRouteMessages all the same, so the presentation moved here whole
 * and the page hands it a plain, already-derived view model.
 *
 * The split follows that constraint. Anything needing the ephemeris stays on
 * the page; anything that is a pure function of the payload (which points are
 * key placements, which boundary is nearest, the adjacent vargas) is derived
 * here, next to the strings that describe it. The one exception is the dasha
 * date range: Intl formatting runs against the server's time zone, so the
 * page formats it and passes the result, leaving only the empty-range fallback
 * to be translated here.
 */

type PositionRow = {
  position: DivisionalDetailPosition;
  boundary: DivisionalBoundaryDistance | null;
};

type TimingPlacement = {
  kind: "mahadasha" | "antardasha";
  planet: string;
  /** The period's dates as the engine gives them; empty when it gives none. */
  start: string;
  end: string;
};

type DivisionDetailViewProps = {
  detail: DivisionalChartDetail;
  positionRows: PositionRow[];
  /** Shadbala delivery ratio by planet, for the classical seven. */
  strengthRatios: Record<string, number>;
  currentMahadasha: string | null;
  currentAntardasha: string | null;
  timingPlacements: TimingPlacement[];
  engine: {
    engineLabel: string;
    ephemerisProvider: string;
    ayanamsha: string;
    houseSystem: string;
    /** The registry's code for the house system, which names it in the catalog. */
    houseSystemCode: string;
  };
  /** Every division the payload returned, for the adjacent-varga pager. */
  availableDivisions: number[];
  historyQuery: string;
  atlasHref: string;
  readingHref: string;
  birthTimeAccuracy: string;
  birthTimeFallback: boolean;
};

type Translate = (key: string, params?: Record<string, string>) => string;

const CLASSICAL_PLANETS = new Set([
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
]);

const PLANET_GLYPHS: Record<string, string> = {
  Ascendant: "↑",
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Rahu: "☊",
  Ketu: "☋",
};

/* South-Indian charts keep signs in fixed positions. House numbers rotate from
 * the divisional ascendant and are supplied by buildDivisionalChartDetail. */
const SOUTH_INDIAN_LAYOUT = [
  { sign: "Pisces", area: "pisces" },
  { sign: "Aries", area: "aries" },
  { sign: "Taurus", area: "taurus" },
  { sign: "Gemini", area: "gemini" },
  { sign: "Aquarius", area: "aquarius" },
  { sign: "Cancer", area: "cancer" },
  { sign: "Capricorn", area: "capricorn" },
  { sign: "Leo", area: "leo" },
  { sign: "Sagittarius", area: "sagittarius" },
  { sign: "Scorpio", area: "scorpio" },
  { sign: "Libra", area: "libra" },
  { sign: "Virgo", area: "virgo" },
] as const;

const TIMING_LABEL_KEY: Record<TimingPlacement["kind"], string> = {
  mahadasha: "divisional.detail.timing.mahadasha",
  antardasha: "divisional.detail.timing.antardasha",
};

function withQuery(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}

function humanizeToken(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* The engine's dignities (PlanetDignity), worded by divisional.detail.dignities. */
export const DIGNITIES = ["exalted", "own_sign", "debilitated", "neutral"] as const;

function dignityLabel(tr: Translate, dignity: string): string {
  const key = `divisional.detail.dignities.${dignity}`;
  const text = tr(key);
  return text === key ? humanizeToken(dignity) : text;
}

/* The registry's house systems (HOUSE_SYSTEMS), by code. */
export const HOUSE_SYSTEM_CODES = ["whole_sign", "equal", "placidus", "koch", "campanus", "regiomontanus"] as const;

function houseSystemLabel(tr: Translate, code: string, english: string): string {
  const key = `divisional.detail.method.houseSystems.${code}`;
  const text = tr(key);
  return text === key ? english : text;
}

/*
 * A dasha period's months, in the reader's language: "Mar 2024 – Sep 2026".
 *
 * Formatted in UTC, so the server's render and the browser's agree whatever
 * either one's time zone is; the engine's dates are calendar dates, which UTC
 * leaves on the day they name. Empty when neither end can be read, which the
 * view words as copy.
 */
function formatDateRange(locale: string, start: string, end: string): string {
  const format = (value: string) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  };
  return [format(start), format(end)].filter(Boolean).join(" – ");
}

function formatBoundary(
  tr: Translate,
  boundary: DivisionalBoundaryDistance | null,
): string {
  if (!boundary) return tr("divisional.detail.boundary.unavailable");
  if (boundary.isAtBoundary) return tr("divisional.detail.boundary.atBoundary");
  if (boundary.distanceArcMinutes < 1) {
    return `${boundary.distanceArcMinutes.toFixed(2)}′`;
  }
  if (boundary.distanceArcMinutes < 60) {
    return `${boundary.distanceArcMinutes.toFixed(1)}′`;
  }
  return `${boundary.distanceDegrees.toFixed(2)}°`;
}

function reliabilityLabel(
  tr: Translate,
  sensitivity: DivisionalChartSensitivity,
  accuracy: string,
  fallback: boolean,
): string {
  if (fallback || accuracy !== "exact") {
    return tr("divisional.detail.birthTime.exploratory");
  }
  if (sensitivity === "rectified-time") {
    return tr("divisional.detail.birthTime.rectificationAdvised");
  }
  if (sensitivity === "foundation") {
    return tr("divisional.detail.birthTime.foundation");
  }
  return tr("divisional.detail.birthTime.exact");
}

function strengthRatioFor(
  strengthRatios: Record<string, number>,
  planetName: string,
  shouldShow: boolean,
): number | null {
  if (!shouldShow || !CLASSICAL_PLANETS.has(planetName)) return null;
  return strengthRatios[planetName] ?? null;
}

export function DivisionDetailNotice(
  props:
    | {
        variant: "missing-input";
        label: string;
        division: number;
        atlasHref: string;
      }
    | {
        variant: "unavailable";
        label: string;
        division: number;
        /** The calculation's own message; falls back to translated copy. */
        error: string;
        atlasHref: string;
        readingHref: string;
      },
) {
  const tr = useRouteMessages(divisionalMessages);
  const { label, division } = props;
  const name = tr(divisionalGuideKey(division, "name"));

  const copy =
    props.variant === "missing-input"
      ? {
          kicker: tr("divisional.detail.errors.missingKicker", { label }),
          title: tr("divisional.detail.errors.missingTitle"),
          body: tr("divisional.detail.errors.missingBody", { label, name }),
          primaryHref: "/",
          primaryLabel: tr("divisional.detail.errors.backToIntake"),
          secondaryHref: props.atlasHref,
          secondaryLabel: tr("divisional.detail.errors.returnToAtlas"),
        }
      : {
          kicker: tr("divisional.detail.errors.unavailableKicker", { label }),
          title: tr("divisional.detail.errors.unavailableTitle", { name }),
          body:
            props.error ||
            tr("divisional.detail.errors.unavailableBody", { label }),
          primaryHref: props.atlasHref,
          primaryLabel: tr("divisional.detail.errors.returnToAtlas"),
          secondaryHref: props.readingHref,
          secondaryLabel: tr("divisional.detail.errors.backToReading"),
        };

  return (
    <div className={styles.page} /* the desktop layout owns <main> */>
      <section className={styles.errorCard}>
        <p className={styles.kicker}>{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <div className={styles.errorActions}>
          <Link className={styles.primaryLink} href={copy.primaryHref}>
            {copy.primaryLabel}
          </Link>
          {copy.secondaryHref && copy.secondaryLabel ? (
            <Link className={styles.textLink} href={copy.secondaryHref}>
              {copy.secondaryLabel}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default function DivisionDetailView({
  detail,
  positionRows,
  strengthRatios,
  currentMahadasha,
  currentAntardasha,
  timingPlacements,
  engine,
  availableDivisions,
  historyQuery,
  atlasHref,
  readingHref,
  birthTimeAccuracy,
  birthTimeFallback,
}: DivisionDetailViewProps) {
  const tr = useRouteMessages(divisionalMessages);
  const { language } = useTranslation();
  const locale = LOCALE_TAGS[language];
  const guideText = (field: DivisionalGuideField) =>
    tr(divisionalGuideKey(detail.division, field));
  const house = (number: number | null) =>
    number === null ? "—" : tr("divisional.detail.houseShort", { house: String(number) });
  /* The varga's own line, from the catalog; the engine's if it has none. */
  const themeKey = `divisional.panel.themes.d${detail.division}`;
  const theme = tr(themeKey) === themeKey ? detail.description : tr(themeKey);

  const rowByName = new Map(positionRows.map((row) => [row.position.name, row]));
  const houseBySign = new Map(detail.houses.map((house) => [house.sign, house]));
  const firstHouse = detail.houses.find((house) => house.houseNumber === 1);
  const ascendantLord = firstHouse?.signRuler ?? null;
  const timingLordNames = [currentMahadasha, currentAntardasha].filter(
    (name): name is string => Boolean(name),
  );

  const keyPlacementNames = [
    ...detail.positions
      .filter((position) => position.isFocusPlanet || position.isFocusHouse)
      .map((position) => position.name),
    ascendantLord,
    ...timingLordNames,
  ].filter((name): name is string => Boolean(name));
  const uniqueKeyNames = [...new Set(keyPlacementNames)];
  const keyPlacementRows = uniqueKeyNames
    .map((name) => rowByName.get(name))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const nearestBoundaryRow = [...positionRows]
    .filter((row) => row.boundary)
    .sort(
      (left, right) =>
        (left.boundary?.distanceDegrees ?? Number.POSITIVE_INFINITY) -
        (right.boundary?.distanceDegrees ?? Number.POSITIVE_INFINITY),
    )[0];

  const availableSet = new Set(availableDivisions);
  const availableKeyVargas = IMPORTANT_DIVISIONAL_CHARTS.filter((item) =>
    availableSet.has(item.division),
  );
  const currentIndex = availableKeyVargas.findIndex(
    (item) => item.division === detail.division,
  );
  const previousVarga = currentIndex > 0 ? availableKeyVargas[currentIndex - 1] : null;
  const nextVarga =
    currentIndex >= 0 && currentIndex < availableKeyVargas.length - 1
      ? availableKeyVargas[currentIndex + 1]
      : null;

  const reliability = reliabilityLabel(
    tr,
    detail.sensitivity,
    birthTimeAccuracy,
    birthTimeFallback,
  );

  return (
    <div className={styles.page} /* the desktop layout owns <main> */>
      <div className={styles.shell}>
        <nav
          className={styles.breadcrumbs}
          aria-label={tr("divisional.detail.breadcrumb.label")}
        >
          <Link href={readingHref}>{tr("divisional.detail.breadcrumb.reading")}</Link>
          <span aria-hidden="true">/</span>
          <Link href={atlasHref}>{tr("divisional.detail.breadcrumb.atlas")}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{detail.label}</span>
        </nav>

        <Link className={styles.backLink} href={atlasHref}>
          <span aria-hidden="true">←</span> {tr("divisional.detail.backToAtlas")}
        </Link>

        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>{tr("divisional.detail.hero.kicker")}</p>
            <h1>
              {detail.label} <span>{guideText("name")}</span>
            </h1>
            <p className={styles.heroFocus}>{guideText("focus")}</p>
            <p className={styles.heroSummary}>{guideText("summary")}</p>
            <div
              className={styles.heroBadges}
              aria-label={tr("divisional.detail.hero.badgesLabel")}
            >
              <span>{reliability}</span>
              <span>{guideText("mappingMethod")}</span>
              <span>{tr("divisional.detail.hero.wholeSignHouses")}</span>
            </div>
          </div>
          <div className={styles.heroSeal} aria-hidden="true">
            <span>{detail.label}</span>
            <small>{guideText("name")}</small>
          </div>
        </header>

        <section
          className={styles.purposeGrid}
          aria-label={tr("divisional.detail.purpose.gridLabel", {
            label: detail.label,
          })}
        >
          <article>
            <span>{tr("divisional.detail.purpose.purpose")}</span>
            <h2>{guideText("focus")}</h2>
            <p>{theme}</p>
          </article>
          <article>
            <span>{tr("divisional.detail.purpose.clientQuestion")}</span>
            <h2>{tr("divisional.detail.purpose.clientQuestionHeading")}</h2>
            <p>{guideText("clientQuestion")}</p>
          </article>
          <article>
            <span>{tr("divisional.detail.purpose.readWith")}</span>
            <h2>{tr("divisional.detail.purpose.readWithHeading")}</h2>
            <p>{guideText("readWith")}</p>
          </article>
        </section>

        <section
          className={`${styles.reliabilityPanel} ${
            birthTimeFallback || birthTimeAccuracy !== "exact"
              ? styles.reliabilityCaution
              : ""
          }`}
          aria-labelledby="reliability-title"
        >
          <div>
            <p className={styles.kicker}>
              {tr("divisional.detail.reliability.kicker")}
            </p>
            <h2 id="reliability-title">{reliability}</h2>
          </div>
          <p>
            {guideText("sensitivityNote")} {tr("divisional.detail.reliability.note")}
          </p>
        </section>

        <section className={styles.glanceSection} aria-labelledby="glance-title">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>{tr("divisional.detail.glance.kicker")}</p>
            <h2 id="glance-title">{tr("divisional.detail.glance.heading")}</h2>
          </div>
          <div className={styles.statGrid}>
            <article>
              <span>{tr("divisional.detail.glance.divisionalAscendant")}</span>
              <strong>
                {detail.ascendantSign
                  ? signName(detail.ascendantSign, tr)
                  : tr("divisional.detail.glance.unavailable")}
              </strong>
            </article>
            <article>
              <span>{tr("divisional.detail.glance.ascendantLord")}</span>
              <strong>
                {ascendantLord
                  ? planetName(ascendantLord, tr)
                  : tr("divisional.detail.glance.unavailable")}
              </strong>
              {ascendantLord && rowByName.get(ascendantLord) ? (
                <small>
                  {signName(rowByName.get(ascendantLord)?.position.vargaSign ?? "", tr)} ·{" "}
                  {house(rowByName.get(ascendantLord)?.position.wholeSignHouse ?? null)}
                </small>
              ) : null}
            </article>
            <article>
              <span>{tr("divisional.detail.glance.recurrences")}</span>
              <strong>{detail.repeatedNames.length}</strong>
              <small>
                {detail.repeatedNames.map((name) => pointName(name, tr)).join(", ") ||
                  tr("divisional.detail.glance.none")}
              </small>
            </article>
            <article>
              <span>{tr("divisional.detail.glance.nearestBoundary")}</span>
              <strong>{formatBoundary(tr, nearestBoundaryRow?.boundary ?? null)}</strong>
              <small>
                {nearestBoundaryRow
                  ? pointName(nearestBoundaryRow.position.name, tr)
                  : tr("divisional.detail.glance.unavailable")}
              </small>
            </article>
          </div>
          <p className={styles.plainNote}>{tr("divisional.detail.glance.note")}</p>
        </section>

        <section className={`${styles.panel} ${styles.deferredSection}`} aria-labelledby="chart-grid-title">
          <div className={styles.sectionHeadingRow}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>{tr("divisional.detail.map.kicker")}</p>
              <h2 id="chart-grid-title">
                {tr("divisional.detail.map.heading", { label: detail.label })}
              </h2>
            </div>
            <span className={styles.methodTag}>
              {tr("divisional.detail.map.methodTag")}
            </span>
          </div>

          {detail.hasValidAscendant && detail.houses.length === 12 ? (
            <div
              className={styles.chartGrid}
              aria-label={tr("divisional.detail.map.gridLabel", {
                label: detail.label,
              })}
            >
              {SOUTH_INDIAN_LAYOUT.map(({ sign, area }) => {
                const cell = houseBySign.get(sign);
                if (!cell) return null;
                return (
                  <article
                    key={sign}
                    className={`${styles.houseCell} ${cell.isFocusHouse ? styles.houseCellFocus : ""}`}
                    style={{ gridArea: area }}
                    aria-label={tr("divisional.detail.map.houseLabel", {
                      sign: signName(sign, tr),
                      house: String(cell.houseNumber),
                      ruler: planetName(cell.signRuler, tr),
                    })}
                  >
                    <div className={styles.houseTopline}>
                      <strong>{signName(sign, tr)}</strong>
                      <span>{house(cell.houseNumber)}</span>
                    </div>
                    <small>
                      {tr("divisional.detail.map.lord", { ruler: planetName(cell.signRuler, tr) })}
                    </small>
                    <div className={styles.houseOccupants}>
                      {cell.occupants.length > 0 ? (
                        cell.occupants.map((name) => (
                          <span key={name}>
                            <i aria-hidden="true">{PLANET_GLYPHS[name] ?? "•"}</i>
                            {pointName(name, tr)}
                          </span>
                        ))
                      ) : (
                        <span className={styles.emptyHouse}>
                          {tr("divisional.detail.map.noPoints")}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
              <div className={styles.chartCenter} aria-hidden="true">
                <strong>{detail.label}</strong>
                <span>{guideText("name")}</span>
                <small>{tr("divisional.detail.map.centerCaption")}</small>
              </div>
            </div>
          ) : (
            <p className={styles.unavailableNote}>
              {tr("divisional.detail.map.invalidAscendant")}
            </p>
          )}
          <p className={styles.plainNote}>{tr("divisional.detail.map.note")}</p>
        </section>

        <section className={`${styles.focusSection} ${styles.deferredSection}`} aria-labelledby="focus-title">
          <div className={styles.sectionHeadingRow}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>
                {tr("divisional.detail.placements.kicker")}
              </p>
              <h2 id="focus-title">{tr("divisional.detail.placements.heading")}</h2>
            </div>
            <span className={styles.methodTag}>
              {tr("divisional.detail.placements.focusHouses", {
                houses: detail.focusHouses.map((number) => house(number)).join(" · "),
              })}
            </span>
          </div>

          <div className={styles.placementGrid}>
            {keyPlacementRows.map(({ position, boundary }) => {
              const isTimingLord = timingLordNames.includes(position.name);
              const natalStrength = strengthRatioFor(
                strengthRatios,
                position.name,
                position.isFocusPlanet || isTimingLord,
              );
              return (
                <article key={position.name} className={styles.placementCard}>
                  <div className={styles.placementHeading}>
                    <span className={styles.planetMark} aria-hidden="true">
                      {PLANET_GLYPHS[position.name] ?? "•"}
                    </span>
                    <div>
                      <h3>{pointName(position.name, tr)}</h3>
                      <p>
                        {signName(position.vargaSign, tr)} · {house(position.wholeSignHouse)}
                      </p>
                    </div>
                  </div>
                  <div className={styles.reasonChips}>
                    {position.isFocusPlanet ? (
                      <span>{tr("divisional.detail.placements.focusPlanet")}</span>
                    ) : null}
                    {position.isFocusHouse ? (
                      <span>{tr("divisional.detail.placements.focusHouse")}</span>
                    ) : null}
                    {position.name === ascendantLord ? (
                      <span>{tr("divisional.detail.placements.ascendantLord")}</span>
                    ) : null}
                    {position.name === currentMahadasha ? (
                      <span>{tr("divisional.detail.placements.mahadashaLord")}</span>
                    ) : null}
                    {position.name === currentAntardasha ? (
                      <span>{tr("divisional.detail.placements.antardashaLord")}</span>
                    ) : null}
                  </div>
                  <dl className={styles.placementFacts}>
                    <div><dt>{tr("divisional.detail.placements.signLord")}</dt><dd>{position.signRuler ? planetName(position.signRuler, tr) : "—"}</dd></div>
                    <div><dt>{tr("divisional.detail.placements.dignity")}</dt><dd>{position.dignity ? dignityLabel(tr, position.dignity) : tr("divisional.detail.placements.notAssigned")}</dd></div>
                    <div><dt>{tr("divisional.detail.placements.boundary")}</dt><dd>{formatBoundary(tr, boundary)}</dd></div>
                    <div><dt>{tr("divisional.detail.placements.d1Repeat")}</dt><dd>{position.repeatsD1 ? tr("divisional.detail.placements.yes") : tr("divisional.detail.placements.no")}</dd></div>
                  </dl>
                  {position.conjunctionPeers.length > 0 ? (
                    <p className={styles.peerNote}>
                      {tr("divisional.detail.placements.peers", {
                        peers: position.conjunctionPeers.map((name) => pointName(name, tr)).join(", "),
                      })}
                    </p>
                  ) : null}
                  {natalStrength !== null ? (
                    <div className={styles.strengthNote}>
                      <strong>
                        {tr("divisional.detail.placements.strength", {
                          ratio: natalStrength.toFixed(2),
                        })}
                      </strong>
                      <span>
                        {tr("divisional.detail.placements.strengthNote", {
                          label: detail.label,
                        })}
                      </span>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.deferredSection}`} aria-labelledby="positions-title">
          <div className={styles.sectionHeadingRow}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>{tr("divisional.detail.table.kicker")}</p>
              <h2 id="positions-title">{tr("divisional.detail.table.heading")}</h2>
            </div>
            <span className={styles.methodTag}>
              {tr("divisional.detail.table.count", {
                count: String(positionRows.length),
              })}
            </span>
          </div>
          <div className={styles.tableScroller}>
            <table className={styles.positionTable}>
              <caption className={styles.srOnly}>
                {tr("divisional.detail.table.caption", { label: detail.label })}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{tr("divisional.detail.table.point")}</th>
                  <th scope="col">{tr("divisional.detail.table.d1Sign")}</th>
                  <th scope="col">
                    {tr("divisional.detail.vargaSign", { label: detail.label })}
                  </th>
                  <th scope="col">{tr("divisional.detail.table.house")}</th>
                  <th scope="col">{tr("divisional.detail.table.signLord")}</th>
                  <th scope="col">{tr("divisional.detail.table.dignity")}</th>
                  <th scope="col">{tr("divisional.detail.table.d1Repeat")}</th>
                  <th scope="col">{tr("divisional.detail.table.boundaryDistance")}</th>
                </tr>
              </thead>
              <tbody>
                {positionRows.map(({ position, boundary }) => (
                  <tr key={position.name}>
                    <th scope="row">
                      <span className={styles.tablePlanet}>
                        <i aria-hidden="true">{PLANET_GLYPHS[position.name] ?? "•"}</i>
                        {pointName(position.name, tr)}
                      </span>
                    </th>
                    <td>{signName(position.rashiSign, tr)}</td>
                    <td>{signName(position.vargaSign, tr)}</td>
                    <td>{position.wholeSignHouse ?? "—"}</td>
                    <td>{position.signRuler ? planetName(position.signRuler, tr) : "—"}</td>
                    <td>{position.dignity ? dignityLabel(tr, position.dignity) : "—"}</td>
                    <td>
                      {position.repeatsD1 ? (
                        <span className={styles.repeatMarker}>
                          {tr("divisional.detail.table.repeatYes")}
                        </span>
                      ) : (
                        tr("divisional.detail.table.repeatNo")
                      )}
                    </td>
                    <td
                      title={
                        boundary
                          ? tr("divisional.detail.table.boundaryTitle", {
                              degree: boundary.nearestBoundaryDegree.toFixed(4),
                              segment: String(boundary.segmentNumber),
                            })
                          : undefined
                      }
                    >
                      {formatBoundary(tr, boundary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.plainNote}>{tr("divisional.detail.table.note")}</p>
        </section>

        <section className={`${styles.timingSection} ${styles.deferredSection}`} aria-labelledby="timing-title">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>{tr("divisional.detail.timing.kicker")}</p>
            <h2 id="timing-title">
              {tr("divisional.detail.timing.heading", { label: detail.label })}
            </h2>
          </div>
          {timingPlacements.length > 0 ? (
            <div className={styles.timingGrid}>
              {timingPlacements.map((timing) => {
                const row = rowByName.get(timing.planet);
                return (
                  <article key={timing.kind}>
                    <span>{tr(TIMING_LABEL_KEY[timing.kind])}</span>
                    <h3>{planetName(timing.planet, tr)}</h3>
                    <p>
                      {formatDateRange(locale, timing.start, timing.end) ||
                        tr("divisional.detail.dates.unavailable")}
                    </p>
                    {row ? (
                      <dl>
                        <div><dt>{tr("divisional.detail.vargaSign", { label: detail.label })}</dt><dd>{signName(row.position.vargaSign, tr)}</dd></div>
                        <div><dt>{tr("divisional.detail.timing.wholeSignHouse")}</dt><dd>{row.position.wholeSignHouse ?? "—"}</dd></div>
                        <div><dt>{tr("divisional.detail.timing.boundary")}</dt><dd>{formatBoundary(tr, row.boundary)}</dd></div>
                      </dl>
                    ) : (
                      <p>{tr("divisional.detail.timing.placementUnavailable")}</p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className={styles.unavailableNote}>
              {tr("divisional.detail.timing.dashaUnavailable")}
            </p>
          )}
          <p className={styles.plainNote}>{tr("divisional.detail.timing.note")}</p>
        </section>

        <section className={`${styles.methodSection} ${styles.deferredSection}`} aria-labelledby="method-title">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>{tr("divisional.detail.method.kicker")}</p>
            <h2 id="method-title">{tr("divisional.detail.method.heading")}</h2>
          </div>
          <dl className={styles.provenanceList}>
            <div><dt>{tr("divisional.detail.method.vargaMapping")}</dt><dd>{guideText("mappingMethod")}</dd></div>
            <div><dt>{tr("divisional.detail.method.engine")}</dt><dd>{engine.engineLabel}</dd></div>
            <div><dt>{tr("divisional.detail.method.ephemerisProvider")}</dt><dd>{engine.ephemerisProvider}</dd></div>
            <div><dt>{tr("divisional.detail.method.ayanamsha")}</dt><dd>{engine.ayanamsha}</dd></div>
            <div><dt>{tr("divisional.detail.method.natalHouseMethod")}</dt><dd>{houseSystemLabel(tr, engine.houseSystemCode, engine.houseSystem)}</dd></div>
            <div><dt>{tr("divisional.detail.method.vargaHouseDisplay")}</dt><dd>{tr("divisional.detail.method.vargaHouseDisplayValue", { label: detail.label })}</dd></div>
            <div><dt>{tr("divisional.detail.method.birthTimeStatus")}</dt><dd>{reliability}</dd></div>
          </dl>
          <div className={styles.methodCaution}>
            <strong>{tr("divisional.detail.method.cautionTitle")}</strong>
            <p>
              {tr("divisional.detail.method.cautionBody", { label: detail.label })}
            </p>
          </div>
        </section>

        <nav
          className={styles.vargaPager}
          aria-label={tr("divisional.detail.pager.label")}
        >
          {previousVarga ? (
            <Link
              href={withQuery(
                `/insights/divisional-charts/${previousVarga.division}`,
                historyQuery,
              )}
            >
              <span>← {tr("divisional.detail.pager.previous")}</span>
              <strong>
                {previousVarga.label} ·{" "}
                {tr(divisionalGuideKey(previousVarga.division, "name"))}
              </strong>
            </Link>
          ) : (
            <span />
          )}
          {nextVarga ? (
            <Link
              href={withQuery(
                `/insights/divisional-charts/${nextVarga.division}`,
                historyQuery,
              )}
            >
              <span>{tr("divisional.detail.pager.next")} →</span>
              <strong>
                {nextVarga.label} ·{" "}
                {tr(divisionalGuideKey(nextVarga.division, "name"))}
              </strong>
            </Link>
          ) : null}
        </nav>

        <footer className={styles.footer}>
          <p>{tr("divisional.detail.footer.note")}</p>
          <Link href={readingHref}>{tr("divisional.detail.footer.returnLink")}</Link>
        </footer>
      </div>
    </div>
  );
}
