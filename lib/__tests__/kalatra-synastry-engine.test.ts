import { describe, expect, it } from "vitest";
import {
  computeKalatraSynastry,
  nadiOf,
  type SynastryChart,
} from "../engines/kalatra-synastry-engine";
import { NAKSHATRA_SPAN } from "../engines/nakshatra-engine";
import type { HousePlacement, PlanetPosition } from "../engines/swiss-ephemeris-engine";

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

/**
 * A whole-sign chart. `moonNakshatra` places the Moon at the centre of a given
 * nakshatra when a test needs Nadi, overriding its house placement.
 */
function chartOf(
  name: string,
  ascendant: string,
  placements: Record<string, number>,
  moonNakshatra?: number
): SynastryChart {
  const start = SIGNS.indexOf(ascendant);
  const signForHouse = (house: number) => SIGNS[(start + house - 1) % 12];

  const planets: PlanetPosition[] = Object.entries(placements).map(([planet, house]) => {
    const signIndex = (start + house - 1) % 12;
    const longitude =
      planet === "Moon" && moonNakshatra !== undefined
        ? moonNakshatra * NAKSHATRA_SPAN + NAKSHATRA_SPAN / 2
        : signIndex * 30 + 15;
    return {
      name: planet,
      longitude,
      sign:
        planet === "Moon" && moonNakshatra !== undefined
          ? SIGNS[Math.floor(longitude / 30) % 12]
          : SIGNS[signIndex],
      degree_in_sign: longitude % 30,
      house,
    };
  });

  const houses: HousePlacement[] = Array.from({ length: 12 }, (_, index) => {
    const house = index + 1;
    return {
      house_number: house,
      sign: signForHouse(house),
      planets: Object.entries(placements)
        .filter(([, h]) => h === house)
        .map(([planet]) => planet),
    };
  });

  return { name, planets, houses };
}

const facet = (result: ReturnType<typeof computeKalatraSynastry>, key: string) => {
  const found = result?.facets.find((f) => f.key === key);
  if (!found) throw new Error(`facet ${key} missing`);
  return found;
};

const texts = (result: ReturnType<typeof computeKalatraSynastry>, key: string) =>
  facet(result, key).findings.map((f) => f.text).join(" ");

// ---------------------------------------------------------------------------

describe("nadiOf", () => {
  /*
   * The classical groups, zero-indexed from Ashwini. Spelled out in full
   * because the first implementation used `index % 3`, which agrees with the
   * real assignment for the first three nakshatras and then disagrees from
   * Rohini onward — a bug that passes a spot check and fails two thirds of
   * real charts.
   */
  const AADI = [0, 5, 6, 11, 12, 17, 18, 23, 24];
  const MADHYA = [1, 4, 7, 10, 13, 16, 19, 22, 25];
  const ANTYA = [2, 3, 8, 9, 14, 15, 20, 21, 26];

  it("assigns all 27 nakshatras to their classical nadi", () => {
    for (const index of AADI) expect(nadiOf(index), `nakshatra ${index}`).toBe(0);
    for (const index of MADHYA) expect(nadiOf(index), `nakshatra ${index}`).toBe(1);
    for (const index of ANTYA) expect(nadiOf(index), `nakshatra ${index}`).toBe(2);
  });

  it("covers each nadi exactly nine times", () => {
    const counts = [0, 0, 0];
    for (let index = 0; index < 27; index += 1) counts[nadiOf(index)] += 1;
    expect(counts).toEqual([9, 9, 9]);
  });

  it("disagrees with a plain modulo, which is the point", () => {
    /* Rohini (3) is Antya; index % 3 would call it Aadi. */
    expect(nadiOf(3)).toBe(2);
    expect(nadiOf(3)).not.toBe(3 % 3);
  });
});

describe("Mangal matching", () => {
  it("cancels the dosha when both charts carry it — dosha samya", () => {
    /* Aries rising, Mars in the 7th in Libra: present, no parihara. */
    const a = chartOf("Asha", "Aries", { Mars: 7 });
    const b = chartOf("Ravi", "Aries", { Mars: 7 });
    const result = computeKalatraSynastry(a, b);
    expect(facet(result, "mangal_matching").verdict).toBe("Mutually cancelled");
    expect(texts(result, "mangal_matching")).toContain("dosha samya");
  });

  it("leaves it standing when only one side carries it", () => {
    const a = chartOf("Asha", "Aries", { Mars: 7 });
    const b = chartOf("Ravi", "Aries", { Mars: 5 });
    const result = computeKalatraSynastry(a, b);
    expect(facet(result, "mangal_matching").verdict).toBe("Carried by one side");
    expect(texts(result, "mangal_matching")).toContain("Only Asha carries it");
  });

  it("reports not in play when neither has it", () => {
    const a = chartOf("Asha", "Aries", { Mars: 5 });
    const b = chartOf("Ravi", "Aries", { Mars: 9 });
    expect(facet(computeKalatraSynastry(a, b), "mangal_matching").verdict).toBe("Not in play");
  });

  it("does not treat a chart-internally cancelled dosha as a matching partner", () => {
    /* Asha is uncancelled; Ravi's is cancelled in his own chart by Mars in
       Scorpio. That is not dosha samya — there is nothing live to cancel. */
    const a = chartOf("Asha", "Aries", { Mars: 7 });
    const b = chartOf("Ravi", "Scorpio", { Mars: 1 });
    const result = computeKalatraSynastry(a, b);
    expect(facet(result, "mangal_matching").verdict).toBe("Carried by one side");
  });
});

