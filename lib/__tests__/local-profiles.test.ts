import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_PROFILES,
  createProfile,
  deleteProfile,
  getProfilesSnapshot,
  loadOrSeedProfiles,
  profileScopedKey,
  renameProfile,
  setActiveProfile,
} from "@/lib/local-profiles";
import { chartHistoryKey } from "@/lib/chart-history-store";

function names() {
  return getProfilesSnapshot().profiles.map((profile) => profile.display_name);
}

describe("local-profiles", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("seeds a single profile on a fresh device", () => {
    const state = loadOrSeedProfiles();
    expect(state.profiles).toHaveLength(1);
    expect(state.active_profile_id).toBe(state.profiles[0].profile_id);
  });

  it("does not re-seed when profiles already exist", () => {
    const first = loadOrSeedProfiles();
    const second = loadOrSeedProfiles();
    expect(second.profiles).toHaveLength(1);
    expect(second.profiles[0].profile_id).toBe(first.profiles[0].profile_id);
  });

  it("adopts pre-profile chart history into the seeded profile", () => {
    const legacy = JSON.stringify([{ name: "Asha", queryString: "name=Asha" }]);
    localStorage.setItem("astro_chart_history", legacy);

    const state = loadOrSeedProfiles();
    const seededId = state.profiles[0].profile_id;

    expect(localStorage.getItem(chartHistoryKey(seededId))).toBe(legacy);
    expect(localStorage.getItem("astro_chart_history")).toBeNull();
  });

  it("caps the device at MAX_PROFILES", () => {
    loadOrSeedProfiles();
    for (let i = 1; i < MAX_PROFILES; i++) {
      expect(createProfile(`Person ${i}`).ok).toBe(true);
    }
    expect(names()).toHaveLength(MAX_PROFILES);

    const overflow = createProfile("One too many");
    expect(overflow.ok).toBe(false);
    expect(overflow.error).toContain(String(MAX_PROFILES));
    expect(names()).toHaveLength(MAX_PROFILES);
  });

  it("rejects blank and duplicate names, case-insensitively", () => {
    loadOrSeedProfiles();
    expect(createProfile("Asha").ok).toBe(true);

    expect(createProfile("   ").ok).toBe(false);
    expect(createProfile("asha").ok).toBe(false);
    expect(createProfile("ASHA").ok).toBe(false);
  });

  it("makes a newly created profile the active one", () => {
    loadOrSeedProfiles();
    const created = createProfile("Ravi");
    expect(created.ok).toBe(true);
    expect(getProfilesSnapshot().active_profile_id).toBe(created.profile!.profile_id);
  });

  it("renames a profile without touching its id", () => {
    const seeded = loadOrSeedProfiles();
    const id = seeded.profiles[0].profile_id;

    expect(renameProfile(id, "  Renamed   Person ").ok).toBe(true);
    const state = getProfilesSnapshot();
    expect(state.profiles[0].profile_id).toBe(id);
    expect(state.profiles[0].display_name).toBe("Renamed Person");
  });

  it("refuses to delete the last remaining profile", () => {
    const seeded = loadOrSeedProfiles();
    const result = deleteProfile(seeded.profiles[0].profile_id);
    expect(result.ok).toBe(false);
    expect(getProfilesSnapshot().profiles).toHaveLength(1);
  });

  it("deletes a profile along with everything scoped to it", () => {
    loadOrSeedProfiles();
    const created = createProfile("Ravi");
    const id = created.profile!.profile_id;

    const scopedKeys = [
      chartHistoryKey(id),
      profileScopedKey("astro_workspace_saved_charts", id),
      profileScopedKey("astro_palm_readings", id),
      profileScopedKey("astro_intake_draft", id),
      profileScopedKey("astro_birth_details_history", id),
      // Suffixed key — the insights section state appends a chart query.
      `${profileScopedKey("astro_insights_section_state", id)}:name=Asha:core`,
    ];
    for (const key of scopedKeys) {
      localStorage.setItem(key, "[]");
    }

    expect(deleteProfile(id).ok).toBe(true);
    for (const key of scopedKeys) {
      expect(localStorage.getItem(key)).toBeNull();
    }
  });

  it("moves the active profile when the active one is deleted", () => {
    const seeded = loadOrSeedProfiles();
    const keptId = seeded.profiles[0].profile_id;
    const created = createProfile("Ravi");
    const createdId = created.profile!.profile_id;

    expect(getProfilesSnapshot().active_profile_id).toBe(createdId);
    expect(deleteProfile(createdId).ok).toBe(true);
    expect(getProfilesSnapshot().active_profile_id).toBe(keptId);
  });

  it("leaves another profile's data alone on delete", () => {
    loadOrSeedProfiles();
    const a = createProfile("A").profile!.profile_id;
    const b = createProfile("B").profile!.profile_id;

    localStorage.setItem(chartHistoryKey(a), '["a"]');
    localStorage.setItem(chartHistoryKey(b), '["b"]');

    expect(deleteProfile(b).ok).toBe(true);
    expect(localStorage.getItem(chartHistoryKey(a))).toBe('["a"]');
    expect(localStorage.getItem(chartHistoryKey(b))).toBeNull();
  });

  it("rejects switching to a profile that does not exist", () => {
    loadOrSeedProfiles();
    expect(setActiveProfile("nope").ok).toBe(false);
  });

  it("returns a stable snapshot identity while storage is unchanged", () => {
    loadOrSeedProfiles();
    expect(getProfilesSnapshot()).toBe(getProfilesSnapshot());

    createProfile("Ravi");
    const afterWrite = getProfilesSnapshot();
    expect(afterWrite).not.toBe(undefined);
    expect(afterWrite).toBe(getProfilesSnapshot());
  });

  it("survives corrupt stored state", () => {
    localStorage.setItem("astro_local_profiles", "{not json");
    const state = getProfilesSnapshot();
    expect(state.hydrated).toBe(true);
    expect(state.profiles).toEqual([]);
  });
});
