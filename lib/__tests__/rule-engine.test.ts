import { describe, it, expect } from "vitest";
import {
  generateRules,
  generateLifeDomainInsights,
  HOUSE_THEMES,
  type DeterministicRule,
  type LifeDomainInsight,
} from "../engines/rule-engine";
import type { PlanetPosition, HousePlacement } from "../engines/swiss-ephemeris-engine";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildTestPlanets(): PlanetPosition[] {
  return [
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
}

function buildTestHouses(ascSign: string): HousePlacement[] {
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];
  const ascIdx = signs.indexOf(ascSign);
  const planets = buildTestPlanets();
  const houses: HousePlacement[] = [];
  for (let h = 1; h <= 12; h++) {
    const houseSign = signs[(ascIdx + h - 1) % 12];
    const housePlanets = planets.filter((p) => p.house === h).map((p) => p.name);
    houses.push({ house_number: h, sign: houseSign, planets: housePlanets });
  }
  return houses;
}

const ASC_SIGN = "Taurus";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("rule-engine", () => {
  describe("generateRules()", () => {
    it("returns rules array and summary string", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const result = generateRules(ASC_SIGN, planets, houses);

      expect(result).toHaveProperty("rules");
      expect(result).toHaveProperty("summary");
      expect(Array.isArray(result.rules)).toBe(true);
      expect(typeof result.summary).toBe("string");
    });

    it("returns a non-empty rules array", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);
      expect(rules.length).toBeGreaterThan(0);
    });

    it("each rule has all required fields", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      for (const rule of rules) {
        expect(rule).toHaveProperty("title");
        expect(rule).toHaveProperty("insight");
        expect(rule).toHaveProperty("basis");
        expect(rule).toHaveProperty("priority");
        expect(rule).toHaveProperty("category");
        expect(rule).toHaveProperty("confidence_score");
        expect(rule).toHaveProperty("tension_note");

        expect(typeof rule.title).toBe("string");
        expect(typeof rule.insight).toBe("string");
        expect(typeof rule.basis).toBe("string");
        expect(typeof rule.tension_note).toBe("string");
      }
    });

    it("priority values are high, medium, or low", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      for (const rule of rules) {
        expect(["high", "medium", "low"]).toContain(rule.priority);
      }
    });

    it("confidence_score is between 0 and 1", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      for (const rule of rules) {
        expect(rule.confidence_score).toBeGreaterThanOrEqual(0);
        expect(rule.confidence_score).toBeLessThanOrEqual(1);
      }
    });

    it("categories include core, career, and love", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const categories = new Set(rules.map((r) => r.category));
      expect(categories.has("core")).toBe(true);
      expect(categories.has("career")).toBe(true);
      expect(categories.has("love")).toBe(true);
    });
  });

  describe("Lagna signature rule", () => {
    it("first rule is the Lagna Signature for the ascendant", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      expect(rules[0].title).toContain("Lagna Signature");
      expect(rules[0].title).toContain(ASC_SIGN);
      expect(rules[0].priority).toBe("high");
      expect(rules[0].category).toBe("core");
    });
  });

  describe("Sun and Moon rules", () => {
    it("generates Solar Identity rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const sunRule = rules.find((r) => r.title.startsWith("Solar Identity"));
      expect(sunRule).toBeDefined();
      expect(sunRule!.title).toContain("Taurus"); // Sun is in Taurus
      expect(sunRule!.category).toBe("core");
    });

    it("generates Lunar Mindset rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const moonRule = rules.find((r) => r.title.startsWith("Lunar Mindset"));
      expect(moonRule).toBeDefined();
      expect(moonRule!.title).toContain("Leo"); // Moon is in Leo
    });
  });

  describe("career rules", () => {
    it("includes a Career Axis rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const careerAxis = rules.find((r) => r.title.startsWith("Career Axis"));
      expect(careerAxis).toBeDefined();
      expect(careerAxis!.category).toBe("career");
      expect(careerAxis!.priority).toBe("high");
    });
  });

  describe("love rules", () => {
    it("includes a Partnership Axis rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const loveAxis = rules.find((r) => r.title.startsWith("Partnership Axis"));
      expect(loveAxis).toBeDefined();
      expect(loveAxis!.category).toBe("love");
    });

    it("includes a Venus rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const venusRule = rules.find((r) => r.title.startsWith("Venus in"));
      expect(venusRule).toBeDefined();
      expect(venusRule!.category).toBe("love");
    });
  });

  describe("dignity rules", () => {
    it("generates rules for exalted planets", () => {
      // Jupiter in Cancer is exalted
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const jupiterExalted = rules.find(
        (r) => r.title.includes("Jupiter") && r.title.includes("Exalted")
      );
      expect(jupiterExalted).toBeDefined();
      expect(jupiterExalted!.priority).toBe("high");
    });

    it("generates rules for planets in own sign", () => {
      // Venus in Libra is own sign, Saturn in Capricorn is own sign, Mars in Aries is own sign
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const ownSignRules = rules.filter((r) => r.title.includes("Own Sign"));
      expect(ownSignRules.length).toBeGreaterThan(0);
    });

    it("does not generate rules for neutral dignity planets", () => {
      // Sun in Taurus is neutral, Moon in Leo is neutral
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      // There should be no dignity rule for Sun (neutral in Taurus)
      const sunDignity = rules.find(
        (r) => r.title.includes("Sun Strength") && r.title.includes("Neutral")
      );
      expect(sunDignity).toBeUndefined();
    });
  });

  describe("yoga rules", () => {
    it("detects Budha-Aditya yoga when Sun and Mercury share a house", () => {
      // Our test data: Sun house=1, Mercury house=1
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const budhaAditya = rules.find((r) => r.title.includes("Budha-Aditya"));
      expect(budhaAditya).toBeDefined();
      expect(budhaAditya!.category).toBe("career");
    });

    it("detects Gaja-Kesari when Jupiter is in kendra from Moon", () => {
      // Moon in Leo (index 4), Jupiter in Cancer (index 3)
      // signDistance: ((3 - 4 + 12) % 12) + 1 = 12 -> not in [1,4,7,10]
      // So we need to test with a setup where it works.
      // Let's check: Leo=4, Cancer=3 -> (3-4+12)%12+1 = 12, not kendra.
      // Actually with our test data it won't fire. Let's verify.
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const gajaKesari = rules.find((r) => r.title.includes("Gaja-Kesari"));
      // With Moon in Leo and Jupiter in Cancer, sign distance = 12, not kendra
      expect(gajaKesari).toBeUndefined();
    });

    it("detects Gaja-Kesari with appropriate planet positions", () => {
      // Moon in Cancer (index 3), Jupiter in Libra (index 6) -> distance = (6-3+12)%12+1 = 4 -> kendra!
      const planets = buildTestPlanets().map((p) => {
        if (p.name === "Moon") return { ...p, sign: "Cancer" };
        if (p.name === "Jupiter") return { ...p, sign: "Libra" };
        return p;
      });
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const gajaKesari = rules.find((r) => r.title.includes("Gaja-Kesari"));
      expect(gajaKesari).toBeDefined();
    });
  });

  describe("core path rules", () => {
    it("generates Ascendant Lord rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const ascLord = rules.find((r) => r.title.startsWith("Ascendant Lord"));
      expect(ascLord).toBeDefined();
      // Taurus ruler is Venus
      expect(ascLord!.title).toContain("Venus");
    });

    it("generates Nodal Axis rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const nodal = rules.find((r) => r.title.startsWith("Nodal Axis"));
      expect(nodal).toBeDefined();
      expect(nodal!.category).toBe("core");
    });

    it("generates Emotional Focus rule for Moon", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const moonFocus = rules.find((r) => r.title.startsWith("Emotional Focus"));
      expect(moonFocus).toBeDefined();
    });
  });

  describe("element balance", () => {
    it("generates Dominant Element rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const elementRule = rules.find((r) => r.title.startsWith("Dominant Element"));
      expect(elementRule).toBeDefined();
      expect(elementRule!.category).toBe("core");
    });
  });

  describe("summary", () => {
    it("summary mentions ascendant sign, sun sign, and moon sign", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { summary } = generateRules(ASC_SIGN, planets, houses);

      expect(summary).toContain("Taurus"); // Ascendant
      expect(summary).toContain("Leo"); // Moon sign
    });
  });

  describe("tension notes", () => {
    it("Sun-Moon element mismatch produces tension note", () => {
      // Sun in Taurus (Earth), Moon in Leo (Fire) -> different elements
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const solarRule = rules.find((r) => r.title.startsWith("Solar Identity"));
      expect(solarRule).toBeDefined();
      // Sun=Earth, Moon=Fire -> mismatch, so tension_note should be non-empty
      expect(solarRule!.tension_note.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Life domain insights
  // ---------------------------------------------------------------------------

  describe("generateLifeDomainInsights()", () => {
    it("returns 6 life domain insights", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      expect(insights).toHaveLength(6);
    });

    it("covers all 6 domain keys", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      const keys = insights.map((i) => i.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          "love_life", "career", "family", "inheritance", "influence", "life_cycle",
        ])
      );
    });

    it("each insight has all required fields", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      for (const insight of insights) {
        expect(insight).toHaveProperty("key");
        expect(insight).toHaveProperty("label");
        expect(insight).toHaveProperty("headline");
        expect(insight).toHaveProperty("overview");
        expect(insight).toHaveProperty("strengths");
        expect(insight).toHaveProperty("watchouts");
        expect(insight).toHaveProperty("timing_triggers");
        expect(insight).toHaveProperty("supporting_patterns");
        expect(insight).toHaveProperty("guidance");
        expect(insight).toHaveProperty("long_game");
        expect(insight).toHaveProperty("confidence_score");

        expect(typeof insight.headline).toBe("string");
        expect(typeof insight.overview).toBe("string");
        expect(typeof insight.guidance).toBe("string");
        expect(typeof insight.long_game).toBe("string");
        expect(Array.isArray(insight.strengths)).toBe(true);
        expect(Array.isArray(insight.watchouts)).toBe(true);
      }
    });

    it("confidence_score is between 0.66 and 0.91", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      for (const insight of insights) {
        expect(insight.confidence_score).toBeGreaterThanOrEqual(0.66);
        expect(insight.confidence_score).toBeLessThanOrEqual(0.91);
      }
    });

    it("strengths has at most 3 items", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      for (const insight of insights) {
        expect(insight.strengths.length).toBeLessThanOrEqual(3);
      }
    });

    it("watchouts has at most 2 items", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      for (const insight of insights) {
        expect(insight.watchouts.length).toBeLessThanOrEqual(2);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // HOUSE_THEMES
  // ---------------------------------------------------------------------------

  describe("HOUSE_THEMES", () => {
    it("has entries for all 12 houses", () => {
      for (let h = 1; h <= 12; h++) {
        expect(HOUSE_THEMES[h]).toBeDefined();
        expect(typeof HOUSE_THEMES[h]).toBe("string");
      }
    });
  });
});
