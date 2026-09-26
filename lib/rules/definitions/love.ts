/**
 * Love and partnership rules. Ports rule-engine.ts:589-651.
 */

import type { RuleDefinitionInput } from "@/lib/rules/schema";

export const LOVE_RULES: RuleDefinitionInput[] = [
  // -------------------------------------------------------------------------
  {
    id: "love.seventh_house_axis",
    tier: "foundation",
    category: "love",
    priority: "high",
    instance_key: "love.seventh_house_axis:{$h7.sign}",
    for_each: null,

    bind: {
      h7: { from: "house", number: 7 },
      lord7: { from: "house_lord", house: 7 },
    },

    when: { op: "always" },
    rarity_key: "love.seventh_house_axis.{$h7.sign}",

    strength: {
      base: 0.55,
      bonuses: [
        { when: { op: "gte", left: "$h7.occupant_count", value: 1 }, add: 0.15 },
        { when: { op: "dignity", planet: "$lord7", is: ["exalted", "own_sign"] }, add: 0.2 },
        { when: { op: "in", left: "$lord7.house", values: [6, 8, 12] }, add: -0.1 },
      ],
    },

    display: {
      headline: "What you are actually looking for in a partner",
      body: "{@love_insights[$h7.sign]}",
      tension: [
        {
          when: { op: "in", left: "$lord7.house", values: [6, 8, 12] },
          text:
            "Partnership here asks for maturity before it offers chemistry. There is usually a stretch of " +
            "learning about pacing, trust or unequal effort first -- often through one relationship that " +
            "teaches the lesson expensively -- before things settle.",
        },
      ],
    },

    evidence: {
      technical_note: "7th house sign: {$h7.sign}. Lord {$lord7.name} in house {$lord7.house} ({$lord7.sign}).",
      claims: [
        { label: "7th house sign", path: "$h7.sign", kind: "placement" },
        { label: "7th lord", path: "$lord7.name", kind: "lordship" },
        { label: "7th lord placement", path: "$lord7.house", kind: "placement", format: "ordinal_house" },
        { label: "7th lord dignity", path: "$lord7.dignity", kind: "dignity", format: "dignity" },
        { label: "Occupants", path: "$h7.occupants", kind: "count", format: "list" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "love.venus_expression",
    tier: "signature",
    category: "love",
    priority: "medium",
    instance_key: "love.venus_expression:{$venus.sign}:{$venus.house}",
    for_each: null,

    bind: {
      venus: { from: "planet", name: "Venus" },
      h7: { from: "house", number: 7 },
    },

    when: { op: "always" },
    rarity_key: "love.venus_expression.{$venus.sign}",

    strength: {
      base: 0.45,
      bonuses: [
        { when: { op: "dignity", planet: "$venus", is: ["exalted", "own_sign"] }, add: 0.2 },
        { when: { op: "dignity", planet: "$venus", is: ["debilitated"] }, add: 0.1 },
      ],
    },

    display: {
      headline: "How you show affection, as opposed to how you feel it",
      body:
        "Venus is the part of a chart that governs attraction and how care actually gets expressed. In " +
        "{$venus.sign} it runs through {$venus.element|lower} habits, which shapes what reads as love when you " +
        "give it -- and, more usefully, explains why affection you offered sincerely has sometimes not landed " +
        "as affection at all.",
      tension: [
        {
          when: { op: "neqPath", left: "$venus.element", right: "$h7.element" },
          text:
            "How you express desire and what you want from commitment are made of different material -- " +
            "{$venus.element|lower} against {$h7.element|lower}. Left unexamined this shows up as choosing " +
            "people you are drawn to over people you would actually be well matched with.",
        },
      ],
    },

    evidence: {
      technical_note: "Venus at {$venus.degree_in_sign|degrees} deg in {$venus.sign}, house {$venus.house}.",
      claims: [
        { label: "Venus sign", path: "$venus.sign", kind: "placement" },
        { label: "Venus house", path: "$venus.house", kind: "placement", format: "ordinal_house" },
        { label: "Venus dignity", path: "$venus.dignity", kind: "dignity", format: "dignity" },
        { label: "Venus degree", path: "$venus.degree_in_sign", kind: "measurement", format: "degrees" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "love.fifth_house_activators",
    tier: "signature",
    category: "love",
    priority: "medium",
    instance_key: "love.fifth_house_activators:{$h5.occupants|slug}",
    for_each: null,

    bind: {
      h5: { from: "house", number: 5 },
    },

    when: { op: "gte", left: "$h5.occupant_count", value: 1 },
    rarity_key: "love.fifth_house_activators.{$h5.occupant_count}",

    strength: {
      base: 0.4,
      bonuses: [{ when: { op: "gte", left: "$h5.occupant_count", value: 2 }, add: 0.2 }],
    },

    display: {
      headline: "Romance and creativity run on the same circuit",
      body:
        "{$h5.occupants|list} occupy the part of your chart that handles play, romance and creative output. " +
        "These tend to move together for you: periods where you are making something are usually periods where " +
        "you are more open to being pursued, and creative droughts and romantic ones often arrive in the same month.",
      tension: [],
    },

    evidence: {
      technical_note: "5th house in {$h5.sign} with {$h5.occupants|list}.",
      claims: [
        { label: "5th house sign", path: "$h5.sign", kind: "placement" },
        { label: "5th house occupants", path: "$h5.occupants", kind: "count", format: "list" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "love.mars_partnership_heat",
    tier: "signature",
    category: "love",
    priority: "medium",
    instance_key: "love.mars_partnership_heat:{$mars.house}",
    for_each: null,

    bind: {
      mars: { from: "planet", name: "Mars" },
    },

    // Kuja (Mangal) dosha counted from the lagna: Mars in the 1st, 2nd, 4th,
    // 7th, 8th or 12th, half of all charts before any cancellation. Mars in its
    // own signs or exalted is the cancellation every classical school accepts,
    // so that case does not fire.
    when: {
      op: "all",
      of: [
        { op: "in", left: "$mars.house", values: [1, 2, 4, 7, 8, 12] },
        { op: "not", of: { op: "dignity", planet: "$mars", is: ["exalted", "own_sign"] } },
      ],
    },
    rarity_key: "love.mars_partnership_heat",

    strength: {
      base: 0.45,
      bonuses: [
        { when: { op: "in", left: "$mars.house", values: [7, 8] }, add: 0.2 },
        { when: { op: "dignity", planet: "$mars", is: ["debilitated"] }, add: 0.1 },
      ],
    },

    display: {
      headline: "Passion in your relationships needs a steering wheel",
      body:
        "Mars -- drive, desire and the appetite for conflict -- sits in one of the six positions the Indian " +
        "matchmaking tradition watches most closely for intensity in partnership. It shows up in a large share of " +
        "charts, which is the first thing worth knowing about it: it describes a temperament, not a fate. In " +
        "practice it adds heat and speed to relationships -- attraction to intensity, quick flare-ups, a strong " +
        "need for directness -- and it goes best with a partner who has comparable fire, or who is not rattled " +
        "by yours.",
      tension: [
        {
          when: { op: "in", left: "$mars.house", values: [7, 8] },
          text:
            "Here Mars sits right on the partnership axis, so arguments can escalate faster than you mean them " +
            "to. The skill that pays off most is a pause: the hard thing said an hour later lands better than " +
            "the same thing said now.",
        },
      ],
    },

    evidence: {
      technical_note:
        "Mars in house {$mars.house} ({$mars.sign}, {$mars.dignity|dignity}): kuja dosha from the lagna, not " +
        "cancelled by own sign or exaltation.",
      claims: [
        { label: "Mars's house", path: "$mars.house", kind: "placement", format: "ordinal_house" },
        { label: "Mars's sign", path: "$mars.sign", kind: "placement" },
        { label: "Mars's dignity", path: "$mars.dignity", kind: "dignity", format: "dignity" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "love.jupiter_guards_partnership",
    tier: "signature",
    category: "love",
    priority: "medium",
    instance_key: "love.jupiter_guards_partnership:{$jupiter.house}",
    for_each: null,

    bind: {
      h7: { from: "house", number: 7 },
      jupiter: { from: "planet", name: "Jupiter" },
    },

    // Jupiter in the 7th, or aspecting it: its 7th from the 1st, its 5th from
    // the 3rd, its 9th from the 11th. About a third of charts.
    when: { op: "in", left: "$jupiter.house", values: [1, 3, 7, 11] },
    rarity_key: "love.jupiter_guards_partnership",

    strength: {
      base: 0.55,
      bonuses: [
        { when: { op: "eq", left: "$jupiter.house", right: 7 }, add: 0.15 },
        { when: { op: "dignity", planet: "$jupiter", is: ["exalted", "own_sign"] }, add: 0.15 },
        { when: { op: "dignity", planet: "$jupiter", is: ["debilitated"] }, add: -0.1 },
      ],
    },

    display: {
      headline: "Your relationships come with a safety net",
      body:
        "Jupiter -- the planet classically read as protection and good judgement -- falls on the part of your " +
        "chart that governs committed partnership. It tends to draw partners with some maturity or principle to " +
        "them, and to make conflict more repairable than it feels in the moment: arguments end in a conversation " +
        "more often than in a closed door. It is not a promise of an easy relationship. It is a better than " +
        "average floor under one.",
      tension: [
        {
          when: { op: "eq", left: "$jupiter.house", right: 7 },
          text:
            "With Jupiter sitting in the partnership house itself, the thing to watch is expecting too much of the " +
            "other person -- a teacher, a rescuer, a moral compass. The relationships that last are the ones where " +
            "neither of you has to be that all the time.",
        },
      ],
    },

    evidence: {
      technical_note:
        "Jupiter in house {$jupiter.house} ({$jupiter.sign}): in the 7th, or aspecting it by its 5th, 7th or 9th " +
        "drishti. 7th house in {$h7.sign}.",
      claims: [
        { label: "Jupiter's house", path: "$jupiter.house", kind: "placement", format: "ordinal_house" },
        { label: "Jupiter's sign", path: "$jupiter.sign", kind: "placement" },
        { label: "7th house sign", path: "$h7.sign", kind: "placement" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "love.romance_to_commitment",
    tier: "signature",
    category: "love",
    priority: "medium",
    instance_key: "love.romance_to_commitment:{$lord5.name}:{$lord7.name}",
    for_each: null,

    bind: {
      lord5: { from: "house_lord", house: 5 },
      lord7: { from: "house_lord", house: 7 },
    },

    // The 5th lord (romance) and 7th lord (partnership) together, or each in
    // the other's house: the most cited signature of love leading to marriage.
    // No planet rules two signs this far apart, so there is no rising sign for
    // which one planet carries both and the rule fires by default.
    when: {
      op: "any",
      of: [
        { op: "sameHouse", a: "$lord5", b: "$lord7" },
        { op: "eq", left: "$lord5.house", right: 7 },
        { op: "eq", left: "$lord7.house", right: 5 },
      ],
    },
    rarity_key: "love.romance_to_commitment",

    strength: {
      base: 0.6,
      bonuses: [
        { when: { op: "sameHouse", a: "$lord5", b: "$lord7" }, add: 0.15 },
        { when: { op: "dignity", planet: "$lord7", is: ["exalted", "own_sign"] }, add: 0.1 },
      ],
    },

    display: {
      headline: "Romance tends to turn into commitment for you",
      body:
        "The planet in charge of romance and the planet in charge of committed partnership are linked in your " +
        "chart. The classical reading is love leading to marriage rather than an arrangement, and the practical " +
        "version is that you rarely keep the two apart: attraction becomes a question about the future quickly, " +
        "and the relationships that matter most tend to start as a spark rather than as a sensible match.",
      tension: [],
    },

    evidence: {
      technical_note:
        "5th lord {$lord5.name} in house {$lord5.house}; 7th lord {$lord7.name} in house {$lord7.house}: a " +
        "5th-7th sambandha.",
      claims: [
        { label: "5th lord", path: "$lord5.name", kind: "lordship" },
        { label: "5th lord placement", path: "$lord5.house", kind: "placement", format: "ordinal_house" },
        { label: "7th lord", path: "$lord7.name", kind: "lordship" },
        { label: "7th lord placement", path: "$lord7.house", kind: "placement", format: "ordinal_house" },
      ],
    },
  },
];
