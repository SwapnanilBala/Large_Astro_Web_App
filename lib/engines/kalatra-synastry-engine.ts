import type { HousePlacement, PlanetPosition } from "./swiss-ephemeris-engine";
import { calculateNakshatra } from "./nakshatra-engine";
import { computeMangalDosha, houseFrom, type MangalDosha } from "./kalatra-engine";
import { ZODIAC_SIGNS, signDistance } from "@/lib/rules/context";

/*
 * The married-life read across two charts.
 *
 * lib/engines/kalatra-engine.ts answers these questions from one chart, which
 * is the only thing /insights has. Several of the rules it uses are not really
 * single-chart rules at all -- Mangal dosha's best-known cancellation needs the
 * other person, and Bhakoot and Nadi have no single-chart form whatsoever --
 * so the native panel names that limit and stops. This is the other half.
 *
 * Three things are genuinely pair-level and nothing else is smuggled in:
 *
 *   1. The three doshas classical matching checks *between* charts -- Mangal,
 *      Bhakoot and Nadi. These are the ones that carry a cancellation rule
 *      that only a second chart can satisfy.
 *   2. House overlay: whose planets land in whose houses. A planet is in the
 *      7th of its own chart or it is not; whether it is in the partner's 7th
 *      is a separate fact and the one synastry actually turns on.
 *   3. Cross-validation of the native in-law reading. The native panel derives
 *      the spouse's mother from the 7th by bhavat bhavam. If the spouse is
 *      sitting right there, their actual 4th house is checkable, and agreement
 *      or disagreement between the two is worth more than either alone.
 *
 * Ashtakoota as a whole is deliberately not here. The page already computes
 * its own compatibility score, and bolting a second 36-point total beside it
 * would give a reader two numbers for one question with no way to reconcile
 * them. Bhakoot and Nadi are included because they are doshas -- blocking
 * conditions with their own cancellations -- rather than points on a scale.
 */

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export type SynastryFacetKey =
  | "mangal_matching"
  | "moon_doshas"
  | "physical_chemistry"
  | "in_law_crosscheck"
  | "privacy_overlay";

export type SynastryPolarity = "clear" | "caution" | "context";

export type SynastryFinding = {
  text: string;
  /** The chart fact, naming which chart it came from. */
  basis: string;
  polarity: SynastryPolarity;
};

export type SynastryFacet = {
  key: SynastryFacetKey;
  label: string;
  sourcing: string;
  /** The facet's own headline, computed rather than scored. */
  verdict: string;
  findings: SynastryFinding[];
};

export type KalatraSynastryResult = {
  facets: SynastryFacet[];
  method: string;
};

export type SynastryChart = {
  name: string;
  planets: PlanetPosition[];
  houses: HousePlacement[];
};

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

const NATURAL_BENEFICS = new Set(["Jupiter", "Venus", "Mercury", "Moon"]);
const NATURAL_MALEFICS = new Set(["Saturn", "Mars", "Sun", "Rahu", "Ketu"]);

const planetIn = (chart: SynastryChart, name: string) =>
  chart.planets.find((p) => p.name === name);

const occupantsOf = (chart: SynastryChart, house: number) =>
  chart.houses.find((h) => h.house_number === house)?.planets ?? [];

/*
 * Which of `chart`'s houses a given sign falls in.
 *
 * Whole-sign charts give one answer. Placidus and the rest can put one sign on
 * two cusps or none, and there `find` returns the first match or nothing --
 * the same limitation house-support-engine documents, and the reason overlay
 * findings are phrased as "lands in" rather than asserted as exact.
 */
const houseForSign = (chart: SynastryChart, sign: string): number | null =>
  chart.houses.find((h) => h.sign === sign)?.house_number ?? null;

const list = (items: string[]) =>
  items.length <= 1
    ? items[0] ?? ""
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const verb = (singular: string, count: number) =>
  count > 1 ? (singular === "is" ? "are" : singular.replace(/s$/, "")) : singular;

const ordinal = (n: number) => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
};

