/**
 * The predicate evaluator.
 *
 * Returns both the boolean and a trace of the clauses that actually matched.
 * The trace is the reason predicates are a walkable tree rather than a parsed
 * string: `evidence.matched_conditions` is derived from it, so a rule's
 * technical provenance can never drift from the condition that produced it.
 */

import type { Predicate } from "./schema";
import type { RuleContext, PlanetFacts } from "./context";
import { signDistance } from "./context";
import { resolvePath, type Bindings } from "./paths";

export type EvalResult = {
  matched: boolean;
  /** Human-readable descriptions of the leaf clauses that matched. */
  trace: string[];
};

/** "$lord10.house" -> "lord10.house". Traces read better without the sigil. */
function label(path: string): string {
  return path.slice(1);
}

function asPlanet(value: unknown): PlanetFacts | null {
  if (value && typeof value === "object" && "dignity" in value && "house" in value) {
    return value as PlanetFacts;
  }
  return null;
}

export function evaluate(pred: Predicate, ctx: RuleContext, bindings: Bindings): EvalResult {
  switch (pred.op) {
    case "always":
      return { matched: true, trace: [] };

    case "eq": {
      const left = resolvePath(pred.left, bindings);
      const matched = left === pred.right;
      return { matched, trace: matched ? [`${label(pred.left)} is ${String(pred.right)}`] : [] };
    }

    case "neq": {
      const left = resolvePath(pred.left, bindings);
      const matched = left !== pred.right;
      return {
        matched,
        trace: matched ? [`${label(pred.left)} (${String(left)}) is not ${String(pred.right)}`] : [],
      };
    }

    case "eqPath": {
      const left = resolvePath(pred.left, bindings);
      const right = resolvePath(pred.right, bindings);
      const matched = left === right;
      return {
        matched,
        trace: matched ? [`${label(pred.left)} matches ${label(pred.right)} (${String(left)})`] : [],
      };
    }

    case "neqPath": {
      const left = resolvePath(pred.left, bindings);
      const right = resolvePath(pred.right, bindings);
      const matched = left !== right;
      return {
        matched,
        trace: matched
          ? [`${label(pred.left)} (${String(left)}) differs from ${label(pred.right)} (${String(right)})`]
          : [],
      };
    }

    case "in": {
      const left = resolvePath(pred.left, bindings) as string | number;
      const matched = pred.values.includes(left);
      return {
        matched,
        trace: matched ? [`${label(pred.left)} (${String(left)}) is one of ${pred.values.join(", ")}`] : [],
      };
    }

    case "notIn": {
      const left = resolvePath(pred.left, bindings) as string | number;
      const matched = !pred.values.includes(left);
      return {
        matched,
        trace: matched ? [`${label(pred.left)} (${String(left)}) is none of ${pred.values.join(", ")}`] : [],
      };
    }

    case "gte": {
      const left = Number(resolvePath(pred.left, bindings));
      const matched = Number.isFinite(left) && left >= pred.value;
      return { matched, trace: matched ? [`${label(pred.left)} is ${left} (at least ${pred.value})`] : [] };
    }

    case "lte": {
      const left = Number(resolvePath(pred.left, bindings));
      const matched = Number.isFinite(left) && left <= pred.value;
      return { matched, trace: matched ? [`${label(pred.left)} is ${left} (at most ${pred.value})`] : [] };
    }

    case "sameHouse": {
      const a = asPlanet(resolvePath(pred.a, bindings));
      const b = asPlanet(resolvePath(pred.b, bindings));
      const matched = a !== null && b !== null && a.house === b.house;
      return { matched, trace: matched ? [`${a!.name} and ${b!.name} share house ${a!.house}`] : [] };
    }

    case "signDistance": {
      const from = asPlanet(resolvePath(pred.from, bindings));
      const to = asPlanet(resolvePath(pred.to, bindings));
      if (!from || !to) return { matched: false, trace: [] };
      const distance = signDistance(from.sign, to.sign);
      const matched = pred.oneOf.includes(distance);
      return {
        matched,
        trace: matched
          ? [`${to.name} is ${distance} signs from ${from.name} (one of ${pred.oneOf.join(", ")})`]
          : [],
      };
    }

    case "dignity": {
      const planet = asPlanet(resolvePath(pred.planet, bindings));
      const matched = planet !== null && pred.is.includes(planet.dignity);
      return { matched, trace: matched ? [`${planet!.name} is ${planet!.dignity.replace(/_/g, " ")}`] : [] };
    }

    case "rulesHouse": {
      const planet = asPlanet(resolvePath(pred.planet, bindings));
      const matched = planet !== null && planet.rules_houses.includes(pred.house);
      return { matched, trace: matched ? [`${planet!.name} rules house ${pred.house}`] : [] };
    }

    case "countPlanetsInHouses": {
      const count = Object.values(ctx.planets).filter((p) => pred.houses.includes(p.house)).length;
      const meetsGte = pred.gte === undefined || count >= pred.gte;
      const meetsLte = pred.lte === undefined || count <= pred.lte;
      const matched = meetsGte && meetsLte;
      return {
        matched,
        trace: matched ? [`${count} planets in houses ${pred.houses.join(", ")}`] : [],
      };
    }

    case "all": {
      const results = pred.of.map((p) => evaluate(p, ctx, bindings));
      const matched = results.every((r) => r.matched);
      return { matched, trace: matched ? results.flatMap((r) => r.trace) : [] };
    }

    case "any": {
      const results = pred.of.map((p) => evaluate(p, ctx, bindings));
      const matched = results.some((r) => r.matched);
      return { matched, trace: matched ? results.filter((r) => r.matched).flatMap((r) => r.trace) : [] };
    }

    case "not": {
      const inner = evaluate(pred.of, ctx, bindings);
      return { matched: !inner.matched, trace: [] };
    }
  }
}

/** Convenience wrapper for callers that only need the boolean. */
export function matches(pred: Predicate, ctx: RuleContext, bindings: Bindings): boolean {
  return evaluate(pred, ctx, bindings).matched;
}
