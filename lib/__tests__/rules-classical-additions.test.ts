/**
 * The 2026-09 rule additions, checked against their classical definitions.
 *
 * Each rule's condition is restated here in plain TypeScript -- independently
 * of the rule schema -- and compared with what the interpreter fires over a
 * seeded sample of real charts. A rule that drifts from its textbook
 * definition, or from the yoga panel's definition of the same yoga, fails here
 * rather than in someone's reading.
 */

import { describe, expect, it } from "vitest";
import { calculate, type PlanetPosition } from "../engines/swiss-ephemeris-engine";
import { buildRuleContext, planetDignity, signDistance, SIGN_RULERS } from "../rules/context";
import { evaluateRules } from "../rules";
import { detectYogas } from "../engines/yoga-engine";
import { evaluateLifeDomainRules } from "../engines/life-domain-rules";
import { mulberry32 } from "../../scripts/rarity/prng";

// ---------------------------------------------------------------------------
// A seeded sample of real charts
// ---------------------------------------------------------------------------

const CITIES = [
  { lat: 19.08, lng: 72.88 }, // Mumbai
  { lat: 51.51, lng: -0.13 }, // London
  { lat: -33.87, lng: 151.21 }, // Sydney
  { lat: 40.71, lng: -74.01 }, // New York
  { lat: 1.35, lng: 103.82 }, // Singapore
  { lat: 59.33, lng: 18.07 }, // Stockholm
];

const SAMPLE_SIZE = 1500;

type Chart = ReturnType<typeof calculate>;
type Sampled = {
  chart: Chart;
  /** Rule ids that fired, plus `id:Planet` for the per-planet records. */
  fired: Set<string>;
  /** The yoga panel's findings for the same chart: ids, plus `id:strength`. */
  panel: Set<string>;
};

function sampleCharts(): Sampled[] {
  const rng = mulberry32(20260925);
  const start = Date.UTC(1940, 0, 1);
  const span = Date.UTC(2015, 11, 31) - start;
  const out: Sampled[] = [];
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const city = CITIES[Math.floor(rng() * CITIES.length)];
    const utc = new Date(start + Math.floor(rng() * span));
    const chart = calculate({
      utc_year: utc.getUTCFullYear(),
      utc_month: utc.getUTCMonth() + 1,
      utc_day: utc.getUTCDate(),
      utc_hour: utc.getUTCHours(),
      utc_minute: utc.getUTCMinutes(),
      utc_second: 0,
      latitude: city.lat,
      longitude: city.lng,
    });
    const ctx = buildRuleContext(chart.ascendant.sign, chart.planets, chart.houses);
    const fired = new Set<string>();
    for (const rule of evaluateRules(ctx)) {
      fired.add(rule.definition.id);
      fired.add(rule.instance_key);
    }
    const panel = new Set<string>();
    for (const yoga of detectYogas({
      planets: chart.planets,
      houses: chart.houses,
      ascendantSign: chart.ascendant.sign,
    })) {
      panel.add(yoga.yoga_id);
      panel.add(`${yoga.yoga_id}:${yoga.strength}`);
    }
    out.push({ chart, fired, panel });
  }
  return out;
}

const SAMPLE = sampleCharts();

// ---------------------------------------------------------------------------
// Plain restatements of the chart facts the definitions use
// ---------------------------------------------------------------------------

function facts(chart: Chart) {
  const planet = (name: string) => chart.planets.find((p) => p.name === name) as PlanetPosition;
  const houseSign = (n: number) => chart.houses.find((h) => h.house_number === n)!.sign;
  const lordOf = (n: number) => planet(SIGN_RULERS[houseSign(n)]);
  const dignity = (p: PlanetPosition) => planetDignity(p.name, p.sign);
  const strong = (p: PlanetPosition) => ["exalted", "own_sign"].includes(dignity(p));
  const house = (name: string) => planet(name).house;
  const fromMoon = (name: string) => signDistance(planet("Moon").sign, planet(name).sign);
  const ascLord = planet(SIGN_RULERS[chart.ascendant.sign]);
  return { planet, lordOf, dignity, strong, house, fromMoon, ascLord };
}