// ---------------------------------------------------------------------------
// Facet 1 — Mangal dosha across the pair
// ---------------------------------------------------------------------------

/*
 * Dosha samya: the cancellation the native panel could not evaluate.
 *
 * Mangal dosha is the classical friction marker for marriage, and the rule
 * cited more than any other about it is that when both charts carry it the two
 * cancel each other. A single chart cannot know that, so kalatra-engine reports
 * the dosha and says explicitly that this cancellation is not counted. Here it
 * is countable, and it is the first thing this panel answers.
 */
function mangalMatching(
  a: SynastryChart,
  b: SynastryChart,
  doshaA: MangalDosha,
  doshaB: MangalDosha
): SynastryFacet {
  const findings: SynastryFinding[] = [];
  const bothActive = doshaA.active && doshaB.active;
  const oneActive = doshaA.active !== doshaB.active;

  const describe = (chart: SynastryChart, dosha: MangalDosha) => {
    if (!dosha.present) {
      findings.push({
        text: `${chart.name} does not carry Mangal dosha.`,
        basis: `Mars in the ${ordinal(dosha.marsHouse)} from the ascendant — not one of the six dosha houses`,
        polarity: "clear",
      });
      return;
    }
    if (dosha.cancellations.length > 0) {
      findings.push({
        text:
          `${chart.name} carries Mangal dosha, but it is already cancelled within their own chart, ` +
          "before the pairing is considered at all.",
        basis: `Mars in the ${ordinal(dosha.marsHouse)}; ${list(dosha.cancellations)}`,
        polarity: "clear",
      });
      return;
    }
    findings.push({
      text: `${chart.name} carries Mangal dosha with nothing in their own chart to cancel it.`,
      basis: `Mars in the ${ordinal(dosha.marsHouse)} from the ascendant`,
      polarity: bothActive ? "context" : "caution",
    });
  };

  describe(a, doshaA);
  describe(b, doshaB);

  if (bothActive) {
    findings.push({
      text:
        "Both charts carry it, and the tradition treats that as mutual cancellation — dosha samya. " +
        "This is the single most-cited rule in Mangal matching, and it is the one a one-chart reading " +
        "cannot reach: neither chart looks any different, the pairing does.",
      basis: `${a.name} and ${b.name} both Mangal — mutually cancelled (dosha samya)`,
      polarity: "clear",
    });
  } else if (oneActive) {
    const carrier = doshaA.active ? a.name : b.name;
    const other = doshaA.active ? b.name : a.name;
    findings.push({
      text:
        `Only ${carrier} carries it, so there is no mutual cancellation. Read classically this is the ` +
        `friction pairing: ${carrier} brings a heat to the marriage that ${other}'s chart does not ` +
        "match. Modern practice treats it as a pacing problem rather than a prohibition.",
      basis: `Uncancelled in ${carrier}'s chart, absent or cancelled in ${other}'s`,
      polarity: "caution",
    });
  }

  return {
    key: "mangal_matching",
    label: "Mangal dosha, matched",
    sourcing: "Mars from the ascendant in both charts, with the chart-internal pariharas and dosha samya",
    verdict: bothActive
      ? "Mutually cancelled"
      : oneActive
        ? "Carried by one side"
        : "Not in play",
    findings,
  };
}

// ---------------------------------------------------------------------------
// Facet 2 — the two Moon doshas
// ---------------------------------------------------------------------------

/*
 * Bhakoot and Nadi: the two Ashtakoota factors that block rather than score.
 *
 * Bhakoot is the whole-sign distance between the two Moons. The tradition
 * counts it both ways, so a pair is described by the two distances together:
 * 6/8 (shashtashtaka) and 2/12 (dwirdwadasha) are the afflicted pairs, while
 * 5/9 (nava-pancham) is the most favourable. Nadi comes off the Moon's
 * nakshatra -- the 27 cycle through Aadi, Madhya and Antya -- and a shared
 * nadi is the heaviest single objection in classical matching.
 */
const NADI_NAMES = ["Aadi", "Madhya", "Antya"];

