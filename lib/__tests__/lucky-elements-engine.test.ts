import { describe, expect, it } from "vitest";
import { computeLuckyElements } from "../engines/lucky-elements-engine";
import type { HousePlacement, PlanetPosition } from "../astro-types";

const planets: PlanetPosition[] = [
  { name: "Moon", longitude: 0, sign: "Cancer", degree_in_sign: 5, house: 3 },
  { name: "Jupiter", longitude: 0, sign: "Pisces", degree_in_sign: 12, house: 11 },
  { name: "Saturn", longitude: 0, sign: "Capricorn", degree_in_sign: 18, house: 9 },
  { name: "Mercury", longitude: 0, sign: "Gemini", degree_in_sign: 2, house: 2 },
];

const houses: HousePlacement[] = Array.from({ length: 12 }, (_, index) => ({
  house_number: index + 1,
  sign: index + 1 === 9 ? "Capricorn" : "Taurus",
  planets: [],
}));

describe("lucky-elements-engine", () => {
  it("returns usable gemstone guidance and fortune domains", () => {
    const result = computeLuckyElements("Taurus", planets, houses, "Mercury");

    expect(result.gemstone_guidance.primary.governing_planet).toBe("Saturn");
    expect(result.gemstone_guidance.primary.gemstone).toBe("Blue Sapphire");
    expect(result.gemstone_guidance.safety_note).toContain("qualified Vedic astrologer");

    expect(result.fortune_domains).toHaveLength(3);
    expect(result.fortune_domains[0]).toMatchObject({
      title: "Learning & mentors",
      key_planet: "Saturn",
      planet_house: 9,
    });
    expect(result.fortune_domains[1]).toMatchObject({
      title: "Growth & opportunity",
      key_planet: "Jupiter",
      planet_house: 11,
    });
  });
});
