import { describe, expect, it } from "vitest";

import {
  detectYogas,
  YOGA_DEFINITIONS,
  type YogaChartInput,
} from "../engines/yoga-engine";

function buildChart(): YogaChartInput {
  const planets = [
    { name: "Sun", longitude: 45, sign: "Taurus", degree_in_sign: 15, house: 1 },
    { name: "Moon", longitude: 120, sign: "Leo", degree_in_sign: 0, house: 4 },
    { name: "Mercury", longitude: 50, sign: "Taurus", degree_in_sign: 20, house: 1 },
    { name: "Venus", longitude: 200, sign: "Libra", degree_in_sign: 20, house: 6 },
    { name: "Mars", longitude: 15, sign: "Aries", degree_in_sign: 15, house: 12 },
    { name: "Jupiter", longitude: 90, sign: "Cancer", degree_in_sign: 0, house: 3 },
    { name: "Saturn", longitude: 270, sign: "Capricorn", degree_in_sign: 0, house: 9 },
    { name: "Rahu", longitude: 150, sign: "Virgo", degree_in_sign: 0, house: 5 },
    { name: "Ketu", longitude: 330, sign: "Pisces", degree_in_sign: 0, house: 11 },
  ];
  const signs = [
    "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra",
    "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces", "Aries",
  ];
  const houses = signs.map((sign, index) => ({
    house_number: index + 1,
    sign,
    planets: planets.filter((planet) => planet.house === index + 1).map((planet) => planet.name),
  }));

  return { planets, houses, ascendantSign: "Taurus" };
}

describe("yoga-engine", () => {
  it("defines exactly 208 unique yogas", () => {
    const ids = YOGA_DEFINITIONS.map((definition) => definition.id);
    expect(YOGA_DEFINITIONS).toHaveLength(208);
    expect(new Set(ids)).toHaveLength(208);
  });

  /* Two yogas sharing a display name would be indistinguishable in the panel,
     which is the one place the reader sees them. Shakata is the near miss:
     the Moon-Jupiter combination and the Nabhasa figure are unrelated rules
     that the tradition gives the same name, so the second is disambiguated. */
  it("gives every yoga a distinct display name", () => {
    const names = YOGA_DEFINITIONS.map((definition) => definition.name);
    expect(new Set(names).size).toBe(YOGA_DEFINITIONS.length);
  });

  it("adds occurrence chance to every detected yoga", () => {
    const yogas = detectYogas(buildChart());
    expect(yogas.length).toBeGreaterThan(0);
    for (const yoga of yogas) {
      expect(yoga.occurrence_chance).toBeGreaterThanOrEqual(30);
      expect(yoga.occurrence_chance).toBeLessThanOrEqual(99);
    }
  });

  it("filters cancellation cases below the 30 percent occurrence threshold", () => {
    const yogas = detectYogas(buildChart());
    expect(yogas.find((yoga) => yoga.yoga_id === "shakata")).toBeUndefined();
  });
});

/*
 * The nine whole-chart figures below did not fire once in 50,000 sampled
 * charts, which is the expected result -- Dhwaja wants every benefic in the
 * ascendant and every malefic in the 8th -- but it is also exactly what a
 * definition that can never fire looks like. A Monte Carlo run cannot tell
 * those two apart, so each one gets a chart built to satisfy it by hand.
 *
 * These are the records most likely to be broken by a later refactor and
 * least likely to be noticed, since no real chart exercises them.
 */
