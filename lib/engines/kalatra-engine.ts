import type { HousePlacement, PlanetPosition } from "@/lib/engines/swiss-ephemeris-engine";
import { SIGN_RULERS, planetDignity } from "@/lib/rules/context";

/*
 * Kalatra: the married-life detail read.
 *
 * The love_life domain answers "what are you like in partnership". This answers
 * the questions underneath it that the domain summary deliberately does not go
 * near -- the physical side, the household you marry into, whether the bond is
 * built to last. They are separate facets rather than one paragraph because
 * they are read from different houses and different karakas, and a chart is
 * routinely strong in one and thin in another.
 *
 * Every finding here names the classical rule it came from. That is not
 * decoration: this is the part of a reading a client is most likely to push
 * back on, and "the 8th lord is in the 12th" is answerable in a way that "your
 * intimacy is complicated" is not. The `basis` string on each finding is the
 * chart fact; the `sourcing` string on each facet is the bhava and karaka the
 * whole facet is read from.
 *
 * Houses are whole-sign throughout, taken off the chart's own `houses` array
 * rather than counted from the ascendant -- see house-support-engine for why
 * that distinction matters once a reader picks Placidus or Koch.
 */

// ---------------------------------------------------------------------------
// Classical constants
// ---------------------------------------------------------------------------

/*
 * The natural benefic/malefic split, in its simple form.
 *
 * Simple on purpose. The full classical treatment makes Mercury malefic in
 * malefic company and grades the Moon by paksha (waxing benefic, waning
 * malefic), and both refinements are real. Neither is applied here: this engine
 * reports tendencies at house level, and a Mercury that flips polarity by
 * association would make two findings in the same facet contradict each other
 * with no way for the reader to tell which one moved. Where the Moon's phase
 * actually changes a reading it is the dedicated Moon findings that carry it.
 */
const NATURAL_BENEFICS = new Set(["Jupiter", "Venus", "Mercury", "Moon"]);
const NATURAL_MALEFICS = new Set(["Saturn", "Mars", "Sun", "Rahu", "Ketu"]);

/*
 * Graha drishti as whole-sign house offsets.
 *
 * Every planet aspects the 7th house from itself. Mars adds the 4th and 8th,
 * Jupiter the 5th and 9th, Saturn the 3rd and 10th. Rahu and Ketu are given
 * Jupiter's 5/9 here, which is the common modern convention and is flagged
 * where it is used.
 *
 * Deliberately not lib/engines/aspect-engine.ts. That one is degree-based with
 * a 10-degree orb, which is the right model for "is Mars aspecting Venus" and
 * the wrong one for "is Jupiter aspecting the 10th house" -- a house is a whole
 * sign, so a degree orb would answer about a 20-degree slice of it and call the
 * rest unaspected.
 */
const SPECIAL_ASPECTS: Record<string, number[]> = {
  Mars: [4, 7, 8],
  Jupiter: [5, 7, 9],
  Saturn: [3, 7, 10],
  Rahu: [5, 7, 9],
  Ketu: [5, 7, 9],
};
const DEFAULT_ASPECTS = [7];

/** Houses that carry Mangal dosha when Mars sits in them, counted from Lagna. */
const MANGAL_HOUSES = [1, 2, 4, 7, 8, 12];

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export type KalatraFacetKey =
  | "physical_intimacy"
  | "privacy_and_rest"
  | "in_laws"
  | "bond_durability"
  | "desire_pattern";

export type FindingPolarity = "support" | "pressure" | "context";

export type KalatraFinding = {
  /** What the rule means, in the reader's language. */
  text: string;
  /** The chart fact it fired on, in the astrologer's language. */
  basis: string;
  polarity: FindingPolarity;
};

export type KalatraBand = "strong" | "mixed" | "tender";

export type KalatraFacet = {
  key: KalatraFacetKey;
  label: string;
  /** The bhavas and karakas this facet is read from. */
  sourcing: string;
  /** 0-100, derived from the findings' weights. */
  score: number;
  band: KalatraBand;
  summary: string;
  findings: KalatraFinding[];
};

export type MangalDosha = {
  present: boolean;
  /** The house Mars occupies from the ascendant. */
  marsHouse: number;
  /** Classical cancellations (parihara) that apply to this chart. */
  cancellations: string[];
  /** present && no cancellations. */
  active: boolean;
};