describe("Bhakoot", () => {
  const withMoonSign = (name: string, sign: string) =>
    chartOf(name, sign, { Moon: 1 });

  it("flags a 6/8 pair as shashtashtaka", () => {
    /* Aries and Virgo: Aries->Virgo is 6, Virgo->Aries is 8. */
    const result = computeKalatraSynastry(withMoonSign("A", "Aries"), withMoonSign("B", "Virgo"));
    expect(texts(result, "moon_doshas")).toContain("shashtashtaka");
  });

  it("flags a 2/12 pair as dwirdwadasha", () => {
    const result = computeKalatraSynastry(withMoonSign("A", "Aries"), withMoonSign("B", "Taurus"));
    expect(texts(result, "moon_doshas")).toContain("dwirdwadasha");
  });

  it("credits a 5/9 pair as nava-pancham", () => {
    /* Aries and Leo: Aries->Leo is 5, Leo->Aries is 9. */
    const result = computeKalatraSynastry(withMoonSign("A", "Aries"), withMoonSign("B", "Leo"));
    expect(texts(result, "moon_doshas")).toContain("nava-pancham");
  });

  it("passes an unremarkable pair without comment", () => {
    /* Aries and Gemini: 3/11, which classical matching has no objection to. */
    const result = computeKalatraSynastry(withMoonSign("A", "Aries"), withMoonSign("B", "Gemini"));
    expect(texts(result, "moon_doshas")).toContain("Bhakoot is not afflicted");
  });
});

describe("Nadi", () => {
  const withNakshatra = (name: string, index: number) =>
    chartOf(name, "Aries", { Moon: 1 }, index);

  it("flags a shared nadi in different nakshatras", () => {
    /* Ashwini (0) and Ardra (5) are both Aadi. */
    const result = computeKalatraSynastry(withNakshatra("A", 0), withNakshatra("B", 5));
    const text = texts(result, "moon_doshas");
    expect(text).toContain("Aadi nadi");
    expect(text).toContain("heaviest single objection");
  });

  it("exempts a shared nadi when both Moons are in one nakshatra", () => {
    const result = computeKalatraSynastry(withNakshatra("A", 0), withNakshatra("B", 0));
    expect(texts(result, "moon_doshas")).toContain("classical exemption");
  });

  it("passes different nadis", () => {
    /* Ashwini (0) is Aadi, Bharani (1) is Madhya. */
    const result = computeKalatraSynastry(withNakshatra("A", 0), withNakshatra("B", 1));
    expect(texts(result, "moon_doshas")).toContain("different nadis");
  });
});

describe("chemistry by overlay", () => {
  it("reads a Venus/Mars conjunction across the charts", () => {
    const a = chartOf("Asha", "Aries", { Venus: 5 }); // Venus in Leo
    const b = chartOf("Ravi", "Leo", { Mars: 1 }); //   Mars in Leo
    const result = computeKalatraSynastry(a, b);
    expect(texts(result, "physical_chemistry")).toContain("share a sign");
  });

  it("reads a planet landing in the partner's 7th", () => {
    /* Asha's Venus in Libra; Libra is Ravi's 7th from an Aries ascendant. */
    const a = chartOf("Asha", "Libra", { Venus: 1 });
    const b = chartOf("Ravi", "Aries", { Sun: 1 });
    const result = computeKalatraSynastry(a, b);
    expect(texts(result, "physical_chemistry")).toContain("7th — the house of the partner itself");
  });

  it("reads Venus into the partner's 12th as shayya sukha by overlay", () => {
    /* Asha's Venus in Pisces; Pisces is Ravi's 12th from an Aries ascendant. */
    const a = chartOf("Asha", "Pisces", { Venus: 1 });
    const b = chartOf("Ravi", "Aries", { Sun: 1 });
    const result = computeKalatraSynastry(a, b);
    expect(texts(result, "physical_chemistry")).toContain("shayya sukha by overlay");
  });
});

