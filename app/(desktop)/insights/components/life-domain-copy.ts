import type { DomainRuleImpact, LifeDomainInsight, LifeDomainKey } from "@/lib/astro-types";
import { chartValue } from "@/lib/chart-labels";

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
type Translate = (key: string, params?: Record<string, string>) => string;

/* The engine's closed sets the life areas pages word themselves. */
export const RULE_IMPACTS: readonly DomainRuleImpact[] = ["support", "pressure", "activation", "context"];
export const CONFIRMATION_STATUSES = ["confirmed", "qualified", "improved", "contradictory", "insufficient"] as const;
export const CONCLUSION_STRENGTHS = ["strong", "moderate", "cautious"] as const;
export const SUBTHEME_BANDS = ["leading", "supporting", "developing"] as const;
export const EVIDENCE_STATUSES = ["support", "pressure", "mixed", "context"] as const;
export const EVIDENCE_FAMILIES = ["primary", "supporting", "divisional", "strength", "house_support", "yoga", "timing", "contradiction"] as const;

/* The engine's activity bands, a closed set (LifeDomainInsight.signal_profile). */
export const ACTIVITY_BANDS = ["developing", "active", "prominent"] as const;

/** A life area's name in the reader's language: lifeDomains.names, else the engine's label. */
export function domainName(domain: { key: LifeDomainKey; label: string }, t: Translate): string {
  const key = `lifeDomains.names.${domain.key}`;
  const text = t(key);
  return text === key ? domain.label : text;
}

/** The same name inside a sentence ("Full reading for love life"): lower case,
    except in German, which capitalises its nouns. */
export function domainNameInSentence(
  domain: { key: LifeDomainKey; label: string },
  t: Translate,
  language: string,
): string {
  const name = domainName(domain, t);
  return language === "de" ? name : name.toLowerCase();
}

/** The badge for an activity band: "developing activity", in the reader's language. */
export function activityBadge(band: string, t: Translate): string {
  const key = `lifeDomains.activity.${band}`;
  const text = t(key);
  return text === key ? `${band} activity` : text;
}

export const DOMAIN_ICONS: Record<LifeDomainKey, string> = {
  love_life: "\u2661",
  career: "\u2726",
  family: "\u2302",
  inheritance: "\u229B",
  influence: "\u2605",
  life_cycle: "\u21BB",
  travel_destinations: "\u2708",
};

/* The four reading lines for each area. They are the same for every chart, so
   they are the app's copy rather than the engine's, and read in the visitor's
   language: lifeAreas.copy.<area>.<field>, in the life-areas route catalog. */
export const DOMAIN_READ_FIELDS = ["description", "clarity", "decisionRule", "boundaryRule"] as const;

export function domainReadCopy(domain: LifeDomainKey, t: Translate): DomainReadCopy {
  const copy = {} as DomainReadCopy;
  for (const field of DOMAIN_READ_FIELDS) copy[field] = t(`lifeAreas.copy.${domain}.${field}`);
  return copy;
}

/* The evidence claims the rule engine writes (buildDomainClaims). It sends no
   id with them, and the seven labels are fixed, so they are matched by their
   English. An unknown label is shown as it came. */
const CLAIM_LABEL_KEYS: Record<string, string> = {
  "Primary house": "lifeAreas.claims.primaryHouse",
  "Sign on that house": "lifeAreas.claims.houseSign",
  "House lord": "lifeAreas.claims.houseLord",
  "Lord placement": "lifeAreas.claims.lordPlacement",
  "Supporting house": "lifeAreas.claims.supportingHouse",
  "Supporting lord": "lifeAreas.claims.supportingLord",
  "Anchor planet": "lifeAreas.claims.anchorPlanet",
};

export const CLAIM_LABEL_KEY_LIST = Object.values(CLAIM_LABEL_KEYS);

export function claimLabel(label: string, t: Translate): string {
  const key = CLAIM_LABEL_KEYS[label];
  if (!key) return label;
  const text = t(key);
  return text === key ? label : text;
}

/** A claim's value -- "10th house", a sign or a planet -- in the reader's language. */
export function claimValue(value: string, t: Translate): string {
  return chartValue(value, t);
}

/** A word from one of the engine's closed sets, or the engine's own word if a
    newer engine sends one the catalog has not met. */
export function engineWord(key: string, fallback: string, t: Translate): string {
  const text = t(key);
  return text === key ? fallback : text;
}

/**
 * The technical read-out for a domain.
 *
 * These deliberately keep reading the legacy fields -- house-lord notation and
 * transit language are correct here, because this now renders only inside the
 * evidence disclosure.
 */
export function buildDomainRules(domain: LifeDomainInsight, t: Translate) {
  if (Array.isArray(domain.rule_hits) && domain.rule_hits.length > 0) {
    return domain.rule_hits.map((rule) => {
      const impact = RULE_IMPACTS.includes(rule.impact) ? rule.impact : "context";
      return {
        /* The impact is ours to word; the rule's own label is the engine's. */
        label: `${t(`lifeAreas.ruleImpact.${impact}`)} · ${rule.label}`,
        body: rule.technical_note,
      };
    });
  }

  return [
    {
      label: t("lifeAreas.ruleLabels.house"),
      body: `${domain.headline} Use this as the baseline before judging specific events.`,
    },
    {
      label: t("lifeAreas.ruleLabels.evidence"),
      body:
        domain.supporting_patterns[0] ??
        "Give more weight to patterns that repeat across houses, lord placements, and timing indicators.",
    },
    {
      label: t("lifeAreas.ruleLabels.timing"),
      body:
        domain.timing_triggers[0] ??
        "Use timing triggers as activation windows, not as isolated promises.",
    },
    {
      label: t("lifeAreas.ruleLabels.action"),
      body: domain.guidance,
    },
  ];
}
