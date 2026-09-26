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

  // -------------------------------------------------------------------------
  // Pancha Mahapurusha (BPHS ch. 75): Mars, Mercury, Jupiter, Venus or Saturn
  // in its own or exaltation sign AND on an angle from the lagna. The same
  // test as detectMahapurusha in lib/engines/yoga-engine.ts, so the reading
  // and the yoga panel cannot disagree. Split by category the way dignity is:
  // Bhadra (Mercury), Hamsa (Jupiter) and Sasa (Saturn) here, Ruchaka (Mars)
  // and Malavya (Venus) in the love record below.
  {
    id: "yoga.mahapurusha_career",
    tier: "signature",
    category: "career",
    priority: "high",
    instance_key: "yoga.mahapurusha_career:{$p.name}",
    for_each: { as: "p", over: "career_planets" },

    bind: {
      p: { from: "planet", name: "@p" },
    },

    when: {
      op: "all",
      of: [
        { op: "in", left: "$p.house", values: [1, 4, 7, 10] },
        { op: "dignity", planet: "$p", is: ["exalted", "own_sign"] },
      ],
    },
    rarity_key: "yoga.mahapurusha.{$p.name}",

    strength: {
      base: 0.7,
      bonuses: [
        { when: { op: "dignity", planet: "$p", is: ["exalted"] }, add: 0.15 },
        { when: { op: "in", left: "$p.house", values: [1, 10] }, add: 0.1 },
      ],
    },

    display: {
      headline: "{$p.name} is one of the pillars of your chart",
      body:
        "{$p.name} is both in one of its strongest signs and on one of the four corners of your chart, the " +
        "combination classical astrology counts among its five great-person patterns. It makes " +
        "{@planet_role[$p.name]} a defining feature rather than one trait among many: people tend to know you " +
        "for it, and the parts of life that run on it are where you are most likely to stand out.",
      tension: [],
    },

    evidence: {
      technical_note:
        "{@mahapurusha_name[$p.name]} yoga: {$p.name} {$p.dignity|dignity} in {$p.sign}, house {$p.house} (a kendra).",
      claims: [
        { label: "Planet", path: "$p.name", kind: "placement" },
        { label: "Sign", path: "$p.sign", kind: "placement" },
        { label: "House", path: "$p.house", kind: "placement", format: "ordinal_house" },
        { label: "Dignity", path: "$p.dignity", kind: "dignity", format: "dignity" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "yoga.mahapurusha_love",
    tier: "signature",
    category: "love",
    priority: "high",
    instance_key: "yoga.mahapurusha_love:{$p.name}",
    for_each: { as: "p", over: "love_planets" },

    bind: {
      p: { from: "planet", name: "@p" },
    },

    // The love set carries the Moon, which forms no Mahapurusha yoga however
    // strong it is.
    when: {
      op: "all",
      of: [
        { op: "neq", left: "$p.name", right: "Moon" },
        { op: "in", left: "$p.house", values: [1, 4, 7, 10] },
        { op: "dignity", planet: "$p", is: ["exalted", "own_sign"] },
      ],
    },
    rarity_key: "yoga.mahapurusha.{$p.name}",

    strength: {
      base: 0.7,
      bonuses: [
        { when: { op: "dignity", planet: "$p", is: ["exalted"] }, add: 0.15 },
        { when: { op: "in", left: "$p.house", values: [1, 7] }, add: 0.1 },
      ],
    },

    display: {
      headline: "{$p.name} is one of the pillars of your chart",
      body:
        "{$p.name} is both in one of its strongest signs and on one of the four corners of your chart, the " +
        "combination classical astrology counts among its five great-person patterns. It makes " +
        "{@planet_role[$p.name]} a defining feature rather than one trait among many: people tend to know you " +
        "for it, and it colours how you attract, pursue and hold on to the people you care about.",
      tension: [],
    },

    evidence: {
      technical_note:
        "{@mahapurusha_name[$p.name]} yoga: {$p.name} {$p.dignity|dignity} in {$p.sign}, house {$p.house} (a kendra).",
      claims: [
        { label: "Planet", path: "$p.name", kind: "placement" },
        { label: "Sign", path: "$p.sign", kind: "placement" },
        { label: "House", path: "$p.house", kind: "placement", format: "ordinal_house" },
        { label: "Dignity", path: "$p.dignity", kind: "dignity", format: "dignity" },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "yoga.kemadruma",
    tier: "signature",
    category: "core",
    priority: "medium",
    instance_key: "yoga.kemadruma:{$moon.sign}",
    for_each: null,

    bind: {
      moon: { from: "planet", name: "Moon" },
      mars: { from: "planet", name: "Mars" },
      mercury: { from: "planet", name: "Mercury" },
      jupiter: { from: "planet", name: "Jupiter" },
      venus: { from: "planet", name: "Venus" },
      saturn: { from: "planet", name: "Saturn" },
    },

    // Kemadruma: nothing but the Sun and the nodes in the 2nd or 12th sign
    // from the Moon. Only the uncancelled form fires -- the Moon off the
    // angles, and Jupiter neither with it nor opposite -- which is the case
    // lib/engines/yoga-engine.ts reports at full strength. The cancelled form
    // is common and says little, so it stays in the yoga panel.
    when: {
      op: "all",
      of: [
        {
          op: "all",
          of: [
            { op: "notIn", left: "$mars.sign_distance_from.moon", values: [2, 12] },
            { op: "notIn", left: "$mercury.sign_distance_from.moon", values: [2, 12] },
            { op: "notIn", left: "$jupiter.sign_distance_from.moon", values: [2, 12] },
          ],
        },
        {
          op: "all",
          of: [
            { op: "notIn", left: "$venus.sign_distance_from.moon", values: [2, 12] },
            { op: "notIn", left: "$saturn.sign_distance_from.moon", values: [2, 12] },
          ],
        },
        { op: "notIn", left: "$moon.house", values: [1, 4, 7, 10] },
        { op: "notIn", left: "$jupiter.sign_distance_from.moon", values: [1, 7] },
      ],
    },
    rarity_key: "yoga.kemadruma",

    strength: {
      base: 0.6,
      bonuses: [
        { when: { op: "dignity", planet: "$moon", is: ["debilitated"] }, add: 0.15 },
        { when: { op: "in", left: "$moon.house", values: [6, 8, 12] }, add: 0.1 },
      ],
    },

    display: {
      headline: "You learned early to steady yourself",
      body:
        "The Moon -- your emotional needs and what makes you feel safe -- has no planets on either side of it in " +
        "your chart, and none of the placements classical astrology accepts as offsetting that. The old reading " +
        "is a lonely Moon. The practical one is self-reliance: you tend to work through feelings on your own " +
        "before you share them, you are good in a crisis because you are used to being your own support, and " +
        "help is something you have learned to ask for rather than something you expect to arrive.",
      tension: [
        {
          when: { op: "always" },
          text:
            "The cost is that people may not realise you need anything. Saying so plainly, before it becomes " +
            "urgent, does more for this placement than any amount of coping well.",
        },
      ],
    },

    evidence: {
      technical_note:
        "Kemadruma: no graha but the Sun and nodes in the 2nd or 12th sign from the Moon ({$moon.sign}, house " +
        "{$moon.house}); the Moon is not in a kendra, and Jupiter is neither conjunct nor opposite it.",
      claims: [
        { label: "Moon sign", path: "$moon.sign", kind: "placement" },
        { label: "Moon's house", path: "$moon.house", kind: "placement", format: "ordinal_house" },
        {
          label: "Jupiter from the Moon",
          path: "$jupiter.sign_distance_from.moon",
          kind: "aspect",
          detail: "Counted in whole signs, inclusive. 1 is the Moon's own sign and 7 the opposite one.",
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  {
    id: "yoga.dharma_karmadhipati",
    tier: "signature",
    category: "career",
    priority: "high",
    instance_key: "yoga.dharma_karmadhipati:{$lord9.name}:{$lord10.name}",
    for_each: null,

    bind: {
      lord9: { from: "house_lord", house: 9 },
      lord10: { from: "house_lord", house: 10 },
    },

    // The 9th lord (purpose, fortune) and the 10th lord (work) conjunct or in
    // mutual 7th aspect. lib/engines/yoga-engine.ts also accepts a looser
    // kendra relationship, so the yoga panel can name this yoga where the
    // reading stays silent, never the other way round -- which is also why an
    // exchange of houses is not counted here. Taurus rising gives both houses
    // to Saturn, the yogakaraka, which counts as the yoga on its own.
    when: { op: "signDistance", from: "$lord9", to: "$lord10", oneOf: [1, 7] },
    rarity_key: "yoga.dharma_karmadhipati",

    strength: {
      base: 0.7,
      bonuses: [
        { when: { op: "dignity", planet: "$lord9", is: ["exalted", "own_sign"] }, add: 0.1 },
        { when: { op: "dignity", planet: "$lord10", is: ["exalted", "own_sign"] }, add: 0.1 },
        { when: { op: "in", left: "$lord10.house", values: [1, 4, 7, 10] }, add: 0.1 },
      ],
    },

    display: {
      headline: "What you do for a living and what you believe in are joined",
      body:
        "The planet governing your sense of purpose and the planet governing your work are directly linked in " +
        "your chart -- the pairing classical astrology rates among its most important for status and " +
        "achievement. The practical effect is that work you believe in goes much further for you than work you " +
        "do only for the money: when the two line up you tend to rise quickly, and when they do not, the effort " +
        "feels twice as heavy as it should.",
      tension: [],
    },

    evidence: {
      technical_note:
        "9th lord {$lord9.name} in house {$lord9.house} ({$lord9.sign}); 10th lord {$lord10.name} in house " +
        "{$lord10.house} ({$lord10.sign}): conjunct or in mutual 7th aspect.",
      claims: [
        { label: "9th lord", path: "$lord9.name", kind: "lordship" },
        { label: "9th lord placement", path: "$lord9.house", kind: "placement", format: "ordinal_house" },
        { label: "10th lord", path: "$lord10.name", kind: "lordship" },
        { label: "10th lord placement", path: "$lord10.house", kind: "placement", format: "ordinal_house" },
      ],
    },
  },
];
