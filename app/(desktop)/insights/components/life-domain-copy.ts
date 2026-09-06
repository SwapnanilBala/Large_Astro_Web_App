import type { LifeDomainInsight, LifeDomainKey } from "@/lib/astro-types";

/*
 * Presentation copy and helpers for the seven life domains.
 *
 * Shared because the readings now render in two places: the short brief on the
 * results page, and the full deep dive on /insights/life-areas. A second copy
 * of DOMAIN_READ_COPY would let the clarity and decision-rule wording drift
 * between the summary a client reads first and the page they open from it.
 *
 * Lifted out of insights-content.tsx; no wording is changed here.
 */

export type DomainReadCopy = {
  description: string;
  clarity: string;
  decisionRule: string;
  boundaryRule: string;
};

/* â”€â”€â”€ Domain Icon Map â”€â”€â”€ */
export const DOMAIN_ICONS: Record<LifeDomainKey, string> = {
  love_life: "\u2661",
  career: "\u2726",
  family: "\u2302",
  inheritance: "\u229B",
  influence: "\u2605",
  life_cycle: "\u21BB",
  travel_destinations: "\u2708",
};

export const DOMAIN_READ_COPY: Record<LifeDomainKey, DomainReadCopy> = {
  love_life: {
    description:
      "Separates attraction, partnership durability, emotional availability, and the timing that makes connection easier to sustain.",
    clarity:
      "Do not judge love from Venus alone. Read the 7th house for partnership, the 5th for romance, the house lord for delivery, and timing triggers for when the pattern becomes visible.",
    decisionRule:
      "A relationship signal is stronger when support, watchout, and timing notes repeat the same theme.",
    boundaryRule:
      "If the watchout contradicts the support, treat the watchout as the condition that must be managed before the support pays off.",
  },
  career: {
    description:
      "Distinguishes vocation, workload, authority, public reputation, service pressure, and the route through which professional recognition is built.",
    clarity:
      "Do not read career from the 10th house alone. Weigh the 10th sign, its lord, the 6th house work pattern, and Saturn's discipline filter together.",
    decisionRule:
      "Career moves are cleaner when the timing trigger reinforces both the 10th-house promise and the lord's placement.",
    boundaryRule:
      "If pressure houses are involved, advancement may require systems, mentors, and repeatable proof before visibility arrives.",
  },
  family: {
    description:
      "Clarifies home life, inherited emotional patterns, family support, private stability, and the habits that make belonging feel reliable.",
    clarity:
      "Read the 4th house for emotional ground, the 2nd for lineage and speech, the Moon for felt safety, and the house lord for where repair happens.",
    decisionRule:
      "Family guidance is strongest when the support pattern names the same need as the long-game statement.",
    boundaryRule:
      "When the watchout is active, protect steadiness first; resolution works better after the emotional baseline is restored.",
  },
  inheritance: {
    description:
      "Frames shared resources, legacy, debt, hidden obligations, family assets, and the maturity needed around resource transitions.",
    clarity:
      "Read the 8th house for transferred resources, the 2nd for stored value, Jupiter for stewardship, and the lord placement for the route of responsibility.",
    decisionRule:
      "Treat inheritance signals as practical planning prompts when they repeat across support, watchout, and timing sections.",
    boundaryRule:
      "If the watchout names hidden cost or delay, prioritize documentation, transparency, and patient sequencing.",
  },
  influence: {
    description:
      "Looks at public impact, allies, social reach, authority, reputation, and the conditions that help your voice move people.",
    clarity:
      "Read the 11th house for networks, the 10th for public standing, the Sun for visibility, and the lord for where influence is earned.",
    decisionRule:
      "Influence grows fastest when timing triggers amplify an existing support pattern rather than forcing visibility too early.",
    boundaryRule:
      "If the watchout names diffusion or delay, narrow the audience and make the message easier to repeat.",
  },
  life_cycle: {
    description:
      "Connects identity, reinvention, recovery cycles, resilience, and the periods where life asks for a cleaner version of self-direction.",
    clarity:
      "Read the 1st house for identity, the 8th for transformation, the Moon for adaptation, and the lord placement for the terrain of change.",
    decisionRule:
      "A life-cycle signal deserves priority when timing notes and long-game guidance both point toward the same kind of maturity.",
    boundaryRule:
      "If the watchout is active, slow the pace and make the next step smaller, clearer, and easier to sustain.",
  },
  travel_destinations: {
    description:
      "Clarifies long-distance travel, short journeys, relocation pull, foreign links, pilgrimage themes, and what makes a place feel meaningful.",
    clarity:
      "Read the 9th house for distance and meaning, the 3rd for movement and logistics, Jupiter for expansion, and the lord placement for travel purpose.",
    decisionRule:
      "Travel signals become practical when timing triggers support both opportunity and preparation.",
    boundaryRule:
      "If watchouts name friction, treat planning, documents, health, and timing buffers as part of the reading rather than afterthoughts.",
  },
};

/**
 * The technical read-out for a domain.
 *
 * These deliberately keep reading the legacy fields -- house-lord notation and
 * transit language are correct here, because this now renders only inside the
 * evidence disclosure.
 */
export function buildDomainRules(domain: LifeDomainInsight) {
  if (Array.isArray(domain.rule_hits) && domain.rule_hits.length > 0) {
    return domain.rule_hits.map((rule) => ({
      label: `${rule.impact === "pressure" ? "Pressure" : rule.impact === "support" ? "Support" : rule.impact === "activation" ? "Activation" : "Context"} · ${rule.label}`,
      body: rule.technical_note,
    }));
  }

  return [
    {
      label: "House rule",
      body: `${domain.headline} Use this as the baseline before judging specific events.`,
    },
    {
      label: "Evidence rule",
      body:
        domain.supporting_patterns[0] ??
        "Give more weight to patterns that repeat across houses, lord placements, and timing indicators.",
    },
    {
      label: "Timing rule",
      body:
        domain.timing_triggers[0] ??
        "Use timing triggers as activation windows, not as isolated promises.",
    },
    {
      label: "Action rule",
      body: domain.guidance,
    },
  ];
}
