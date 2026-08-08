/**
 * Selector resolution, `$path` lookup, template rendering and claim formatting.
 *
 * Everything a rule record can say about a chart passes through this file. It
 * is deliberately small: two token forms, seven filters, no arithmetic.
 */

import type { ClaimSpec, Selector } from "./schema";
import { pathRoot } from "./schema";
import type { RuleContext } from "./context";
import { SIGN_RULERS } from "./context";
import { TABLES, HOUSE_THEMES } from "./tables";
import type { EvidenceClaim } from "@/lib/astro-types";

/** A resolved binding: a planet, a house, the ascendant, or the derived block. */
export type Bindings = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Formatting primitives
// ---------------------------------------------------------------------------

export function ordinal(v: number): string {
  if (v % 100 >= 10 && v % 100 <= 20) return `${v}th`;
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  return `${v}${suffixes[v % 10] || "th"}`;
}

/** "own_sign" -> "own sign". Keeps dignity readable without a lookup table. */
export function humanDignity(v: string): string {
  return v.replace(/_/g, " ");
}

/** { Earth: 3, Fire: 2 } -> "Earth 3, Fire 2". Replaces the JSON.stringify dump. */
export function formatElementCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "none";
  return entries.map(([el, n]) => `${el} ${n}`).join(", ");
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export class RuleResolutionError extends Error {}

/**
 * Resolve one selector against the chart.
 *
 * `forEachValue` is the concrete planet name bound to "@p" when the rule is a
 * `for_each` expansion. Selectors are resolved once per rule instance, before
 * any predicate runs.
 */
export function resolveSelector(
  sel: Selector,
  ctx: RuleContext,
  forEachValue: string | null,
): unknown {
  switch (sel.from) {
    case "planet": {
      const name = sel.name === "@p" ? forEachValue : sel.name;
      if (!name) {
        throw new RuleResolutionError(`planet selector used "@p" but no for_each value is bound`);
      }
      const planet = ctx.planets[name];
      if (!planet) throw new RuleResolutionError(`planet ${name} is not in this chart`);
      return planet;
    }
    case "house": {
      const house = ctx.houses[sel.number];
      if (!house) throw new RuleResolutionError(`house ${sel.number} is not in this chart`);
      return house;
    }
    case "house_lord": {
      const house = ctx.houses[sel.house];
      if (!house) throw new RuleResolutionError(`house ${sel.house} is not in this chart`);
      const lord = ctx.planets[house.lord];
      if (!lord) throw new RuleResolutionError(`lord ${house.lord} of house ${sel.house} is not in this chart`);
      return lord;
    }
    case "ascendant":
      return ctx.ascendant;
    case "ascendant_lord": {
      const lordName = SIGN_RULERS[ctx.ascendant.sign];
      const lord = ctx.planets[lordName];
      if (!lord) throw new RuleResolutionError(`ascendant lord ${lordName} is not in this chart`);
      return lord;
    }
    case "densest_house": {
      const house = ctx.houses[ctx.derived.densest_house];
      if (!house) throw new RuleResolutionError(`densest house is not in this chart`);
      return house;
    }
    case "derived":
      return ctx.derived;
  }
}

/**
 * Resolve every selector in a rule's `bind` map.
 *
 * Returns null when a required object is missing from the chart -- a rule that
 * cannot be bound simply does not fire, rather than crashing the whole engine
 * on one malformed chart.
 */
