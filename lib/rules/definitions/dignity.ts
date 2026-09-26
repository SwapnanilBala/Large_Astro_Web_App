/**
 * Planet strength: dignity rules, then the planet-state rules (directional
 * strength, combustion, retrograde) at the bottom of the file.
 *
 * The legacy engine looped seven classical planets against three non-neutral
 * dignities and assigned `category` dynamically per planet. Written flat that
 * is twenty-one near-identical records; written with one `for_each` record per
 * dignity it loses the per-planet category.
 *
 * So: one record per (dignity x category), nine in total, each expanding over
 * its own planet set. Category stays statically inspectable -- the selection
 * layer's diversity constraint depends on that -- and the "neutral" skip
 * survives as the absence of a `dignity.neutral` record rather than as a
 * downstream filter.
 */

import type { RuleDefinitionInput } from "@/lib/rules/schema";
import type { Predicate } from "@/lib/rules/schema";

type DignitySpec = {
  slug: "exalted" | "own_sign" | "debilitated";
  priority: "high" | "medium" | "low";
  headline: string;
  body: string;
  tension: string | null;
  base: number;
  bonus: { when: Predicate; add: number };
};

type CategorySpec = {
  slug: "core" | "career" | "love";
  over: "core_planets" | "career_planets" | "love_planets";
};

const DIGNITY_SPECS: DignitySpec[] = [
  {
    slug: "exalted",
    priority: "high",
    headline: "{$p.name} is running at full strength",
    body:
      "{$p.name} is placed in the sign where it works best, which means {@planet_role[$p.name]} tends to come " +
      "easily to you and to hold up under load. Things that other people have to force, you get for free here. " +
      "The usual risk is not weakness but complacency -- an ability this reliable rarely gets deliberately trained.",
    tension: null,
    base: 0.75,
    bonus: { when: { op: "in", left: "$p.house", values: [1, 4, 7, 10] }, add: 0.15 },
  },
  {
    slug: "own_sign",
    priority: "medium",
    headline: "{$p.name} is on home ground",
    body:
      "{$p.name} sits in a sign it governs, so {@planet_role[$p.name]} behaves consistently rather than in " +
      "bursts. This is not the most dramatic placement in a chart, but it is one of the most trustworthy: " +
      "what it promises on a good day is roughly what it delivers on an average one.",
    tension: null,
    base: 0.6,
    bonus: { when: { op: "in", left: "$p.house", values: [1, 4, 7, 10] }, add: 0.15 },
  },
  {
    slug: "debilitated",
    priority: "high",
    headline: "{$p.name} has to be built, not assumed",
    body:
      "{$p.name} is in the sign where it has least natural support, so {@planet_role[$p.name]} can feel " +
      "inconsistent -- strong in one season, absent the next -- until you deliberately build structure around " +
      "it. This is one of the most commonly over-read placements in a chart, and it is worth being clear: it " +
      "describes a starting position, not a ceiling.",
    tension:
      "The honest version is that this area improves through repetition, structure and someone further along " +
      "than you -- not through instinct. If you have been waiting to feel naturally good at it before you " +
      "commit to it, that is the wrong order and it will keep costing you.",
    base: 0.7,
    bonus: { when: { op: "in", left: "$p.house", values: [6, 8, 12] }, add: 0.1 },
  },
];

const CATEGORY_SPECS: CategorySpec[] = [
  { slug: "core", over: "core_planets" },
  { slug: "career", over: "career_planets" },
  { slug: "love", over: "love_planets" },
];

