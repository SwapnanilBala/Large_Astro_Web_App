/**
 * Core-path rules.
 *
 * Declaration order here is the emission order of the first block of
 * `generateRules()`, and `core.lagna_signature` must stay first -- both the
 * desktop hero and rule-engine.test.ts read `rules[0]`.
 *
 * Every `evidence.technical_note` reproduces the legacy `basis` string
 * byte-for-byte, with one deliberate exception: `core.dominant_element` used to
 * emit a raw `JSON.stringify` of the element tally. That dump is deleted; the
 * distribution is now an EvidenceClaim with a formatted value.
 */

import type { RuleDefinitionInput } from "@/lib/rules/schema";

export const CORE_RULES: RuleDefinitionInput[] = [
  // -------------------------------------------------------------------------
  {
    id: "core.lagna_signature",
    tier: "foundation",
    category: "core",
    priority: "high",
    instance_key: "core.lagna_signature:{$asc.sign}",
    for_each: null,

    bind: {
      asc: { from: "ascendant" },
    },

    when: { op: "always" },

    // Fires for every chart, so the bare id would have fire_rate 1.0 and rarity
    // 0. Parameterising by sign gives twelve keys, each roughly 1/12.
    rarity_key: "core.lagna_signature.{$asc.sign}",

    strength: {
      base: 0.6,
      bonuses: [],
    },

    display: {
      headline: "How you come across before you say anything",
      body: "{@ascendant_insights[$asc.sign]}",
      tension: [],
    },

    evidence: {
      technical_note: "Ascendant computed in {$asc.sign}.",
      claims: [
        { label: "Rising sign", path: "$asc.sign", kind: "placement" },
        { label: "Ruling planet", path: "$asc.lord", kind: "lordship" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "core.solar_identity",
    tier: "foundation",
    category: "core",
    priority: "high",
    instance_key: "core.solar_identity:{$sun.sign}",
    for_each: null,

    bind: {
      sun: { from: "planet", name: "Sun" },
      moon: { from: "planet", name: "Moon" },
    },

    when: { op: "always" },
    rarity_key: "core.solar_identity.{$sun.sign}",

    strength: {
      base: 0.55,
      bonuses: [{ when: { op: "dignity", planet: "$sun", is: ["exalted", "own_sign"] }, add: 0.15 }],
    },

    display: {
      headline: "What you are actually driving at",
      body: "{@sun_sign_insights[$sun.sign]}",
      tension: [
        {
          when: { op: "neqPath", left: "$sun.element", right: "$moon.element" },
          text:
            "What motivates you and what settles you are not made of the same material. Your drive runs " +
            "{$sun.element|lower} while your emotional pacing runs {$moon.element|lower}, so the version of you " +
            "that sets the goal and the version that has to live through it will not always want the same week.",
        },
      ],
    },

    evidence: {
      technical_note: "Sun sign placement: {$sun.sign} ({$sun.degree_in_sign|degrees} deg).",
      claims: [
        { label: "Sun sign", path: "$sun.sign", kind: "placement" },
        { label: "Sun house", path: "$sun.house", kind: "placement", format: "ordinal_house" },
        { label: "Sun dignity", path: "$sun.dignity", kind: "dignity", format: "dignity" },
        { label: "Sun degree", path: "$sun.degree_in_sign", kind: "measurement", format: "degrees" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "core.lunar_mindset",
    tier: "foundation",
    category: "core",
    priority: "high",
    instance_key: "core.lunar_mindset:{$moon.sign}",
    for_each: null,

    bind: {
      sun: { from: "planet", name: "Sun" },
      moon: { from: "planet", name: "Moon" },
    },

    when: { op: "always" },
    rarity_key: "core.lunar_mindset.{$moon.sign}",

    strength: {
      base: 0.55,
      bonuses: [{ when: { op: "dignity", planet: "$moon", is: ["exalted", "own_sign"] }, add: 0.15 }],
    },

    display: {
      headline: "How you settle yourself",
      body: "{@moon_sign_insights[$moon.sign]}",
      tension: [
        {
          when: { op: "neqPath", left: "$sun.element", right: "$moon.element" },
          text:
            "What motivates you and what settles you are not made of the same material. Your drive runs " +
            "{$sun.element|lower} while your emotional pacing runs {$moon.element|lower}, so the version of you " +
            "that sets the goal and the version that has to live through it will not always want the same week.",
        },
      ],
    },

    evidence: {
      technical_note: "Moon sign placement: {$moon.sign} ({$moon.degree_in_sign|degrees} deg).",
      claims: [
        { label: "Moon sign", path: "$moon.sign", kind: "placement" },
        { label: "Moon house", path: "$moon.house", kind: "placement", format: "ordinal_house" },
        { label: "Moon dignity", path: "$moon.dignity", kind: "dignity", format: "dignity" },
        { label: "Moon degree", path: "$moon.degree_in_sign", kind: "measurement", format: "degrees" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "core.dominant_element",
    tier: "foundation",
    category: "core",
    priority: "medium",
    instance_key: "core.dominant_element:{$d.dominant_element}",
    for_each: null,

    bind: {
      d: { from: "derived" },
      venus: { from: "planet", name: "Venus" },
    },

    when: { op: "always" },
    rarity_key: "core.dominant_element.{$d.dominant_element}",

    strength: {
      base: 0.45,
      bonuses: [{ when: { op: "gte", left: "$d.dominant_element_count", value: 4 }, add: 0.2 }],
    },

    display: {
      headline: "Your default way of deciding",
      body:
        "{$d.dominant_element_count} of your seven main planets sit in {$d.dominant_element|lower} signs, which " +
        "is enough to set a house style. Under pressure, and with no time to think it through, you will " +
        "{@element_style[$d.dominant_element]}. That is worth knowing mostly so you can tell when it is the " +
        "right instinct and when it is just the loudest one.",
      tension: [
        {
          when: { op: "neqPath", left: "$venus.element", right: "$d.dominant_element" },
          text:
            "What you are drawn to does not match how you actually operate. Your momentum is " +
            "{$d.dominant_element|lower}, but what attracts you runs {$venus.element|lower}, so the things you " +
            "want and the way you go about getting them can quietly work against each other.",
        },
      ],
    },

    evidence: {
      technical_note:
        "Dominant element: {$d.dominant_element}, carried by {$d.dominant_element_count} of the seven classical planets.",
      claims: [
        { label: "Element distribution", path: "$d.element_counts", kind: "count", format: "element_counts" },
        { label: "Dominant element", path: "$d.dominant_element", kind: "count" },
        { label: "Venus element", path: "$venus.element", kind: "placement" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "core.focused_house",
    tier: "signature",
    category: "core",
    priority: "medium",
    instance_key: "core.focused_house:{$dense.number}",
    for_each: null,

    bind: {
      dense: { from: "densest_house" },
    },

    when: { op: "gte", left: "$dense.occupant_count", value: 1 },
    rarity_key: "core.focused_house.{$dense.number}",

    strength: {
      base: 0.4,
      bonuses: [
        { when: { op: "gte", left: "$dense.occupant_count", value: 3 }, add: 0.25 },
        { when: { op: "gte", left: "$dense.occupant_count", value: 2 }, add: 0.1 },
      ],
    },

    display: {
      headline: "Where your chart is most crowded",
      body:
        "More of your chart is stacked into one area of life than any other: {@house_themes[$dense.number]}. " +
        "Concentration like this tends to make a theme unavoidable rather than optional -- it is where the " +
        "repeated events, the recurring lessons and the disproportionate share of your attention end up going.",
      tension: [],
    },

    evidence: {
      technical_note: "House {$dense.number} in {$dense.sign} carries {$dense.occupants|list}.",
      claims: [
        { label: "Busiest house", path: "$dense.number", kind: "placement", format: "ordinal_house" },
        { label: "Sign on that house", path: "$dense.sign", kind: "placement" },
        { label: "Occupants", path: "$dense.occupants", kind: "count", format: "list" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "core.ascendant_lord",
    tier: "foundation",
    category: "core",
    priority: "high",
    instance_key: "core.ascendant_lord:{$lord.name}:{$lord.house}",
    for_each: null,

    bind: {
      asc: { from: "ascendant" },
      lord: { from: "ascendant_lord" },
    },

    when: { op: "always" },
    rarity_key: "core.ascendant_lord.{$lord.name}.{$lord.house}",

    strength: {
      base: 0.6,
      bonuses: [
        { when: { op: "dignity", planet: "$lord", is: ["exalted", "own_sign"] }, add: 0.2 },
        { when: { op: "in", left: "$lord.house", values: [1, 4, 7, 10] }, add: 0.1 },
        { when: { op: "in", left: "$lord.house", values: [6, 8, 12] }, add: -0.1 },
      ],
    },

    display: {
      headline: "The engine your life actually runs on",
      body:
        "The planet in charge of your whole chart is {$lord.name}, and where it sits decides where your life " +
        "keeps steering: {@house_themes[$lord.house]}. Of everything in a chart, this is the single clearest " +
        "signal for what you will end up organising your years around, whether or not you chose it deliberately.",
      tension: [
        {
          when: { op: "in", left: "$lord.house", values: [6, 8, 12] },
          text:
            "This one grows through pressure rather than ease. Your main line of development runs through the " +
            "harder rooms of the chart, so expect hidden effort, repeated restarts and a fair amount of work " +
            "nobody sees before the outside picture matches the inside one.",
        },
      ],
    },

    evidence: {
      technical_note: "{$lord.name} rules {$asc.sign} and is placed in {$lord.sign}, house {$lord.house}.",
      claims: [
        { label: "Chart ruler", path: "$lord.name", kind: "lordship" },
        { label: "Ruler placement", path: "$lord.house", kind: "placement", format: "ordinal_house" },
        { label: "Ruler sign", path: "$lord.sign", kind: "placement" },
        { label: "Ruler dignity", path: "$lord.dignity", kind: "dignity", format: "dignity" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "core.emotional_focus",
    tier: "signature",
    category: "core",
    priority: "medium",
    instance_key: "core.emotional_focus:{$moon.house}",
    for_each: null,

    bind: {
      moon: { from: "planet", name: "Moon" },
    },

    when: { op: "always" },
    rarity_key: "core.emotional_focus.{$moon.house}",

    strength: {
      base: 0.45,
      bonuses: [{ when: { op: "in", left: "$moon.house", values: [1, 4, 7, 10] }, add: 0.15 }],
    },

    display: {
      headline: "Where you go looking for reassurance",
      body:
        "Your attention keeps returning to {@house_themes[$moon.house]} whenever you need to feel steady. " +
        "This is less about what you value in principle and more about where you instinctively go when " +
        "something has knocked you off balance and you want the ground back under you.",
      tension: [],
    },

    evidence: {
      technical_note: "Moon placed in {$moon.sign}, house {$moon.house}.",
      claims: [
        { label: "Moon house", path: "$moon.house", kind: "placement", format: "ordinal_house" },
        { label: "Moon sign", path: "$moon.sign", kind: "placement" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "core.nodal_axis",
    tier: "signature",
    category: "core",
    priority: "medium",
    instance_key: "core.nodal_axis:{$rahu.house}:{$ketu.house}",
    for_each: null,

    bind: {
      rahu: { from: "planet", name: "Rahu" },
      ketu: { from: "planet", name: "Ketu" },
    },

    when: { op: "always" },
    rarity_key: "core.nodal_axis.{$rahu.house}",

    strength: {
      base: 0.5,
      bonuses: [{ when: { op: "in", left: "$rahu.house", values: [1, 4, 7, 10] }, add: 0.15 }],
    },

    display: {
      headline: "What you are hungry for, and what you are done with",
      body:
        "One end of this axis pulls you toward {@house_themes[$rahu.house]} with an appetite that rarely feels " +
        "fully satisfied. The other asks you to loosen your grip on {@house_themes[$ketu.house]}, which is " +
        "usually the area you are already good at and can hide in. The pull and the release are the same mechanism.",
      tension: [
        {
          when: { op: "always" },
          text:
            "Both ends misbehave when they run unsupervised. Chasing too hard makes urgency outrun judgement; " +
            "letting go too easily looks like maturity but is often just avoidance wearing better clothes.",
        },
      ],
    },

    evidence: {
      technical_note: "Rahu in {$rahu.sign}, house {$rahu.house}; Ketu in {$ketu.sign}, house {$ketu.house}.",
      claims: [
        { label: "North node house", path: "$rahu.house", kind: "placement", format: "ordinal_house" },
        { label: "South node house", path: "$ketu.house", kind: "placement", format: "ordinal_house" },
        { label: "North node sign", path: "$rahu.sign", kind: "placement" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "core.angular_emphasis",
    tier: "signature",
    category: "core",
    priority: "medium",
    instance_key: "core.angular_emphasis:{$d.kendra_planets|slug}",
    for_each: null,

    bind: {
      d: { from: "derived" },
    },

    when: { op: "countPlanetsInHouses", houses: [1, 4, 7, 10], gte: 3 },
    rarity_key: "core.angular_emphasis.{$d.kendra_planet_count}",

    strength: {
      base: 0.5,
      bonuses: [{ when: { op: "countPlanetsInHouses", houses: [1, 4, 7, 10], gte: 4 }, add: 0.2 }],
    },

    display: {
      headline: "Your life happens out loud",
      body:
        "{$d.kendra_planet_count} of your planets sit on the four corners of the chart -- the positions tied to " +
        "self, home, partnership and public standing. Charts weighted this way tend to produce visible, " +
        "eventful lives that respond quickly to decisive action, and respond just as quickly to indecision.",
      tension: [],
    },

    evidence: {
      technical_note: "Planets in kendras: {$d.kendra_planets|list}.",
      claims: [
        { label: "Planets on the angles", path: "$d.kendra_planets", kind: "count", format: "list" },
        { label: "Angular count", path: "$d.kendra_planet_count", kind: "count" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "core.jupiter_on_ascendant",
    tier: "signature",
    category: "core",
    priority: "medium",
    instance_key: "core.jupiter_on_ascendant:{$jupiter.house}",
    for_each: null,

    bind: {
      asc: { from: "ascendant" },
      jupiter: { from: "planet", name: "Jupiter" },
    },

    // In the 1st, or reaching it by one of Jupiter's three aspects: its 9th
    // from the 5th, its 7th from the 7th, its 5th from the 9th. Guru drishti on
    // the lagna, the classical protection for the self. About a third of charts.
    when: { op: "in", left: "$jupiter.house", values: [1, 5, 7, 9] },
    rarity_key: "core.jupiter_on_ascendant",

    strength: {
      base: 0.55,
      bonuses: [
        { when: { op: "eq", left: "$jupiter.house", right: 1 }, add: 0.15 },
        { when: { op: "dignity", planet: "$jupiter", is: ["exalted", "own_sign"] }, add: 0.15 },
        { when: { op: "dignity", planet: "$jupiter", is: ["debilitated"] }, add: -0.1 },
      ],
    },

    display: {
      headline: "People tend to meet you with goodwill",
      body:
        "Jupiter -- the planet classically read as protection, good judgement and generosity -- falls directly on " +
        "the part of your chart that describes you. In practice that tends to show up as people giving you the " +
        "benefit of the doubt, second chances arriving when you need them, and a habit of looking for the meaning " +
        "in a setback before looking for someone to blame. It is one of the quieter advantages a chart can carry.",
      tension: [
        {
          when: { op: "dignity", planet: "$jupiter", is: ["debilitated"] },
          text:
            "Jupiter is in its weakest sign here, so the goodwill is real but easy to overspend: promising more " +
            "than you can carry, or trusting a plan because it feels right rather than because it has been checked.",
        },
      ],
    },

    evidence: {
      technical_note:
        "Jupiter in house {$jupiter.house} ({$jupiter.sign}): in the lagna, or aspecting it by its 5th, 7th or " +
        "9th drishti.",
      claims: [
        { label: "Jupiter's house", path: "$jupiter.house", kind: "placement", format: "ordinal_house" },
        { label: "Jupiter's sign", path: "$jupiter.sign", kind: "placement" },
        { label: "Jupiter's dignity", path: "$jupiter.dignity", kind: "dignity", format: "dignity" },
        { label: "Rising sign", path: "$asc.sign", kind: "placement" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "core.saturn_on_ascendant",
    tier: "signature",
    category: "core",
    priority: "high",
    instance_key: "core.saturn_on_ascendant:{$saturn.sign}",
    for_each: null,

    bind: {
      asc: { from: "ascendant" },
      saturn: { from: "planet", name: "Saturn" },
    },

    // Saturn in the 1st house: about one chart in twelve.
    when: { op: "eq", left: "$saturn.house", right: 1 },
    rarity_key: "core.saturn_on_ascendant",

    strength: {
      base: 0.65,
      // Strength is how pronounced the pattern is, not how pleasant: a
      // dignified Saturn (Sasa, in its own signs) and a debilitated one both
      // make it louder.
      bonuses: [
        { when: { op: "dignity", planet: "$saturn", is: ["exalted", "own_sign"] }, add: 0.15 },
        { when: { op: "dignity", planet: "$saturn", is: ["debilitated"] }, add: 0.1 },
      ],
    },

    display: {
      headline: "You grow into yourself later than most, and more durably",
      body:
        "Saturn -- the planet of patience, limits and slow results -- sits on the part of your chart that " +
        "describes you. Classically that is read as seriousness and endurance. In practice it often means being " +
        "handed responsibility early, taking a long time to trust your own authority, and coming across as older " +
        "or more reserved than you feel. The trade is durability: what you build, your confidence included, " +
        "tends to last.",
      tension: [
        {
          when: { op: "dignity", planet: "$saturn", is: ["debilitated"] },
          text:
            "Saturn is in its weakest sign here, so the patience has to be learned rather than assumed. Early " +
            "setbacks can look like proof that effort does not pay. They are closer to the opposite: this " +
            "placement rewards the people who keep going past the point where it stopped being enjoyable.",
        },
      ],
    },

    evidence: {
      technical_note: "Saturn in the lagna: house 1 in {$saturn.sign}, rising sign {$asc.sign}.",
      claims: [
        { label: "Saturn's sign", path: "$saturn.sign", kind: "placement" },
        { label: "Saturn's dignity", path: "$saturn.dignity", kind: "dignity", format: "dignity" },
        { label: "Rising sign", path: "$asc.sign", kind: "placement" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "core.full_moon",
    tier: "signature",
    category: "core",
    priority: "medium",
    instance_key: "core.full_moon:{$moon.sign}",
    for_each: null,

    bind: {
      sun: { from: "planet", name: "Sun" },
      moon: { from: "planet", name: "Moon" },
    },

    // The Moon in the sign opposite the Sun: born at or near the full Moon,
    // where the Moon's phase strength (paksha bala) peaks. By whole signs that
    // is within about two and a half days of it. About one chart in twelve.
    when: { op: "signDistance", from: "$sun", to: "$moon", oneOf: [7] },
    rarity_key: "core.full_moon",

    strength: {
      base: 0.55,
      bonuses: [
        { when: { op: "dignity", planet: "$moon", is: ["exalted", "own_sign"] }, add: 0.15 },
        { when: { op: "in", left: "$moon.house", values: [1, 4, 7, 10] }, add: 0.1 },
      ],
    },

    display: {
      headline: "What you feel, you tend to show",
      body:
        "You were born with the Moon opposite the Sun -- at or near a full Moon, the phase classically counted as " +
        "the Moon at its strongest. The Sun describes what you are driving at and the Moon what you need, and here " +
        "they face each other across the chart, so the pull between them is out in the open rather than buried. " +
        "That tends to make your feelings visible and your relationships a mirror, and it gives you an unusually " +
        "clear read on how other people are reacting to you.",
      tension: [
        {
          when: { op: "always" },
          text:
            "The cost is swing. When what you want and what you need point different ways you feel it fully, and " +
            "you may reach for another person to settle a question that is really between you and yourself.",
        },
      ],
    },

    evidence: {
      technical_note:
        "Sun in {$sun.sign}, Moon in {$moon.sign}: the Moon is 7 signs from the Sun (purnima, paksha bala at " +
        "its peak).",
      claims: [
        { label: "Sun sign", path: "$sun.sign", kind: "placement" },
        { label: "Moon sign", path: "$moon.sign", kind: "placement" },
        { label: "Moon's house", path: "$moon.house", kind: "placement", format: "ordinal_house" },
      ],
    },
  },
];
