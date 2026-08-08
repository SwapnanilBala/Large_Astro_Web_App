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
];
