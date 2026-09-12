import { describe, expect, it } from "vitest";
import {
  computeKalatraDetail,
  computeMangalDosha,
  houseFrom,
} from "../engines/kalatra-engine";
import type { HousePlacement, PlanetPosition } from "../engines/swiss-ephemeris-engine";

/*
 * The rules are the product here, so they are pinned rather than smoke-tested.
 *
 * Each case is built as a whole-sign chart with the planets placed exactly
 * where a rule needs them, so a failure names the classical statement that
 * broke rather than "a facet changed shape".
 */

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

/** Whole-sign houses from an ascendant sign, with planets dropped into houses. */
function chartOf(
  ascendant: string,
  placements: Record<string, number>
): { planets: PlanetPosition[]; houses: HousePlacement[] } {
  const start = SIGNS.indexOf(ascendant);
  const signForHouse = (house: number) => SIGNS[(start + house - 1) % 12];

  const planets: PlanetPosition[] = Object.entries(placements).map(([name, house]) => ({
    name,
    longitude: ((start + house - 1) % 12) * 30 + 15,
    sign: signForHouse(house),
    degree_in_sign: 15,
    house,
  }));

  const houses: HousePlacement[] = Array.from({ length: 12 }, (_, index) => {
    const house = index + 1;
    return {
      house_number: house,
      sign: signForHouse(house),
      planets: Object.entries(placements)
        .filter(([, h]) => h === house)
        .map(([name]) => name),
    };
  });

  return { planets, houses };
}

const facet = (result: ReturnType<typeof computeKalatraDetail>, key: string) => {
  const found = result?.facets.find((f) => f.key === key);
  if (!found) throw new Error(`facet ${key} missing`);
  return found;
};

const bases = (result: ReturnType<typeof computeKalatraDetail>, key: string) =>
  facet(result, key).findings.map((f) => f.basis);

// ---------------------------------------------------------------------------

describe("houseFrom — bhavat bhavam", () => {
  it("counts the spouse's relatives from the 7th", () => {
    /* The three derivations the in-law facet is built on. If these move, the
       whole facet is reading the wrong houses. */
    expect(houseFrom(7, 4)).toBe(10); // spouse's mother
    expect(houseFrom(7, 9)).toBe(3); //  spouse's father
    expect(houseFrom(7, 3)).toBe(9); //  spouse's siblings
  });

  it("wraps the zodiac rather than running past 12", () => {
    expect(houseFrom(12, 2)).toBe(1);
    expect(houseFrom(10, 7)).toBe(4);
    expect(houseFrom(1, 1)).toBe(1);
  });
});

describe("Mangal dosha", () => {
  it("fires on each of the six classical houses", () => {
    for (const house of [1, 2, 4, 7, 8, 12]) {
      const { planets, houses } = chartOf("Aries", { Mars: house });
      expect(computeMangalDosha(planets, houses).present, `house ${house}`).toBe(true);
    }
  });

  it("stays silent everywhere else", () => {
    for (const house of [3, 5, 6, 9, 10, 11]) {
      const { planets, houses } = chartOf("Aries", { Mars: house });
      expect(computeMangalDosha(planets, houses).present, `house ${house}`).toBe(false);
    }
  });

  it("is cancelled when Mars sits in its own sign", () => {
    /* Scorpio ascendant puts Mars in the 1st in Scorpio — a dosha house and
       Mars's own sign at once. */
    const { planets, houses } = chartOf("Scorpio", { Mars: 1 });
    const dosha = computeMangalDosha(planets, houses);
    expect(dosha.present).toBe(true);
    expect(dosha.cancellations).toContain("Mars is in its own sign (Scorpio)");
    expect(dosha.active).toBe(false);
  });

  it("is cancelled when Jupiter aspects Mars", () => {
    /* Jupiter in the 4th throws its 5th aspect to the 8th, where Mars sits. */
    const { planets, houses } = chartOf("Aries", { Mars: 8, Jupiter: 4 });
    const dosha = computeMangalDosha(planets, houses);
    expect(dosha.present).toBe(true);
    expect(dosha.cancellations).toContain("Jupiter aspects Mars");
    expect(dosha.active).toBe(false);
  });

  it("is cancelled by Mercury's signs in the 2nd", () => {
    /* Taurus rising puts the 2nd in Gemini. */
    const { planets, houses } = chartOf("Taurus", { Mars: 2 });
    const dosha = computeMangalDosha(planets, houses);
    expect(dosha.cancellations).toContain("Mars in the 2nd in Gemini, a sign of Mercury");
    expect(dosha.active).toBe(false);
  });

  it("stays active when nothing cancels it", () => {
    /* Aries rising, Mars in the 7th in Libra: a dosha house, Mars in its sign
       of debilitation-adjacent detriment, no Jupiter anywhere. */
    const { planets, houses } = chartOf("Aries", { Mars: 7 });
    const dosha = computeMangalDosha(planets, houses);
    expect(dosha.present).toBe(true);
    expect(dosha.cancellations).toEqual([]);
    expect(dosha.active).toBe(true);
  });
});

