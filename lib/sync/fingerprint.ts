/**
 * Deterministic keys for the rows a chart push touches.
 *
 * Every one of these exists so that pushing the same chart twice is a no-op
 * rather than a duplicate. The alternative — letting the server generate ids
 * and having the client remember them — needs a mapping table, and a mapping
 * table is a second source of truth for "which row is this chart".
 *
 * All three are SHA-256 hex, so they are fixed-length and fit the columns they
 * land in: `clients.external_reference` is varchar(120) and
 * `chart_calculations.input_fingerprint` is varchar(128).
 *
 * These are not secrets and are not trying to be. A digest of a name is not
 * anonymisation — the name is stored in the next column over. The digest is
 * here to be *stable and short*, nothing more.
 */

import { createHash } from "node:crypto";

/** Birth facts that identify one version of one person's chart input. */
export type BirthFacts = {
  name: string;
  birthDate: string;
  birthTime: string;
  latitude: number | null;
  longitude: number | null;
  timezoneOffsetMinutes: number;
  timeZoneId: string;
  country: string;
  state: string;
  city: string;
  town: string;
};

function digest(parts: readonly (string | number | null)[]): string {
  /* Unit separator as the joiner: it cannot occur in any of these values, so
     ["a", "bc"] and ["ab", "c"] cannot collide into the same input. */
  return createHash("sha256").update(parts.map((p) => String(p ?? "")).join("\u001f")).digest("hex");
}

/**
 * Which person this chart is for, within one workspace.
 *
 * Name and birth date only, deliberately. Someone who re-runs their own chart
 * after fixing a typo in the birth time is the same person, and should end up
 * as one `clients` row with a corrected birth profile rather than two people
 * who happen to share a name.
 */
export function clientReference(name: string, birthDate: string): string {
  return digest([name.trim().toLowerCase(), birthDate.trim()]);
}

/**
 * Which version of the birth facts this is.
 *
 * Covers everything `birth_profiles` stores, so a changed birth time or a
 * corrected city produces a different value and the old profile gets
 * superseded rather than silently overwritten.
 */
export function birthFingerprint(facts: BirthFacts): string {
  return digest([
    facts.name.trim().toLowerCase(),
    facts.birthDate.trim(),
    facts.birthTime.trim(),
    facts.latitude,
    facts.longitude,
    facts.timezoneOffsetMinutes,
    facts.timeZoneId.trim(),
    facts.country.trim(),
    facts.state.trim(),
    facts.city.trim(),
    facts.town.trim(),
  ]);
}

/**
 * Which calculation this is, for `chart_calculations.input_fingerprint`.
 *
 * The engine id is part of it because the same birth facts run through Lahiri
 * and through Fagan-Bradley are two different charts, both worth keeping.
 */
export function chartInputFingerprint(facts: BirthFacts, engineId: string): string {
  return digest([birthFingerprint(facts), engineId.trim()]);
}