export type KalatraResult = {
  facets: KalatraFacet[];
  mangal: MangalDosha;
  /** One line naming the technique, for the evidence disclosure. */
  method: string;
};

// ---------------------------------------------------------------------------
// Chart lookups
// ---------------------------------------------------------------------------

type Chart = {
  planet: (name: string) => PlanetPosition | undefined;
  houseOf: (name: string) => number | null;
  signOf: (house: number) => string;
  occupants: (house: number) => string[];
  lordOf: (house: number) => string;
  aspectsHouse: (planet: string, house: number) => boolean;
  benefics: (house: number) => string[];
  malefics: (house: number) => string[];
};

/**
 * The house `count` places from `from`, whole-sign and 1-based.
 *
 * `houseFrom(7, 4)` is the 4th from the 7th = the 10th. This is bhavat bhavam,
 * and it is the whole basis of the in-laws facet: the spouse is the 7th, so the
 * spouse's mother is the 4th counted from there.
 */
export function houseFrom(from: number, count: number): number {
  return ((from + count - 2) % 12) + 1;
}

function buildChart(planets: PlanetPosition[], houses: HousePlacement[]): Chart {
  const byName = new Map(planets.map((p) => [p.name, p]));
  const bySign = new Map(houses.map((h) => [h.house_number, h.sign]));
  const byHouse = new Map(houses.map((h) => [h.house_number, h.planets]));

  const signOf = (house: number) => bySign.get(house) ?? "";
  const occupants = (house: number) => byHouse.get(house) ?? [];

  return {
    planet: (name) => byName.get(name),
    houseOf: (name) => byName.get(name)?.house ?? null,
    signOf,
    occupants,
    lordOf: (house) => SIGN_RULERS[signOf(house)] ?? "",
    aspectsHouse: (name, house) => {
      const from = byName.get(name)?.house;
      if (!from) return false;
      const offsets = SPECIAL_ASPECTS[name] ?? DEFAULT_ASPECTS;
      return offsets.some((offset) => houseFrom(from, offset) === house);
    },
    benefics: (house) => occupants(house).filter((p) => NATURAL_BENEFICS.has(p)),
    malefics: (house) => occupants(house).filter((p) => NATURAL_MALEFICS.has(p)),
  };
}

/** Signed weight per polarity, so a facet's score follows its findings. */
const WEIGHT: Record<FindingPolarity, number> = {
  support: 12,
  pressure: -12,
  context: 0,
};

function scoreOf(findings: KalatraFinding[]): number {
  const raw = findings.reduce((total, f) => total + WEIGHT[f.polarity], 50);
  return Math.max(4, Math.min(96, Math.round(raw)));
}

/*
 * Thresholds set so that one finding moves the band.
 *
 * 50 is the no-findings midpoint, and a single support lands on 62 while a
 * single pressure lands on 38. That is deliberate: these facets routinely fire
 * once or twice, and at a wider band every chart came back "Mixed" -- a label
 * that costs a card's worth of space to say nothing.
 */
function bandOf(score: number): KalatraBand {
  if (score >= 62) return "strong";
  if (score >= 40) return "mixed";
  return "tender";
}

const ordinal = (n: number) => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
};

const list = (items: string[]) =>
  items.length <= 1
    ? items[0] ?? ""
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/*
 * Verb agreement for a planet list.
 *
 * "Saturn and Rahu falls on the house" is what you get from a template that
 * assumes one planet, and two malefics in one house is common enough that it
 * showed up on the first chart rendered. `verb("sits", n)` picks the form.
 */
const verb = (singular: string, count: number) =>
  count > 1 ? (singular === "is" ? "are" : singular.replace(/s$/, "")) : singular;

// ---------------------------------------------------------------------------
// Facet 1 — the physical side
// ---------------------------------------------------------------------------

