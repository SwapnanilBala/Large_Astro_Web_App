import type { AshtakavargaData, HousePlacement } from "@/lib/astro-types";

/*
 * House support from Sarvashtakavarga.
 *
 * Ashtakavarga scores *signs*, not houses: `sarvashtakavarga` is twelve sign
 * totals that always sum to 337 bindus. Reading it as house support means
 * carrying each house's sign total onto the house, which is what this does.
 *
 * The mapping comes from the chart's own `houses` array rather than from
 * counting forward off the ascendant. Those agree under Whole Sign, which is
 * this app's default, but they do not agree under Placidus, Koch, Campanus or
 * Regiomontanus — all of which this app offers. There a sign can rule two
 * cusps or none, so counting off the ascendant silently attributes the wrong
 * total to most of the chart. See `totalIsExact` below for what that costs.
 */

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

/** Every chart's Sarvashtakavarga sums to this. The engine enforces it. */
export const SAV_TOTAL_BINDUS = 337;

/** 337 / 12 = 28.083…, the bindu count a house holds at dead average. */
export const AVERAGE_BINDUS_PER_HOUSE = SAV_TOTAL_BINDUS / 12;

/*
 * Classical names and groupings for the twelve bhavas.
 *
 * Here rather than in either panel because the desktop /insights view and the
 * /m/insights view both render this reference and must not drift apart.
 *
 * The *copy* for what each house governs is deliberately not here — that is
 * HOUSE_THEMES in lib/rules/tables.ts, which the rule engine and chart-service
 * already use to write sentences about house activation. A second wording
 * would let the panels disagree with the readings on the same page.
 */
export const BHAVA_NAMES: Record<number, string> = {
  1: "Tanu", 2: "Dhana", 3: "Sahaja", 4: "Bandhu",
  5: "Putra", 6: "Ari", 7: "Yuvati", 8: "Randhra",
  9: "Dharma", 10: "Karma", 11: "Labha", 12: "Vyaya",
};

/*
 * Two groupings, in this order: the angular one first, then the qualifiers.
 *
 * Kendra/Panaphara/Apoklima partitions all twelve houses, so every entry gets
 * at least one tag and none of them look truncated. Trikona, Upachaya and
 * Dusthana overlap it and each other on purpose — the 6th really is both an
 * Upachaya and a Dusthana, and the 1st really is both a Kendra and a Trikona.
 * Picking one to display would be tidier and wrong.
 */
export const HOUSE_GROUPS: Record<number, readonly string[]> = {
  1: ["Kendra", "Trikona"],
  2: ["Panaphara"],
  3: ["Apoklima", "Upachaya"],
  4: ["Kendra"],
  5: ["Panaphara", "Trikona"],
  6: ["Apoklima", "Upachaya", "Dusthana"],
  7: ["Kendra"],
  8: ["Panaphara", "Dusthana"],
  9: ["Apoklima", "Trikona"],
  10: ["Kendra", "Upachaya"],
  11: ["Panaphara", "Upachaya"],
  12: ["Apoklima", "Dusthana"],
};

export type SupportBand = "strong" | "neutral" | "weak";

export type HouseSupport = {
  house: number;
  sign: string;
  bindus: number;
  /** Percentage of the 28.08 average. 100 = exactly average. */
  percent: number;
  band: SupportBand;
};

export type HouseSupportResult = {
  houses: HouseSupport[];
  averagePerHouse: number;
  /** The 1st house — the chart's support for the self. */
  ascendant: HouseSupport;
  whole: {
    bindus: number;
    /** Bindus across all twelve houses as a percentage of the 337 baseline. */
    percent: number;
    housesAbove: number;
    housesBelow: number;
    strongest: HouseSupport;
    weakest: HouseSupport;
    /*
     * True when the twelve houses carry twelve distinct signs, i.e. the sign
     * totals partition cleanly and the sum really is 337. Under a quadrant
     * house system it can be false: a duplicated sign is counted twice and an
     * intercepted one not at all, so `percent` drifts off 100 and is reporting
     * the house division as much as the chart. The panel says so rather than
     * presenting the number as if it were the same measurement.
     */
    totalIsExact: boolean;
  };
};

/* Same thresholds the Ashtakavarga panel already uses for SAV cells, so a
 * house called "strong" here is the same claim as a strong cell there. */
function bandFor(bindus: number): SupportBand {
  if (bindus >= 28) return "strong";
  if (bindus <= 25) return "weak";
  return "neutral";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeHouseSupport(
  ashtakavarga: AshtakavargaData | null | undefined,
  houses: HousePlacement[] | null | undefined,
): HouseSupportResult | null {
  const sav = ashtakavarga?.sarvashtakavarga;
  if (!sav || sav.length !== 12) return null;
  if (!houses || houses.length !== 12) return null;

  const byNumber = new Map<number, HousePlacement>();
  for (const house of houses) byNumber.set(house.house_number, house);

  const supports: HouseSupport[] = [];
  for (let houseNumber = 1; houseNumber <= 12; houseNumber++) {
    const placement = byNumber.get(houseNumber);
    if (!placement) return null;
    const signIndex = SIGNS.indexOf(placement.sign as (typeof SIGNS)[number]);
    if (signIndex < 0) return null;
    const bindus = sav[signIndex];
    if (!Number.isFinite(bindus)) return null;
    supports.push({
      house: houseNumber,
      sign: placement.sign,
      bindus,
      percent: round1((bindus / AVERAGE_BINDUS_PER_HOUSE) * 100),
      band: bandFor(bindus),
    });
  }

  const totalBindus = supports.reduce((sum, entry) => sum + entry.bindus, 0);
  const distinctSigns = new Set(supports.map((entry) => entry.sign)).size;

  const byBindus = [...supports].sort((left, right) => right.bindus - left.bindus);

  return {
    houses: supports,
    averagePerHouse: AVERAGE_BINDUS_PER_HOUSE,
    ascendant: supports[0],
    whole: {
      bindus: totalBindus,
      percent: round1((totalBindus / SAV_TOTAL_BINDUS) * 100),
      housesAbove: supports.filter((entry) => entry.bindus > AVERAGE_BINDUS_PER_HOUSE).length,
      housesBelow: supports.filter((entry) => entry.bindus < AVERAGE_BINDUS_PER_HOUSE).length,
      strongest: byBindus[0],
      weakest: byBindus[byBindus.length - 1],
      totalIsExact: distinctSigns === 12,
    },
  };
}