describe("the in-law cross-check", () => {
  it("reports agreement when both routes read the same way", () => {
    /* Asha's 10th carries Jupiter (warm by derivation for Ravi's mother);
       Ravi's own 4th carries Venus (warm directly). */
    const a = chartOf("Asha", "Aries", { Jupiter: 10 });
    const b = chartOf("Ravi", "Aries", { Venus: 4 });
    const result = computeKalatraSynastry(a, b);
    const finding = facet(result, "in_law_crosscheck").findings.find((f) =>
      f.text.includes("Both charts say the same thing")
    );
    expect(finding).toBeDefined();
    expect(finding?.text).toContain("mother");
  });

  it("says so when the two routes disagree", () => {
    /* Asha's 10th carries Saturn (strained by derivation); Ravi's own 4th
       carries Jupiter (warm directly). */
    const a = chartOf("Asha", "Aries", { Saturn: 10 });
    const b = chartOf("Ravi", "Aries", { Jupiter: 4 });
    const result = computeKalatraSynastry(a, b);
    expect(texts(result, "in_law_crosscheck")).toContain("The two routes disagree");
    expect(facet(result, "in_law_crosscheck").verdict).toBe("Routes disagree");
  });

  it("stays quiet when neither house says anything", () => {
    const a = chartOf("Asha", "Aries", { Sun: 5 });
    const b = chartOf("Ravi", "Aries", { Sun: 5 });
    const result = computeKalatraSynastry(a, b);
    expect(facet(result, "in_law_crosscheck").findings).toEqual([]);
    expect(facet(result, "in_law_crosscheck").verdict).toBe("Nothing to check");
  });
});

describe("privacy overlay", () => {
  it("flags malefics landing in the partner's 12th", () => {
    /* Asha's Saturn in Pisces; Pisces is Ravi's 12th. */
    const a = chartOf("Asha", "Pisces", { Saturn: 1 });
    const b = chartOf("Ravi", "Aries", { Sun: 1 });
    const result = computeKalatraSynastry(a, b);
    expect(texts(result, "privacy_overlay")).toContain("Rest is where this shows first");
  });

  it("leaves Venus in the partner's 12th to the chemistry facet", () => {
    /* Both facets look at the 12th, and on the first real pair this ran
       against, Asha's Venus in Ravi's 12th came back in both cards. */
    const a = chartOf("Asha", "Pisces", { Venus: 1 });
    const b = chartOf("Ravi", "Aries", { Sun: 1 });
    const result = computeKalatraSynastry(a, b);
    expect(texts(result, "physical_chemistry")).toContain("shayya sukha by overlay");
    expect(facet(result, "privacy_overlay").findings).toEqual([]);
  });

  it("still reports other benefics landing in the partner's 12th", () => {
    const a = chartOf("Asha", "Pisces", { Jupiter: 1 });
    const b = chartOf("Ravi", "Aries", { Sun: 1 });
    const result = computeKalatraSynastry(a, b);
    expect(texts(result, "privacy_overlay")).toContain("rest better with this person");
  });

  it("agrees the verb when two planets land together", () => {
    const a = chartOf("Asha", "Pisces", { Saturn: 1, Ketu: 1 });
    const b = chartOf("Ravi", "Aries", { Sun: 1 });
    const result = computeKalatraSynastry(a, b);
    const text = texts(result, "privacy_overlay");
    expect(text).toContain("Saturn and Ketu land in");
    expect(text).not.toContain("Saturn and Ketu lands");
  });
});

describe("the result as a whole", () => {
  it("returns all five facets, each sourced and with a verdict", () => {
    const a = chartOf("Asha", "Aries", { Venus: 7, Mars: 8, Moon: 2, Jupiter: 10 });
    const b = chartOf("Ravi", "Leo", { Venus: 3, Mars: 1, Moon: 6, Saturn: 4 });
    const result = computeKalatraSynastry(a, b);
    expect(result?.facets.map((f) => f.key)).toEqual([
      "mangal_matching",
      "moon_doshas",
      "physical_chemistry",
      "in_law_crosscheck",
      "privacy_overlay",
    ]);
    for (const f of result!.facets) {
      expect(f.sourcing.length).toBeGreaterThan(20);
      expect(f.verdict.length).toBeGreaterThan(3);
      for (const finding of f.findings) {
        expect(finding.basis).not.toBe("");
        expect(["clear", "caution", "context"]).toContain(finding.polarity);
      }
    }
  });

  it("names both people rather than saying 'the primary chart'", () => {
    const a = chartOf("Asha", "Aries", { Mars: 7, Moon: 1 });
    const b = chartOf("Ravi", "Aries", { Mars: 7, Moon: 1 });
    const all = computeKalatraSynastry(a, b)!
      .facets.flatMap((f) => f.findings)
      .map((f) => f.text)
      .join(" ");
    expect(all).toContain("Asha");
    expect(all).toContain("Ravi");
  });

  it("returns null rather than an empty shell without charts", () => {
    const empty: SynastryChart = { name: "X", planets: [], houses: [] };
    expect(computeKalatraSynastry(empty, empty)).toBeNull();
  });
});