/*
 * Nadi by nakshatra index, zero-based from Ashwini.
 *
 * Not `index % 3`. The classical assignment runs out and back --
 * Ashwini Aadi, Bharani Madhya, Krittika Antya, then Rohini *Antya* again,
 * Mrigashira Madhya, Ardra Aadi -- and repeats that six-step zigzag four and a
 * half times across the 27. A plain modulo gets Ashwini through Krittika right
 * and then every third nakshatra wrong from Rohini on, which is the kind of
 * error that produces a confident verdict on the heaviest objection in
 * classical matching. The test asserts all 27 against the named groups.
 */
const NADI_CYCLE = [0, 1, 2, 2, 1, 0];
export const nadiOf = (nakshatraIndex: number) => NADI_CYCLE[nakshatraIndex % 6];

function moonDoshas(a: SynastryChart, b: SynastryChart): SynastryFacet {
  const findings: SynastryFinding[] = [];
  const moonA = planetIn(a, "Moon");
  const moonB = planetIn(b, "Moon");

  if (!moonA || !moonB) {
    return {
      key: "moon_doshas",
      label: "Bhakoot and Nadi",
      sourcing: "Moon sign distance both ways, and the Moon's nakshatra nadi in both charts",
      verdict: "Not computable",
      findings: [],
    };
  }

  // --- Bhakoot -----------------------------------------------------------
  const forward = signDistance(moonA.sign, moonB.sign);
  const back = signDistance(moonB.sign, moonA.sign);
  const pair = [forward, back].sort((x, y) => x - y);
  const key = `${pair[0]}/${pair[1]}`;
  const afflicted = key === "6/8" || key === "2/12";

  if (afflicted) {
    findings.push({
      text:
        key === "6/8"
          ? "The Moons sit six and eight signs apart — shashtashtaka. Classically the heavier of the two " +
            "Bhakoot afflictions, read as strain on health and on the ease of the household rather than " +
            "on affection."
          : "The Moons sit two and twelve signs apart — dwirdwadasha. Read as a drain: each person " +
            "spends something on the other that is not obviously returned, and it shows up in money " +
            "and energy before it shows up in feeling.",
      basis: `${a.name}'s Moon in ${moonA.sign}, ${b.name}'s in ${moonB.sign} — ${key} Bhakoot`,
      polarity: "caution",
    });
  } else if (key === "5/9") {
    findings.push({
      text:
        "The Moons are five and nine signs apart — nava-pancham, the most favourable Bhakoot there is. " +
        "The tradition reads it as the pairing where each person's instinct makes sense to the other " +
        "without explanation.",
      basis: `${a.name}'s Moon in ${moonA.sign}, ${b.name}'s in ${moonB.sign} — 5/9 Bhakoot`,
      polarity: "clear",
    });
  } else {
    findings.push({
      text: "Bhakoot is not afflicted. The two Moons are on terms the tradition has no objection to.",
      basis: `${a.name}'s Moon in ${moonA.sign}, ${b.name}'s in ${moonB.sign} — ${key} Bhakoot`,
      polarity: "clear",
    });
  }

  // --- Nadi --------------------------------------------------------------
  const nakA = calculateNakshatra(moonA.longitude);
  const nakB = calculateNakshatra(moonB.longitude);
  const nadiA = nadiOf(nakA.index);
  const nadiB = nadiOf(nakB.index);
  const sameNadi = nadiA === nadiB;
  /* The eka-nakshatra exemption: a shared nadi is excused when both Moons are
     in the same nakshatra, since the objection is to the pair falling in one
     constitutional group by coincidence rather than by identity. */
  const sameNakshatra = nakA.index === nakB.index;

  if (sameNadi && !sameNakshatra) {
    findings.push({
      text:
        `Both Moons fall in ${NADI_NAMES[nadiA]} nadi. This is the heaviest single objection in ` +
        "classical matching — traditionally read as a constitutional sameness that works against " +
        "vitality and progeny. Worth knowing, and worth knowing that it is also the rule modern " +
        "practitioners set aside most often.",
      basis: `${a.name}'s Moon in ${nakA.name}, ${b.name}'s in ${nakB.name} — both ${NADI_NAMES[nadiA]} nadi`,
      polarity: "caution",
    });
  } else if (sameNadi && sameNakshatra) {
    findings.push({
      text:
        `Both Moons fall in ${NADI_NAMES[nadiA]} nadi, but in the same nakshatra — the classical ` +
        "exemption. Nadi dosha is not counted against a pair sharing one nakshatra.",
      basis: `Both Moons in ${nakA.name} — same nadi, exempt`,
      polarity: "clear",
    });
  } else {
    findings.push({
      text: "The two Moons fall in different nadis, which is what matching asks for.",
      basis: `${a.name}: ${nakA.name} (${NADI_NAMES[nadiA]}), ${b.name}: ${nakB.name} (${NADI_NAMES[nadiB]})`,
      polarity: "clear",
    });
  }

  const cautions = findings.filter((f) => f.polarity === "caution").length;
  return {
    key: "moon_doshas",
    label: "Bhakoot and Nadi",
    sourcing: "Moon sign distance counted both ways, and the Moon's nakshatra nadi in both charts",
    verdict: cautions === 0 ? "Both clear" : cautions === 1 ? "One flagged" : "Both flagged",
    findings,
  };
}