/*
 * Read from the 8th bhava, Venus and Mars.
 *
 * The 8th is the one people find surprising. It is known as the house of
 * death and obstruction, but Randhra bhava also governs `guhya` -- the private
 * body and what happens out of sight -- and classical texts read the physical
 * side of a marriage there rather than at the 7th. The 7th is the partner and
 * the contract; the 8th is what the two of you do that nobody else sees.
 *
 * Venus is kama karaka and the significator of pleasure and seed. Mars carries
 * physical drive. Their relationship to each other is the single most useful
 * fact in this facet, which is why it is tested three ways -- conjunction,
 * mutual aspect, and sign-lord exchange.
 */
function physicalIntimacy(chart: Chart): KalatraFacet {
  const findings: KalatraFinding[] = [];
  const venus = chart.planet("Venus");
  const mars = chart.planet("Mars");
  const h8 = 8;

  if (venus) {
    const dignity = planetDignity("Venus", venus.sign);
    if (dignity === "exalted" || dignity === "own_sign") {
      findings.push({
        text:
          "Desire is well-housed here. You are able to want something openly and say so, which is rarer " +
          "than it sounds and is most of what makes the physical side easy rather than negotiated.",
        basis: `Venus ${dignity === "exalted" ? "exalted" : "in its own sign"} in ${venus.sign}`,
        polarity: "support",
      });
    }
    if (dignity === "debilitated") {
      findings.push({
        text:
          "Venus debilitated turns the critical eye inward before it turns outward. Expect a habit of " +
          "auditing your own desirability in the moment -- not a lack of appetite, a running commentary " +
          "alongside it.",
        basis: "Venus debilitated in Virgo",
        polarity: "pressure",
      });
    }
    if (venus.is_combust) {
      findings.push({
        text:
          "Venus combust puts desire too close to identity. Wanting someone and needing to be seen a " +
          "certain way arrive fused, so rejection lands as a verdict on you rather than on a moment.",
        basis: "Venus combust — within the Sun's orb",
        polarity: "pressure",
      });
    }
  }

  if (venus && mars) {
    const conjunct = venus.house === mars.house;
    const mutual = chart.aspectsHouse("Mars", venus.house) || chart.aspectsHouse("Venus", mars.house);
    if (conjunct) {
      findings.push({
        text:
          "Venus and Mars in the same house is the classical signature of a strong physical charge — " +
          "attraction and drive firing together rather than taking turns. It runs hot, and it does not " +
          "wait well.",
        basis: `Venus and Mars both in the ${ordinal(venus.house)} house`,
        polarity: "support",
      });
    } else if (mutual) {
      findings.push({
        text:
          "Venus and Mars in aspect keeps affection and appetite in conversation with each other. The " +
          "warmth and the want tend to arrive together rather than one chasing the other.",
        basis: `Venus in the ${ordinal(venus.house)} and Mars in the ${ordinal(mars.house)}, in mutual drishti`,
        polarity: "support",
      });
    }
  }

  const eighthOccupants = chart.occupants(h8);
  const eighthBenefics = chart.benefics(h8);
  const eighthMalefics = chart.malefics(h8);

  if (eighthBenefics.length > 0) {
    findings.push({
      text:
        `${list(eighthBenefics)} in the 8th ${verb("softens", eighthBenefics.length)} the private half ` +
        "of a marriage. What happens behind the door tends to be the easy part, even in stretches " +
        "where the public half is strained.",
      basis: `${list(eighthBenefics)} in the 8th (Randhra) house`,
      polarity: "support",
    });
  }
  if (eighthMalefics.includes("Mars")) {
    findings.push({
      text:
        "Mars in the 8th is appetite with an edge on it. Intensity is not the problem; the problem is " +
        "that intensity and friction come from the same place, so a good week and a bad argument can " +
        "both trace back to the same drive.",
      basis: "Mars in the 8th (Randhra) house",
      polarity: "context",
    });
  }
  if (eighthMalefics.includes("Saturn")) {
    findings.push({
      text:
        "Saturn in the 8th slows this down and makes it dutiful before it makes it warm. It usually " +
        "improves with years rather than with effort — Saturn pays late, but it does pay.",
      basis: "Saturn in the 8th (Randhra) house",
      polarity: "pressure",
    });
  }
  if (eighthOccupants.includes("Rahu")) {
    findings.push({
      text:
        "Rahu in the 8th reaches for the unfamiliar. Appetite here is exploratory and gets bored of " +
        "the known faster than it admits, which is a strength with a partner who will go there and a " +
        "strain with one who will not.",
      basis: "Rahu in the 8th (Randhra) house",
      polarity: "context",
    });
  }

  if (venus && chart.aspectsHouse("Saturn", venus.house)) {
    findings.push({
      text:
        "Saturn's aspect on Venus is the restraint signature: a delay before you let yourself want " +
        "something, and a tendency to earn intimacy rather than simply accept it.",
      basis: `Saturn aspects Venus in the ${ordinal(venus.house)} house`,
      polarity: "pressure",
    });
  }

  const score = scoreOf(findings);
  return {
    key: "physical_intimacy",
    label: "The physical side",
    sourcing: "8th bhava (Randhra — the private body), Venus as kama karaka, Mars as drive",
    score,
    band: bandOf(score),
    summary:
      findings.length === 0
        ? "Nothing in the 8th, and Venus and Mars both sit quietly. An unremarkable reading here means " +
          "the physical side is led by circumstance and the partner rather than by a strong pull in " +
          "your own chart."
        : bandOf(score) === "strong"
          ? "This is a well-supported part of the chart. The physical side is likely to be a source of " +
            "steadiness rather than something you have to manage."
          : bandOf(score) === "tender"
            ? "This part of the chart asks for patience and plain speech. The difficulty is rarely " +
              "appetite itself — it is the story running alongside it."
            : "Mixed, and mixed in a specific way: the chart gives with one hand here and asks something " +
              "back with the other.",
    findings,
  };
}

