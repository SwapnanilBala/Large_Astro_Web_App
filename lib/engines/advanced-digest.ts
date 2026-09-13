import type { ChartApiResponse } from "@/lib/astro-types";

/**
 * What the advanced page knows, reduced to what is worth narrating.
 *
 * The page renders roughly eighteen thousand characters and two hundred numbers
 * across six modules. Handing all of that to a model would be expensive, slow,
 * and worse -- a summary of everything is a summary of nothing. So this picks:
 * the tightest aspects rather than all of them, the strongest and weakest
 * planet rather than the whole shadbala table, the yogas that actually fired.
 *
 * Everything here is derived from the chart payload, which is computed from
 * birth parameters. No caller-supplied string passes through, which is what
 * lets the route feed this straight into a prompt.
 */

export const ADVANCED_MODULE_KEYS = [
  "timing",
  "aspects",
  "navamsa",
  "divisional",
  "strength",
  "transits",
  "ashtakavarga",
] as const;

export type AdvancedModuleKey = (typeof ADVANCED_MODULE_KEYS)[number];

export type AdvancedDigest = {
  /** Modules this chart actually has data for; the rest are not asked about. */
  available: AdvancedModuleKey[];
  /** The facts block, ready to be the user turn of a prompt. */
  text: string;
};

/** Tightest orb first: a 0.3° aspect is doing more than a 7° one. */
function tightestAspects(payload: ChartApiResponse, limit: number) {
  return [...(payload.chart.aspects ?? [])]
    .sort((a, b) => Math.abs(a.orb) - Math.abs(b.orb))
    .slice(0, limit);
}

const HARMONIOUS = new Set(["trine", "sextile"]);
const HARD = new Set(["square", "opposition"]);

function describeAspectBalance(payload: ChartApiResponse) {
  const aspects = payload.chart.aspects ?? [];
  let harmonious = 0;
  let hard = 0;
  for (const aspect of aspects) {
    const type = aspect.aspect_type.toLowerCase();
    if (HARMONIOUS.has(type)) harmonious += 1;
    else if (HARD.has(type)) hard += 1;
  }
  return { total: aspects.length, harmonious, hard };
}

