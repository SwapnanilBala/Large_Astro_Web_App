/**
 * Rule loading and evaluation.
 *
 * `loadRuleDefinitions()` runs Zod validation plus a set of static checks that
 * a schema alone cannot express -- that every `$binding` a rule references is
 * actually bound, that every `@table` exists, that every filter is known. It
 * throws at import, so a malformed rule file fails the build rather than
 * rendering `undefined` into somebody's reading.
 *
 * `evaluateRules(ctx)` walks the loaded definitions in declaration order and
 * returns one EvaluatedRule per fired instance. Rarity, strength and selection
 * are layered on top of this by the caller -- this file knows nothing about
 * ranking.
 */

import type { EvidenceClaim, RuleCategory, RulePriority, RuleTier } from "@/lib/astro-types";
import type { RuleContext } from "./context";
import { forEachPlanets } from "./context";
import { evaluate } from "./predicates";
import {
  buildClaim,
  renderTemplate,
  resolveBindings,
  templateFilters,
  templateRefs,
  templateRoots,
  TEMPLATE_FILTERS,
  type Bindings,
} from "./paths";
import {
  pathRoot,
  predicatePaths,
  ruleFileSchema,
  type Predicate,
  type RuleDefinition,
} from "./schema";
import { TABLES } from "./tables";

import { CORE_RULES } from "./definitions/core";
import { DIGNITY_RULES } from "./definitions/dignity";
import { CAREER_RULES } from "./definitions/career";
import { LOVE_RULES } from "./definitions/love";
import { YOGA_RULES } from "./definitions/yoga";
import { COMBINATION_RULES } from "./definitions/combination";

/**
 * Bumped whenever the shape of a rule's *output* changes.
 *
 * This string is embedded in every cache key that can hold rule output. Four
 * cache layers sit between the engine and the browser and none of them was
 * versioned before; without this, a payload-cache miss two hours after a deploy
 * rebuilds from day-old cached rules and republishes the old shape into a fresh
 * entry.
 */
export const RULES_SCHEMA_VERSION = "rules-2026-08-v2";

/**
 * Declaration order is emission order, and emission order is what the desktop
 * category buckets and `rules[0]` depend on. This array reproduces the legacy
 * `generateRules()` sequence exactly: the five chart-level rules, the four
 * core-path rules, dignity, career, love, yoga -- with combination rules, which
 * have no legacy counterpart, appended last.
 */
const RAW_DEFINITIONS = [
  ...CORE_RULES,
  ...DIGNITY_RULES,
  ...CAREER_RULES,
  ...LOVE_RULES,
  ...YOGA_RULES,
  ...COMBINATION_RULES,
];

// ---------------------------------------------------------------------------
// Static checks
// ---------------------------------------------------------------------------

export class RuleDefinitionError extends Error {}

/** Every template string a rule carries, paired with a path for error messages. */
function ruleTemplates(def: RuleDefinition): Array<{ where: string; template: string }> {
  const out: Array<{ where: string; template: string }> = [
    { where: "instance_key", template: def.instance_key },
    { where: "rarity_key", template: def.rarity_key },
    { where: "display.headline", template: def.display.headline },
    { where: "display.body", template: def.display.body },
    { where: "evidence.technical_note", template: def.evidence.technical_note },
  ];
  def.display.tension.forEach((v, i) => out.push({ where: `display.tension[${i}].text`, template: v.text }));
  def.evidence.claims.forEach((c, i) => {
    if (c.detail) out.push({ where: `evidence.claims[${i}].detail`, template: c.detail });
  });
  return out;
}

/** Every predicate a rule carries. */
function rulePredicates(def: RuleDefinition): Array<{ where: string; pred: Predicate }> {
  const out: Array<{ where: string; pred: Predicate }> = [{ where: "when", pred: def.when }];
  def.strength.bonuses.forEach((b, i) => out.push({ where: `strength.bonuses[${i}].when`, pred: b.when }));
  def.display.tension.forEach((v, i) => out.push({ where: `display.tension[${i}].when`, pred: v.when }));
  return out;
}