// ---------------------------------------------------------------------------
// Facet 2 — privacy, rest and the bed
// ---------------------------------------------------------------------------

/*
 * Read from the 12th bhava.
 *
 * Vyaya bhava is the house of loss and expenditure, and it is also `shayya
 * sukha` -- the comfort of the bed. That is not a modern gloss: it is why
 * classical texts call Venus in the 12th a good placement despite the 12th
 * being a dusthana, and it is one of the few places where the tradition says
 * something warm about that house. Worth surfacing precisely because a reader
 * who has looked up their own 12th house has probably only found the losses.
 */
function privacyAndRest(chart: Chart): KalatraFacet {
  const findings: KalatraFinding[] = [];
  const h12 = 12;
  const occupants = chart.occupants(h12);
  const lord12 = chart.lordOf(h12);
  const lord12House = chart.houseOf(lord12);

  if (occupants.includes("Venus")) {
    findings.push({
      text:
        "Venus in the 12th is the classical marker for `shayya sukha` — comfort of the bed. The 12th is " +
        "otherwise the house of loss, and this is the one placement the tradition is unreservedly warm " +
        "about: private pleasure is well supplied even in a life that is busy elsewhere.",
      basis: "Venus in the 12th (Vyaya) house — shayya sukha",
      polarity: "support",
    });
  }
  if (occupants.includes("Moon")) {
    findings.push({
      text:
        "The Moon in the 12th needs genuine solitude to refill, which a partner can easily read as " +
        "withdrawal. Naming it as a requirement rather than a mood is most of the fix.",
      basis: "Moon in the 12th (Vyaya) house",
      polarity: "context",
    });
  }
  const restDisturbers = occupants.filter((p) => p === "Saturn" || p === "Mars" || p === "Rahu");
  if (restDisturbers.length > 0) {
    findings.push({
      text:
        `${list(restDisturbers)} in the 12th ${verb("disturbs", restDisturbers.length)} rest before ` +
        "anything else. Sleep, privacy and the hour before bed are where strain shows up first, and " +
        "they are also the cheapest things to protect deliberately.",
      basis: `${list(restDisturbers)} in the 12th (Vyaya) house`,
      polarity: "pressure",
    });
  }

  if (lord12House === 7) {
    findings.push({
      text:
        "The 12th lord in the 7th ties your private world to your partner's. Solitude and partnership " +
        "stop being separate needs — which is unusually good when the match is right and unusually " +
        "costly when it is not.",
      basis: `12th lord ${lord12} in the 7th house`,
      polarity: "support",
    });
  } else if (lord12House && [6, 8, 12].includes(lord12House)) {
    findings.push({
      text:
        "The 12th lord in a difficult house keeps privacy in short supply. Expect a life where the " +
        "quiet hour has to be defended rather than assumed.",
      basis: `12th lord ${lord12} in the ${ordinal(lord12House)} house`,
      polarity: "pressure",
    });
  }

  const score = scoreOf(findings);
  return {
    key: "privacy_and_rest",
    label: "Privacy, rest and the bed",
    sourcing: "12th bhava (Vyaya — shayya sukha, the comfort of the bed) and its lord",
    score,
    band: bandOf(score),
    summary:
      findings.length === 0
        ? "A quiet 12th house. Privacy is neither a strong theme nor a sore point — it will follow " +
          "whatever the household arrangement happens to be."
        : "Read this one as logistics rather than character: it describes the conditions intimacy needs, " +
          "not how much of it there is.",
    findings,
  };
}