describe("yoga-engine: rare whole-chart figures are reachable", () => {
  const SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];

  /** Aries ascendant, so house N carries sign N. Signs can be overridden
      where a rule tests dignity rather than placement. */
  function chartOf(
    placements: Record<string, number>,
    signOverrides: Record<string, string> = {},
  ): YogaChartInput {
    const houses = SIGNS.map((sign, index) => ({
      house_number: index + 1,
      sign,
      planets: [] as string[],
    }));
    const planets = Object.entries(placements).map(([name, house]) => ({
      name,
      longitude: 0,
      sign: signOverrides[name] ?? houses[house - 1].sign,
      degree_in_sign: 10,
      house,
    }));
    for (const planet of planets) {
      const home = houses.find((house) => house.sign === planet.sign);
      if (home) home.planets.push(planet.name);
    }
    return { planets, houses, ascendantSign: "Aries" };
  }

  const cases: Array<[string, YogaChartInput]> = [
    ["shakata_nabhasa", chartOf({ Sun: 1, Moon: 1, Mars: 1, Mercury: 1, Venus: 7, Jupiter: 7, Saturn: 7 })],
    ["vajra", chartOf({ Jupiter: 1, Venus: 1, Mercury: 7, Sun: 4, Mars: 4, Saturn: 10, Moon: 1 })],
    ["yava", chartOf({ Sun: 1, Mars: 1, Saturn: 7, Jupiter: 4, Mercury: 4, Venus: 10, Moon: 7 })],
    ["kamala", chartOf({ Sun: 1, Moon: 4, Mars: 7, Mercury: 10, Venus: 1, Jupiter: 4, Saturn: 7 })],
    ["vapi", chartOf({ Sun: 2, Moon: 5, Mars: 8, Mercury: 11, Venus: 2, Jupiter: 5, Saturn: 8 })],
    ["chakra", chartOf({ Sun: 1, Moon: 3, Mars: 5, Mercury: 7, Venus: 9, Jupiter: 11, Saturn: 1 })],
    ["samudra", chartOf({ Sun: 2, Moon: 4, Mars: 6, Mercury: 8, Venus: 10, Jupiter: 12, Saturn: 2 })],
    ["dhwaja", chartOf({ Mercury: 1, Venus: 1, Jupiter: 1, Sun: 8, Mars: 8, Saturn: 8, Moon: 5 })],
    ["kurma", chartOf(
      { Mercury: 5, Venus: 6, Jupiter: 7, Sun: 1, Mars: 3, Saturn: 11, Moon: 9 },
      {
        Mercury: "Virgo", Venus: "Pisces", Jupiter: "Cancer",
        Sun: "Aries", Mars: "Capricorn", Saturn: "Libra",
      },
    )],
    ["kalatra_chandra_shani", chartOf({ Moon: 7, Saturn: 7, Sun: 1, Mars: 2, Mercury: 3, Jupiter: 4, Venus: 5 })],
    ["kalatra_chandra_shukra", chartOf({ Moon: 1, Venus: 1, Sun: 2, Mercury: 2, Mars: 3, Jupiter: 4, Saturn: 5 })],
    ["kalatra_mangala_shani", chartOf({ Mars: 7, Saturn: 7, Jupiter: 3, Sun: 2, Moon: 2, Mercury: 2, Venus: 4 })],
  ];

  it.each(cases)("detects %s on a chart built to satisfy it", (id, chart) => {
    expect(detectYogas(chart).map((yoga) => yoga.yoga_id)).toContain(id);
  });

  /* The one yoga from the Brihat Jataka's chapter on malefic yogas: a spouse
     leaving, when the Moon and Saturn are both in the 7th. Being together is
     not enough (that is Vish), and neither is one of them there. */
  it("finds Kalatra Chandra-Shani only with both the Moon and Saturn in the 7th", () => {
    const others = { Sun: 1, Mars: 2, Mercury: 3, Jupiter: 4, Venus: 5 };
    const ids = (placements: Record<string, number>) =>
      detectYogas(chartOf({ ...others, ...placements })).map((yoga) => yoga.yoga_id);

    expect(ids({ Moon: 7, Saturn: 7 })).toContain("kalatra_chandra_shani");
    expect(ids({ Moon: 7, Saturn: 8 })).not.toContain("kalatra_chandra_shani");
    expect(ids({ Moon: 6, Saturn: 7 })).not.toContain("kalatra_chandra_shani");
    // In the 9th, clear of Jupiter's aspect from the 4th, which would cancel Vish.
    const together = ids({ Moon: 9, Saturn: 9 });
    expect(together).toContain("vish");
    expect(together).not.toContain("kalatra_chandra_shani");

    const found = detectYogas(chartOf({ ...others, Moon: 7, Saturn: 7 })).find(
      (yoga) => yoga.yoga_id === "kalatra_chandra_shani",
    );
    expect(found).toMatchObject({ category: "challenging", involved_planets: ["Moon", "Saturn"] });
    expect(found?.source).toContain("ch. 23");
    expect(found?.description).toBe("The Moon and Saturn share Libra in the 7th house.");
  });

  /* More than one marriage: the Moon and Venus both cast their (7th-sign)
     aspect on the 7th, which means both stand opposite it. */
  it("finds Kalatra Chandra-Shukra only when both the Moon and Venus aspect the 7th", () => {
    const others = { Sun: 2, Mercury: 2, Mars: 3, Jupiter: 4, Saturn: 5 };
    const detect = (placements: Record<string, number>) =>
      detectYogas(chartOf({ ...others, ...placements })).find((yoga) => yoga.yoga_id === "kalatra_chandra_shukra");

    expect(detect({ Moon: 1, Venus: 1 })?.description).toBe("The Moon and Venus in Aries both aspect the 7th house, Libra.");
    expect(detect({ Moon: 1, Venus: 2 })).toBeUndefined();
    // In the 7th is occupying it, not aspecting it.
    expect(detect({ Moon: 7, Venus: 7 })).toBeUndefined();
  });

  /* Marrying late: Mars and Saturn in the 7th, a benefic aspecting them, and a
     male planet sharing a sign with a female one. Every condition is needed. */
  it("finds Kalatra Mangala-Shani only with all three of its verse's conditions", () => {
    const detect = (placements: Record<string, number>) =>
      detectYogas(chartOf(placements)).find((yoga) => yoga.yoga_id === "kalatra_mangala_shani");
    const full = { Mars: 7, Saturn: 7, Jupiter: 3, Sun: 2, Moon: 2, Mercury: 2, Venus: 4 };

    expect(detect(full)?.description).toBe(
      "Mars and Saturn hold the 7th house under the aspect of Jupiter, and the Sun shares Taurus with the Moon.",
    );
    expect(detect(full)?.involved_planets).toEqual(["Mars", "Saturn"]);
    // Jupiter in the 4th casts no aspect on the 7th, and no other benefic does.
    expect(detect({ ...full, Jupiter: 4 })).toBeUndefined();
    // No male planet shares a sign with a female one.
    expect(detect({ ...full, Jupiter: 1, Moon: 5, Venus: 6 })).toBeUndefined();
    // Saturn outside the 7th.
    expect(detect({ ...full, Saturn: 8 })).toBeUndefined();
  });

  /* Yava used to be "three signs holding two planets each", a rule of its own
     under the classical name. That is only Kedara with the planets split
     2-2-2-1, and it put Yava on about 6% of charts, every one of which also
     had Kedara. */
  it("calls a 2-2-2-1 split Kedara, not Yava", () => {
    const ids = detectYogas(
      chartOf({ Sun: 1, Mercury: 1, Moon: 2, Venus: 2, Mars: 3, Jupiter: 3, Saturn: 5 }),
    ).map((yoga) => yoga.yoga_id);
    expect(ids).toContain("kedara");
    expect(ids).not.toContain("yava");
  });
});

