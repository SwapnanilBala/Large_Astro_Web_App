import type { PlanetPosition } from "../swiss-ephemeris-engine";
import { calculateNavamsa } from "../navamsa-engine";
import type { YogaChartInput } from "./types";
import { getSignLord, isExalted, isOwnSign } from "./helpers";

// --------------------------------------------------------------------------
// Navamsa yogas
// --------------------------------------------------------------------------
/*
 * The combinations that read the D9 as well as the rasi chart.
 *
 * These were left out when the catalogue doubled, on the grounds that
 * computing a navamsa here would put a second definition of a divisional
 * chart in this file. That objection was about *recomputing* it. Calling
 * `calculateNavamsa`, which is the engine the rest of the app already uses,
 * raises no such problem -- and it needs nothing that `YogaChartInput` was not
 * already carrying, since the D9 sign of a planet follows from its rasi sign
 * and its degree within that sign.
 *
 * The one thing the input did lack is the ascendant's degree. `ascendantSign`
 * alone cannot yield a navamsa, so `ascendantDegreeInSign` is a new optional
 * field and Lagna Vargottama is the only record that requires it; every other
 * yoga in this file behaves exactly as before when it is absent.
 *
 * A note on which navamsa. There are two implementations in the tree --
 * `navamsa-engine.calculateNavamsa` and `divisional-engine.computeD9` -- and
 * as of 2026-09-26 they agree exactly, which they did not before (see the
 * comment on NAVAMSA_SPAN). This file uses the former, because life-domain
 * rules already do, so a yoga and a life-area reading cannot disagree about
 * the same planet.
 */

/* One chart is put through every definition in the catalogue, so the D9 is
   computed once per chart rather than once per navamsa yoga. Keyed on the
   planets array itself, which detectYogas passes through unchanged. */
const navamsaCache = new WeakMap<PlanetPosition[], Map<string, string>>();

export function navamsaSigns(chart: YogaChartInput): Map<string, string> {
  const cached = navamsaCache.get(chart.planets);
  if (cached) return cached;
  const signs = new Map<string, string>();
  for (const position of calculateNavamsa(chart.planets)) {
    signs.set(position.name, position.navamsa_sign);
  }
  navamsaCache.set(chart.planets, signs);
  return signs;
}

/** The lord of the sign a planet holds in the D9. */
export function navamsaDispositor(chart: YogaChartInput, planetName: string): string | null {
  const sign = navamsaSigns(chart).get(planetName);
  return sign ? getSignLord(sign) : null;
}

/** The ascendant's own D9 sign, which needs a degree the caller may not supply. */
export function ascendantNavamsaSign(chart: YogaChartInput): string | null {
  const degree = chart.ascendantDegreeInSign;
  if (degree === undefined || !Number.isFinite(degree) || degree < 0 || degree >= 30) {
    return null;
  }
  const [position] = calculateNavamsa([
    { name: "Ascendant", longitude: 0, sign: chart.ascendantSign, degree_in_sign: degree, house: 1 },
  ]);
  return position?.navamsa_sign ?? null;
}

/** Dignity counted in either chart, which is how the texts state it. */
export function dignifiedInRasiOrNavamsa(chart: YogaChartInput, planet: PlanetPosition): boolean {
  if (isExalted(planet.name, planet.sign) || isOwnSign(planet.name, planet.sign)) return true;
  const navamsa = navamsaSigns(chart).get(planet.name);
  if (!navamsa) return false;
  return isExalted(planet.name, navamsa) || isOwnSign(planet.name, navamsa);
}
