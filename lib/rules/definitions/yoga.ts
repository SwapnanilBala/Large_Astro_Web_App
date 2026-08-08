/**
 * Classical combination patterns. Ports rule-engine.ts:711-778.
 *
 * The Sanskrit names stay in the technical tier. Display headlines describe
 * what the pattern does, because a client who has to look up "Budha-Aditya"
 * before the sentence means anything has been handed homework, not a reading.
 */

import type { RuleDefinitionInput } from "@/lib/rules/schema";

export const YOGA_RULES: RuleDefinitionInput[] = [
  // -------------------------------------------------------------------------
  {
    id: "yoga.budha_aditya",
    tier: "signature",
    category: "career",
    priority: "medium",
    instance_key: "yoga.budha_aditya:{$sun.house}",
    for_each: null,

    bind: {
      sun: { from: "planet", name: "Sun" },
      mercury: { from: "planet", name: "Mercury" },
    },

    when: { op: "sameHouse", a: "$sun", b: "$mercury" },
    rarity_key: "yoga.budha_aditya",

    strength: {
      base: 0.6,
      bonuses: [
        { when: { op: "in", left: "$sun.house", values: [1, 4, 7, 10] }, add: 0.15 },
        { when: { op: "dignity", planet: "$mercury", is: ["exalted", "own_sign"] }, add: 0.15 },
      ],
    },

    display: {
      headline: "Your thinking and your sense of self point the same way",
      body:
        "The planet governing your identity and the planet governing how you think sit in the same part of the " +
        "chart. In practice that sharpens the link between having an idea and being able to sell it -- you are " +
        "unusually good at making what you believe sound reasonable to other people, which is a real advantage " +
        "and occasionally a way of talking yourself past a bad decision.",
      tension: [],
    },

    evidence: {
      technical_note: "Sun and Mercury are both in house {$sun.house}.",
      claims: [
        { label: "Shared house", path: "$sun.house", kind: "placement", format: "ordinal_house" },
        { label: "Sun sign", path: "$sun.sign", kind: "placement" },
        { label: "Mercury sign", path: "$mercury.sign", kind: "placement" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "yoga.gaja_kesari",
    tier: "signature",
    category: "core",
    priority: "medium",
    instance_key: "yoga.gaja_kesari:{$jupiter.sign_distance_from.moon}",
    for_each: null,

    bind: {
      moon: { from: "planet", name: "Moon" },
      jupiter: { from: "planet", name: "Jupiter" },
    },

    when: { op: "signDistance", from: "$moon", to: "$jupiter", oneOf: [1, 4, 7, 10] },
    rarity_key: "yoga.gaja_kesari",

    strength: {
      base: 0.6,
      bonuses: [
        { when: { op: "dignity", planet: "$jupiter", is: ["exalted", "own_sign"] }, add: 0.2 },
        { when: { op: "in", left: "$jupiter.house", values: [1, 4, 7, 10] }, add: 0.1 },
      ],
    },

    display: {
      headline: "You get your perspective back faster than most people",
      body:
        "Jupiter holds one of the four strong angles from your Moon, a configuration classically read as " +
        "resilience. The practical version is recovery time: setbacks land on you as hard as on anyone, but " +
        "the interval between the bad thing happening and you being able to think clearly about it again is " +
        "shorter than average. Over a long enough run that compounds into something that looks like luck.",
      tension: [],
    },

    evidence: {
      technical_note:
        "Moon in {$moon.sign}; Jupiter in {$jupiter.sign} ({$jupiter.sign_distance_from.moon} houses from Moon).",
      claims: [
        { label: "Moon sign", path: "$moon.sign", kind: "placement" },
        { label: "Jupiter sign", path: "$jupiter.sign", kind: "placement" },
        {
          label: "Distance from Moon",
          path: "$jupiter.sign_distance_from.moon",
          kind: "aspect",
          detail: "Counted in whole signs, inclusive. The 1st, 4th, 7th and 10th are the angles.",
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "yoga.chandra_mangala",
    tier: "signature",
    category: "career",
    priority: "medium",
    instance_key: "yoga.chandra_mangala:{$moon.house}",
    for_each: null,

    bind: {
      moon: { from: "planet", name: "Moon" },
      mars: { from: "planet", name: "Mars" },
    },

    when: { op: "sameHouse", a: "$moon", b: "$mars" },
    rarity_key: "yoga.chandra_mangala",

    strength: {
      base: 0.55,
      bonuses: [
        { when: { op: "in", left: "$moon.house", values: [1, 4, 7, 10] }, add: 0.15 },
        { when: { op: "dignity", planet: "$mars", is: ["exalted", "own_sign"] }, add: 0.15 },
      ],
    },

    display: {
      headline: "Your feelings and your drive are wired together",
      body:
        "The planet that governs your emotional pacing shares a house with the one that governs appetite and " +
        "aggression. That coupling produces genuine force -- you can convert a mood into action faster than " +
        "most people, and this placement has a long-standing association with the ability to make money out of " +
        "that. It works well exactly to the degree that you have somewhere legitimate to point it.",
      tension: [
        {
          when: { op: "always" },
          text:
            "The same wiring runs in reverse. With no outlet, the drive turns inward as impatience and " +
            "disproportionate reactions, and the people closest to you will notice the pattern well before you do.",
        },
      ],
    },

    evidence: {
      technical_note: "Moon and Mars are both in house {$moon.house}.",
      claims: [
        { label: "Shared house", path: "$moon.house", kind: "placement", format: "ordinal_house" },
        { label: "Moon sign", path: "$moon.sign", kind: "placement" },
        { label: "Mars sign", path: "$mars.sign", kind: "placement" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "yoga.fortune_house",
    tier: "signature",
    category: "core",
    priority: "low",
    instance_key: "yoga.fortune_house:{$h9.occupants|slug}",
    for_each: null,

    bind: {
      h9: { from: "house", number: 9 },
    },

    when: { op: "gte", left: "$h9.occupant_count", value: 1 },
    rarity_key: "yoga.fortune_house.{$h9.occupant_count}",

    strength: {
      base: 0.35,
      bonuses: [{ when: { op: "gte", left: "$h9.occupant_count", value: 2 }, add: 0.2 }],
    },

    display: {
      headline: "Teachers and beliefs carry more weight for you than average",
      body:
        "The part of your chart dealing with belief, higher learning and long-range good fortune is occupied " +
        "rather than empty. Charts like this tend to have identifiable turning points attached to a particular " +
        "teacher, a particular book, or a period abroad -- influence arriving from outside your existing world " +
        "rather than from inside it.",
      tension: [],
    },

    evidence: {
      technical_note: "9th house in {$h9.sign} with {$h9.occupants|list}.",
      claims: [
        { label: "9th house sign", path: "$h9.sign", kind: "placement" },
        { label: "9th house occupants", path: "$h9.occupants", kind: "count", format: "list" },
      ],
    },
  },
];