function checkDefinition(def: RuleDefinition): void {
  const bound = new Set(Object.keys(def.bind));
  const fail = (msg: string) => {
    throw new RuleDefinitionError(`rule "${def.id}": ${msg}`);
  };

  if (def.for_each && !bound.has(def.for_each.as)) {
    fail(`for_each binds "@${def.for_each.as}" but there is no "${def.for_each.as}" entry in bind`);
  }

  for (const { where, pred } of rulePredicates(def)) {
    for (const path of predicatePaths(pred)) {
      if (!bound.has(pathRoot(path))) fail(`${where} references unbound name "${pathRoot(path)}" via ${path}`);
    }
  }

  for (const { where, template } of ruleTemplates(def)) {
    const { paths, tables } = templateRefs(template);
    for (const path of paths) {
      if (!bound.has(pathRoot(path))) fail(`${where} references unbound name "${pathRoot(path)}" via ${path}`);
    }
    for (const table of tables) {
      if (!(table in TABLES)) fail(`${where} references unknown table "@${table}"`);
    }
    for (const filter of templateFilters(template)) {
      if (!(TEMPLATE_FILTERS as readonly string[]).includes(filter)) {
        fail(`${where} uses unknown filter "|${filter}"`);
      }
    }
  }

  for (const claim of def.evidence.claims) {
    if (!bound.has(pathRoot(claim.path))) {
      fail(`evidence claim "${claim.label}" references unbound name "${pathRoot(claim.path)}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

let cached: RuleDefinition[] | null = null;

export function loadRuleDefinitions(): RuleDefinition[] {
  if (cached) return cached;

  const parsed = ruleFileSchema.safeParse(RAW_DEFINITIONS);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new RuleDefinitionError(
      `rule definitions failed validation at ${issue.path.join(".")}: ${issue.message}`,
    );
  }

  const defs = parsed.data;

  const seen = new Set<string>();
  for (const def of defs) {
    if (seen.has(def.id)) throw new RuleDefinitionError(`duplicate rule id "${def.id}"`);
    seen.add(def.id);
    checkDefinition(def);
  }

  cached = defs;
  return defs;
}

/** The validated, declaration-ordered rule set. */
export const RULE_DEFINITIONS: RuleDefinition[] = loadRuleDefinitions();

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export type EvaluatedRule = {
  id: string;
  instance_key: string;
  tier: RuleTier;
  category: RuleCategory;
  priority: RulePriority;
  /** The key this instance's fire rate is looked up under. */
  rarity_key: string;

  headline: string;
  body: string;
  tension?: string;

  technical_note: string;
  claims: EvidenceClaim[];
  matched_conditions: string[];

  /** Retained so the strength layer can re-evaluate bonus predicates. */
  definition: RuleDefinition;
  bindings: Bindings;
};

function buildInstance(
  def: RuleDefinition,
  ctx: RuleContext,
  bindings: Bindings,
  matchedConditions: string[],
): EvaluatedRule {
  // First matching variant wins; none matching means no tension line.
  let tension: string | undefined;
  for (const variant of def.display.tension) {
    if (evaluate(variant.when, ctx, bindings).matched) {
      tension = renderTemplate(variant.text, bindings);
      break;
    }
  }

  return {
    id: def.id,
    instance_key: renderTemplate(def.instance_key, bindings),
    tier: def.tier,
    category: def.category,
    priority: def.priority,
    rarity_key: renderTemplate(def.rarity_key, bindings),
    headline: renderTemplate(def.display.headline, bindings),
    body: renderTemplate(def.display.body, bindings),
    tension,
    technical_note: renderTemplate(def.evidence.technical_note, bindings),
    claims: def.evidence.claims.map((c) => buildClaim(c, bindings)),
    matched_conditions: matchedConditions,
    definition: def,
    bindings,
  };
}

/**
 * Fire every rule against one chart, in declaration order.
 *
 * `for_each` records expand before evaluation, so the evaluator only ever sees
 * concrete rules. A rule whose bindings cannot be resolved against this chart
 * is skipped rather than throwing -- one missing planet should not take out the
 * whole reading.
 */
export function evaluateRules(ctx: RuleContext, definitions: RuleDefinition[] = RULE_DEFINITIONS): EvaluatedRule[] {
  const fired: EvaluatedRule[] = [];

  for (const def of definitions) {
    const forEachValues = def.for_each ? forEachPlanets(def.for_each.over, ctx) : [null];

    for (const value of forEachValues) {
      const bindings = resolveBindings(def.bind, ctx, value);
      if (!bindings) continue;

      const result = evaluate(def.when, ctx, bindings);
      if (!result.matched) continue;

      fired.push(buildInstance(def, ctx, bindings, result.trace));
    }
  }

  return fired;
}

export { templateRoots };