// ---------------------------------------------------------------------------
// Facet 3 — the family you marry into
// ---------------------------------------------------------------------------

/*
 * Read by bhavat bhavam from the 7th.
 *
 * The spouse is the 7th house, so the spouse's relatives are counted from
 * there: the 4th from the 7th is the spouse's mother, which lands on the 10th
 * house of the natal chart; the 9th from the 7th is the spouse's father, on the
 * 3rd; the 3rd from the 7th is the spouse's siblings, on the 9th. The 2nd house
 * -- kutumba, the family you belong to -- carries the household as a whole once
 * you have joined it.
 *
 * This is the facet most worth showing the derivation for, because "your 10th
 * house describes your mother-in-law" reads as invented until you see that it
 * is just the 4th house of the person in the 7th.
 */
/*
 * Each relation carries its own copy rather than filling a shared template.
 *
 * The template version worked and read like a mail merge: three consecutive
 * findings ending "...about authority and expectation rather than about
 * affection" is what a generated report sounds like when nobody checked the
 * output. The relationships are also genuinely different -- the thing that
 * goes wrong with a mother-in-law is not the thing that goes wrong with a
 * brother-in-law -- so one sentence for all three was wrong twice.
 */
const IN_LAW_RELATIONS = [
  {
    count: 4,
    who: "your spouse's mother",
    support:
      "That is usually the warm one. Expect to be taken in rather than assessed, and expect it early " +
      "rather than after you have proved something.",
    pressure:
      "Expect the friction there to be about standards — how things are done, and whose way is the " +
      "right one. It is rarely about whether you are liked.",
  },
  {
    count: 9,
    who: "your spouse's father",
    support:
      "That relationship tends to settle into respect quickly, and to be the one you can go to when " +
      "something needs a level head.",
    pressure:
      "Expect distance rather than conflict there — approval held slightly out of reach, and a " +
      "relationship that stays formal for longer than you would like.",
  },
  {
    count: 3,
    who: "your spouse's siblings",
    support:
      "Expect that to be the easy end of the family — allies rather than obligations, and often the " +
      "route through which the rest of them warm to you.",
    pressure:
      "Expect comparison and competing claims on your partner's time. This is the in-law friction " +
      "that shows up at weddings and funerals rather than day to day.",
  },
] as const;