export function buildAdvancedDigest(payload: ChartApiResponse): AdvancedDigest {
  const available: AdvancedModuleKey[] = [];
  const lines: string[] = [];

  lines.push(
    `Chart: ${payload.chart.ascendant.sign} rising, Sun in ${
      payload.chart.planets.find((p) => p.name === "Sun")?.sign ?? "unknown"
    }, Moon in ${payload.chart.planets.find((p) => p.name === "Moon")?.sign ?? "unknown"}.`,
  );

  /* ── timing ── */
  const { nakshatra, dasha } = payload.chart;
  if (nakshatra && dasha) {
    available.push("timing");
    lines.push("");
    lines.push("[TIMING]");
    lines.push(
      `Birth nakshatra: ${nakshatra.name}, lord ${nakshatra.lord}, pada ${nakshatra.pada}.`,
    );
    lines.push(
      `Running period: ${dasha.current_dasha} major, ${dasha.current_antardasha} sub, until ${dasha.current_antardasha_end}.`,
    );
    lines.push(`The ${dasha.current_dasha} major period runs to ${dasha.current_dasha_end}.`);
  }

  /* ── aspects ── */
  const aspects = payload.chart.aspects ?? [];
  if (aspects.length > 0) {
    available.push("aspects");
    const balance = describeAspectBalance(payload);
    lines.push("");
    lines.push("[ASPECTS]");
    lines.push(
      `${balance.total} contacts in total: ${balance.harmonious} flowing, ${balance.hard} frictional.`,
    );
    lines.push("Tightest contacts, closest first:");
    for (const aspect of tightestAspects(payload, 6)) {
      lines.push(
        `  - ${aspect.planet1} ${aspect.aspect_type} ${aspect.planet2}, orb ${aspect.orb.toFixed(2)} degrees, ${
          aspect.applying ? "applying" : "separating"
        }${aspect.vedic ? ", Vedic drishti" : ""}`,
      );
    }
  }

  /* ── navamsa ── */
  const navamsa = payload.chart.navamsa ?? [];
  if (navamsa.length > 0) {
    available.push("navamsa");
    const vargottama = navamsa.filter((p) => p.rashi_sign === p.navamsa_sign);
    const dignified = navamsa.filter((p) => p.dignity === "exalted" || p.dignity === "own");
    const debilitated = navamsa.filter((p) => p.dignity === "debilitated");
    lines.push("");
    lines.push("[NAVAMSA]");
    lines.push(
      vargottama.length > 0
        ? `Vargottama (same sign in both charts): ${vargottama.map((p) => p.name).join(", ")}.`
        : "No planet holds the same sign in both charts.",
    );
    if (dignified.length > 0) {
      lines.push(
        `Strong in the navamsa: ${dignified.map((p) => `${p.name} (${p.dignity})`).join(", ")}.`,
      );
    }
    if (debilitated.length > 0) {
      lines.push(`Weak in the navamsa: ${debilitated.map((p) => p.name).join(", ")}.`);
    }
  }

  /* ── divisional ── */
  const divisional = payload.chart.divisional_charts ?? {};
  const divisions = Object.keys(divisional)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (divisions.length > 0) {
    available.push("divisional");
    lines.push("");
    lines.push("[DIVISIONAL]");
    lines.push(`Divisional charts computed: ${divisions.map((d) => `D${d}`).join(", ")}.`);
  }

  /* ── strength ── */
  const shadbala = payload.chart.shadbala ?? [];
  const yogas = (payload.chart.yogas ?? []).filter((yoga) => yoga.present);
  if (shadbala.length > 0 || yogas.length > 0) {
    available.push("strength");
    lines.push("");
    lines.push("[STRENGTH]");
    if (shadbala.length > 0) {
      const ranked = [...shadbala].sort((a, b) => b.strengthRatio - a.strengthRatio);
      const strongest = ranked[0];
      const weakest = ranked[ranked.length - 1];
      lines.push(
        `Strongest planet: ${strongest.planet}, at ${strongest.strengthRatio.toFixed(2)} times the minimum it needs.`,
      );
      lines.push(
        `Weakest planet: ${weakest.planet}, at ${weakest.strengthRatio.toFixed(2)} times the minimum it needs.`,
      );
      const belowMinimum = shadbala.filter((p) => !p.isStrong).map((p) => p.planet);
      if (belowMinimum.length > 0) {
        lines.push(`Below the classical minimum: ${belowMinimum.join(", ")}.`);
      }
    }
    if (yogas.length > 0) {
      lines.push("Yogas present:");
      for (const yoga of yogas.slice(0, 5)) {
        lines.push(
          `  - ${yoga.name} (${yoga.category}, ${yoga.strength}), involving ${yoga.involved_planets.join(" and ")}`,
        );
      }
    }
  }

  /* ── transits ── */
  const transits = payload.transits;
  if (transits) {
    available.push("transits");
    lines.push("");
    lines.push("[TRANSITS]");
    const positions = transits.positions ?? [];
    if (positions.length > 0) {
      lines.push(
        `Where the sky is now: ${positions
          .slice(0, 5)
          .map((p) => `${p.name} in ${p.sign}`)
          .join(", ")}.`,
      );
    }
    const active = transits.active_aspects ?? [];
    lines.push(
      active.length > 0
        ? `${active.length} transit contacts to the birth chart are active.`
        : "No transit contacts to the birth chart are close enough to count.",
    );
  }

  /* ── ashtakavarga ── */
  const ashtakavarga = payload.ashtakavarga;
  if (ashtakavarga && ashtakavarga.sarvashtakavarga.length === 12) {
    available.push("ashtakavarga");
    lines.push("");
    lines.push("[ASHTAKAVARGA]");
    lines.push(
      `Benefic points across the whole chart: ${ashtakavarga.totalBindus} of a possible 337.`,
    );
    if (ashtakavarga.strongSigns.length > 0) {
      lines.push(`Best supported signs: ${ashtakavarga.strongSigns.join(", ")}.`);
    }
    if (ashtakavarga.weakSigns.length > 0) {
      lines.push(`Least supported signs: ${ashtakavarga.weakSigns.join(", ")}.`);
    }
  }

  return { available, text: lines.join("\n") };
}