// ---------------------------------------------------------------------------
// Facet 3 — chemistry by overlay
// ---------------------------------------------------------------------------

/*
 * Venus and Mars across the two charts, and where they land in each other's
 * houses.
 *
 * The native panel reads Venus and Mars inside one chart, which describes an
 * appetite. What a pair wants to know is whether the two appetites meet, and
 * that is a cross-chart question: A's Venus against B's Mars, and each of them
 * against the houses of the other chart. A Mars in its own 5th is a fact about
 * that person; the same Mars in the partner's 7th is a fact about the marriage.
 */
function physicalChemistry(a: SynastryChart, b: SynastryChart): SynastryFacet {
  const findings: SynastryFinding[] = [];

  const cross = (from: SynastryChart, to: SynastryChart) => {
    const venus = planetIn(from, "Venus");
    const mars = planetIn(to, "Mars");
    if (!venus || !mars) return;
    const distance = signDistance(venus.sign, mars.sign);
    if (distance === 1) {
      findings.push({
        text:
          `${from.name}'s Venus and ${to.name}'s Mars share a sign. This is the strongest of the ` +
          "cross-chart attraction contacts — what one finds beautiful is what the other is driven " +
          "toward, with no translation needed.",
        basis: `${from.name}'s Venus and ${to.name}'s Mars both in ${venus.sign}`,
        polarity: "clear",
      });
    } else if (distance === 7) {
      findings.push({
        text:
          `${from.name}'s Venus opposes ${to.name}'s Mars. Opposition across charts is pull with a ` +
          "charge on it: strong attraction that keeps its edge instead of settling.",
        basis: `${from.name}'s Venus in ${venus.sign} opposite ${to.name}'s Mars in ${mars.sign}`,
        polarity: "context",
      });
    }
  };
  cross(a, b);
  cross(b, a);

  /* Overlay, both directions. The 7th, 8th and 12th are the three the native
     facets are read from, so they are the three worth checking here. */
  const overlay = (from: SynastryChart, to: SynastryChart) => {
    for (const name of ["Venus", "Mars"]) {
      const planet = planetIn(from, name);
      if (!planet) continue;
      const house = houseForSign(to, planet.sign);
      if (house === null) continue;
      if (house === 7) {
        findings.push({
          text:
            `${from.name}'s ${name} lands in ${to.name}'s 7th — the house of the partner itself. ` +
            `${to.name} is likely to experience ${from.name} as partner-shaped from very early on.`,
          basis: `${from.name}'s ${name} in ${planet.sign}, which is ${to.name}'s 7th house`,
          polarity: "clear",
        });
      } else if (house === 8) {
        findings.push({
          text:
            `${from.name}'s ${name} lands in ${to.name}'s 8th, the private body. Physically this is ` +
            "one of the more charged overlays there is, and it is also the one that makes the " +
            "relationship hard to keep casual.",
          basis: `${from.name}'s ${name} in ${planet.sign}, which is ${to.name}'s 8th house`,
          polarity: "context",
        });
      } else if (house === 12 && name === "Venus") {
        findings.push({
          text:
            `${from.name}'s Venus lands in ${to.name}'s 12th — shayya sukha by overlay. The classical ` +
            "reading of Venus in the 12th applies to the pairing rather than to either chart alone.",
          basis: `${from.name}'s Venus in ${planet.sign}, which is ${to.name}'s 12th house`,
          polarity: "clear",
        });
      }
    }
  };
  overlay(a, b);
  overlay(b, a);

  return {
    key: "physical_chemistry",
    label: "Chemistry across the charts",
    sourcing: "Venus against the other's Mars both ways, and Venus/Mars overlay into the partner's 7th, 8th and 12th",
    verdict:
      findings.length === 0
        ? "No strong contacts"
        : findings.some((f) => f.polarity === "clear")
          ? "Live contacts present"
          : "Charged rather than easy",
    findings,
  };
}

