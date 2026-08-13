import type { ChartApiResponse, DivisionalPositionInfo } from "@/lib/astro-types";

const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

export type StoryVerificationStatus = "verified" | "qualified" | "failed";
export type StoryCheckStatus = "passed" | "warning" | "failed";

export type StoryVerificationCheck = {
  id: string;
  label: string;
  status: StoryCheckStatus;
  detail: string;
  critical: boolean;
};

export type StoryVerification = {
  status: StoryVerificationStatus;
  checkedAt: string;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  checks: StoryVerificationCheck[];
  summary: string;
  calculationProfile: {
    provider: string;
    engine: string;
    ayanamsha: string;
    houseSystem: string;
    birthTimeReliability: string;
  };
};

function normalizeLongitude(longitude: number): number {
  return ((longitude % 360) + 360) % 360;
}

function angularDistance(left: number, right: number): number {
  const distance = Math.abs(normalizeLongitude(left) - normalizeLongitude(right));
  return Math.min(distance, 360 - distance);
}

function expectedSign(longitude: number): string {
  return SIGNS[Math.floor(normalizeLongitude(longitude) / 30)] ?? "Unknown";
}

function expectedDegreeInSign(longitude: number): number {
  return normalizeLongitude(longitude) % 30;
}

function positionMap(positions: DivisionalPositionInfo[] | undefined) {
  return new Map((positions ?? []).map((position) => [position.name, position]));
}

function check(
  id: string,
  label: string,
  condition: boolean,
  passedDetail: string,
  failedDetail: string,
  options: { critical?: boolean; warningOnly?: boolean } = {},
): StoryVerificationCheck {
  return {
    id,
    label,
    status: condition ? "passed" : options.warningOnly ? "warning" : "failed",
    detail: condition ? passedDetail : failedDetail,
    critical: Boolean(options.critical),
  };
}

function birthTimeReliability(payload: ChartApiResponse): string {
  if (payload.client.birth_time_fallback) return "Fallback time - high vargas are exploratory";
  const accuracy = payload.client.birth_time_accuracy?.trim().toLowerCase();
  if (accuracy === "exact") return "Exact time recorded";
  if (accuracy) return `${accuracy[0].toUpperCase()}${accuracy.slice(1)} time window`;
  return "Time precision not recorded";
}

/**
 * Independently re-derives the facts most likely to invalidate client prose.
 * This does not merely count populated fields: it reconstructs signs and
 * degrees from longitude, tests the lunar-node axis, checks D1 against the
 * natal positions, verifies timing chronology, and audits evidence coverage.
 */