/** Every rule has to be a real distinction: never silent, never universal. */
function expectDiscriminating(key: string, fires: number) {
  expect(fires, `${key} never fired in ${SAMPLE_SIZE} charts`).toBeGreaterThan(0);
  expect(fires, `${key} fired for every chart`).toBeLessThan(SAMPLE_SIZE);
}

function checkRule(key: string, expected: (f: ReturnType<typeof facts>, chart: Chart) => boolean) {
  let fires = 0;
  for (const s of SAMPLE) {
    const want = expected(facts(s.chart), s.chart);
    expect(s.fired.has(key), `${key}, ${s.chart.ascendant.sign} rising`).toBe(want);
    if (want) fires++;
  }
  expectDiscriminating(key, fires);
}

// ---------------------------------------------------------------------------
// Core, career, love
// ---------------------------------------------------------------------------

describe("the added section rules fire exactly on their classical condition", () => {
  it("core: Jupiter in the 1st or aspecting it (5th, 7th, 9th drishti)", () => {
    checkRule("core.jupiter_on_ascendant", (f) => [1, 5, 7, 9].includes(f.house("Jupiter")));
  });

  it("core: Saturn in the 1st", () => {
    checkRule("core.saturn_on_ascendant", (f) => f.house("Saturn") === 1);
  });

  it("core: the Moon in the sign opposite the Sun", () => {
    checkRule("core.full_moon", (f) => signDistance(f.planet("Sun").sign, f.planet("Moon").sign) === 7);
  });

  it("career: the 10th lord in the 11th", () => {
    checkRule("career.tenth_lord_gains", (f) => f.lordOf(10).house === 11);
  });

  it("career: a natural malefic in the 6th", () => {
    checkRule("career.competitive_edge", (f) =>
      ["Sun", "Mars", "Saturn", "Rahu", "Ketu"].some((name) => f.house(name) === 6),
    );
  });

  it("career: the 2nd and 11th lords linked, unless one planet rules both", () => {
    checkRule("career.wealth_link", (f) => {
      const lord2 = f.lordOf(2);
      const lord11 = f.lordOf(11);
      if (lord2.name === lord11.name) return false;
      return lord2.house === lord11.house || lord2.house === 11 || lord11.house === 2;
    });
  });

  it("love: Mars in the 1st, 2nd, 4th, 7th, 8th or 12th, cancelled by own sign or exaltation", () => {
    checkRule(
      "love.mars_partnership_heat",
      (f) => [1, 2, 4, 7, 8, 12].includes(f.house("Mars")) && !f.strong(f.planet("Mars")),
    );
  });

  it("love: Jupiter in the 7th or aspecting it", () => {
    checkRule("love.jupiter_guards_partnership", (f) => [1, 3, 7, 11].includes(f.house("Jupiter")));
  });

  it("love: the 5th and 7th lords together or in each other's house", () => {
    checkRule("love.romance_to_commitment", (f) => {
      const lord5 = f.lordOf(5);
      const lord7 = f.lordOf(7);
      return lord5.house === lord7.house || lord5.house === 7 || lord7.house === 5;
    });
  });
});

// ---------------------------------------------------------------------------
// Planet strength
// ---------------------------------------------------------------------------

const CATEGORY_OF: Record<string, string> = {
  Sun: "core",
  Mercury: "career",
  Jupiter: "career",
  Saturn: "career",
  Moon: "love",
  Venus: "love",
  Mars: "love",
};

const DIG_BALA_HOUSE: Record<string, number> = {
  Jupiter: 1, Mercury: 1, Moon: 4, Venus: 4, Saturn: 7, Sun: 10, Mars: 10,
};

