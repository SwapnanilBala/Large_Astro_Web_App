import { describe, expect, it } from "vitest";
import {
  AVERAGE_BINDUS_PER_HOUSE,
  SAV_TOTAL_BINDUS,
  computeHouseSupport,
} from "../engines/house-support-engine";
import type { AshtakavargaData, HousePlacement } from "../astro-types";

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

/* A real Lahiri/Whole-Sign chart: 1988-07-07 14:30 IST, Kolkata, Libra rising.
 * Sign totals are Aries-first, as the engine emits them. */
const REAL_SAV = [33, 20, 24, 23, 29, 26, 33, 23, 28, 30, 30, 38];

function ashtakavarga(sav: number[]): AshtakavargaData {
  return {
    bhinnashtakavarga: {},
    sarvashtakavarga: sav,
    totalBindus: sav.reduce((sum, value) => sum + value, 0),
    strongSigns: [],
    weakSigns: [],
  };
}

/** Whole-sign houses starting at `ascendantSign`. */
function wholeSignHouses(ascendantSign: string): HousePlacement[] {
  const start = SIGNS.indexOf(ascendantSign);
  return Array.from({ length: 12 }, (_, offset) => ({
    house_number: offset + 1,
    sign: SIGNS[(start + offset) % 12],
    planets: [],
  }));
}

describe("computeHouseSupport", () => {
  it("carries each house's own sign total onto the house", () => {
    const result = computeHouseSupport(ashtakavarga(REAL_SAV), wholeSignHouses("Libra"));
    expect(result).not.toBeNull();
    // Libra rising: H1 = Libra (33), H2 = Scorpio (23), H6 = Pisces (38).
    expect(result!.houses[0]).toMatchObject({ house: 1, sign: "Libra", bindus: 33 });
    expect(result!.houses[1]).toMatchObject({ house: 2, sign: "Scorpio", bindus: 23 });
    expect(result!.houses[5]).toMatchObject({ house: 6, sign: "Pisces", bindus: 38 });
  });

  it("reports the ascendant's support against the 28.08 average", () => {
    const result = computeHouseSupport(ashtakavarga(REAL_SAV), wholeSignHouses("Libra"))!;
    expect(result.ascendant.bindus).toBe(33);
    // 33 / (337/12) = 117.5%
    expect(result.ascendant.percent).toBe(117.5);
    expect(result.averagePerHouse).toBeCloseTo(28.083, 3);
  });

  it("sums to exactly 337 — and so to 100% — for any whole-sign chart", () => {
    for (const sign of SIGNS) {
      const result = computeHouseSupport(ashtakavarga(REAL_SAV), wholeSignHouses(sign))!;
      expect(result.whole.bindus).toBe(SAV_TOTAL_BINDUS);
      expect(result.whole.percent).toBe(100);
      expect(result.whole.totalIsExact).toBe(true);
    }
  });

  it("flags a quadrant chart where a sign is duplicated and another intercepted", () => {
    /* Placidus at high latitude: Gemini on two cusps, Sagittarius on none.
     * The sign totals no longer partition, so the sum drifts off 337 and the
     * result must say so rather than presenting 100% it did not measure. */
    const houses = wholeSignHouses("Aries");
    houses[2].sign = "Gemini"; // H3 already Gemini elsewhere → duplicate
    houses[8].sign = "Gemini"; // H9 was Sagittarius → intercepted
    const result = computeHouseSupport(ashtakavarga(REAL_SAV), houses)!;
    expect(result.whole.totalIsExact).toBe(false);
    expect(result.whole.bindus).not.toBe(SAV_TOTAL_BINDUS);
  });

  it("bands houses on the same thresholds the Ashtakavarga panel uses", () => {
    const result = computeHouseSupport(ashtakavarga(REAL_SAV), wholeSignHouses("Libra"))!;
    const byHouse = (n: number) => result.houses[n - 1];
    expect(byHouse(1).band).toBe("strong"); // 33 >= 28
    expect(byHouse(2).band).toBe("weak"); //   23 <= 25
    expect(byHouse(11).band).toBe("strong"); // 29 >= 28
    expect(byHouse(12).band).toBe("neutral"); // 26 is between
  });

  it("finds the strongest and weakest houses and counts either side of average", () => {
    const result = computeHouseSupport(ashtakavarga(REAL_SAV), wholeSignHouses("Libra"))!;
    expect(result.whole.strongest).toMatchObject({ house: 6, bindus: 38 });
    expect(result.whole.weakest).toMatchObject({ house: 8, bindus: 20 });
    expect(result.whole.housesAbove + result.whole.housesBelow).toBeLessThanOrEqual(12);
    expect(result.whole.housesAbove).toBe(
      result.houses.filter((h) => h.bindus > AVERAGE_BINDUS_PER_HOUSE).length,
    );
  });

  it("returns null rather than a wrong chart when inputs are unusable", () => {
    expect(computeHouseSupport(null, wholeSignHouses("Aries"))).toBeNull();
    expect(computeHouseSupport(ashtakavarga(REAL_SAV), null)).toBeNull();
    expect(computeHouseSupport(ashtakavarga([1, 2, 3]), wholeSignHouses("Aries"))).toBeNull();
    const badSign = wholeSignHouses("Aries");
    badSign[4].sign = "Ophiuchus";
    expect(computeHouseSupport(ashtakavarga(REAL_SAV), badSign)).toBeNull();
    expect(computeHouseSupport(ashtakavarga(REAL_SAV), wholeSignHouses("Aries").slice(0, 11))).toBeNull();
  });
});