describe("yoga-engine: citations", () => {
  /* The hundred added in 2026-09 each name the text they come from. The
     original hundred deliberately do not -- see the note on YogaDefinition --
     except Kedara and Yava, two of the 32 Nabhasa figures, which took the
     family's citation when they moved in beside it. The three Kalatra
     yogas, added 2026-10-04 from the malefic-yogas chapter, carry their own. */
  it("cites a classical source on exactly the definitions that have one", () => {
    const cited = YOGA_DEFINITIONS.filter((definition) => definition.source);
    expect(cited).toHaveLength(110);
    for (const definition of cited) {
      expect(definition.source!.length).toBeGreaterThan(10);
    }
  });
});

/*
 * The navamsa records, which are the only ones that read a second chart.
 *
 * Two of them had a defect that a frequency run surfaced and a unit test
 * would not have: when the navamsa dispositor of a lord happens to *be* the
 * lord it is supposed to join, "combined with the 9th lord" is satisfied by a
 * planet standing next to itself. Gauri fired about three times too often and
 * Bharathi about twice. Both exclusions are asserted here.
 */
describe("yoga-engine: navamsa records", () => {
  const NAVAMSA_SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];

  function chartOf(
    placements: Record<string, [number, string, number]>,
    ascendantDegreeInSign?: number,
  ): YogaChartInput {
    const houses = NAVAMSA_SIGNS.map((sign, index) => ({
      house_number: index + 1,
      sign,
      planets: [] as string[],
    }));
    const planets = Object.entries(placements).map(([name, [house, sign, degree]]) => ({
      name, longitude: 0, sign, degree_in_sign: degree, house,
    }));
    for (const planet of planets) {
      const home = houses.find((house) => house.sign === planet.sign);
      if (home) home.planets.push(planet.name);
    }
    return { planets, houses, ascendantSign: "Aries", ascendantDegreeInSign };
  }

  /* Aries is a fire sign, so its navamsas run from Aries and the first pada
     (0 to 3deg20') is Aries again. */
  const VARGOTTAMA_DEGREE = 1;
  const PLAIN_DEGREE = 20;

  it("reports a planet holding the same sign in both charts", () => {
    const found = detectYogas(chartOf({ Sun: [1, "Aries", VARGOTTAMA_DEGREE] }))
      .find((yoga) => yoga.yoga_id === "vargottama");
    expect(found).toBeDefined();
    expect(found!.involved_planets).toContain("Sun");
  });

  it("does not report a planet whose navamsa sign differs", () => {
    const ids = detectYogas(chartOf({ Sun: [1, "Aries", PLAIN_DEGREE] })).map((y) => y.yoga_id);
    expect(ids).not.toContain("vargottama");
  });

  it("detects a vargottama ascendant when a degree is supplied", () => {
    const chart = chartOf({ Mars: [1, "Aries", 5] }, VARGOTTAMA_DEGREE);
    expect(detectYogas(chart).map((yoga) => yoga.yoga_id)).toContain("lagna_vargottama");
  });

  /* The field is optional, and every caller predating it omits it. */
  it("stays silent about the ascendant when no degree is supplied", () => {
    const chart = chartOf({ Mars: [1, "Aries", 5] });
    expect(detectYogas(chart).map((yoga) => yoga.yoga_id)).not.toContain("lagna_vargottama");
  });

  it("does not let a planet satisfy Gauri by joining itself", () => {
    /* Aries ascendant, so Mars rules both the 1st and the 8th. Mars exalted
       in the 10th as its own navamsa dispositor would, without the guard,
       "join the ascendant lord" by standing beside itself. */
    const chart = chartOf({
      Mars: [10, "Capricorn", 20], Sun: [5, "Leo", 10], Moon: [4, "Cancer", 10],
      Mercury: [6, "Virgo", 10], Venus: [7, "Libra", 10], Jupiter: [9, "Sagittarius", 10],
      Saturn: [11, "Aquarius", 10],
    });
    expect(detectYogas(chart).map((yoga) => yoga.yoga_id)).not.toContain("gauri");
  });

  it("does not let the 9th lord satisfy Bharathi by conjoining itself", () => {
    /* Aries ascendant, so Jupiter rules the 9th. An exalted Jupiter that is
       its own navamsa dispositor must not produce Bharathi unaided. */
    const chart = chartOf({
      Jupiter: [4, "Cancer", 1], Mars: [1, "Aries", 10], Sun: [5, "Leo", 10],
      Moon: [7, "Libra", 10], Mercury: [6, "Virgo", 10], Venus: [2, "Taurus", 10],
      Saturn: [11, "Aquarius", 10],
    });
    expect(detectYogas(chart).map((yoga) => yoga.yoga_id)).not.toContain("bharathi");
  });
});
