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

  // -------------------------------------------------------------------------
  {
    id: "career.tenth_lord_gains",
    tier: "signature",
    category: "career",
    priority: "medium",
    instance_key: "career.tenth_lord_gains:{$lord10.name}",
    for_each: null,

    bind: {
      h10: { from: "house", number: 10 },
      lord10: { from: "house_lord", house: 10 },
    },

    // The 10th lord in the 11th, the house of gains: output converted into
    // income and allies. An upachaya, so it compounds rather than arriving at
    // once. About one chart in twelve.
    when: { op: "eq", left: "$lord10.house", right: 11 },
    rarity_key: "career.tenth_lord_gains",

    strength: {
      base: 0.6,
      bonuses: [
        { when: { op: "dignity", planet: "$lord10", is: ["exalted", "own_sign"] }, add: 0.2 },
        { when: { op: "dignity", planet: "$lord10", is: ["debilitated"] }, add: -0.1 },
      ],
    },

    display: {
      headline: "Your work tends to turn into income and allies",
      body:
        "The planet that runs your working life sits in the part of the chart that governs gains, networks and " +
        "the people who open doors. Classically that is one of the most rewarding places for it: effort gets " +
        "converted into something you can keep. In practice careers like this grow through connections, side " +
        "projects that become the main thing, and a reputation that travels ahead of you -- slowly at first, " +
        "then faster.",
      tension: [
        {
          when: { op: "dignity", planet: "$lord10", is: ["debilitated"] },
          text:
            "The planet carrying this is in its weakest sign, so the network matters more than usual and needs " +
            "choosing carefully: the wrong allies will cost you more here than the wrong role.",
        },
      ],
    },

    evidence: {
      technical_note: "10th lord {$lord10.name} placed in the 11th house ({$lord10.sign}), an upachaya.",
      claims: [
        { label: "10th house sign", path: "$h10.sign", kind: "placement" },
        { label: "10th lord", path: "$lord10.name", kind: "lordship" },
        { label: "10th lord sign", path: "$lord10.sign", kind: "placement" },
        { label: "10th lord dignity", path: "$lord10.dignity", kind: "dignity", format: "dignity" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "career.competitive_edge",
    tier: "signature",
    category: "career",
    priority: "medium",
    instance_key: "career.competitive_edge:{$h6.occupants|slug}",
    for_each: null,

    bind: {
      h6: { from: "house", number: 6 },
      sun: { from: "planet", name: "Sun" },
      mars: { from: "planet", name: "Mars" },
      saturn: { from: "planet", name: "Saturn" },
      rahu: { from: "planet", name: "Rahu" },
      ketu: { from: "planet", name: "Ketu" },
    },

    // A natural malefic in the 6th -- rivals, service, the daily grind -- one
    // of the few houses where classical texts want the hard planets. It is an
    // upachaya too, so the edge sharpens with age. Roughly a third of charts.
    when: {
      op: "any",
      of: [
        {
          op: "any",
          of: [
            { op: "eq", left: "$sun.house", right: 6 },
            { op: "eq", left: "$mars.house", right: 6 },
          ],
        },
        {
          op: "any",
          of: [
            { op: "eq", left: "$saturn.house", right: 6 },
            { op: "eq", left: "$rahu.house", right: 6 },
            { op: "eq", left: "$ketu.house", right: 6 },
          ],
        },
      ],
    },
    rarity_key: "career.competitive_edge",

    strength: {
      base: 0.5,
      bonuses: [
        { when: { op: "gte", left: "$h6.occupant_count", value: 2 }, add: 0.15 },
        { when: { op: "eq", left: "$mars.house", right: 6 }, add: 0.1 },
      ],
    },

    display: {
      headline: "You do your best work against a deadline or a rival",
      body:
        "One of the hard-edged planets sits in the part of your chart that governs competition, service and the " +
        "daily grind -- one of the few places classical astrology actually wants them. Pressure there sharpens " +
        "you rather than wearing you down: you tend to outlast competitors, take on the problems other people " +
        "walk away from, and get better at difficult work every year you do it. Work built on competition, " +
        "service, health, law or repair suits it well.",
      tension: [
        {
          when: { op: "always" },
          text:
            "The risk is needing an opponent to feel motivated. Without a rival or a crisis the same energy can " +
            "turn inward as restlessness, or go looking for a fight that was never necessary.",
        },
      ],
    },

    evidence: {
      technical_note:
        "6th house ({$h6.sign}) holds {$h6.occupants|list}: a natural malefic in a dusthana that is also an " +
        "upachaya.",
      claims: [
        { label: "6th house occupants", path: "$h6.occupants", kind: "count", format: "list" },
        { label: "6th house sign", path: "$h6.sign", kind: "placement" },
        { label: "Occupant count", path: "$h6.occupant_count", kind: "count" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "career.wealth_link",
    tier: "signature",
    category: "career",
    priority: "medium",
    instance_key: "career.wealth_link:{$lord2.name}:{$lord11.name}",
    for_each: null,

    bind: {
      lord2: { from: "house_lord", house: 2 },
      lord11: { from: "house_lord", house: 11 },
    },

    // The 2nd lord (what you keep) and the 11th lord (what comes in) together,
    // or each in the other's house: the core of the classical dhana
    // combinations. Leo and Aquarius rising hand both houses to one planet, a
    // different pattern, excluded rather than firing for a sixth of all charts.
    when: {
      op: "all",
      of: [
        { op: "neqPath", left: "$lord2.name", right: "$lord11.name" },
        {
          op: "any",
          of: [
            { op: "sameHouse", a: "$lord2", b: "$lord11" },
            { op: "eq", left: "$lord2.house", right: 11 },
            { op: "eq", left: "$lord11.house", right: 2 },
          ],
        },
      ],
    },
    rarity_key: "career.wealth_link",

    strength: {
      base: 0.6,
      bonuses: [
        { when: { op: "dignity", planet: "$lord2", is: ["exalted", "own_sign"] }, add: 0.15 },
        { when: { op: "dignity", planet: "$lord11", is: ["exalted", "own_sign"] }, add: 0.15 },
        { when: { op: "in", left: "$lord2.house", values: [6, 8, 12] }, add: -0.1 },
      ],
    },

    display: {
      headline: "What you earn has a way of staying with you",
      body:
        "The planet governing what comes in and the planet governing what you keep are linked in your chart -- " +
        "the basic shape of the classical combinations for wealth. It describes a talent rather than a promise: " +
        "money that arrives tends to be held, invested or put to work instead of passing straight through, and " +
        "the habits that build a cushion come more naturally to you than to most people.",
      tension: [
        {
          when: { op: "in", left: "$lord2.house", values: [6, 8, 12] },
          text:
            "The link runs through one of the harder houses, so it builds through effort, debt paid down or " +
            "shared resources rather than windfalls -- slower, but the kind that holds.",
        },
      ],
    },

    evidence: {
      technical_note:
        "2nd lord {$lord2.name} in house {$lord2.house} ({$lord2.sign}); 11th lord {$lord11.name} in house " +
        "{$lord11.house} ({$lord11.sign}): a 2nd-11th dhana sambandha.",
      claims: [
        { label: "2nd lord", path: "$lord2.name", kind: "lordship" },
        { label: "2nd lord placement", path: "$lord2.house", kind: "placement", format: "ordinal_house" },
        { label: "11th lord", path: "$lord11.name", kind: "lordship" },
        { label: "11th lord placement", path: "$lord11.house", kind: "placement", format: "ordinal_house" },
      ],
    },
  },
];
