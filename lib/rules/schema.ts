/**
 * The rule definition format.
 *
 * Rules are data records, not code. This schema is what makes that claim
 * enforceable: it admits no functions, no arithmetic and no free-form
 * expressions. A rule declares what to bind, when it fires, how strong the
 * pattern is, and what to say about it -- nothing else.
 *
 * Three deliberate departures from a general expression language, all covered
 * in the migration contract:
 *
 *   - Predicates are a closed 15-op discriminated union rather than a parsed
 *     string DSL. Evidence is *derived* from the condition tree, so the tree
 *     has to be walkable; a string would force every technical note to be
 *     authored twice and drift.
 *   - Arithmetic lives in the binding layer (`occupant_count`, `dignity`,
 *     `element`, `sign_distance` are precomputed context fields), not in rules.
 *   - Conditionals are expressed as `variants`, not as `if`.
 */

import { z } from "zod";

export const RULE_CATEGORIES = ["core", "career", "love"] as const;
export const RULE_PRIORITIES = ["high", "medium", "low"] as const;
export const RULE_TIERS = ["foundation", "signature", "combination"] as const;
export const DIGNITIES = ["exalted", "own_sign", "debilitated", "neutral"] as const;

/**
 * The planet sets `for_each` can expand over.
 *
 * The three category-specific sets exist because the legacy dignity loop
 * assigned `category` dynamically per planet, and the schema deliberately has
 * no expression for that. Splitting one record per category keeps every rule's
 * category statically inspectable, which the selection layer's diversity
 * constraint depends on.
 */
export const FOR_EACH_SETS = [
  "classical_planets",
  "all_planets",
  "core_planets",
  "career_planets",
  "love_planets",
] as const;

export type ForEachSet = (typeof FOR_EACH_SETS)[number];

/** A path reference. Always "$"-prefixed so it can never be confused with a literal. */
const pathRef = z
  .string()
  .regex(/^\$[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, "path must look like $binding.field");

/**
 * Selectors bind a local name to a chart object. "@p" resolves the `for_each`
 * variable.
 *
 * `derived` is the escape hatch for chart-level aggregates (dominant element,
 * planets in angular houses). It is the binding layer doing arithmetic so the
 * rules do not have to.
 */
const selectorSchema = z.discriminatedUnion("from", [
  z.object({ from: z.literal("planet"), name: z.string().min(2) }), // "Venus" | "@p"
  z.object({ from: z.literal("house"), number: z.number().int().min(1).max(12) }),
  z.object({ from: z.literal("house_lord"), house: z.number().int().min(1).max(12) }),
  z.object({ from: z.literal("ascendant") }),
  z.object({ from: z.literal("ascendant_lord") }),
  z.object({ from: z.literal("densest_house") }),
  z.object({ from: z.literal("derived") }),
]);

export type Selector = z.infer<typeof selectorSchema>;

// ---------------------------------------------------------------------------
// Predicates -- closed set
// ---------------------------------------------------------------------------

export type Predicate =
  | { op: "always" }
  | { op: "eq"; left: string; right: string | number | boolean }
  | { op: "neq"; left: string; right: string | number | boolean }
  | { op: "eqPath"; left: string; right: string }
  | { op: "neqPath"; left: string; right: string }
  | { op: "in"; left: string; values: (string | number)[] }
  | { op: "notIn"; left: string; values: (string | number)[] }
  | { op: "gte"; left: string; value: number }
  | { op: "lte"; left: string; value: number }
  | { op: "sameHouse"; a: string; b: string }
  | { op: "signDistance"; from: string; to: string; oneOf: number[] }
  | { op: "dignity"; planet: string; is: (typeof DIGNITIES)[number][] }
  | { op: "rulesHouse"; planet: string; house: number }
  | { op: "countPlanetsInHouses"; houses: number[]; gte?: number; lte?: number }
  | { op: "all"; of: Predicate[] }
  | { op: "any"; of: Predicate[] }
  | { op: "not"; of: Predicate };

// The explicit z.ZodType<Predicate> annotation is required -- without it TS
// reports TS7022 on the self-referential lazy schema.
export const predicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.discriminatedUnion("op", [
    z.object({ op: z.literal("always") }),
    z.object({ op: z.literal("eq"), left: pathRef, right: z.union([z.string(), z.number(), z.boolean()]) }),
    z.object({ op: z.literal("neq"), left: pathRef, right: z.union([z.string(), z.number(), z.boolean()]) }),
    z.object({ op: z.literal("eqPath"), left: pathRef, right: pathRef }),
    z.object({ op: z.literal("neqPath"), left: pathRef, right: pathRef }),
    z.object({ op: z.literal("in"), left: pathRef, values: z.array(z.union([z.string(), z.number()])).min(1) }),
    z.object({ op: z.literal("notIn"), left: pathRef, values: z.array(z.union([z.string(), z.number()])).min(1) }),
    z.object({ op: z.literal("gte"), left: pathRef, value: z.number() }),
    z.object({ op: z.literal("lte"), left: pathRef, value: z.number() }),
    z.object({ op: z.literal("sameHouse"), a: pathRef, b: pathRef }),
    z.object({
      op: z.literal("signDistance"),
      from: pathRef,
      to: pathRef,
      oneOf: z.array(z.number().int().min(1).max(12)).min(1),
    }),
    z.object({ op: z.literal("dignity"), planet: pathRef, is: z.array(z.enum(DIGNITIES)).min(1) }),
    z.object({ op: z.literal("rulesHouse"), planet: pathRef, house: z.number().int().min(1).max(12) }),
    z.object({
      op: z.literal("countPlanetsInHouses"),
      houses: z.array(z.number().int().min(1).max(12)).min(1),
      gte: z.number().int().optional(),
      lte: z.number().int().optional(),
    }),
    z.object({ op: z.literal("all"), of: z.array(predicateSchema).min(2).max(4) }),
    z.object({ op: z.literal("any"), of: z.array(predicateSchema).min(2).max(4) }),
    z.object({ op: z.literal("not"), of: predicateSchema }),
  ]),
) as z.ZodType<Predicate>;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/**
 * Three token forms only:
 *   {$binding.field}              -> resolved value
 *   {$binding.field|filter}       -> filter in { lower, list, ordinal, theme, dignity, degrees }
 *   {@table_name[$binding.field]} -> lookup in lib/rules/tables.ts
 *
 * No arithmetic. No conditionals. Conditionals are `variants`.
 */
