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
];
