import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  chartParamsToQuery,
  getChartPayload,
  hasAllChartParams,
  readChartParams,
} from "@/lib/chart-params";
import type { ChartApiResponse, ShadbalaResult } from "@/lib/astro-types";
import {
  buildDivisionalChartDetail,
  distanceToDivisionalBoundary,
  getKeyDivisionalChartFocus,
} from "@/lib/divisional-chart-detail";
import { IMPORTANT_DIVISIONAL_CHARTS } from "@/lib/divisional-chart-guide";
import styles from "./divisional-chart-detail.module.css";

export const maxDuration = 60;

type DivisionalChartDetailPageProps = {
  params: Promise<{ division: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

function parseKeyDivision(rawDivision: string): number | null {
  if (!/^\d+$/.test(rawDivision)) return null;
  const division = Number(rawDivision);
  return IMPORTANT_DIVISIONAL_CHARTS.some((item) => item.division === division)
    ? division
    : null;
}

function requireKeyDivision(rawDivision: string): number {
  const division = parseKeyDivision(rawDivision);
  if (division === null) notFound();
  return division;
}

function withQuery(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}

function insightHref(query: string): string {
  return query ? `/insights?${query}#divisional-charts` : "/insights#divisional-charts";
}

function humanizeToken(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function validTimingLord(value?: string): string | null {
  const name = value?.trim();
  return name && name !== "Unknown" ? name : null;
}

function formatBoundary(
  boundary: ReturnType<typeof distanceToDivisionalBoundary>,
): string {
  if (!boundary) return "Unavailable";
  if (boundary.isAtBoundary) return "At boundary";
  if (boundary.distanceArcMinutes < 1) {
    return `${boundary.distanceArcMinutes.toFixed(2)}′`;
  }
  if (boundary.distanceArcMinutes < 60) {
    return `${boundary.distanceArcMinutes.toFixed(1)}′`;
  }
  return `${boundary.distanceDegrees.toFixed(2)}°`;
}

function formatDateRange(start?: string, end?: string): string {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    year: "numeric",
  };
  const format = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("en", options).format(date);
  };
  const formattedStart = format(start);
  const formattedEnd = format(end);
  return [formattedStart, formattedEnd].filter(Boolean).join(" – ") || "Dates unavailable";
}

function reliabilityLabel(
  sensitivity: "foundation" | "exact-time" | "rectified-time",
  accuracy: string,
  fallback: boolean,
): string {
  if (fallback || accuracy !== "exact") return "Exploratory with this birth time";
  if (sensitivity === "rectified-time") return "Rectification still advised";
  if (sensitivity === "foundation") return "Foundation layer";
  return "Exact time recorded";
}

function strengthFor(
  strengthByPlanet: Map<string, ShadbalaResult>,
  planetName: string,
  shouldShow: boolean,
): ShadbalaResult | null {
  if (!shouldShow || !CLASSICAL_PLANETS.has(planetName)) return null;
  return strengthByPlanet.get(planetName) ?? null;
}

function ErrorState({
  kicker,
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  kicker: string;
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.errorCard}>
        <p className={styles.kicker}>{kicker}</p>
        <h1>{title}</h1>
        <p>{body}</p>
        <div className={styles.errorActions}>
          <Link className={styles.primaryLink} href={primaryHref}>
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link className={styles.textLink} href={secondaryHref}>
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export async function generateMetadata({
  params,
}: DivisionalChartDetailPageProps): Promise<Metadata> {
  const { division: rawDivision } = await params;
  const division = requireKeyDivision(rawDivision);
  const focus = getKeyDivisionalChartFocus(division);
  if (!focus) notFound();

  return {
    title: `${focus.label} ${focus.name} Divisional Chart`,
    description: `${focus.label} ${focus.name} detail for ${focus.focus.toLowerCase()}, with whole-sign placements, reliability, and calculation context.`,
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

export default async function DivisionalChartDetailPage({
  params,
  searchParams,
}: DivisionalChartDetailPageProps) {
  const { division: rawDivision } = await params;
  const division = requireKeyDivision(rawDivision);
  const focus = getKeyDivisionalChartFocus(division);
  if (!focus) notFound();

  const chartParams = readChartParams(await searchParams);
  const historyQuery = chartParamsToQuery(chartParams);
  const atlasHref = withQuery("/insights/divisional-charts", historyQuery);

  if (!hasAllChartParams(chartParams)) {
    return (
      <ErrorState
        kicker={`${focus.label} · Missing input`}
        title="Complete birth details are required."
        body={`Return to intake and provide the complete birth details before opening the ${focus.label} ${focus.name} analysis.`}
        primaryHref="/"
        primaryLabel="Back to intake"
        secondaryHref={atlasHref}
        secondaryLabel="Return to the varga atlas"
      />
    );
  }

  let payload: ChartApiResponse | null = null;
  let calculationError = "";
  try {
    payload = getChartPayload(chartParams);
  } catch (cause) {
    calculationError = cause instanceof Error ? cause.message : "Chart calculation failed";
  }

  const chart = payload?.chart.divisional_charts?.[division];
  const detail = chart ? buildDivisionalChartDetail(chart) : null;
  if (!payload || !chart || !detail) {
    return (
      <ErrorState
        kicker={`${focus.label} · Calculation unavailable`}
        title={`The ${focus.name} detail could not be prepared.`}
        body={calculationError || `${focus.label} was not returned by the chart calculation.`}
        primaryHref={atlasHref}
        primaryLabel="Return to the varga atlas"
        secondaryHref={insightHref(historyQuery)}
        secondaryLabel="Back to your reading"
      />
    );
  }

  const sourcePositions = new Map<string, { sign: string; degree: number }>([
    [
      "Ascendant",
      {
        sign: payload.chart.ascendant.sign,
        degree: payload.chart.ascendant.degree_in_sign,
      },
    ],
    ...payload.chart.planets.map(
      (planet) => [
        planet.name,
        { sign: planet.sign, degree: planet.degree_in_sign },
      ] as [string, { sign: string; degree: number }],
    ),
  ]);

  const positionRows = detail.positions.map((position) => {
    const source = sourcePositions.get(position.name);
    return {
      position,
      boundary: source
        ? distanceToDivisionalBoundary(division, source.sign, source.degree)
        : null,
    };
  });
  const rowByName = new Map(positionRows.map((row) => [row.position.name, row]));
  const houseBySign = new Map(detail.houses.map((house) => [house.sign, house]));
  const firstHouse = detail.houses.find((house) => house.houseNumber === 1);
  const ascendantLord = firstHouse?.signRuler ?? null;
  const currentMahadasha = validTimingLord(payload.chart.dasha?.current_dasha);
  const currentAntardasha = validTimingLord(payload.chart.dasha?.current_antardasha);
  const timingLordNames = [currentMahadasha, currentAntardasha].filter(
    (name): name is string => Boolean(name),
  );
  const strengthByPlanet = new Map(
    (payload.chart.shadbala ?? []).map((strength) => [strength.planet, strength]),
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

  const availableKeyVargas = IMPORTANT_DIVISIONAL_CHARTS.filter(
    (item) => payload.chart.divisional_charts?.[item.division],
  );
  const currentIndex = availableKeyVargas.findIndex((item) => item.division === division);
  const previousVarga = currentIndex > 0 ? availableKeyVargas[currentIndex - 1] : null;
  const nextVarga =
    currentIndex >= 0 && currentIndex < availableKeyVargas.length - 1
      ? availableKeyVargas[currentIndex + 1]
      : null;
  const accuracy = chartParams.birthTimeAccuracy || "unknown";
  const fallbackTime = chartParams.birthTimeFallback === "true";
  const reliability = reliabilityLabel(detail.sensitivity, accuracy, fallbackTime);

  const timingPlacements = [
    currentMahadasha
      ? {
          label: "Current mahadasha",
          planet: currentMahadasha,
          range: formatDateRange(
            payload.chart.dasha?.current_dasha_start,
            payload.chart.dasha?.current_dasha_end,
          ),
        }
      : null,
    currentAntardasha
      ? {
          label: "Current antardasha",
          planet: currentAntardasha,
          range: formatDateRange(
            payload.chart.dasha?.current_antardasha_start,
            payload.chart.dasha?.current_antardasha_end,
          ),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <Link href={insightHref(historyQuery)}>Reading</Link>
          <span aria-hidden="true">/</span>
          <Link href={atlasHref}>Divisional charts</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{detail.label}</span>
        </nav>

        <Link className={styles.backLink} href={atlasHref}>
          <span aria-hidden="true">←</span> Back to the varga atlas
        </Link>

        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Key varga · Dedicated detail</p>
            <h1>
              {detail.label} <span>{detail.name}</span>
            </h1>
            <p className={styles.heroFocus}>{detail.focus}</p>
            <p className={styles.heroSummary}>{detail.summary}</p>
            <div className={styles.heroBadges} aria-label="Chart context">
              <span>{reliability}</span>
              <span>{detail.mappingMethod}</span>
              <span>Whole-sign varga houses</span>
            </div>
          </div>
          <div className={styles.heroSeal} aria-hidden="true">
            <span>{detail.label}</span>
            <small>{detail.name}</small>
          </div>
        </header>

        <section className={styles.purposeGrid} aria-label={`${detail.label} reading guidance`}>
          <article>
            <span>Purpose</span>
            <h2>{detail.focus}</h2>
            <p>{detail.description}</p>
          </article>
          <article>
            <span>Client question</span>
            <h2>What this layer helps examine</h2>
            <p>{detail.clientQuestion}</p>
          </article>
          <article>
            <span>Read it with</span>
            <h2>The natal baseline remains primary</h2>
            <p>{detail.readWith}</p>
          </article>
        </section>

        <section
          className={`${styles.reliabilityPanel} ${
            fallbackTime || accuracy !== "exact" ? styles.reliabilityCaution : ""
          }`}
          aria-labelledby="reliability-title"
        >
          <div>
            <p className={styles.kicker}>Reliability</p>
            <h2 id="reliability-title">{reliability}</h2>
          </div>
          <p>
            {detail.sensitivityNote} Boundary distance below describes proximity to
            the source-rashi subdivision; it is not a probability or a favorable/unfavorable score.
          </p>
        </section>

        <section className={styles.glanceSection} aria-labelledby="glance-title">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>At a glance</p>
            <h2 id="glance-title">The chart facts before interpretation</h2>
          </div>
          <div className={styles.statGrid}>
            <article>
              <span>Divisional ascendant</span>
              <strong>{detail.ascendantSign ?? "Unavailable"}</strong>
            </article>
            <article>
              <span>Ascendant lord</span>
              <strong>{ascendantLord ?? "Unavailable"}</strong>
              {ascendantLord && rowByName.get(ascendantLord) ? (
                <small>
                  {rowByName.get(ascendantLord)?.position.vargaSign} · H
                  {rowByName.get(ascendantLord)?.position.wholeSignHouse ?? "—"}
                </small>
              ) : null}
            </article>
            <article>
              <span>D1 sign recurrences</span>
              <strong>{detail.repeatedNames.length}</strong>
              <small>{detail.repeatedNames.join(", ") || "None"}</small>
            </article>
            <article>
              <span>Nearest subdivision boundary</span>
              <strong>{formatBoundary(nearestBoundaryRow?.boundary ?? null)}</strong>
              <small>{nearestBoundaryRow?.position.name ?? "Unavailable"}</small>
            </article>
          </div>
          <p className={styles.plainNote}>
            A D1 sign recurrence is a consistency marker only. It is not automatically
            positive, strong, or predictive.
          </p>
        </section>

        <section className={`${styles.panel} ${styles.deferredSection}`} aria-labelledby="chart-grid-title">
          <div className={styles.sectionHeadingRow}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>Whole-sign map</p>
              <h2 id="chart-grid-title">{detail.label} South-Indian-style chart</h2>
            </div>
            <span className={styles.methodTag}>Signs stay fixed · houses rotate</span>
          </div>

          {detail.hasValidAscendant && detail.houses.length === 12 ? (
            <div className={styles.chartGrid} aria-label={`${detail.label} whole-sign house map`}>
              {SOUTH_INDIAN_LAYOUT.map(({ sign, area }) => {
                const house = houseBySign.get(sign);
                if (!house) return null;
                return (
                  <article
                    key={sign}
                    className={`${styles.houseCell} ${house.isFocusHouse ? styles.houseCellFocus : ""}`}
                    style={{ gridArea: area }}
                    aria-label={`${sign}, house ${house.houseNumber}, ruled by ${house.signRuler}`}
                  >
                    <div className={styles.houseTopline}>
                      <strong>{sign}</strong>
                      <span>H{house.houseNumber}</span>
                    </div>
                    <small>Lord {house.signRuler}</small>
                    <div className={styles.houseOccupants}>
                      {house.occupants.length > 0 ? (
                        house.occupants.map((name) => (
                          <span key={name}>
                            <i aria-hidden="true">{PLANET_GLYPHS[name] ?? "•"}</i>
                            {name}
                          </span>
                        ))
                      ) : (
                        <span className={styles.emptyHouse}>No points</span>
                      )}
                    </div>
                  </article>
                );
              })}
              <div className={styles.chartCenter} aria-hidden="true">
                <strong>{detail.label}</strong>
                <span>{detail.name}</span>
                <small>Whole-sign houses</small>
              </div>
            </div>
          ) : (
            <p className={styles.unavailableNote}>
              A valid divisional ascendant was not returned, so house placement is withheld.
            </p>
          )}
          <p className={styles.plainNote}>
            This map derives whole-sign houses from the divisional ascendant. It does not
            infer exact aspects or replace the natal house system.
          </p>
        </section>

        <section className={`${styles.focusSection} ${styles.deferredSection}`} aria-labelledby="focus-title">
          <div className={styles.sectionHeadingRow}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>Key placements</p>
              <h2 id="focus-title">Points connected to this chart&apos;s focus</h2>
            </div>
            <span className={styles.methodTag}>
              Focus houses {detail.focusHouses.map((house) => `H${house}`).join(" · ")}
            </span>
          </div>

          <div className={styles.placementGrid}>
            {keyPlacementRows.map(({ position, boundary }) => {
              const isTimingLord = timingLordNames.includes(position.name);
              const natalStrength = strengthFor(
                strengthByPlanet,
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
                      <h3>{position.name}</h3>
                      <p>
                        {position.vargaSign} · H{position.wholeSignHouse ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className={styles.reasonChips}>
                    {position.isFocusPlanet ? <span>Focus planet</span> : null}
                    {position.isFocusHouse ? <span>Focus house</span> : null}
                    {position.name === ascendantLord ? <span>Ascendant lord</span> : null}
                    {position.name === currentMahadasha ? <span>Mahadasha lord</span> : null}
                    {position.name === currentAntardasha ? <span>Antardasha lord</span> : null}
                  </div>
                  <dl className={styles.placementFacts}>
                    <div><dt>Sign lord</dt><dd>{position.signRuler ?? "—"}</dd></div>
                    <div><dt>Dignity</dt><dd>{position.dignity ? humanizeToken(position.dignity) : "Not assigned"}</dd></div>
                    <div><dt>Boundary</dt><dd>{formatBoundary(boundary)}</dd></div>
                    <div><dt>D1 repeat</dt><dd>{position.repeatsD1 ? "Yes" : "No"}</dd></div>
                  </dl>
                  {position.conjunctionPeers.length > 0 ? (
                    <p className={styles.peerNote}>
                      Same-sign company: {position.conjunctionPeers.join(", ")}.
                    </p>
                  ) : null}
                  {natalStrength ? (
                    <div className={styles.strengthNote}>
                      <strong>{natalStrength.strengthRatio.toFixed(2)}× required Shadbala minimum</strong>
                      <span>
                        Independent natal delivery strength; this is not a {detail.label} dignity score.
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
              <p className={styles.kicker}>Complete map</p>
              <h2 id="positions-title">Every calculated point</h2>
            </div>
            <span className={styles.methodTag}>{positionRows.length} positions</span>
          </div>
          <div className={styles.tableScroller}>
            <table className={styles.positionTable}>
              <caption className={styles.srOnly}>
                {detail.label} positions compared with D1, including whole-sign house,
                sign lord, dignity, recurrence, and source subdivision boundary distance.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Point</th>
                  <th scope="col">D1 sign</th>
                  <th scope="col">{detail.label} sign</th>
                  <th scope="col">House</th>
                  <th scope="col">Sign lord</th>
                  <th scope="col">Dignity</th>
                  <th scope="col">D1 repeat</th>
                  <th scope="col">Boundary distance</th>
                </tr>
              </thead>
              <tbody>
                {positionRows.map(({ position, boundary }) => (
                  <tr key={position.name}>
                    <th scope="row">
                      <span className={styles.tablePlanet}>
                        <i aria-hidden="true">{PLANET_GLYPHS[position.name] ?? "•"}</i>
                        {position.name}
                      </span>
                    </th>
                    <td>{position.rashiSign}</td>
                    <td>{position.vargaSign}</td>
                    <td>{position.wholeSignHouse ?? "—"}</td>
                    <td>{position.signRuler ?? "—"}</td>
                    <td>{position.dignity ? humanizeToken(position.dignity) : "—"}</td>
                    <td>
                      {position.repeatsD1 ? (
                        <span className={styles.repeatMarker}>Yes · consistency</span>
                      ) : (
                        "No"
                      )}
                    </td>
                    <td
                      title={
                        boundary
                          ? `Nearest source-rashi boundary at ${boundary.nearestBoundaryDegree.toFixed(4)}°. Segment ${boundary.segmentNumber}.`
                          : undefined
                      }
                    >
                      {formatBoundary(boundary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.plainNote}>
            Classical dignity is shown only for the seven classical planets. No dignity
            is assigned here to the Ascendant, Rahu, or Ketu. Boundary distance is measured
            from each point&apos;s natal degree to the nearest subdivision edge.
          </p>
        </section>

        <section className={`${styles.timingSection} ${styles.deferredSection}`} aria-labelledby="timing-title">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Current timing context</p>
            <h2 id="timing-title">Dasha lords inside {detail.label}</h2>
          </div>
          {timingPlacements.length > 0 ? (
            <div className={styles.timingGrid}>
              {timingPlacements.map((timing) => {
                const row = rowByName.get(timing.planet);
                return (
                  <article key={timing.label}>
                    <span>{timing.label}</span>
                    <h3>{timing.planet}</h3>
                    <p>{timing.range}</p>
                    {row ? (
                      <dl>
                        <div><dt>{detail.label} sign</dt><dd>{row.position.vargaSign}</dd></div>
                        <div><dt>Whole-sign house</dt><dd>{row.position.wholeSignHouse ?? "—"}</dd></div>
                        <div><dt>Boundary</dt><dd>{formatBoundary(row.boundary)}</dd></div>
                      </dl>
                    ) : (
                      <p>Placement unavailable in this chart.</p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className={styles.unavailableNote}>Current dasha data was not returned.</p>
          )}
          <p className={styles.plainNote}>
            An active period increases timing relevance; it does not make a placement
            automatically favorable. Read it with D1, measured strength, and lived evidence.
          </p>
        </section>

        <section className={`${styles.methodSection} ${styles.deferredSection}`} aria-labelledby="method-title">
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Method and provenance</p>
            <h2 id="method-title">How this page was calculated</h2>
          </div>
          <dl className={styles.provenanceList}>
            <div><dt>Varga mapping</dt><dd>{detail.mappingMethod}</dd></div>
            <div><dt>Engine</dt><dd>{payload.engine.engine_label}</dd></div>
            <div><dt>Ephemeris provider</dt><dd>{payload.engine.ephemeris_provider}</dd></div>
            <div><dt>Ayanamsha</dt><dd>{payload.engine.ayanamsha}</dd></div>
            <div><dt>Natal house method</dt><dd>{payload.engine.house_system}</dd></div>
            <div><dt>Varga house display</dt><dd>Whole-sign houses derived from the {detail.label} Ascendant</dd></div>
            <div><dt>Birth-time status</dt><dd>{reliability}</dd></div>
          </dl>
          <div className={styles.methodCaution}>
            <strong>Interpretive boundary</strong>
            <p>
              This page reports calculated signs, whole-sign houses, rulers, classical
              dignity, and timing-lord location. It does not infer exact divisional aspects,
              treat sign recurrence as automatically positive, or let {detail.label} override D1.
            </p>
          </div>
        </section>

        <nav className={styles.vargaPager} aria-label="Adjacent key divisional charts">
          {previousVarga ? (
            <Link
              href={withQuery(
                `/insights/divisional-charts/${previousVarga.division}`,
                historyQuery,
              )}
            >
              <span>← Previous key varga</span>
              <strong>{previousVarga.label} · {previousVarga.name}</strong>
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
              <span>Next key varga →</span>
              <strong>{nextVarga.label} · {nextVarga.name}</strong>
            </Link>
          ) : null}
        </nav>

        <footer className={styles.footer}>
          <p>
            Divisional charts refine a natal promise; they do not replace it. Stronger
            conclusions require reliable birth data and agreement with independent evidence.
          </p>
          <Link href={insightHref(historyQuery)}>Return to your full reading</Link>
        </footer>
      </div>
    </main>
  );
}
