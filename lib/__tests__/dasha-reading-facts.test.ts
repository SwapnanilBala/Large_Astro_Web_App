/**
 * Where a period's planets stand in the chart: the facts the period reading is
 * written from and the panel prints under the period.
 */
import { describe, expect, it } from "vitest";
import {
  dignityOf,
  friendshipOf,
  housesRuledBy,
  lordFacts,
  periodFacts,
  relationKind,
  type FactChart,
} from "../dasha-reading-facts";

/* Libra rising: Saturn and Mercury together in Scorpio (2nd), Rahu in Aries (7th), Mars and Venus in Virgo (12th). */
const CHART: FactChart = {
  ascendantSign: "Libra",
  planets: [
    { name: "Sun", sign: "Libra", is_combust: false },
    { name: "Moon", sign: "Gemini" },
    { name: "Mercury", sign: "Scorpio", is_retrograde: true },
    { name: "Venus", sign: "Virgo" },
    { name: "Mars", sign: "Virgo" },
    { name: "Jupiter", sign: "Capricorn" },
    { name: "Saturn", sign: "Scorpio" },
    { name: "Rahu", sign: "Aries", is_retrograde: true },
    { name: "Ketu", sign: "Libra", is_retrograde: true },
  ],
};

describe("a planet's houses and dignity", () => {
  it("rules the houses whose signs are its own, counted from the rising sign", () => {
    expect(housesRuledBy("Saturn", "Libra")).toEqual([4, 5]);
    expect(housesRuledBy("Venus", "Libra")).toEqual([1, 8]);
    expect(housesRuledBy("Moon", "Libra")).toEqual([10]);
    expect(housesRuledBy("Rahu", "Libra")).toEqual([]);
  });

  it("is exalted, debilitated or at home first, then judged by its regard for the sign's lord", () => {
    expect(dignityOf("Mercury", "Virgo")).toBe("exalted");
    expect(dignityOf("Venus", "Virgo")).toBe("debilitated");
    expect(dignityOf("Saturn", "Aquarius")).toBe("own");
    expect(dignityOf("Saturn", "Scorpio")).toBe("enemy");
    expect(dignityOf("Moon", "Gemini")).toBe("friend");
    expect(dignityOf("Mercury", "Scorpio")).toBe("neutral");
    expect(dignityOf("Rahu", "Aries")).toBeNull();
  });

  it("follows the natural friendships, which are not mutual", () => {
    expect(friendshipOf("Moon", "Mercury")).toBe("friend");
    expect(friendshipOf("Mercury", "Moon")).toBe("enemy");
    expect(friendshipOf("Saturn", "Jupiter")).toBe("neutral");
    expect(friendshipOf("Saturn", "Rahu")).toBeNull();
    expect(friendshipOf("Saturn", "Saturn")).toBeNull();
  });

  it("stands to another planet by the count of signs between them", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(relationKind)).toEqual([
      "same",
      "adjacent",
      "growth",
      "angle",
      "trine",
      "strained",
      "angle",
      "strained",
      "trine",
      "angle",
      "growth",
      "adjacent",
    ]);
  });
});

describe("one planet's facts", () => {
  it("place it by whole sign, with the planets beside it and those aspecting it", () => {
    const saturn = lordFacts(CHART, "Saturn", [1]);
    expect(saturn).toMatchObject({
      sign: "Scorpio",
      house: 2,
      dignity: "enemy",
      rules: [4, 5],
      with: ["Mercury"],
      retrograde: false,
      actsThrough: null,
    });
    /* Mars in Virgo aspects the 4th, 7th and 8th signs from it; Scorpio is the 3rd, so nothing aspects Saturn. */
    expect(saturn?.aspectedBy).toEqual([]);
    expect(lordFacts(CHART, "Mercury")?.retrograde).toBe(true);
  });

  it("give Rahu the lord of its sign to act through, and leave out Ketu's aspect and its retrograde", () => {
    const rahu = lordFacts(CHART, "Rahu", [3]);
    expect(rahu?.actsThrough).toEqual({ lord: "Mars", sign: "Virgo", house: 12 });
    expect(rahu?.dignity).toBeNull();
    expect(rahu?.retrograde).toBe(false);
    expect(rahu?.rules).toEqual([]);
    expect(rahu?.aspectedBy).not.toContain("Ketu");
    expect(rahu?.aspectedBy).toEqual(["Sun", "Mars"]);
  });

  it("are null for a planet the chart does not place", () => {
    expect(lordFacts({ ascendantSign: "Libra", planets: [] }, "Saturn")).toBeNull();
    expect(lordFacts({ ascendantSign: "Nowhere", planets: CHART.planets }, "Saturn")).toBeNull();
  });
});

describe("a period's facts", () => {
  it("list each planet once with every level it rules, and how each level stands to the one above", () => {
    const facts = periodFacts(CHART, ["Saturn", "Mercury", "Rahu", "Mercury"]);
    expect(facts?.lords.map((lord) => [lord.lord, lord.levels])).toEqual([
      ["Saturn", [1]],
      ["Mercury", [2, 4]],
      ["Rahu", [3]],
    ]);
    expect(facts?.relations).toEqual([
      { level: 2, lord: "Mercury", parent: "Saturn", distance: 1, kind: "same", friendship: "friend" },
      { level: 3, lord: "Rahu", parent: "Mercury", distance: 6, kind: "strained", friendship: null },
      { level: 4, lord: "Mercury", parent: "Rahu", distance: 8, kind: "strained", friendship: null },
    ]);
  });

  it("call a planet's sub-period of itself its own", () => {
    expect(periodFacts(CHART, ["Saturn", "Saturn"])?.relations[0]).toMatchObject({ kind: "self", friendship: null });
  });

  it("have no relations for a Maha Dasha alone, and are null when a planet is missing", () => {
    expect(periodFacts(CHART, ["Venus"])?.relations).toEqual([]);
    expect(periodFacts({ ascendantSign: "Libra", planets: CHART.planets.slice(0, 3) }, ["Saturn"])).toBeNull();
  });
});