describe("the planet-state rules", () => {
  it("directional strength: Jupiter and Mercury 1st, Moon and Venus 4th, Saturn 7th, Sun and Mars 10th", () => {
    for (const [name, digHouse] of Object.entries(DIG_BALA_HOUSE)) {
      checkRule(`strength.directional_${CATEGORY_OF[name]}:${name}`, (f) => f.house(name) === digHouse);
    }
  });

  it("combustion follows the ephemeris flag, for every planet that can be combust", () => {
    for (const name of ["Mercury", "Jupiter", "Saturn", "Moon", "Venus", "Mars"]) {
      checkRule(`strength.combust_${CATEGORY_OF[name]}:${name}`, (f) => f.planet(name).is_combust === true);
    }
  });

  it("retrograde motion follows the ephemeris flag, for every planet that can be retrograde", () => {
    for (const name of ["Mercury", "Jupiter", "Saturn", "Venus", "Mars"]) {
      checkRule(`strength.retrograde_${CATEGORY_OF[name]}:${name}`, (f) => f.planet(name).is_retrograde === true);
    }
  });

  it("never emits a state the planet cannot have", () => {
    for (const s of SAMPLE) {
      expect(s.fired.has("strength.combust_core"), "the Sun cannot be combust").toBe(false);
      expect(s.fired.has("strength.retrograde_core"), "the Sun cannot be retrograde").toBe(false);
      expect(s.fired.has("strength.retrograde_love:Moon"), "the Moon cannot be retrograde").toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Yogas -- against the textbook, and against the yoga panel
// ---------------------------------------------------------------------------

const MAHAPURUSHA: Record<string, { yogaId: string; category: string }> = {
  Mars: { yogaId: "ruchaka", category: "love" },
  Mercury: { yogaId: "bhadra", category: "career" },
  Jupiter: { yogaId: "hamsa", category: "career" },
  Venus: { yogaId: "malavya", category: "love" },
  Saturn: { yogaId: "shasha", category: "career" },
};

describe("the added yoga rules", () => {
  it("Mahapurusha: own or exaltation sign on an angle -- and the yoga panel agrees", () => {
    for (const [name, { yogaId, category }] of Object.entries(MAHAPURUSHA)) {
      const key = `yoga.mahapurusha_${category}:${name}`;
      checkRule(key, (f) => [1, 4, 7, 10].includes(f.house(name)) && f.strong(f.planet(name)));
      for (const s of SAMPLE) {
        expect(s.fired.has(key), `${key} vs the panel's ${yogaId}`).toBe(s.panel.has(yogaId));
      }
    }
    // The Moon is in the love set, and forms no Mahapurusha yoga however strong.
    for (const s of SAMPLE) expect(s.fired.has("yoga.mahapurusha_love:Moon")).toBe(false);
  });

  it("Kemadruma: an isolated Moon, uncancelled -- exactly what the panel shows at full strength", () => {
    checkRule("yoga.kemadruma", (f) => {
      const isolated = ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"].every(
        (name) => ![2, 12].includes(f.fromMoon(name)),
      );
      const moonOnAngle = [1, 4, 7, 10].includes(f.house("Moon"));
      const jupiterWithOrOpposite = [1, 7].includes(f.fromMoon("Jupiter"));
      return isolated && !moonOnAngle && !jupiterWithOrOpposite;
    });
    for (const s of SAMPLE) {
      expect(s.fired.has("yoga.kemadruma")).toBe(s.panel.has("kemadruma:strong"));
    }
  });

  it("Dharma-Karmadhipati: 9th and 10th lords conjunct or opposite -- never without the panel", () => {
    checkRule("yoga.dharma_karmadhipati", (f) =>
      [1, 7].includes(signDistance(f.lordOf(9).sign, f.lordOf(10).sign)),
    );
    for (const s of SAMPLE) {
      if (!s.fired.has("yoga.dharma_karmadhipati")) continue;
      expect(s.panel.has("dharma_karmadhipati"), "the reading names a yoga the panel does not").toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Combinations
// ---------------------------------------------------------------------------

describe("the added combination rules", () => {
  it("steady partnership: four clauses", () => {
    checkRule("combo.steady_partnership", (f) => {
      const venus = f.planet("Venus");
      return (
        [1, 4, 5, 7, 9, 10].includes(f.lordOf(7).house) &&
        ["Mars", "Saturn", "Rahu", "Ketu"].every((name) => f.house(name) !== 7) &&
        [1, 3, 7, 11].includes(f.house("Jupiter")) &&
        f.dignity(venus) !== "debilitated" &&
        !venus.is_combust
      );
    });
  });

  it("compounding career: Saturn and Mars in growth houses, 10th lord strong, chart ruler clear", () => {
    checkRule("combo.compounding_career", (f) =>
      [3, 6, 10, 11].includes(f.house("Saturn")) &&
      [3, 6, 10, 11].includes(f.house("Mars")) &&
      [1, 4, 7, 10, 11].includes(f.lordOf(10).house) &&
      ![6, 8, 12].includes(f.ascLord.house),
    );
  });

  it("strong foundation: a dignified, well-placed chart ruler, Jupiter on the 1st, no malefic but the ruler", () => {
    checkRule("combo.strong_foundation", (f) =>
      f.strong(f.ascLord) &&
      [1, 4, 5, 7, 9, 10].includes(f.ascLord.house) &&
      [1, 5, 7, 9].includes(f.house("Jupiter")) &&
      (f.house("Mars") !== 1 || f.ascLord.name === "Mars") &&
      (f.house("Saturn") !== 1 || f.ascLord.name === "Saturn") &&
      f.house("Rahu") !== 1 &&
      f.house("Ketu") !== 1,
    );
  });
});

// ---------------------------------------------------------------------------
// Life areas
// ---------------------------------------------------------------------------

const BENEFICS = ["Jupiter", "Venus"];
const MALEFICS = ["Mars", "Saturn", "Rahu", "Ketu"];
const ASPECTS: Record<string, number[]> = { Mars: [4, 7, 8], Jupiter: [5, 7, 9], Saturn: [3, 7, 10] };
const fromHouse = (from: number, to: number) => ((to - from + 12) % 12) + 1;

describe("the added life-area rules", () => {
  it("fire on kartari hemming and on the ruler counted from its own house, for every house", () => {
    const counts: Record<string, number> = {};
    let evaluations = 0;
    for (const s of SAMPLE.slice(0, 300)) {
      const f = facts(s.chart);
      for (let n = 1; n <= 12; n++) {
        const primaryHouse = s.chart.houses.find((h) => h.house_number === n)!;
        const secondaryHouse = s.chart.houses.find((h) => h.house_number === (n % 12) + 1)!;
        const primaryLord = f.lordOf(n);
        const { rules } = evaluateLifeDomainRules({
          key: "career",
          label: "Test area",
          primaryHouse,
          secondaryHouse,
          primaryLord,
          secondaryLord: f.lordOf(secondaryHouse.house_number),
          anchorPlanet: f.planet("Moon"),
          planets: s.chart.planets,
          houses: s.chart.houses,
        });
        const ids = new Set(rules.map((r) => r.id));
        evaluations++;

        const before = ((n + 10) % 12) + 1;
        const after = (n % 12) + 1;
        const has = (set: string[], houseNumber: number) => set.some((name) => f.house(name) === houseNumber);
        const papa = has(MALEFICS, before) && has(MALEFICS, after);
        const shubha = !papa && has(BENEFICS, before) && has(BENEFICS, after);
        const distance = fromHouse(n, primaryLord.house);
        const strained = [6, 8, 12].includes(distance);
        const guards =
          primaryLord.house === n ||
          (ASPECTS[primaryLord.name] ?? [7]).includes(fromHouse(primaryLord.house, n));

        const expectations: Record<string, boolean> = {
          primary_house_hemmed_malefic: papa,
          primary_house_hemmed_benefic: shubha,
          lord_strained_from_house: strained,
          lord_guards_house: guards,
        };
        for (const [id, want] of Object.entries(expectations)) {
          expect(ids.has(id), `${id} for house ${n}, ${s.chart.ascendant.sign} rising`).toBe(want);
          if (want) counts[id] = (counts[id] ?? 0) + 1;
        }
      }
    }
    for (const id of Object.keys({
      primary_house_hemmed_malefic: 0,
      primary_house_hemmed_benefic: 0,
      lord_strained_from_house: 0,
      lord_guards_house: 0,
    })) {
      expect(counts[id] ?? 0, `${id} never fired`).toBeGreaterThan(0);
      expect(counts[id] ?? 0, `${id} fired every time`).toBeLessThan(evaluations);
    }
  });
});