// ---------------------------------------------------------------------------
// Facet 4 — cross-checking the in-law reading
// ---------------------------------------------------------------------------

/*
 * The native in-law facet's own check.
 *
 * kalatra-engine derives the spouse's mother from one chart, by counting the
 * 4th from the 7th. That derivation is sound and it is still an inference about
 * somebody who is not in the chart. With the partner's chart present the same
 * person has a direct significator -- their own 4th house -- and the two
 * readings either agree or they do not. Agreement is worth more than either
 * alone; disagreement is worth saying out loud rather than quietly preferring
 * one of them.
 */
const CROSSCHECKS = [
  { count: 4, ownHouse: 4, who: "mother" },
  { count: 9, ownHouse: 9, who: "father" },
] as const;

function tenor(chart: SynastryChart, house: number): "warm" | "strained" | "neutral" {
  const occupants = occupantsOf(chart, house);
  const benefics = occupants.filter((p) => NATURAL_BENEFICS.has(p)).length;
  const malefics = occupants.filter((p) => NATURAL_MALEFICS.has(p)).length;
  if (benefics > malefics) return "warm";
  if (malefics > benefics) return "strained";
  return "neutral";
}

function inLawCrosscheck(a: SynastryChart, b: SynastryChart): SynastryFacet {
  const findings: SynastryFinding[] = [];
  let agreements = 0;
  let conflicts = 0;

  const check = (viewer: SynastryChart, subject: SynastryChart) => {
    for (const rel of CROSSCHECKS) {
      const derived = houseFrom(7, rel.count);
      const derivedTenor = tenor(viewer, derived);
      const directTenor = tenor(subject, rel.ownHouse);
      if (derivedTenor === "neutral" && directTenor === "neutral") continue;

      const basis =
        `${viewer.name}'s ${ordinal(derived)} (${ordinal(rel.count)} from the 7th) reads ` +
        `${derivedTenor}; ${subject.name}'s own ${ordinal(rel.ownHouse)} reads ${directTenor}`;

      if (derivedTenor === directTenor) {
        agreements += 1;
        findings.push({
          text:
            `Both charts say the same thing about ${subject.name}'s ${rel.who}. ${viewer.name}'s ` +
            `derived reading and ${subject.name}'s own house agree, which is the strongest form this ` +
            "kind of claim comes in — two independent routes to one answer.",
          basis,
          polarity: derivedTenor === "warm" ? "clear" : "caution",
        });
      } else if (derivedTenor !== "neutral" && directTenor !== "neutral") {
        conflicts += 1;
        findings.push({
          text:
            `The two routes disagree about ${subject.name}'s ${rel.who}. That usually means the ` +
            "relationship is genuinely different from the two sides of it — one of you will find that " +
            "person easier than the other does, and the charts are telling you which.",
          basis,
          polarity: "context",
        });
      }
    }
  };
  check(a, b);
  check(b, a);

  return {
    key: "in_law_crosscheck",
    label: "The in-law reading, cross-checked",
    sourcing:
      "Each chart's bhavat-bhavam derivation from the 7th against the partner's own 4th and 9th — " +
      "two independent routes to the same person",
    verdict:
      findings.length === 0
        ? "Nothing to check"
        : conflicts === 0
          ? "Routes agree"
          : agreements === 0
            ? "Routes disagree"
            : "Mixed",
    findings,
  };
}

