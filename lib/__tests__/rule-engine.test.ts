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
  return buildHousesFromPlanets(ascSign, buildTestPlanets());
}

function buildHousesFromPlanets(ascSign: string, planets: PlanetPosition[]): HousePlacement[] {
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];
  const ascIdx = signs.indexOf(ascSign);
  const houses: HousePlacement[] = [];
  for (let h = 1; h <= 12; h++) {
    const houseSign = signs[(ascIdx + h - 1) % 12];
    const housePlanets = planets.filter((p) => p.house === h).map((p) => p.name);
    houses.push({ house_number: h, sign: houseSign, planets: housePlanets });
  }
  return houses;
}

const ASC_SIGN = "Taurus";

function getInsight(
  insights: LifeDomainInsight[],
  key: LifeDomainInsight["key"]
): LifeDomainInsight {
  const insight = insights.find((i) => i.key === key);
  expect(insight).toBeDefined();
  return insight!;
}

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

        // Identity and the two-layer split.
        expect(rule).toHaveProperty("id");
        expect(rule).toHaveProperty("instance_key");
        expect(rule).toHaveProperty("tier");
        expect(rule.display).toHaveProperty("headline");
        expect(rule.display).toHaveProperty("body");
        expect(rule.display).toHaveProperty("rarity_label");
        expect(rule.evidence).toHaveProperty("technical_note");
        expect(Array.isArray(rule.evidence!.claims)).toBe(true);
        expect(rule.evidence).toHaveProperty("rarity");
        expect(typeof rule.selection!.strength).toBe("number");
        expect(typeof rule.selection!.score).toBe("number");
        expect(typeof rule.selection!.rank).toBe("number");
      }
    });

    it("keeps every deprecated mirror consistent with the tier it mirrors", () => {
      // The tripwire for the migration: these five fields still have readers,
      // and a mirror that goes stale renders last month's copy next to this
      // month's evidence with nothing failing.
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      for (const rule of rules) {
        expect(rule.title).toBe(rule.display!.headline);
        expect(rule.insight).toBe(rule.display!.body);
        expect(rule.basis).toBe(rule.evidence!.technical_note);
        expect(rule.confidence_score).toBe(rule.selection!.score);
        expect(rule.tension_note).toBe(rule.display!.tension ?? "");
      }
    });

    it("keeps rarity pointing the right way: high score means rare", () => {
      // Rarity's natural expression is a fire rate, where LOW means rare. Every
      // ranking sort in the app is descending, so an inversion here would
      // promote the most ordinary rule in the chart to the headline silently.
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      for (const rule of rules) {
        const rarity = rule.evidence!.rarity;
        expect(rarity.score).toBeCloseTo(1 - rarity.fire_rate, 6);
        expect(rule.selection!.score).toBeCloseTo(rarity.score * rule.selection!.strength, 6);
      }
    });

    it("marks a selected set that is ranked 1..N and never empty", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const selected = rules
        .filter((r) => r.selection!.selected)
        .sort((a, b) => a.selection!.rank - b.selection!.rank);

      expect(selected.length).toBeGreaterThan(0);
      expect(selected.length).toBeLessThanOrEqual(7);
      expect(selected.map((r) => r.selection!.rank)).toEqual(
        selected.map((_, i) => i + 1)
      );
      for (const rule of rules) {
        if (!rule.selection!.selected) expect(rule.selection!.rank).toBe(0);
      }
    });

    it("keeps deterministic_rules the full fired list, not the selected one", () => {
      // Selection is metadata. If this ever becomes a filter, the desktop
      // category buckets can empty and mobile loses its above-the-fold content.
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      expect(rules.length).toBeGreaterThan(7);
      expect(rules.some((r) => !r.selection!.selected)).toBe(true);
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

      // Looked up by id, not by copy. Display headlines are plain language
      // now; the sign name lives in the technical tier.
      expect(rules[0].id).toBe("core.lagna_signature");
      expect(rules[0].evidence!.technical_note).toContain(ASC_SIGN);
      expect(rules[0].priority).toBe("high");
      expect(rules[0].category).toBe("core");
    });
  });

  describe("Sun and Moon rules", () => {
    it("generates Solar Identity rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const sunRule = rules.find((r) => r.id === "core.solar_identity");
      expect(sunRule).toBeDefined();
      expect(sunRule!.evidence!.technical_note).toContain("Taurus"); // Sun is in Taurus
      expect(sunRule!.category).toBe("core");
    });

    it("generates Lunar Mindset rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const moonRule = rules.find((r) => r.id === "core.lunar_mindset");
      expect(moonRule).toBeDefined();
      expect(moonRule!.evidence!.technical_note).toContain("Leo"); // Moon is in Leo
    });
  });

  describe("career rules", () => {
    it("includes a Career Axis rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const careerAxis = rules.find((r) => r.id === "career.tenth_house_axis");
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

      const loveAxis = rules.find((r) => r.id === "love.seventh_house_axis");
      expect(loveAxis).toBeDefined();
      expect(loveAxis!.category).toBe("love");
    });

    it("includes a Venus rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const venusRule = rules.find((r) => r.id === "love.venus_expression");
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

      // Dignity rules are one record per (dignity x category), so Jupiter --
      // a career planet in the legacy category split -- lands on the career
      // variant of the exalted record.
      const jupiterExalted = rules.find(
        (r) => r.instance_key === "dignity.exalted_career:Jupiter"
      );
      expect(jupiterExalted).toBeDefined();
      expect(jupiterExalted!.priority).toBe("high");
    });

    it("generates rules for planets in own sign", () => {
      // Venus in Libra is own sign, Saturn in Capricorn is own sign, Mars in Aries is own sign
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const ownSignRules = rules.filter((r) => r.id?.startsWith("dignity.own_sign"));
      expect(ownSignRules.length).toBeGreaterThan(0);
    });

    it("does not generate rules for neutral dignity planets", () => {
      // Sun in Taurus is neutral, Moon in Leo is neutral
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      // There should be no dignity rule for Sun (neutral in Taurus). The skip
      // survives as the absence of a dignity.neutral record, not as a
      // downstream filter.
      const sunDignity = rules.find(
        (r) => r.id?.startsWith("dignity.") && r.instance_key?.endsWith(":Sun")
      );
      expect(sunDignity).toBeUndefined();
      expect(rules.some((r) => r.id?.startsWith("dignity.neutral"))).toBe(false);
    });
  });

  describe("yoga rules", () => {
    it("detects Budha-Aditya yoga when Sun and Mercury share a house", () => {
      // Our test data: Sun house=1, Mercury house=1
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const budhaAditya = rules.find((r) => r.id === "yoga.budha_aditya");
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

      const gajaKesari = rules.find((r) => r.id === "yoga.gaja_kesari");
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

      const gajaKesari = rules.find((r) => r.id === "yoga.gaja_kesari");
      expect(gajaKesari).toBeDefined();
    });
  });

  describe("core path rules", () => {
    it("generates Ascendant Lord rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const ascLord = rules.find((r) => r.id === "core.ascendant_lord");
      expect(ascLord).toBeDefined();
      // Taurus ruler is Venus
      expect(ascLord!.evidence!.technical_note).toContain("Venus");
    });

    it("generates Nodal Axis rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const nodal = rules.find((r) => r.id === "core.nodal_axis");
      expect(nodal).toBeDefined();
      expect(nodal!.category).toBe("core");
    });

    it("generates Emotional Focus rule for Moon", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const moonFocus = rules.find((r) => r.id === "core.emotional_focus");
      expect(moonFocus).toBeDefined();
    });
  });

  describe("element balance", () => {
    it("generates Dominant Element rule", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const { rules } = generateRules(ASC_SIGN, planets, houses);

      const elementRule = rules.find((r) => r.id === "core.dominant_element");
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

      const solarRule = rules.find((r) => r.id === "core.solar_identity");
      expect(solarRule).toBeDefined();
      // Sun=Earth, Moon=Fire -> mismatch, so tension_note should be non-empty
      expect(solarRule!.tension_note!.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Life domain insights
  // ---------------------------------------------------------------------------

  describe("generateLifeDomainInsights()", () => {
    it("returns 7 life domain insights", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      expect(insights).toHaveLength(7);
    });

    it("covers all 7 domain keys", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      const keys = insights.map((i) => i.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          "love_life", "career", "family", "inheritance", "influence", "life_cycle", "travel_destinations",
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

    it("each insight has both tiers", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      for (const insight of insights) {
        expect(insight.display).toHaveProperty("headline");
        expect(insight.display).toHaveProperty("body");
        expect(insight.display).toHaveProperty("guidance");
        expect(insight.display).toHaveProperty("long_game");
        expect(Array.isArray(insight.display.strengths)).toBe(true);
        expect(Array.isArray(insight.display.watchouts)).toBe(true);
        expect(Array.isArray(insight.display.timing)).toBe(true);

        expect(typeof insight.evidence.technical_note).toBe("string");
        expect(Array.isArray(insight.evidence.claims)).toBe(true);
        expect(insight.evidence.claims.length).toBeGreaterThan(0);
        expect(insight.evidence.signal_score).toBe(insight.confidence_score);
      }
    });

    it("respects the display list caps", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      for (const insight of insights) {
        expect(insight.display.strengths.length).toBeLessThanOrEqual(3);
        expect(insight.display.watchouts.length).toBeLessThanOrEqual(2);
        expect(insight.display.timing.length).toBeLessThanOrEqual(2);
      }
    });

    it("keeps house-lord notation out of the display tier", () => {
      // The technical headline ("Career: Capricorn house 10, led by Saturn.")
      // moves into evidence. The default view gets plain language.
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      for (const insight of insights) {
        const shown = [
          insight.display.headline,
          insight.display.body,
          insight.display.guidance,
          insight.display.long_game,
          ...insight.display.strengths,
          ...insight.display.watchouts,
          ...insight.display.timing,
        ].join(" ");

        expect(shown, insight.key).not.toMatch(/\bhouse \d+\b|\bled by\b|\blord\b|\btransit/i);
        expect(shown, insight.key).not.toMatch(/\d+%|\d+\.\d+/);
      }
    });

    it("keeps the technical tier available for the disclosure", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      for (const insight of insights) {
        expect(insight.evidence.technical_note).toContain(insight.headline);
        expect(insight.evidence.technical_note).toContain(insight.overview);
      }
    });

    // ------------------------------------------------------------------
    // The four scoring tests below are deliberately unchanged by the rarity
    // work, because life-domain scoring is out of scope for it.
    //
    // LifeDomainInsight.confidence_score is a STRENGTH signal:
    // calculateDomainSignalScore(), clamped to [0.55, 0.94]. It rises with an
    // occupied house and a dignified lord.
    //
    // DeterministicRule.confidence_score is rarity x strength, where rarity
    // rises as a pattern gets less common.
    //
    // These must not be unified. Under a rarity metric all three monotonic
    // tests below would invert -- a debilitated lord is rarer than an own-sign
    // one, and an empty house is rarer than an occupied one.
    // ------------------------------------------------------------------

    it("confidence_score stays within intended life-domain bounds", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      for (const insight of insights) {
        expect(insight.confidence_score).toBeGreaterThanOrEqual(0.55);
        expect(insight.confidence_score).toBeLessThanOrEqual(0.94);
      }
    });

    it("does not flatten every occupied chart domain to the same score", () => {
      const planets = buildTestPlanets();
      const houses = buildTestHouses(ASC_SIGN);
      const insights = generateLifeDomainInsights(ASC_SIGN, planets, houses);

      const uniqueScores = new Set(insights.map((i) => i.confidence_score));

      expect(uniqueScores.size).toBeGreaterThan(1);
    });

    it("strengthens a domain when its primary house is occupied", () => {
      const planets = buildTestPlanets();
      const unoccupiedHouses = buildHousesFromPlanets(ASC_SIGN, planets);
      const occupiedHouses = unoccupiedHouses.map((house) =>
        house.house_number === 10
          ? { ...house, planets: ["Saturn"] }
          : house
      );

      const unoccupiedCareer = getInsight(
        generateLifeDomainInsights(ASC_SIGN, planets, unoccupiedHouses),
        "career"
      );
      const occupiedCareer = getInsight(
        generateLifeDomainInsights(ASC_SIGN, planets, occupiedHouses),
        "career"
      );

      expect(occupiedCareer.confidence_score).toBeGreaterThan(
        unoccupiedCareer.confidence_score
      );
    });

    it("raises a domain score when its primary lord is stronger", () => {
      const debilitatedLordPlanets = buildTestPlanets().map((planet) =>
        planet.name === "Mars" ? { ...planet, sign: "Cancer" } : planet
      );
      const strongLordPlanets = buildTestPlanets().map((planet) =>
        planet.name === "Mars" ? { ...planet, sign: "Scorpio" } : planet
      );

      const debilitatedLove = getInsight(
        generateLifeDomainInsights(
          ASC_SIGN,
          debilitatedLordPlanets,
          buildHousesFromPlanets(ASC_SIGN, debilitatedLordPlanets)
        ),
        "love_life"
      );
      const strongLove = getInsight(
        generateLifeDomainInsights(
          ASC_SIGN,
          strongLordPlanets,
          buildHousesFromPlanets(ASC_SIGN, strongLordPlanets)
        ),
        "love_life"
      );

      expect(strongLove.confidence_score).toBeGreaterThan(
        debilitatedLove.confidence_score
      );
    });

    it("lowers a domain score when its anchor planet is debilitated", () => {
      const strongAnchorPlanets = buildTestPlanets().map((planet) =>
        planet.name === "Venus" ? { ...planet, sign: "Libra" } : planet
      );
      const debilitatedAnchorPlanets = buildTestPlanets().map((planet) =>
        planet.name === "Venus" ? { ...planet, sign: "Virgo" } : planet
      );

      const strongLove = getInsight(
        generateLifeDomainInsights(
          ASC_SIGN,
          strongAnchorPlanets,
          buildHousesFromPlanets(ASC_SIGN, strongAnchorPlanets)
        ),
        "love_life"
      );
      const debilitatedLove = getInsight(
        generateLifeDomainInsights(
          ASC_SIGN,
          debilitatedAnchorPlanets,
          buildHousesFromPlanets(ASC_SIGN, debilitatedAnchorPlanets)
        ),
        "love_life"
      );

      expect(debilitatedLove.confidence_score).toBeLessThan(
        strongLove.confidence_score
      );
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
