/**
 * The device-local storage scope.
 *
 * Everything this app keeps in the browser — chart history, palm readings, the
 * intake draft, the recent birth details, the insights section state — hangs
 * off one fixed scope. It used to hang off whichever of up to five named local
 * "profiles" was active; that picker is gone and a Google account is now the
 * only identity the app has.
 *
 * The `prefix:scope` key shape is kept rather than flattened to a bare prefix.
 * That makes the migration below a rename rather than a reshape, and it leaves
 * the door open for a per-account scope later without touching every store
 * again.
 */

/** The one scope every local key is filed under. */
export const LOCAL_SCOPE = "local";

/** Where the retired profile picker kept its state. Read once, by the migration. */
const PROFILES_KEY = "astro_local_profiles";

/** Set once the migration has run, so it does not re-scan storage on every mount. */
const MIGRATION_MARKER = "astro_local_scope_migrated";
const MIGRATION_VERSION = "1";

/**
 * Storage-key prefixes that live in the local scope.
 *
 * A new per-device store must be registered here or the migration will not
 * carry it across from the profile that owned it.
 */
export const SCOPED_KEY_PREFIXES = [
  /* Written by the long-removed workspace page. Still listed so a device that
     used it has those rows migrated rather than stranded. */
  "astro_workspace_saved_charts",
  "astro_workspace_saved_comparisons",
  "astro_chart_history",
  "astro_palm_readings",
  "astro_intake_draft",
  "astro_birth_details_history",
  "astro_insights_section_state",
] as const;

export function localScopedKey(prefix: string) {
  return `${prefix}:${LOCAL_SCOPE}`;
}

/** The profile that was last in use, if this device ever had profiles. */
function readActiveProfileId(): string | null {
  const raw = window.localStorage.getItem(PROFILES_KEY);
  if (!raw) return null;

  const parsed = JSON.parse(raw) as {
    active_profile_id?: unknown;
    profiles?: unknown;
  };

  if (typeof parsed.active_profile_id === "string" && parsed.active_profile_id) {
    return parsed.active_profile_id;
  }

  /* A dangling active id was repairable in the old store by falling back to the
     first profile. Same fallback here, or the data of a device whose pointer
     went missing would be treated as if it belonged to nobody. */
  if (Array.isArray(parsed.profiles)) {
    const first = parsed.profiles[0] as { profile_id?: unknown } | undefined;
    if (first && typeof first.profile_id === "string" && first.profile_id) {
      return first.profile_id;
    }
  }

  return null;
}

/** Copy `from` to `to` unless `to` already holds something. */
function claim(from: string, to: string) {
  const value = window.localStorage.getItem(from);
  if (value === null) return;
  if (window.localStorage.getItem(to) !== null) return;
  window.localStorage.setItem(to, value);
}

/**
 * Fold the active profile's data into the fixed scope.
 *
 * Data belonging to the *other* profiles is deliberately left where it is. It
 * is unreachable either way now that the picker is gone, and orphaning a few
 * kilobytes is reversible where deleting somebody else's saved charts is not —
 * on a shared browser those rows belong to a different person. `astro_local_profiles`
 * is kept for the same reason: it is the only remaining record of which orphan
 * belonged to whom, should anyone ever need to get them back.
 */
function migrate() {
  const profileId = readActiveProfileId();

  for (const prefix of SCOPED_KEY_PREFIXES) {
    const target = localScopedKey(prefix);

    /* Devices that predate profiles entirely kept chart history at a bare,
       unscoped key. Adopt that first — it is the oldest shape still out there. */
    claim(prefix, target);

    if (!profileId) continue;

    const stem = `${prefix}:${profileId}`;
    claim(stem, target);

    /* Some stores append a further discriminator — the insights section state is
       keyed per chart as `prefix:scope:queryString` — so the stem is a prefix
       match, not an equality one. Keys are snapshotted before writing: mutating
       localStorage while enumerating it is not safe. */
    const suffixed = Object.keys(window.localStorage).filter((key) =>
      key.startsWith(`${stem}:`),
    );
    for (const key of suffixed) {
      claim(key, `${target}:${key.slice(stem.length + 1)}`);
    }
  }

  window.localStorage.setItem(MIGRATION_MARKER, MIGRATION_VERSION);
}

let checked = false;

/**
 * Run the profile-era migration once per page load.
 *
 * Called at the top of every local store read and write rather than from a
 * mounted component, because an effect in the layout would race the effects in
 * the components that read these keys, and lose about as often as it won.
 */
export function ensureLocalScope() {
  if (checked || typeof window === "undefined") return;
  checked = true;

  try {
    if (window.localStorage.getItem(MIGRATION_MARKER) === MIGRATION_VERSION) return;
    migrate();
  } catch {
    /* Storage is full, blocked, or disabled. The stores below all degrade to
       "nothing saved", which is the same outcome they already have in private
       browsing — not a reason to take the app down. */
  }
}

/** Test seam: forget that the migration was checked this page load. */
export function resetLocalScopeForTests() {
  checked = false;
}
