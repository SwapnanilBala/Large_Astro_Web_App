/**
 * Multi-clause combination rules.
 *
 * These are the rules the migration exists to make possible: patterns that only
 * mean something when three or four independent parts of a chart agree. They
 * did not exist in the legacy engine, so they are the only rules whose output
 * has no pre-migration counterpart.
 *
 * Each carries an expected fire rate in a comment. Anything below roughly
 * 1-in-2000 needs a sample large enough to measure it; the loader marks a rule
 * `low_confidence` and drops its rarity label to non-numeric language when the
 * observed count is under 30, so a thin tail degrades honestly rather than
 * shipping a confident number nobody measured.
 */

import type { RuleDefinitionInput } from "@/lib/rules/schema";

export const COMBINATION_RULES: RuleDefinitionInput[] = [
  // -------------------------------------------------------------------------
  {
    id: "combo.pressured_authority",
    tier: "combination",
    category: "career",
    priority: "high",
    instance_key: "combo.pressured_authority:{$lord10.house}:{$saturn.house}",
    for_each: null,

    bind: {
      h10: { from: "house", number: 10 },
      lord10: { from: "house_lord", house: 10 },
      saturn: { from: "planet", name: "Saturn" },
      sun: { from: "planet", name: "Sun" },
    },

    // Four clauses. Independent estimates: 10th lord in a hard house ~0.25,
    // Saturn on an angle ~0.33, Sun not dignified ~0.83, empty 10th ~0.45
    // => roughly 3%.
    when: {
      op: "all",
      of: [
        { op: "in", left: "$lord10.house", values: [6, 8, 12] },
        { op: "in", left: "$saturn.house", values: [1, 4, 7, 10] },
        { op: "dignity", planet: "$sun", is: ["debilitated", "neutral"] },
        { op: "lte", left: "$h10.occupant_count", value: 0 },
      ],
    },

    rarity_key: "combo.pressured_authority",

    strength: {
      base: 0.7,
      bonuses: [
        { when: { op: "dignity", planet: "$saturn", is: ["exalted", "own_sign"] }, add: 0.2 },
        { when: { op: "dignity", planet: "$sun", is: ["debilitated"] }, add: 0.1 },
      ],
    },

    display: {
      headline: "You earn authority the long way",
      body:
        "Three separate parts of this chart point the same direction: responsibility arrives before the title " +
        "does. You are likely to be handed the weight of a role well before the recognition, the pay, or the " +
        "formal say-so catches up. That is not a penalty -- it is how this particular chart converts effort " +
        "into standing. The people who do best with this pattern stop waiting to be named and start operating " +
        "as if they already were.",
      tension: [
        {
          when: { op: "always" },
          text:
            "The cost is real: this pattern burns people who keep score. If you need the credit to arrive on " +
            "schedule, this shape of career will read as unfair long before it reads as an advantage.",
        },
      ],
    },

    evidence: {
      technical_note:
        "10th lord {$lord10.name} in house {$lord10.house} (dusthana). Saturn in house {$saturn.house} " +
        "(kendra). Sun {$sun.dignity|dignity} in {$sun.sign}. 10th house in {$h10.sign} unoccupied.",
      claims: [
        {
          label: "10th lord placement",
          path: "$lord10.house",
          kind: "placement",
          format: "ordinal_house",
          detail: "The 6th, 8th and 12th are the houses of effort, disruption and loss.",
        },
        { label: "Saturn placement", path: "$saturn.house", kind: "placement", format: "ordinal_house" },
        { label: "Sun dignity", path: "$sun.dignity", kind: "dignity", format: "dignity" },
        { label: "10th house occupants", path: "$h10.occupants", kind: "count", format: "list" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "combo.late_partnership",
    tier: "combination",
    category: "love",
    priority: "high",
    instance_key: "combo.late_partnership:{$lord7.house}:{$venus.house}",
    for_each: null,

    bind: {
      h7: { from: "house", number: 7 },
      lord7: { from: "house_lord", house: 7 },
      venus: { from: "planet", name: "Venus" },
      saturn: { from: "planet", name: "Saturn" },
    },

    // 7th lord in a hard house ~0.25, empty 7th ~0.45, Venus undignified ~0.79,
    // Saturn touching the partnership axis ~0.17 => roughly 1.5%.
    when: {
      op: "all",
      of: [
        { op: "in", left: "$lord7.house", values: [6, 8, 12] },
        { op: "lte", left: "$h7.occupant_count", value: 0 },
        { op: "dignity", planet: "$venus", is: ["debilitated", "neutral"] },
        { op: "in", left: "$saturn.house", values: [1, 7] },
      ],
    },

    rarity_key: "combo.late_partnership",

    strength: {
      base: 0.68,
      bonuses: [
        { when: { op: "dignity", planet: "$venus", is: ["debilitated"] }, add: 0.15 },
        { when: { op: "eq", left: "$saturn.house", right: 7 }, add: 0.15 },
      ],
    },

    display: {
      headline: "Partnership arrives on a slower clock than you would like",
      body:
        "Four separate signals agree here, which is why this one is worth taking seriously rather than reading " +
        "as a warning. The pattern is not absence of partnership -- it is delay, and specifically delay that " +
        "resolves. Relationships formed early tend to be the expensive lessons; the durable one usually turns " +
        "up after you have stopped auditioning for it, and it tends to be built on shared work rather than " +
        "on chemistry alone.",
      tension: [
        {
          when: { op: "always" },
          text:
            "The trap is treating the delay as a verdict on you. People with this pattern tend to either " +
            "settle early to end the waiting, or decide the whole area is closed and stop showing up for it. " +
            "Both convert a timing problem into a permanent one.",
        },
      ],
    },

    evidence: {
      technical_note:
        "7th lord {$lord7.name} in house {$lord7.house} (dusthana). 7th house in {$h7.sign} unoccupied. " +
        "Venus {$venus.dignity|dignity} in {$venus.sign}. Saturn in house {$saturn.house}.",
      claims: [
        { label: "7th lord placement", path: "$lord7.house", kind: "placement", format: "ordinal_house" },
        { label: "7th house occupants", path: "$h7.occupants", kind: "count", format: "list" },
        { label: "Venus dignity", path: "$venus.dignity", kind: "dignity", format: "dignity" },
        {
          label: "Saturn placement",
          path: "$saturn.house",
          kind: "placement",
          format: "ordinal_house",
          detail: "Saturn on the 1st/7th axis is the classical signature for delay in partnership.",
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "combo.steady_partnership",
    tier: "combination",
    category: "love",
    priority: "high",
    instance_key: "combo.steady_partnership:{$lord7.house}:{$jupiter.house}",
    for_each: null,

    bind: {
      h7: { from: "house", number: 7 },
      lord7: { from: "house_lord", house: 7 },
      venus: { from: "planet", name: "Venus" },
      jupiter: { from: "planet", name: "Jupiter" },
      mars: { from: "planet", name: "Mars" },
      saturn: { from: "planet", name: "Saturn" },
      rahu: { from: "planet", name: "Rahu" },
      ketu: { from: "planet", name: "Ketu" },
    },

    // Four clauses, the mirror image of late_partnership. Independent
    // estimates: 7th lord on an angle or trine ~0.5, no natural malefic in the
    // 7th ~0.7, Jupiter in or aspecting the 7th ~0.33, Venus neither
    // debilitated nor combust ~0.75 => roughly 9%.
    when: {
      op: "all",
      of: [
        { op: "in", left: "$lord7.house", values: [1, 4, 5, 7, 9, 10] },
        {
          op: "all",
          of: [
            { op: "neq", left: "$mars.house", right: 7 },
            { op: "neq", left: "$saturn.house", right: 7 },
            { op: "neq", left: "$rahu.house", right: 7 },
            { op: "neq", left: "$ketu.house", right: 7 },
          ],
        },
        { op: "in", left: "$jupiter.house", values: [1, 3, 7, 11] },
        {
          op: "all",
          of: [
            { op: "not", of: { op: "dignity", planet: "$venus", is: ["debilitated"] } },
            { op: "eq", left: "$venus.is_combust", right: false },
          ],
        },
      ],
    },

    rarity_key: "combo.steady_partnership",

    strength: {
      base: 0.68,
      bonuses: [
        { when: { op: "dignity", planet: "$venus", is: ["exalted", "own_sign"] }, add: 0.15 },
        { when: { op: "eq", left: "$jupiter.house", right: 7 }, add: 0.1 },
      ],
    },

    display: {
      headline: "Partnership is one of the steadier parts of your chart",
      body:
        "Four separate signals agree here. The planet that governs your partnerships is well placed, none of the " +
        "harder planets sit in the partnership house, Jupiter's protective influence falls on it, and Venus is in " +
        "working order. None of that guarantees an easy relationship. What it describes is good ground: you tend " +
        "to choose people you can build something with, conflict is more repairable than average, and a " +
        "commitment, once made, is one of the things in your life most likely to hold.",
      tension: [
        {
          when: { op: "always" },
          text:
            "The risk with good ground is taking it for granted. The pattern gives you a better than average " +
            "starting point, and it still needs the ordinary maintenance every relationship does.",
        },
      ],
    },

    evidence: {
      technical_note:
        "7th lord {$lord7.name} in house {$lord7.house} (kendra or trikona). No natural malefic in the 7th " +
        "({$h7.sign}). Jupiter in house {$jupiter.house}, in or aspecting the 7th. Venus " +
        "{$venus.dignity|dignity} in {$venus.sign}, not combust.",
      claims: [
        { label: "7th lord placement", path: "$lord7.house", kind: "placement", format: "ordinal_house" },
        { label: "7th house occupants", path: "$h7.occupants", kind: "count", format: "list" },
        {
          label: "Jupiter placement",
          path: "$jupiter.house",
          kind: "placement",
          format: "ordinal_house",
          detail: "Jupiter reaches the 7th from the 1st, 3rd, 7th and 11th houses.",
        },
        { label: "Venus dignity", path: "$venus.dignity", kind: "dignity", format: "dignity" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "combo.compounding_career",
    tier: "combination",
    category: "career",
    priority: "high",
    instance_key: "combo.compounding_career:{$saturn.house}:{$mars.house}",
    for_each: null,

    bind: {
      ruler: { from: "ascendant_lord" },
      lord10: { from: "house_lord", house: 10 },
      mars: { from: "planet", name: "Mars" },
      saturn: { from: "planet", name: "Saturn" },
    },

    // Four clauses. Independent estimates: Saturn in an upachaya ~0.33, Mars
    // in an upachaya ~0.33, 10th lord on an angle or in the 11th ~0.42, chart
    // ruler outside the 6th/8th/12th ~0.75 => roughly 3.5%.
    when: {
      op: "all",
      of: [
        { op: "in", left: "$saturn.house", values: [3, 6, 10, 11] },
        { op: "in", left: "$mars.house", values: [3, 6, 10, 11] },
        { op: "in", left: "$lord10.house", values: [1, 4, 7, 10, 11] },
        { op: "notIn", left: "$ruler.house", values: [6, 8, 12] },
      ],
    },

    rarity_key: "combo.compounding_career",

    strength: {
      base: 0.7,
      bonuses: [
        { when: { op: "dignity", planet: "$saturn", is: ["exalted", "own_sign"] }, add: 0.15 },
        { when: { op: "dignity", planet: "$mars", is: ["exalted", "own_sign"] }, add: 0.1 },
      ],
    },

    display: {
      headline: "Your career gets stronger with every decade",
      body:
        "Several separate parts of this chart agree. The two planets classically tied to effort and pressure -- " +
        "Saturn and Mars -- both sit in the chart's growth houses, the positions where hard planets improve with " +
        "age instead of wearing you down. The planet that runs your working life is on firm ground, and the " +
        "planet that runs your chart as a whole is not undermined. The shape this produces is slow early and " +
        "compounding later: competition, deadlines and difficulty tend to feed the rise rather than stall it.",
      tension: [
        {
          when: { op: "always" },
          text:
            "The early years can feel like pushing uphill while other people coast. That is the pattern working " +
            "as described, not a sign you are in the wrong place -- the gap usually closes, and then reverses.",
        },
      ],
    },

    evidence: {
      technical_note:
        "Saturn in house {$saturn.house} and Mars in house {$mars.house}, both upachaya. 10th lord " +
        "{$lord10.name} in house {$lord10.house}. Chart ruler {$ruler.name} in house {$ruler.house}, outside " +
        "the dusthanas.",
      claims: [
        {
          label: "Saturn placement",
          path: "$saturn.house",
          kind: "placement",
          format: "ordinal_house",
          detail: "The 3rd, 6th, 10th and 11th are the growth (upachaya) houses.",
        },
        { label: "Mars placement", path: "$mars.house", kind: "placement", format: "ordinal_house" },
        { label: "10th lord placement", path: "$lord10.house", kind: "placement", format: "ordinal_house" },
        { label: "Chart ruler placement", path: "$ruler.house", kind: "placement", format: "ordinal_house" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "combo.strong_foundation",
    tier: "combination",
    category: "core",
    priority: "high",
    instance_key: "combo.strong_foundation:{$ruler.name}:{$ruler.house}",
    for_each: null,

    bind: {
      asc: { from: "ascendant" },
      ruler: { from: "ascendant_lord" },
      jupiter: { from: "planet", name: "Jupiter" },
      mars: { from: "planet", name: "Mars" },
      saturn: { from: "planet", name: "Saturn" },
      rahu: { from: "planet", name: "Rahu" },
      ketu: { from: "planet", name: "Ketu" },
    },

    // Four clauses: a classically strong lagna. Independent estimates: chart
    // ruler dignified ~0.2, on an angle or trine ~0.5, Jupiter in or aspecting
    // the 1st ~0.33, no natural malefic in the 1st ~0.7 => roughly 2%, before
    // the first two correlate (a ruler in its own sign often sits in the 1st).
    // Mars or Saturn in the 1st is allowed when it is the ruler itself -- a
    // dignified ruler rising is the strong lagna, not an affliction of it.
    when: {
      op: "all",
      of: [
        { op: "dignity", planet: "$ruler", is: ["exalted", "own_sign"] },
        { op: "in", left: "$ruler.house", values: [1, 4, 5, 7, 9, 10] },
        { op: "in", left: "$jupiter.house", values: [1, 5, 7, 9] },
        {
          op: "all",
          of: [
            {
              op: "any",
              of: [
                { op: "neq", left: "$mars.house", right: 1 },
                { op: "eq", left: "$ruler.name", right: "Mars" },
              ],
            },
            {
              op: "any",
              of: [
                { op: "neq", left: "$saturn.house", right: 1 },
                { op: "eq", left: "$ruler.name", right: "Saturn" },
              ],
            },
            { op: "neq", left: "$rahu.house", right: 1 },
            { op: "neq", left: "$ketu.house", right: 1 },
          ],
        },
      ],
    },

    rarity_key: "combo.strong_foundation",

    strength: {
      base: 0.7,
      bonuses: [
        { when: { op: "dignity", planet: "$ruler", is: ["exalted"] }, add: 0.1 },
        { when: { op: "eq", left: "$jupiter.house", right: 1 }, add: 0.1 },
      ],
    },

    display: {
      headline: "You have a stronger base to work from than most people",
      body:
        "Four separate signals agree that the part of your chart describing you is well supported. The planet " +
        "that runs your chart is in one of its best signs and well placed, Jupiter's protective influence falls " +
        "directly on you, and none of the harder planets sit on your ascendant to complicate it. Classically " +
        "this is read as vitality, confidence and the capacity to recover. In practice it tends to mean you " +
        "know roughly who you are, you bounce back from setbacks faster than you expect to, and people find " +
        "you easier to trust than you realise.",
      tension: [
        {
          when: { op: "always" },
          text:
            "The risk of a strong base is impatience with people who do not have one. What comes easily to you " +
            "here is genuinely hard for others, which is worth remembering before offering advice.",
        },
      ],
    },

    evidence: {
      technical_note:
        "Chart ruler {$ruler.name} {$ruler.dignity|dignity} in {$ruler.sign}, house {$ruler.house}. Jupiter in " +
        "house {$jupiter.house}, in or aspecting the lagna ({$asc.sign}). No natural malefic but the ruler in " +
        "the 1st.",
      claims: [
        { label: "Chart ruler", path: "$ruler.name", kind: "lordship" },
        { label: "Ruler dignity", path: "$ruler.dignity", kind: "dignity", format: "dignity" },
        { label: "Ruler placement", path: "$ruler.house", kind: "placement", format: "ordinal_house" },
        { label: "Jupiter placement", path: "$jupiter.house", kind: "placement", format: "ordinal_house" },
      ],
    },
  },
];