describe("the physical-side facet", () => {
  it("reads Venus and Mars in one house as a strong charge", () => {
    const { planets, houses } = chartOf("Aries", { Venus: 5, Mars: 5 });
    const result = computeKalatraDetail(planets, houses);
    expect(bases(result, "physical_intimacy")).toContain(
      "Venus and Mars both in the 5th house"
    );
  });

  it("reads benefics in the 8th as easing the private half", () => {
    const { planets, houses } = chartOf("Aries", { Jupiter: 8 });
    const result = computeKalatraDetail(planets, houses);
    expect(bases(result, "physical_intimacy")).toContain(
      "Jupiter in the 8th (Randhra) house"
    );
  });

  it("marks a debilitated Venus as pressure, not absence", () => {
    /* Libra rising puts the 12th in Virgo, where Venus falls. */
    const { planets, houses } = chartOf("Libra", { Venus: 12 });
    const result = computeKalatraDetail(planets, houses);
    const finding = facet(result, "physical_intimacy").findings.find((f) =>
      f.basis.includes("debilitated")
    );
    expect(finding?.polarity).toBe("pressure");
  });

  it("scores a supported chart above a strained one", () => {
    const supported = chartOf("Aries", { Venus: 5, Mars: 5, Jupiter: 8 });
    const strained = chartOf("Libra", { Venus: 12, Saturn: 8 });
    const a = computeKalatraDetail(supported.planets, supported.houses);
    const b = computeKalatraDetail(strained.planets, strained.houses);
    expect(facet(a, "physical_intimacy").score).toBeGreaterThan(
      facet(b, "physical_intimacy").score
    );
  });
});

describe("the privacy facet", () => {
  it("treats Venus in the 12th as shayya sukha rather than loss", () => {
    const { planets, houses } = chartOf("Aries", { Venus: 12 });
    const result = computeKalatraDetail(planets, houses);
    const finding = facet(result, "privacy_and_rest").findings.find((f) =>
      f.basis.includes("shayya sukha")
    );
    expect(finding).toBeDefined();
    expect(finding?.polarity).toBe("support");
  });

  it("reads malefics in the 12th as disturbed rest", () => {
    const { planets, houses } = chartOf("Aries", { Saturn: 12 });
    const result = computeKalatraDetail(planets, houses);
    const finding = facet(result, "privacy_and_rest").findings.find((f) =>
      f.basis.includes("12th (Vyaya)")
    );
    expect(finding?.polarity).toBe("pressure");
  });
});

describe("the in-law facet", () => {
  it("reads the spouse's mother off the 10th and shows the derivation", () => {
    const { planets, houses } = chartOf("Aries", { Saturn: 10 });
    const result = computeKalatraDetail(planets, houses);
    const finding = facet(result, "in_laws").findings.find((f) =>
      f.basis.includes("4th from the 7th")
    );
    expect(finding?.basis).toBe("Saturn in the 10th (4th from the 7th = your 10th house)");
    expect(finding?.text).toContain("your spouse's mother");
    expect(finding?.polarity).toBe("pressure");
  });

  it("reads the spouse's father off the 3rd", () => {
    const { planets, houses } = chartOf("Aries", { Venus: 3 });
    const result = computeKalatraDetail(planets, houses);
    const finding = facet(result, "in_laws").findings.find((f) =>
      f.basis.includes("9th from the 7th")
    );
    expect(finding?.basis).toBe("Venus in the 3rd (9th from the 7th = your 3rd house)");
    expect(finding?.text).toContain("your spouse's father");
    expect(finding?.polarity).toBe("support");
  });

  it("reads the spouse's siblings off the 9th", () => {
    const { planets, houses } = chartOf("Aries", { Mars: 9 });
    const result = computeKalatraDetail(planets, houses);
    const finding = facet(result, "in_laws").findings.find((f) =>
      f.basis.includes("3rd from the 7th")
    );
    expect(finding?.basis).toBe("Mars in the 9th (3rd from the 7th = your 9th house)");
    expect(finding?.text).toContain("your spouse's siblings");
  });

  it("credits Jupiter's aspect on an in-law house as smoothing", () => {
    /* Jupiter in the 6th throws its 5th aspect onto the 10th. */
    const { planets, houses } = chartOf("Aries", { Jupiter: 6 });
    const result = computeKalatraDetail(planets, houses);
    const finding = facet(result, "in_laws").findings.find((f) =>
      f.basis.startsWith("Jupiter aspects the 10th")
    );
    expect(finding?.polarity).toBe("support");
  });

  it("agrees the verb with the number of planets", () => {
    /* Two malefics in one in-law house produced "Saturn and Rahu falls on the
       house", which is what a one-planet template does the first time two
       planets share a sign. */
    const two = chartOf("Aries", { Saturn: 10, Rahu: 10 });
    const one = chartOf("Aries", { Saturn: 10 });
    const twoText = facet(computeKalatraDetail(two.planets, two.houses), "in_laws")
      .findings.map((f) => f.text)
      .join(" ");
    const oneText = facet(computeKalatraDetail(one.planets, one.houses), "in_laws")
      .findings.map((f) => f.text)
      .join(" ");
    expect(twoText).toContain("Saturn and Rahu fall on");
    expect(twoText).not.toContain("Saturn and Rahu falls");
    expect(oneText).toContain("Saturn falls on");
  });

  it("gives each relation its own copy rather than one template", () => {
    /* Same polarity, three different houses: if the sentences after the first
       clause match, the relations are sharing a template again. */
    const { planets, houses } = chartOf("Aries", { Saturn: 10, Mars: 3, Ketu: 9 });
    const result = computeKalatraDetail(planets, houses);
    const pressure = facet(result, "in_laws")
      .findings.filter((f) => f.polarity === "pressure")
      .map((f) => f.text.split(". ").slice(1).join(". "));
    expect(pressure.length).toBe(3);
    expect(new Set(pressure).size).toBe(3);
  });

  it("says so plainly when the in-law houses are empty", () => {
    const { planets, houses } = chartOf("Aries", { Sun: 5 });
    const result = computeKalatraDetail(planets, houses);
    expect(facet(result, "in_laws").findings).toEqual([]);
    expect(facet(result, "in_laws").summary).toContain("unlikely to be a defining feature");
  });
});

