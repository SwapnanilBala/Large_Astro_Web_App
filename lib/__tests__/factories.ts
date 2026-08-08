/**
 * Test factories for the rule payload shapes.
 *
 * These were introduced so the deprecated compatibility mirrors lived in one
 * place; deleting those five fields was a one-file change here rather than a
 * hunt through every fixture. They stay because the same argument applies to
 * the next shape change.
 *
 * `selection.score` is derived from the rarity and strength a caller passes,
 * so a fixture cannot encode a scoring relationship the engine would never
 * produce.
 */

import type {
  DeterministicRule,
  DomainDisplay,
  DomainEvidence,
  LifeDomainInsight,
  RuleDisplay,
  RuleEvidence,
  RuleRarity,
  RuleSelectionMeta,
} from "@/lib/astro-types";

export function makeRarity(overrides: Partial<RuleRarity> = {}): RuleRarity {
  const fire_rate = overrides.fire_rate ?? 0.1;
  return {
    fire_rate,
    score: 1 - fire_rate,
    band: "uncommon",
    observed_count: 20_000,
    sample_size: 200_000,
    low_confidence: false,
    dataset_version: "2026-08-08.1",
    ...overrides,
  };
}

type RuleOverrides = Omit<Partial<DeterministicRule>, "display" | "evidence" | "selection"> & {
  display?: Partial<RuleDisplay>;
  evidence?: Partial<RuleEvidence>;
  selection?: Partial<RuleSelectionMeta>;
};

export function makeRule(overrides: RuleOverrides = {}): DeterministicRule {
  const display: RuleDisplay = {
    headline: "The engine your life actually runs on",
    body: "Mars gives a direct, practical edge to your life direction.",
    tension: "Move quickly, but leave a pause for consultation before a high-impact decision.",
    rarity_label: "Shows up in about 10 of every 100 charts",
    ...overrides.display,
  };

  const evidence: RuleEvidence = {
    technical_note: "Mars in Aries, house 1.",
    claims: [{ label: "Chart ruler", value: "Mars", kind: "lordship" }],
    rarity: makeRarity(),
    matched_conditions: [],
    ...overrides.evidence,
  };

  const strength = overrides.selection?.strength ?? 0.9;
  const selection: RuleSelectionMeta = {
    strength,
    score: evidence.rarity.score * strength,
    selected: true,
    rank: 1,
    ...overrides.selection,
  };

  const { display: _d, evidence: _e, selection: _s, ...rest } = overrides;

  return {
    id: "core.ascendant_lord",
    instance_key: "core.ascendant_lord:Mars:1",
    tier: "foundation",
    category: "core",
    priority: "high",
    display,
    evidence,
    selection,

    ...rest,
  };
}

type DomainOverrides = Omit<Partial<LifeDomainInsight>, "display" | "evidence"> & {
  display?: Partial<DomainDisplay>;
  evidence?: Partial<DomainEvidence>;
};

export function makeDomainInsight(overrides: DomainOverrides = {}): LifeDomainInsight {
  const headline = "Career: Build visible responsibility around your strongest skills.";
  const overview = "Career patterns reward steady leadership.";
  const confidence_score = overrides.confidence_score ?? 0.91;

  const display: DomainDisplay = {
    headline: "Where your working life is heading",
    body: "Career patterns reward steady leadership.",
    guidance: "Choose one meaningful scope, then make it repeatable.",
    long_game: "Build authority through outcomes and reliable systems.",
    strengths: ["Strategic execution", "Clear responsibility"],
    watchouts: ["Taking on every urgent task yourself"],
    timing: ["When you pair a long commitment with a clear weekly rhythm"],
    ...overrides.display,
  };

  const evidence: DomainEvidence = {
    technical_note: `${headline} ${overview}`,
    claims: [{ label: "10th house sign", value: "Capricorn", kind: "placement" }],
    signal_score: confidence_score,
    ...overrides.evidence,
  };

  const { display: _d, evidence: _e, ...rest } = overrides;

  return {
    key: "career",
    label: "Career",
    display,
    evidence,

    headline,
    overview,
    strengths: ["Strategic execution", "Clear responsibility"],
    watchouts: ["Taking on every urgent task yourself"],
    timing_triggers: ["you pair a long-range commitment with a clear operating rhythm"],
    supporting_patterns: ["Mars in the first house"],
    guidance: "Choose one meaningful scope, then make it repeatable.",
    long_game: "Build authority through outcomes and reliable systems.",
    confidence_score,

    ...rest,
  };
}