// ---------------------------------------------------------------------------
// Facet 5 — privacy by overlay
// ---------------------------------------------------------------------------

function privacyOverlay(a: SynastryChart, b: SynastryChart): SynastryFacet {
  const findings: SynastryFinding[] = [];

  const into12 = (from: SynastryChart, to: SynastryChart) => {
    const landed = from.planets.filter((p) => houseForSign(to, p.sign) === 12);
    const malefics = landed.filter((p) => NATURAL_MALEFICS.has(p.name)).map((p) => p.name);
    /* Venus is excluded, not missing. The chemistry facet already reports a
       Venus landing in the partner's 12th as shayya sukha by overlay, and on
       the first real pair this ran against it came back in both cards -- one
       chart fact printed twice under two headings, which reads as the report
       padding itself. Chemistry owns Venus here; this facet owns the rest. */
    const benefics = landed
      .filter((p) => NATURAL_BENEFICS.has(p.name) && p.name !== "Venus")
      .map((p) => p.name);

    if (malefics.length > 0) {
      findings.push({
        text:
          `${from.name}'s ${list(malefics)} ${verb("lands", malefics.length)} in ${to.name}'s 12th. ` +
          `Rest is where this shows first: ${to.name} is likely to sleep and recover less well in ` +
          "this person's company than alone, which is a logistics problem and not a verdict on the " +
          "relationship.",
        basis: `${from.name}'s ${list(malefics)} in ${to.name}'s 12th house`,
        polarity: "caution",
      });
    }
    if (benefics.length > 0) {
      findings.push({
        text:
          `${from.name}'s ${list(benefics)} ${verb("lands", benefics.length)} in ${to.name}'s 12th, ` +
          `the house of private comfort. ${to.name} tends to rest better with this person than without.`,
        basis: `${from.name}'s ${list(benefics)} in ${to.name}'s 12th house`,
        polarity: "clear",
      });
    }
  };
  into12(a, b);
  into12(b, a);

  return {
    key: "privacy_overlay",
    label: "Rest and privacy, by overlay",
    sourcing: "Each chart's planets falling in the other's 12th bhava",
    verdict:
      findings.length === 0
        ? "Neither 12th is touched"
        : findings.every((f) => f.polarity === "clear")
          ? "Restful both ways"
          : "Worth arranging around",
    findings,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function computeKalatraSynastry(
  a: SynastryChart,
  b: SynastryChart
): KalatraSynastryResult | null {
  if (a.planets.length === 0 || b.planets.length === 0) return null;
  if (a.houses.length === 0 || b.houses.length === 0) return null;

  const doshaA = computeMangalDosha(a.planets, a.houses);
  const doshaB = computeMangalDosha(b.planets, b.houses);

  return {
    facets: [
      mangalMatching(a, b, doshaA, doshaB),
      moonDoshas(a, b),
      physicalChemistry(a, b),
      inLawCrosscheck(a, b),
      privacyOverlay(a, b),
    ],
    method:
      "Read between the two charts rather than within either. Mangal dosha is computed in both and " +
      "then matched (dosha samya). Bhakoot counts the Moon-sign distance both ways; Nadi comes off " +
      "the Moon's nakshatra. Overlay places one chart's planets in the other's whole-sign houses. " +
      "Ashtakoota as a whole is not computed here — the page's own compatibility score already " +
      "answers that question, and two totals would not reconcile.",
  };
}

/** Exported for the tests. */
export const NADI_GROUPS = NADI_NAMES;
export { ZODIAC_SIGNS };