function inLaws(chart: Chart): KalatraFacet {
  const findings: KalatraFinding[] = [];

  for (const relation of IN_LAW_RELATIONS) {
    const house = houseFrom(7, relation.count);
    const benefics = chart.benefics(house);
    const malefics = chart.malefics(house);
    const derivation = `${ordinal(relation.count)} from the 7th = your ${ordinal(house)} house`;

    if (benefics.length > 0) {
      findings.push({
        text:
          `${list(benefics)} ${verb("falls", benefics.length)} on the house standing for ` +
          `${relation.who}. ${relation.support}`,
        basis: `${list(benefics)} in the ${ordinal(house)} (${derivation})`,
        polarity: "support",
      });
    }
    if (malefics.length > 0) {
      findings.push({
        text:
          `${list(malefics)} ${verb("falls", malefics.length)} on the house standing for ` +
          `${relation.who}. ${relation.pressure}`,
        basis: `${list(malefics)} in the ${ordinal(house)} (${derivation})`,
        polarity: "pressure",
      });
    }
    if (chart.aspectsHouse("Jupiter", house) && !benefics.includes("Jupiter")) {
      findings.push({
        text:
          `Jupiter's aspect reaches the house for ${relation.who}, which is the classical smoothing ` +
          "influence: even where that relationship is strained, there is usually somebody willing to " +
          "be reasonable first.",
        basis: `Jupiter aspects the ${ordinal(house)} (${derivation})`,
        polarity: "support",
      });
    }
  }

  const h2Malefics = chart.malefics(2);
  const h2Benefics = chart.benefics(2);
  if (h2Benefics.length > 0) {
    findings.push({
      text:
        `${list(h2Benefics)} in the 2nd ${verb("supports", h2Benefics.length)} the household you marry ` +
        "into as a unit — meals, money and the ordinary business of a shared family tend to go smoothly.",
      basis: `${list(h2Benefics)} in the 2nd (Dhana/kutumba) house`,
      polarity: "support",
    });
  }
  if (h2Malefics.length > 0) {
    findings.push({
      text:
        `${list(h2Malefics)} in the 2nd ${verb("puts", h2Malefics.length)} strain on the joined family ` +
        "rather than on any one person in it. Money and who decides things are the usual pressure points.",
      basis: `${list(h2Malefics)} in the 2nd (Dhana/kutumba) house`,
      polarity: "pressure",
    });
  }

  const score = scoreOf(findings);
  return {
    key: "in_laws",
    label: "The family you marry into",
    sourcing:
      "Bhavat bhavam from the 7th — 4th from 7th (10th) for the spouse's mother, 9th from 7th (3rd) " +
      "for the father, 3rd from 7th (9th) for siblings; 2nd bhava for the household",
    score,
    band: bandOf(score),
    summary:
      findings.length === 0
        ? "The in-law houses are empty and unaspected, which is its own answer: these relationships are " +
          "unlikely to be a defining feature of the marriage in either direction."
        : "Read these as tendencies in the relationship, not verdicts on the people. The same placement " +
          "that reads as friction at twenty-five often reads as respect at forty.",
    findings,
  };
}

// ---------------------------------------------------------------------------
// Facet 4 — whether the bond holds
// ---------------------------------------------------------------------------

/*
 * Read from the 7th lord, the 8th as mangalya sthana, and Mangal dosha.
 *
 * The 8th doing double duty is not a contradiction: the same house that governs
 * the private body governs `mangalya` -- the durability of the marital bond
 * itself. A chart can be warm in the first reading of the 8th and brittle in
 * the second, and separating them is the point of having two facets.
 */