function buildDignityRule(dignity: DignitySpec, category: CategorySpec): RuleDefinitionInput {
  const id = `dignity.${dignity.slug}_${category.slug}`;
  return {
    id,
    tier: "signature",
    category: category.slug,
    priority: dignity.priority,
    instance_key: `${id}:{$p.name}`,
    for_each: { as: "p", over: category.over },

    bind: {
      p: { from: "planet", name: "@p" },
    },

    when: { op: "dignity", planet: "$p", is: [dignity.slug] },

    // Keyed by dignity and planet, not by the category-split id: Venus exalted
    // is one measurable event regardless of which record emits it.
    rarity_key: `dignity.${dignity.slug}.{$p.name}`,

    strength: {
      base: dignity.base,
      bonuses: [dignity.bonus],
    },

    display: {
      headline: dignity.headline,
      body: dignity.body,
      tension: dignity.tension ? [{ when: { op: "always" }, text: dignity.tension }] : [],
    },

    evidence: {
      technical_note: "{$p.name} placed in {$p.sign}, house {$p.house}.",
      claims: [
        { label: "Planet", path: "$p.name", kind: "placement" },
        { label: "Sign", path: "$p.sign", kind: "placement" },
        { label: "House", path: "$p.house", kind: "placement", format: "ordinal_house" },
        { label: "Dignity", path: "$p.dignity", kind: "dignity", format: "dignity" },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Planet states: directional strength, combustion, retrograde motion
// ---------------------------------------------------------------------------

/**
 * Three more measures of how well a planet can deliver, beyond its sign.
 *
 * Same split as dignity -- one record per (state x category) -- except where a
 * state cannot happen: the Sun is never combust or retrograde, so those two
 * states have no core record rather than a record that never fires. The Moon
 * is never retrograde either, but it shares the love set with Venus and Mars,
 * so it simply never matches there.
 *
 * All three flags are precomputed in the binding layer: `is_combust` and
 * `is_retrograde` by the ephemeris engine, `has_directional_strength` from
 * DIRECTIONAL_STRENGTH_HOUSE in context.ts.
 */
type StateSpec = {
  slug: "directional" | "combust" | "retrograde";
  priority: "high" | "medium" | "low";
  when: Predicate;
  categories: CategorySpec[];
  headline: string;
  body: string;
  tension: string | null;
  base: number;
  bonus: { when: Predicate; add: number };
  technical_note: string;
};

const STATE_SPECS: StateSpec[] = [
  {
    slug: "directional",
    priority: "medium",
    when: { op: "eq", left: "$p.has_directional_strength", right: true },
    categories: CATEGORY_SPECS,
    headline: "{$p.name} is in the one position where it works hardest for you",
    body:
      "{$p.name} sits in the part of your chart where classical astrology says it gains directional strength -- " +
      "the position it is most at home in, whichever sign it happens to be in. That tends to make " +
      "{@planet_role[$p.name]} unusually effective and easy to reach for: it is one of the tools you use without " +
      "thinking, and other people often notice it before you do.",
    tension: null,
    base: 0.6,
    bonus: { when: { op: "dignity", planet: "$p", is: ["exalted", "own_sign"] }, add: 0.15 },
    technical_note: "{$p.name} in house {$p.house} ({$p.sign}): dig bala, full directional strength.",
  },
  {
    slug: "combust",
    priority: "medium",
    when: { op: "eq", left: "$p.is_combust", right: true },
    categories: CATEGORY_SPECS.filter((c) => c.slug !== "core"),
    headline: "{$p.name} works in the Sun's shadow",
    body:
      "{$p.name} sits very close to the Sun in your chart -- close enough that classical astrology calls it " +
      "combust, its light drowned out by the brighter body. That does not mean {@planet_role[$p.name]} is " +
      "missing. It means it tends to work in service of your sense of self rather than on its own terms: strong " +
      "when it serves what you are driving at, harder to reach when it has to act independently, and easy for " +
      "other people to overlook.",
    tension:
      "If this part of life feels harder for you than it looks for other people, that is the pattern rather " +
      "than a verdict. It grows when you give it time and room of its own, away from whatever you are trying " +
      "to prove.",
    base: 0.55,
    bonus: { when: { op: "dignity", planet: "$p", is: ["debilitated"] }, add: 0.1 },
    technical_note: "{$p.name} in {$p.sign}, house {$p.house}, inside its combustion orb of the Sun (asta).",
  },
  {
    slug: "retrograde",
    priority: "low",
    when: { op: "eq", left: "$p.is_retrograde", right: true },
    categories: CATEGORY_SPECS.filter((c) => c.slug !== "core"),
    headline: "{$p.name} does its best work on the second pass",
    body:
      "{$p.name} was moving backwards in the sky when you were born -- retrograde, in astrology's term. " +
      "Classical texts treat a retrograde planet as strong but unconventional: {@planet_role[$p.name]} tends " +
      "to work inward first, revisiting and revising before it commits, and to find its own route rather than " +
      "the expected one. What looks like hesitation from the outside is usually thoroughness.",
    tension:
      "The trap is mistaking the review for the result. At some point the revision has to be finished and " +
      "put in front of people, even if it could still be improved.",
    base: 0.5,
    bonus: { when: { op: "dignity", planet: "$p", is: ["exalted", "own_sign"] }, add: 0.1 },
    technical_note: "{$p.name} retrograde (vakri) in {$p.sign}, house {$p.house}.",
  },
];

function buildStateRule(state: StateSpec, category: CategorySpec): RuleDefinitionInput {
  const id = `strength.${state.slug}_${category.slug}`;
  return {
    id,
    tier: "signature",
    category: category.slug,
    priority: state.priority,
    instance_key: `${id}:{$p.name}`,
    for_each: { as: "p", over: category.over },

    bind: {
      p: { from: "planet", name: "@p" },
    },

    when: state.when,

    // Keyed by state and planet, for the same reason dignity is.
    rarity_key: `strength.${state.slug}.{$p.name}`,

    strength: {
      base: state.base,
      bonuses: [state.bonus],
    },

    display: {
      headline: state.headline,
      body: state.body,
      tension: state.tension ? [{ when: { op: "always" }, text: state.tension }] : [],
    },

    evidence: {
      technical_note: state.technical_note,
      claims: [
        { label: "Planet", path: "$p.name", kind: "placement" },
        { label: "Sign", path: "$p.sign", kind: "placement" },
        { label: "House", path: "$p.house", kind: "placement", format: "ordinal_house" },
        { label: "Dignity", path: "$p.dignity", kind: "dignity", format: "dignity" },
      ],
    },
  };
}

/** Dignity records first, in their legacy order; the state records follow them. */
export const DIGNITY_RULES: RuleDefinitionInput[] = [
  ...DIGNITY_SPECS.flatMap((dignity) =>
    CATEGORY_SPECS.map((category) => buildDignityRule(dignity, category)),
  ),
  ...STATE_SPECS.flatMap((state) => state.categories.map((category) => buildStateRule(state, category))),
];
