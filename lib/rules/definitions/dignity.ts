/**
 * Dignity rules.
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

export const DIGNITY_RULES: RuleDefinitionInput[] = DIGNITY_SPECS.flatMap((dignity) =>
  CATEGORY_SPECS.map((category) => buildDignityRule(dignity, category)),
);