describe("the durability facet", () => {
  it("reads a 7th lord in a dusthana as strain", () => {
    /* Aries rising: 7th is Libra, lord Venus. Venus in the 12th is a dusthana. */
    const { planets, houses } = chartOf("Aries", { Venus: 12 });
    const result = computeKalatraDetail(planets, houses);
    const finding = facet(result, "bond_durability").findings.find((f) =>
      f.basis.startsWith("7th lord Venus in the 12th")
    );
    expect(finding?.polarity).toBe("pressure");
  });

  it("credits Jupiter's aspect on the 7th as classical protection", () => {
    /* Jupiter in the 3rd casts its 5th aspect onto the 7th. */
    const { planets, houses } = chartOf("Aries", { Jupiter: 3 });
    const result = computeKalatraDetail(planets, houses);
    const finding = facet(result, "bond_durability").findings.find((f) =>
      f.basis.includes("Jupiter aspects the 7th")
    );
    expect(finding?.polarity).toBe("support");
  });

  it("reports a cancelled dosha as context rather than pressure", () => {
    const { planets, houses } = chartOf("Scorpio", { Mars: 1 });
    const result = computeKalatraDetail(planets, houses);
    const finding = facet(result, "bond_durability").findings.find((f) =>
      f.basis.includes("from the ascendant")
    );
    expect(finding?.polarity).toBe("context");
    expect(finding?.text).toContain("cancelled");
  });
});

describe("the desire facet", () => {
  it("calls a busy kama trikona a live engine", () => {
    const { planets, houses } = chartOf("Aries", { Sun: 3, Moon: 7, Mercury: 11 });
    const result = computeKalatraDetail(planets, houses);
    expect(bases(result, "desire_pattern")).toContain(
      "3 planets across the kama trikona (3rd, 7th, 11th)"
    );
  });

  it("calls an empty one out too", () => {
    const { planets, houses } = chartOf("Aries", { Sun: 5 });
    const result = computeKalatraDetail(planets, houses);
    expect(bases(result, "desire_pattern")).toContain(
      "No planets in the kama trikona (3rd, 7th, 11th)"
    );
  });
});

describe("the result as a whole", () => {
  it("returns all five facets, each with a band and sourcing", () => {
    const { planets, houses } = chartOf("Aries", { Venus: 7, Mars: 8, Jupiter: 5 });
    const result = computeKalatraDetail(planets, houses);
    expect(result?.facets.map((f) => f.key)).toEqual([
      "physical_intimacy",
      "privacy_and_rest",
      "in_laws",
      "bond_durability",
      "desire_pattern",
    ]);
    for (const f of result!.facets) {
      expect(f.sourcing.length).toBeGreaterThan(20);
      expect(["strong", "mixed", "tender"]).toContain(f.band);
      expect(f.score).toBeGreaterThanOrEqual(4);
      expect(f.score).toBeLessThanOrEqual(96);
    }
  });

  it("gives every finding a basis a reader could check", () => {
    const { planets, houses } = chartOf("Taurus", {
      Sun: 4, Moon: 9, Mars: 2, Mercury: 4, Jupiter: 8, Venus: 12, Saturn: 7,
    });
    const result = computeKalatraDetail(planets, houses);
    const all = result!.facets.flatMap((f) => f.findings);
    expect(all.length).toBeGreaterThan(4);
    for (const finding of all) {
      expect(finding.basis).not.toBe("");
      expect(finding.text.length).toBeGreaterThan(40);
      expect(["support", "pressure", "context"]).toContain(finding.polarity);
    }
  });

  it("returns null rather than an empty shell when there is no chart", () => {
    expect(computeKalatraDetail([], [])).toBeNull();
  });
});
