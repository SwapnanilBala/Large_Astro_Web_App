/**
 * Career rules. Ports rule-engine.ts:543-583.
 */

import type { RuleDefinitionInput } from "@/lib/rules/schema";

export const CAREER_RULES: RuleDefinitionInput[] = [
  // -------------------------------------------------------------------------
  {
    id: "career.tenth_house_axis",
    tier: "foundation",
    category: "career",
    priority: "high",
    instance_key: "career.tenth_house_axis:{$h10.sign}",
    for_each: null,

    bind: {
      h10: { from: "house", number: 10 },
      lord10: { from: "house_lord", house: 10 },
    },

    when: { op: "always" },

    // Fires for every chart, so the raw id would have fire_rate 1.0 and rarity 0.
    // Parameterising by sign gives twelve keys, each roughly 1/12.
    rarity_key: "career.tenth_house_axis.{$h10.sign}",

    strength: {
      base: 0.55,
      bonuses: [
        { when: { op: "gte", left: "$h10.occupant_count", value: 1 }, add: 0.15 },
        { when: { op: "dignity", planet: "$lord10", is: ["exalted", "own_sign"] }, add: 0.2 },
        { when: { op: "in", left: "$lord10.house", values: [1, 4, 7, 10] }, add: 0.1 },
        { when: { op: "in", left: "$lord10.house", values: [6, 8, 12] }, add: -0.1 },
      ],
    },

    display: {
      headline: "How your working life is built",
      body: "{@career_insights[$h10.sign]}",
      tension: [
        {
          when: { op: "in", left: "$lord10.house", values: [6, 8, 12] },
          text:
            "Recognition here tends to arrive later than the work does. Expect a stretch of unglamorous or " +
            "behind-the-scenes effort before the title catches up to the output, and be careful not to read " +
            "that lag as evidence you picked the wrong field.",
        },
        {
          when: { op: "dignity", planet: "$lord10", is: ["debilitated"] },
          text:
            "This part of life rewards structure and mentorship more than instinct. Systems you can repeat " +
            "will outperform bursts of effort, and the right manager will be worth more to you than the right role.",
        },
      ],
    },

    evidence: {
      technical_note:
        "10th house sign: {$h10.sign}. Lord {$lord10.name} placed in house {$lord10.house} in {$lord10.sign}.",
      claims: [
        { label: "10th house sign", path: "$h10.sign", kind: "placement" },
        { label: "10th lord", path: "$lord10.name", kind: "lordship" },
        {
          label: "10th lord placement",
          path: "$lord10.house",
          kind: "placement",
          format: "ordinal_house",
          detail: "The 6th, 8th and 12th are the houses of effort, disruption and loss.",
        },
        { label: "10th lord dignity", path: "$lord10.dignity", kind: "dignity", format: "dignity" },
        { label: "Occupants", path: "$h10.occupants", kind: "count", format: "list" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "career.tenth_house_activators",
    tier: "signature",
    category: "career",
    priority: "medium",
    instance_key: "career.tenth_house_activators:{$h10.occupants|slug}",
    for_each: null,

    bind: {
      h10: { from: "house", number: 10 },
    },

    when: { op: "gte", left: "$h10.occupant_count", value: 1 },
    rarity_key: "career.tenth_house_activators.{$h10.occupant_count}",

    strength: {
      base: 0.45,
      bonuses: [{ when: { op: "gte", left: "$h10.occupant_count", value: 2 }, add: 0.2 }],
    },

    display: {
      headline: "Your work is where people find you",
      body:
        "{$h10.occupants|list} sit directly in the part of your chart that governs profession and public " +
        "standing, which pushes their qualities straight into how you are seen at work. Careers with this " +
        "signature tend to be less separable from identity than most -- what you do and who you are keep " +
        "collapsing into the same answer.",
      tension: [],
    },

    evidence: {
      technical_note: "Planets in 10th house ({$h10.sign}): {$h10.occupants|list}.",
      claims: [
        { label: "10th house occupants", path: "$h10.occupants", kind: "count", format: "list" },
        { label: "10th house sign", path: "$h10.sign", kind: "placement" },
        { label: "Occupant count", path: "$h10.occupant_count", kind: "count" },
      ],
    },
  },
];