export function resolveBindings(
  bind: Record<string, Selector>,
  ctx: RuleContext,
  forEachValue: string | null,
): Bindings | null {
  const out: Bindings = {};
  for (const [name, sel] of Object.entries(bind)) {
    try {
      out[name] = resolveSelector(sel, ctx, forEachValue);
    } catch (err) {
      if (err instanceof RuleResolutionError) return null;
      throw err;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Path lookup
// ---------------------------------------------------------------------------

/** Resolve "$binding.a.b" against the bindings map. Throws on an unbound root. */
export function resolvePath(path: string, bindings: Bindings): unknown {
  const segments = path.slice(1).split(".");
  const root = segments[0];
  if (!(root in bindings)) {
    throw new RuleResolutionError(`path ${path} references unbound name "${root}"`);
  }
  let value: unknown = bindings[root];
  for (const seg of segments.slice(1)) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[seg];
  }
  return value;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const TEMPLATE_FILTERS = [
  "lower",
  "list",
  "slug",
  "ordinal",
  "theme",
  "dignity",
  "degrees",
] as const;

export type TemplateFilter = (typeof TEMPLATE_FILTERS)[number];

function applyFilter(value: unknown, filter: string, path: string): string {
  switch (filter) {
    case "lower":
      return String(value).toLowerCase();
    case "list":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "slug":
      return Array.isArray(value) ? value.join("-") : String(value);
    case "ordinal":
      return ordinal(Number(value));
    case "theme":
      return HOUSE_THEMES[Number(value)] ?? String(value);
    case "dignity":
      return humanDignity(String(value));
    case "degrees":
      return Number(value).toFixed(2);
    default:
      throw new RuleResolutionError(`unknown filter "${filter}" in ${path}`);
  }
}

/**
 * Matches the two token forms:
 *   {$binding.field}  /  {$binding.field|filter}
 *   {@table[$binding.field]}
 */
const TOKEN_RE = /\{@([a-z][a-z0-9_]*)\[(\$[a-z][a-z0-9_.]*)\]\}|\{(\$[a-z][a-z0-9_.]*)(?:\|([a-z_]+))?\}/g;

export function renderTemplate(template: string, bindings: Bindings): string {
  return template.replace(
    TOKEN_RE,
    (_match, tableName: string | undefined, tablePath: string | undefined, path: string | undefined, filter: string | undefined) => {
      if (tableName !== undefined && tablePath !== undefined) {
        const table = TABLES[tableName];
        if (!table) throw new RuleResolutionError(`unknown table "@${tableName}"`);
        const key = resolvePath(tablePath, bindings) as string | number;
        const entry = table[key];
        if (entry === undefined) {
          throw new RuleResolutionError(`table "@${tableName}" has no entry for "${String(key)}"`);
        }
        return entry;
      }
      const value = resolvePath(path!, bindings);
      if (filter) return applyFilter(value, filter, path!);
      if (Array.isArray(value)) return value.join(", ");
      return String(value);
    },
  );
}

/** Every `$path` and `@table` a template references. Used by the static checker. */
export function templateRefs(template: string): { paths: string[]; tables: string[] } {
  const paths: string[] = [];
  const tables: string[] = [];
  for (const m of template.matchAll(TOKEN_RE)) {
    if (m[1] !== undefined) {
      tables.push(m[1]);
      paths.push(m[2]);
    } else {
      paths.push(m[3]);
    }
  }
  return { paths, tables };
}

/** Every filter name a template uses, for load-time validation. */
export function templateFilters(template: string): string[] {
  const out: string[] = [];
  for (const m of template.matchAll(TOKEN_RE)) {
    if (m[4] !== undefined) out.push(m[4]);
  }
  return out;
}

/** The distinct binding names a template depends on. */
export function templateRoots(template: string): string[] {
  return templateRefs(template).paths.map(pathRoot);
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

function formatClaimValue(value: unknown, format: ClaimSpec["format"]): string {
  switch (format) {
    case "ordinal_house":
      return `${ordinal(Number(value))} house`;
    case "dignity":
      return humanDignity(String(value));
    case "list": {
      if (!Array.isArray(value)) return String(value);
      return value.length > 0 ? value.join(", ") : "none";
    }
    case "degrees":
      return `${Number(value).toFixed(2)} deg`;
    case "element_counts":
      return formatElementCounts((value ?? {}) as Record<string, number>);
    case "raw":
    default:
      return Array.isArray(value) ? value.join(", ") : String(value);
  }
}

export function buildClaim(spec: ClaimSpec, bindings: Bindings): EvidenceClaim {
  const raw = resolvePath(spec.path, bindings);
  const claim: EvidenceClaim = {
    label: spec.label,
    value: formatClaimValue(raw, spec.format),
    kind: spec.kind,
  };
  if (spec.detail) claim.detail = renderTemplate(spec.detail, bindings);
  return claim;
}