const templateString = z.string().min(1).max(1200);

/**
 * Display templates additionally forbid degrees. The `degrees` filter and the
 * degree paths remain reachable from `evidence.*`, which is where a number like
 * "12.47 deg" legitimately belongs.
 */
const displayTemplate = templateString.refine(
  (t) => !/degree_in_sign|longitude|\bdeg\b|°|\|degrees\}/.test(t),
  { message: "display templates may not reference degrees" },
);

const variantSchema = z.object({
  when: predicateSchema,
  text: templateString,
});

export type Variant = z.infer<typeof variantSchema>;

const claimSpecSchema = z.object({
  label: z.string().min(1).max(40),
  path: pathRef,
  format: z.enum(["raw", "ordinal_house", "dignity", "list", "degrees", "element_counts"]).default("raw"),
  kind: z.enum(["placement", "lordship", "dignity", "aspect", "count", "measurement"]),
  detail: templateString.optional(),
});

export type ClaimSpec = z.infer<typeof claimSpecSchema>;

const strengthSchema = z.object({
  base: z.number().min(0).max(1),
  bonuses: z
    .array(
      z.object({
        when: predicateSchema,
        add: z.number().min(-0.5).max(0.5),
      }),
    )
    .max(6)
    .default([]),
});

export type StrengthSpec = z.infer<typeof strengthSchema>;

// ---------------------------------------------------------------------------
// The rule record
// ---------------------------------------------------------------------------

export const ruleDefinitionSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/, "id must be `group.name`"),
  tier: z.enum(RULE_TIERS),
  category: z.enum(RULE_CATEGORIES),
  priority: z.enum(RULE_PRIORITIES),

  /**
   * id plus bound discriminators, unique within one chart. Authored rather than
   * derived so a rule controls its own React key -- a key that silently changes
   * shape remounts a card on every recompute.
   */
  instance_key: templateString,

  /** Expands one record into N concrete rules before evaluation. "@p" refers to the value. */
  for_each: z
    .object({
      as: z.literal("p"),
      over: z.enum(FOR_EACH_SETS),
    })
    .nullable()
    .default(null),

  bind: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), selectorSchema),

  when: predicateSchema,

  /** Rarity lookup key. Templated so parameterised rules get per-instance fire rates. */
  rarity_key: templateString,

  strength: strengthSchema,

  display: z.object({
    headline: displayTemplate,
    body: displayTemplate,
    /** First matching variant wins; none matching means no tension line. */
    tension: z.array(variantSchema).max(3).default([]),
  }),

  evidence: z.object({
    technical_note: templateString,
    claims: z.array(claimSpecSchema).min(1).max(6),
  }),
});

export type RuleDefinition = z.infer<typeof ruleDefinitionSchema>;
export type RuleDefinitionInput = z.input<typeof ruleDefinitionSchema>;

export const ruleFileSchema = z.array(ruleDefinitionSchema).min(1);

// ---------------------------------------------------------------------------
// Tree walking -- shared by the static checker and the definitions test
// ---------------------------------------------------------------------------

/** Every `$path` string a predicate references, in tree order. */
export function predicatePaths(pred: Predicate): string[] {
  switch (pred.op) {
    case "always":
      return [];
    case "eq":
    case "neq":
    case "in":
    case "notIn":
    case "gte":
    case "lte":
      return [pred.left];
    case "eqPath":
    case "neqPath":
      return [pred.left, pred.right];
    case "sameHouse":
      return [pred.a, pred.b];
    case "signDistance":
      return [pred.from, pred.to];
    case "dignity":
      return [pred.planet];
    case "rulesHouse":
      return [pred.planet];
    case "countPlanetsInHouses":
      return [];
    case "all":
    case "any":
      return pred.of.flatMap(predicatePaths);
    case "not":
      return predicatePaths(pred.of);
  }
}

/** The `$binding` root of a path, e.g. "$lord10.house" -> "lord10". */
export function pathRoot(path: string): string {
  return path.slice(1).split(".")[0];
}