export function verifyChartForStory(payload: ChartApiResponse): StoryVerification {
  const checks: StoryVerificationCheck[] = [];
  const planets = payload.chart.planets ?? [];
  const ascendant = payload.chart.ascendant;

  const coordinateValues = [
    payload.chart.julian_day_ut,
    payload.client.latitude,
    payload.client.longitude,
    ascendant?.longitude,
    ...planets.flatMap((planet) => [planet.longitude, planet.degree_in_sign, planet.house]),
  ];
  checks.push(check(
    "finite-core",
    "Core coordinates",
    coordinateValues.length > 0 && coordinateValues.every(Number.isFinite),
    "Every core coordinate is finite and usable.",
    "One or more core coordinates are missing or non-numeric.",
    { critical: true },
  ));

  const signRows = [
    { name: "Ascendant", longitude: ascendant.longitude, sign: ascendant.sign, degree: ascendant.degree_in_sign },
    ...planets.map((planet) => ({
      name: planet.name,
      longitude: planet.longitude,
      sign: planet.sign,
      degree: planet.degree_in_sign,
    })),
  ];
  const signMismatches = signRows.filter((row) =>
    expectedSign(row.longitude) !== row.sign ||
    Math.abs(expectedDegreeInSign(row.longitude) - row.degree) > 0.02
  );
  checks.push(check(
    "longitude-sign",
    "Longitude reconstruction",
    signMismatches.length === 0,
    `${signRows.length} signs and within-sign degrees were independently reconstructed from longitude.`,
    `Reconstruction disagreed for: ${signMismatches.map((row) => row.name).join(", ") || "unknown points"}.`,
    { critical: true },
  ));

  const requiredPlanets = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu"];
  const presentPlanets = new Set(planets.map((planet) => planet.name));
  const missingPlanets = requiredPlanets.filter((planet) => !presentPlanets.has(planet));
  checks.push(check(
    "planet-coverage",
    "Planet coverage",
    missingPlanets.length === 0,
    "All nine reading points are available.",
    `Missing reading points: ${missingPlanets.join(", ")}.`,
    { warningOnly: true },
  ));

  const rahu = planets.find((planet) => planet.name === "Rahu");
  const ketu = planets.find((planet) => planet.name === "Ketu");
  const nodeSeparation = rahu && ketu ? angularDistance(rahu.longitude, ketu.longitude) : NaN;
  checks.push(check(
    "node-axis",
    "Lunar-node axis",
    Number.isFinite(nodeSeparation) && Math.abs(nodeSeparation - 180) <= 0.05,
    "Rahu and Ketu form the expected 180-degree axis.",
    rahu && ketu ? `The node separation is ${nodeSeparation.toFixed(3)} degrees.` : "Rahu or Ketu is unavailable.",
    { critical: true },
  ));

  const d1Positions = positionMap(payload.chart.divisional_charts?.[1]?.positions);
  const natalSignByName = new Map([
    ["Ascendant", ascendant.sign],
    ...planets.map((planet) => [planet.name, planet.sign] as const),
  ]);
  const d1Mismatches = [...natalSignByName.entries()].filter(
    ([name, sign]) => d1Positions.get(name)?.divisional_sign !== sign,
  );
  checks.push(check(
    "d1-echo",
    "D1 cross-check",
    d1Positions.size > 0 && d1Mismatches.length === 0,
    "The independently stored D1 layer agrees with every natal sign.",
    d1Positions.size === 0
      ? "The D1 verification layer is unavailable."
      : `D1 disagreed for: ${d1Mismatches.map(([name]) => name).join(", ")}.`,
    { critical: true },
  ));

  const keyVargas = [1, 2, 4, 7, 9, 10, 12, 24, 30, 60];
  const availableVargas = new Set(
    Object.keys(payload.chart.divisional_charts ?? {}).map(Number),
  );
  const missingVargas = keyVargas.filter((division) => !availableVargas.has(division));
  checks.push(check(
    "varga-coverage",
    "Key varga coverage",
    missingVargas.length === 0,
    "All ten client-facing vargas are available for corroboration.",
    `Unavailable corroboration layers: ${missingVargas.map((division) => `D${division}`).join(", ")}.`,
    { warningOnly: true },
  ));

  const dasha = payload.chart.dasha;
  const dashaDates = [
    dasha?.current_dasha_start,
    dasha?.current_dasha_end,
    dasha?.current_antardasha_start,
    dasha?.current_antardasha_end,
  ].map((value) => value ? Date.parse(value) : NaN);
  const dashaChronologyValid = dashaDates.every(Number.isFinite) &&
    dashaDates[0] < dashaDates[1] &&
    dashaDates[2] < dashaDates[3] &&
    dashaDates[2] >= dashaDates[0] &&
    dashaDates[3] <= dashaDates[1];
  checks.push(check(
    "dasha-chronology",
    "Timing chronology",
    dashaChronologyValid,
    "The active major and sub-period dates form a coherent nested timeline.",
    "The active timing dates are incomplete or do not form a valid nested timeline.",
    { warningOnly: true },
  ));

  const strengthValues = (payload.chart.shadbala ?? []).flatMap((result) => [
    result.totalVirupas,
    result.totalRupas,
    result.strengthRatio,
  ]);
  checks.push(check(
    "strength-values",
    "Strength values",
    strengthValues.length > 0 && strengthValues.every(Number.isFinite),
    "Every supplied planetary-strength value is finite.",
    "Planetary-strength values are unavailable or contain an invalid result.",
    { warningOnly: true },
  ));

  const domains = payload.chart.life_domain_insights ?? [];
  const evidenceReady = domains.length >= 4 && domains.every((domain) =>
    Array.isArray(domain.evidence_matrix?.entries) && domain.evidence_matrix.entries.length > 0
  );
  checks.push(check(
    "evidence-matrices",
    "Independent evidence matrices",
    evidenceReady,
    `${domains.length} life areas include traceable evidence matrices.`,
    domains.length === 0
      ? "The deeper life-area synthesis has not completed."
      : "One or more life areas lack a complete evidence matrix.",
    { warningOnly: true },
  ));

  const engineMetadataComplete = Boolean(
    payload.engine.ephemeris_provider &&
    payload.engine.engine_label &&
    payload.engine.ayanamsha &&
    payload.engine.house_system,
  );
  checks.push(check(
    "method-metadata",
    "Calculation method",
    engineMetadataComplete && !payload.engine.fallback_mode,
    "Provider, engine, ayanamsha, and house method are identified without fallback mode.",
    payload.engine.fallback_mode
      ? "The chart is using a fallback calculation mode."
      : "Calculation-method metadata is incomplete.",
    { warningOnly: true },
  ));

  const timeReliable = payload.client.birth_time_accuracy === "exact" && !payload.client.birth_time_fallback;
  checks.push(check(
    "birth-time",
    "Birth-time reliability",
    timeReliable,
    "An exact, non-fallback birth time is recorded.",
    "Higher divisional ascendants and house-based conclusions are treated as exploratory.",
    { warningOnly: true },
  ));

  const failedCritical = checks.some((item) => item.status === "failed" && item.critical);
  const failedCount = checks.filter((item) => item.status === "failed").length;
  const warningCount = checks.filter((item) => item.status === "warning").length;
  const passedCount = checks.filter((item) => item.status === "passed").length;
  const status: StoryVerificationStatus = failedCritical
    ? "failed"
    : warningCount > 0 || failedCount > 0
      ? "qualified"
      : "verified";

  return {
    status,
    checkedAt: payload.generated_at_utc,
    passedCount,
    warningCount,
    failedCount,
    checks,
    summary: status === "verified"
      ? "Core positions, corroborating layers, timing, and evidence coverage passed the report checks."
      : status === "qualified"
        ? "Core calculations passed, with reliability qualifications applied to claims that need stronger supporting data."
        : "A core calculation check failed, so the report should not be presented as verified.",
    calculationProfile: {
      provider: payload.engine.ephemeris_provider,
      engine: payload.engine.engine_label,
      ayanamsha: payload.engine.ayanamsha,
      houseSystem: payload.engine.house_system,
      birthTimeReliability: birthTimeReliability(payload),
    },
  };
}
