/**
 * Local device profiles.
 *
 * This app stores everything on the device — there is no server-side account.
 * A "profile" is just a named slot so several people sharing one browser can
 * each keep their own charts, comparisons, palm readings and chart history
 * without seeing each other's data.
 *
 * Every other store scopes its localStorage keys with `profileScopedKey`, so
 * deleting a profile here is enough to take its data with it.
 */

export const MAX_PROFILES = 5;

export type LocalProfile = {
  profile_id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

export type ProfileState = {
  version: number;
  /** False only on the server, where localStorage cannot be read yet. */
  hydrated: boolean;
  profiles: LocalProfile[];
  active_profile_id: string | null;
};

const STORAGE_KEY = "astro_local_profiles";
const STATE_VERSION = 1;

/** Fired on `window` whenever profiles or the active profile change. */
export const PROFILES_CHANGED_EVENT = "astro:profiles-changed";

/**
 * Storage-key prefixes owned by a profile. Deleting a profile clears every
 * key built from these, so any new per-profile store must be registered here
 * or its rows will outlive the profile that created them.
 */
const SCOPED_KEY_PREFIXES = [
  "astro_workspace_saved_charts",
  "astro_workspace_saved_comparisons",
  "astro_chart_history",
  "astro_palm_readings",
  "astro_intake_draft",
  "astro_birth_details_history",
  "astro_insights_section_state",
];

export function profileScopedKey(prefix: string, profileId: string) {
  return `${prefix}:${profileId}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createProfileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable identity — `useSyncExternalStore` compares snapshots by reference. */
const SERVER_STATE: ProfileState = Object.freeze({
  version: STATE_VERSION,
  hydrated: false,
  profiles: Object.freeze([]) as unknown as LocalProfile[],
  active_profile_id: null,
});

function emptyState(): ProfileState {
  return { version: STATE_VERSION, hydrated: true, profiles: [], active_profile_id: null };
}

function isProfile(value: unknown): value is LocalProfile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LocalProfile>;
  return (
    typeof candidate.profile_id === "string" &&
    candidate.profile_id.length > 0 &&
    typeof candidate.display_name === "string"
  );
}

function readState(): ProfileState {
  if (typeof window === "undefined") {
    return SERVER_STATE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();

    const parsed = JSON.parse(raw) as Partial<ProfileState>;
    const profiles = Array.isArray(parsed.profiles)
      ? parsed.profiles.filter(isProfile).slice(0, MAX_PROFILES)
      : [];
    const activeId =
      typeof parsed.active_profile_id === "string" &&
      profiles.some((profile) => profile.profile_id === parsed.active_profile_id)
        ? parsed.active_profile_id
        : (profiles[0]?.profile_id ?? null);

    return { version: STATE_VERSION, hydrated: true, profiles, active_profile_id: activeId };
  } catch {
    return emptyState();
  }
}

function writeState(state: ProfileState) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A full or blocked storage quota should not take the app down; the
    // in-memory state stays correct for this session.
  }

  window.dispatchEvent(new CustomEvent(PROFILES_CHANGED_EVENT));
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Chart history predates profiles and lived at a single unscoped key.
 * Hand it to the first profile the device seeds so nobody loses the charts
 * they had before the accounts came out.
 */
function adoptLegacyChartHistory(profileId: string) {
  if (typeof window === "undefined") return;

  const legacyKey = "astro_chart_history";
  try {
    const legacy = window.localStorage.getItem(legacyKey);
    if (!legacy) return;

    const scopedKey = profileScopedKey(legacyKey, profileId);
    if (window.localStorage.getItem(scopedKey) === null) {
      window.localStorage.setItem(scopedKey, legacy);
    }
    window.localStorage.removeItem(legacyKey);
  } catch {
    // Nothing to recover if storage is unavailable.
  }
}

/**
 * Remove every key this profile owns.
 *
 * Matches on the `prefix:profileId` stem rather than the exact key, because
 * some stores append a further discriminator (the insights section state is
 * keyed per chart, as `prefix:profileId:queryString`).
 */
function clearScopedData(profileId: string) {
  if (typeof window === "undefined") return;

  try {
    const stems = SCOPED_KEY_PREFIXES.map((prefix) => profileScopedKey(prefix, profileId));
    const doomed = Object.keys(window.localStorage).filter((key) =>
      stems.some((stem) => key === stem || key.startsWith(`${stem}:`))
    );
    for (const key of doomed) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

export type ProfileMutationResult = {
  ok: boolean;
  error?: string;
  profile?: LocalProfile;
};

/**
 * Read the stored profiles, seeding the first one if the device is new.
 *
 * Called on mount by the profile context so there is always somewhere for
 * data to land — a fresh visitor should not have to name themselves before
 * the app will remember a single chart.
 */
export function loadOrSeedProfiles(defaultName = "You"): ProfileState {
  const state = readState();
  if (state.profiles.length > 0) {
    // Repair a dangling active id without forcing a write on every load.
    if (!state.active_profile_id) {
      const repaired = { ...state, active_profile_id: state.profiles[0].profile_id };
      writeState(repaired);
      return repaired;
    }
    return state;
  }

  const timestamp = nowIso();
  const seeded: LocalProfile = {
    profile_id: createProfileId(),
    display_name: normalizeName(defaultName) || "You",
    created_at: timestamp,
    updated_at: timestamp,
  };
  const nextState: ProfileState = {
    version: STATE_VERSION,
    hydrated: true,
    profiles: [seeded],
    active_profile_id: seeded.profile_id,
  };
  adoptLegacyChartHistory(seeded.profile_id);
  writeState(nextState);
  return nextState;
}

export function createProfile(name: string): ProfileMutationResult {
  const state = readState();
  const displayName = normalizeName(name);

  if (!displayName) {
    return { ok: false, error: "Enter a name for this profile." };
  }
  if (displayName.length > 40) {
    return { ok: false, error: "Profile names are limited to 40 characters." };
  }
  if (state.profiles.length >= MAX_PROFILES) {
    return {
      ok: false,
      error: `This device already holds ${MAX_PROFILES} profiles. Delete one to add another.`,
    };
  }
  if (
    state.profiles.some(
      (profile) => profile.display_name.toLowerCase() === displayName.toLowerCase()
    )
  ) {
    return { ok: false, error: "A profile with that name already exists." };
  }

  const timestamp = nowIso();
  const profile: LocalProfile = {
    profile_id: createProfileId(),
    display_name: displayName,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeState({
    version: STATE_VERSION,
    hydrated: true,
    profiles: [...state.profiles, profile],
    active_profile_id: profile.profile_id,
  });

  return { ok: true, profile };
}

export function renameProfile(profileId: string, name: string): ProfileMutationResult {
  const state = readState();
  const displayName = normalizeName(name);

  if (!displayName) {
    return { ok: false, error: "Enter a name for this profile." };
  }
  if (displayName.length > 40) {
    return { ok: false, error: "Profile names are limited to 40 characters." };
  }
  if (!state.profiles.some((profile) => profile.profile_id === profileId)) {
    return { ok: false, error: "That profile no longer exists." };
  }
  if (
    state.profiles.some(
      (profile) =>
        profile.profile_id !== profileId &&
        profile.display_name.toLowerCase() === displayName.toLowerCase()
    )
  ) {
    return { ok: false, error: "A profile with that name already exists." };
  }

  let renamed: LocalProfile | undefined;
  const profiles = state.profiles.map((profile) => {
    if (profile.profile_id !== profileId) return profile;
    renamed = { ...profile, display_name: displayName, updated_at: nowIso() };
    return renamed;
  });

  writeState({ ...state, profiles });
  return { ok: true, profile: renamed };
}

/**
 * Remove a profile and everything scoped to it.
 *
 * The last profile cannot be deleted — the app always needs a place to put
 * data, and an empty device would just re-seed one on the next load anyway.
 */
export function deleteProfile(profileId: string): ProfileMutationResult {
  const state = readState();

  if (!state.profiles.some((profile) => profile.profile_id === profileId)) {
    return { ok: false, error: "That profile no longer exists." };
  }
  if (state.profiles.length <= 1) {
    return { ok: false, error: "Keep at least one profile on this device." };
  }

  const profiles = state.profiles.filter((profile) => profile.profile_id !== profileId);
  const activeId =
    state.active_profile_id === profileId
      ? profiles[0].profile_id
      : state.active_profile_id;

  clearScopedData(profileId);
  writeState({ version: STATE_VERSION, hydrated: true, profiles, active_profile_id: activeId });

  return { ok: true };
}

export function setActiveProfile(profileId: string): ProfileMutationResult {
  const state = readState();
  if (!state.profiles.some((profile) => profile.profile_id === profileId)) {
    return { ok: false, error: "That profile no longer exists." };
  }

  writeState({ ...state, active_profile_id: profileId });
  return { ok: true };
}

/**
 * Subscribe to profile changes from this tab and from other tabs.
 *
 * Seeds the device's first profile on the way in. `useSyncExternalStore` runs
 * this in an effect, which is the right place for that write — doing it during
 * render would be a side effect, and doing it in the component would mean a
 * setState cascade on every mount.
 */
export function subscribeToProfiles(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(PROFILES_CHANGED_EVENT, listener);
  window.addEventListener("storage", onStorage);

  loadOrSeedProfiles();

  return () => {
    window.removeEventListener(PROFILES_CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

/*
 * Snapshot accessors for `useSyncExternalStore`.
 *
 * React re-renders whenever the snapshot's identity changes, so the parsed
 * state is cached against the raw stored string — otherwise every render would
 * hand back a fresh object and loop forever.
 */
let snapshotCache: { raw: string | null; value: ProfileState } | null = null;

export function getProfilesSnapshot(): ProfileState {
  if (typeof window === "undefined") {
    return SERVER_STATE;
  }

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (snapshotCache && snapshotCache.raw === raw) {
    return snapshotCache.value;
  }

  const value = readState();
  snapshotCache = { raw, value };
  return value;
}

export function getServerProfilesSnapshot(): ProfileState {
  return SERVER_STATE;
}