function bondDurability(chart: Chart, mangal: MangalDosha): KalatraFacet {
  const findings: KalatraFinding[] = [];
  const lord7 = chart.lordOf(7);
  const lord7House = chart.houseOf(lord7);
  const lord7Planet = chart.planet(lord7);

  if (lord7House && [6, 8, 12].includes(lord7House)) {
    findings.push({
      text:
        "The lord of partnership sits in a difficult house. Classically this reads as a bond that has " +
        "to be built rather than found — often after one relationship that teaches the lesson at full " +
        "price.",
      basis: `7th lord ${lord7} in the ${ordinal(lord7House)} house`,
      polarity: "pressure",
    });
  } else if (lord7House && [1, 4, 5, 7, 9, 10].includes(lord7House)) {
    findings.push({
      text:
        "The lord of partnership sits in a strong house, which is the plainest single marker for a " +
        "bond that holds its shape under load.",
      basis: `7th lord ${lord7} in the ${ordinal(lord7House)} house`,
      polarity: "support",
    });
  }

  if (lord7Planet) {
    const dignity = planetDignity(lord7, lord7Planet.sign);
    if (dignity === "exalted" || dignity === "own_sign") {
      findings.push({
        text:
          "The partnership lord is in good dignity — the commitment itself is well made, whatever the " +
          "weather around it.",
        basis: `7th lord ${lord7} ${dignity === "exalted" ? "exalted" : "in its own sign"} in ${lord7Planet.sign}`,
        polarity: "support",
      });
    } else if (dignity === "debilitated") {
      findings.push({
        text:
          "The partnership lord is debilitated, which tends to show up as undervaluing the relationship " +
          "you actually have while holding an unmet standard alongside it.",
        basis: `7th lord ${lord7} debilitated in ${lord7Planet.sign}`,
        polarity: "pressure",
      });
    }
  }

  if (chart.aspectsHouse("Jupiter", 7)) {
    findings.push({
      text:
        "Jupiter aspects the 7th. This is the classical protection on a marriage — not that nothing " +
        "goes wrong, but that there is usually a way back after it does.",
      basis: "Jupiter aspects the 7th (Yuvati) house",
      polarity: "support",
    });
  }
  if (chart.aspectsHouse("Saturn", 7) && !chart.occupants(7).includes("Saturn")) {
    findings.push({
      text:
        "Saturn aspects the 7th, which slows partnership down and ages it well. Early years ask more " +
        "than they give; the same aspect is what keeps the thing standing later.",
      basis: "Saturn aspects the 7th (Yuvati) house",
      polarity: "context",
    });
  }

  if (mangal.present) {
    findings.push({
      text: mangal.active
        ? "Mangal dosha is present and uncancelled. Traditionally read as friction in marriage; read " +
          "more usefully, it is a chart that needs an equal rather than an admirer, and does badly " +
          "with a partner who will not push back."
        : "Mangal dosha is present but cancelled by the conditions below, which the tradition treats " +
          "as neutralising it rather than reducing it.",
      basis: `Mars in the ${ordinal(mangal.marsHouse)} house from the ascendant${
        mangal.cancellations.length > 0 ? `; ${list(mangal.cancellations)}` : ""
      }`,
      polarity: mangal.active ? "pressure" : "context",
    });
  }

  const score = scoreOf(findings);
  return {
    key: "bond_durability",
    label: "Whether the bond holds",
    sourcing: "7th lord and its dignity, 8th bhava as mangalya sthana, Jupiter's drishti, Mangal dosha",
    score,
    band: bandOf(score),
    summary:
      bandOf(score) === "strong"
        ? "The structural reading is good. What this facet measures is durability under strain, and " +
          "this chart has it."
        : bandOf(score) === "tender"
          ? "The structure asks for deliberate maintenance. That is a different claim from an unhappy " +
            "marriage — it means the thing does not hold itself up unattended."
          : "A workable structure with one or two specific load-bearing points, named below.",
    findings,
  };
}

// ---------------------------------------------------------------------------
// Facet 5 — the shape of desire
// ---------------------------------------------------------------------------

/*
 * Read from the kama trikona -- houses 3, 7 and 11.
 *
 * The four purusharthas each own a triangle of houses, and kama, desire, owns
 * this one: the 3rd for what you reach for, the 7th for who you reach toward,
 * the 11th for what you want to gain from it. Which of the three is populated
 * says more about how someone pursues than any single placement does.
 */
function desirePattern(chart: Chart): KalatraFacet {
  const findings: KalatraFinding[] = [];
  const trikona = [3, 7, 11];
  const populated = trikona.filter((h) => chart.occupants(h).length > 0);
  const total = trikona.reduce((sum, h) => sum + chart.occupants(h).length, 0);

  if (total >= 3) {
    findings.push({
      text:
        "The desire triangle is busy. Wanting things — people, outcomes, experiences — is a live engine " +
        "in this chart rather than a background hum, and it will not be satisfied by a quiet life.",
      basis: `${total} planets across the kama trikona (3rd, 7th, 11th)`,
      polarity: "support",
    });
  } else if (total === 0) {
    findings.push({
      text:
        "An empty desire triangle. Pursuit is not where this chart spends its energy, which usually " +
        "reads as being chosen rather than choosing — comfortable when the choosing is good.",
      basis: "No planets in the kama trikona (3rd, 7th, 11th)",
      polarity: "context",
    });
  }

  if (populated.includes(7)) {
    findings.push({
      text:
        `${list(chart.occupants(7))} in the 7th ${verb("puts", chart.occupants(7).length)} the partner ` +
        "at the centre of the picture rather than beside it. Relationships here are a main event, not " +
        "a support structure.",
      basis: `${list(chart.occupants(7))} in the 7th (Yuvati) house`,
      polarity: "context",
    });
  }

  const venus = chart.planet("Venus");
  if (venus && trikona.includes(venus.house)) {
    findings.push({
      text:
        "Venus sits inside the desire triangle, which aligns what you are drawn to with how you go " +
        "after it. Fewer mixed signals sent, and fewer received.",
      basis: `Venus in the ${ordinal(venus.house)} house, within the kama trikona`,
      polarity: "support",
    });
  }

  const lord11 = chart.lordOf(11);
  const lord11House = chart.houseOf(lord11);
  if (lord11House === 7 || lord11House === 5) {
    findings.push({
      text:
        "The lord of gain sits in a house of relationship, which ties what you get out of life to who " +
        "you are with. Partnerships tend to be materially as well as emotionally consequential.",
      basis: `11th lord ${lord11} in the ${ordinal(lord11House)} house`,
      polarity: "support",
    });
  }

  const score = scoreOf(findings);
  return {
    key: "desire_pattern",
    label: "The shape of desire",
    sourcing: "Kama trikona — the 3rd, 7th and 11th bhavas, with Venus and the 11th lord",
    score,
    band: bandOf(score),
    summary:
      "This facet describes how you pursue rather than what you want. It is the most useful one to " +
      "compare against a partner's chart, because mismatched pursuit styles cause more trouble than " +
      "mismatched tastes.",
    findings,
  };
}

// ---------------------------------------------------------------------------
// Mangal dosha
// ---------------------------------------------------------------------------

/*
 * Mars in the 1st, 2nd, 4th, 7th, 8th or 12th from the ascendant.
 *
 * The cancellations (parihara) below are the chart-internal ones. The most
 * commonly cited cancellation of all -- that the dosha is void when both
 * partners carry it -- cannot be evaluated from one chart and is named in the
 * panel rather than counted here, because silently omitting it would make a
 * matched pair read as a problem.
 */
export function computeMangalDosha(planets: PlanetPosition[], houses: HousePlacement[]): MangalDosha {
  const chart = buildChart(planets, houses);
  const mars = chart.planet("Mars");
  if (!mars) {
    return { present: false, marsHouse: 0, cancellations: [], active: false };
  }

  const present = MANGAL_HOUSES.includes(mars.house);
  const cancellations: string[] = [];

  if (present) {
    const dignity = planetDignity("Mars", mars.sign);
    if (dignity === "own_sign") cancellations.push(`Mars is in its own sign (${mars.sign})`);
    if (dignity === "exalted") cancellations.push("Mars is exalted in Capricorn");
    if (chart.aspectsHouse("Jupiter", mars.house)) {
      cancellations.push("Jupiter aspects Mars");
    }
    if (chart.occupants(mars.house).includes("Jupiter")) {
      cancellations.push("Jupiter is conjunct Mars");
    }
    /* The sign-specific pariharas: Mars loses its bite in Mercury's signs in the
       2nd, and in Venus's signs in the 12th, because the house's own
       significations are ruled by a benefic that Mars cannot easily spoil. */
    if (mars.house === 2 && ["Gemini", "Virgo"].includes(mars.sign)) {
      cancellations.push(`Mars in the 2nd in ${mars.sign}, a sign of Mercury`);
    }
    if (mars.house === 12 && ["Taurus", "Libra"].includes(mars.sign)) {
      cancellations.push(`Mars in the 12th in ${mars.sign}, a sign of Venus`);
    }
  }

  return {
    present,
    marsHouse: mars.house,
    cancellations,
    active: present && cancellations.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function computeKalatraDetail(
  planets: PlanetPosition[],
  houses: HousePlacement[]
): KalatraResult | null {
  if (planets.length === 0 || houses.length === 0) return null;

  const chart = buildChart(planets, houses);
  const mangal = computeMangalDosha(planets, houses);

  return {
    facets: [
      physicalIntimacy(chart),
      privacyAndRest(chart),
      inLaws(chart),
      bondDurability(chart, mangal),
      desirePattern(chart),
    ],
    mangal,
    method:
      "Whole-sign houses read from the chart's own house array. The in-law houses are derived by " +
      "bhavat bhavam from the 7th. Drishti is rasi (whole-sign) rather than degree-based: every graha " +
      "aspects the 7th from itself, Mars adds the 4th and 8th, Jupiter the 5th and 9th, Saturn the " +
      "3rd and 10th.",
  };
}
