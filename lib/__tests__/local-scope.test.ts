import { beforeEach, describe, expect, it } from "vitest";

import {
  ensureLocalScope,
  localScopedKey,
  resetLocalScopeForTests,
} from "@/lib/local-scope";

/**
 * The migration off the retired profile picker.
 *
 * These are the tests that matter for it: it runs exactly once against a real
 * device's storage, and everything it gets wrong is somebody's saved charts.
 */

const ACTIVE = "profile-active";
const OTHER = "profile-other";

function seedProfiles(activeId: string | null, ids: string[]) {
  localStorage.setItem(
    "astro_local_profiles",
    JSON.stringify({
      version: 1,
      active_profile_id: activeId,
      profiles: ids.map((id) => ({
        profile_id: id,
        display_name: id,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      })),
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  resetLocalScopeForTests();
});

describe("the local scope", () => {
  it("keys every store under one shared scope", () => {
    expect(localScopedKey("astro_chart_history")).toBe("astro_chart_history:local");
    expect(localScopedKey("astro_palm_readings")).toBe("astro_palm_readings:local");
  });

  it("does nothing on a browser that never had profiles", () => {
    ensureLocalScope();
    expect(localStorage.getItem("astro_chart_history:local")).toBeNull();
  });
});

describe("migrating off the profile picker", () => {
  it("adopts the active profile's data", () => {
    seedProfiles(ACTIVE, [ACTIVE]);
    localStorage.setItem(`astro_chart_history:${ACTIVE}`, '["chart"]');
    localStorage.setItem(`astro_palm_readings:${ACTIVE}`, '["palm"]');

    ensureLocalScope();

    expect(localStorage.getItem("astro_chart_history:local")).toBe('["chart"]');
    expect(localStorage.getItem("astro_palm_readings:local")).toBe('["palm"]');
  });

  it("carries across keys that append their own discriminator", () => {
    seedProfiles(ACTIVE, [ACTIVE]);
    localStorage.setItem(
      `astro_insights_section_state:${ACTIVE}:name=Asha`,
      '{"core":true}',
    );

    ensureLocalScope();

    expect(localStorage.getItem("astro_insights_section_state:local:name=Asha")).toBe(
      '{"core":true}',
    );
  });

  it("adopts pre-profile history from the bare, unscoped key", () => {
    localStorage.setItem("astro_chart_history", '["ancient"]');

    ensureLocalScope();

    expect(localStorage.getItem("astro_chart_history:local")).toBe('["ancient"]');
  });

  it("leaves the other profiles' data alone rather than deleting it", () => {
    seedProfiles(ACTIVE, [ACTIVE, OTHER]);
    localStorage.setItem(`astro_chart_history:${ACTIVE}`, '["mine"]');
    localStorage.setItem(`astro_chart_history:${OTHER}`, '["theirs"]');

    ensureLocalScope();

    /* Unreachable either way now the picker is gone, but on a shared browser
       those rows are a different person's. Orphaning them is reversible;
       deleting them is not. */
    expect(localStorage.getItem("astro_chart_history:local")).toBe('["mine"]');
    expect(localStorage.getItem(`astro_chart_history:${OTHER}`)).toBe('["theirs"]');
  });

  it("does not overwrite data already in the scope", () => {
    seedProfiles(ACTIVE, [ACTIVE]);
    localStorage.setItem("astro_chart_history:local", '["current"]');
    localStorage.setItem(`astro_chart_history:${ACTIVE}`, '["stale"]');

    ensureLocalScope();

    expect(localStorage.getItem("astro_chart_history:local")).toBe('["current"]');
  });

  it("falls back to the first profile when the active pointer is missing", () => {
    seedProfiles(null, [ACTIVE]);
    localStorage.setItem(`astro_chart_history:${ACTIVE}`, '["mine"]');

    ensureLocalScope();

    expect(localStorage.getItem("astro_chart_history:local")).toBe('["mine"]');
  });

  it("runs once, so data written after it is not clobbered by a later call", () => {
    seedProfiles(ACTIVE, [ACTIVE]);
    localStorage.setItem(`astro_chart_history:${ACTIVE}`, '["mine"]');

    ensureLocalScope();
    localStorage.setItem("astro_chart_history:local", '["written since"]');

    resetLocalScopeForTests();
    ensureLocalScope();

    expect(localStorage.getItem("astro_chart_history:local")).toBe('["written since"]');
  });

  it("survives storage that throws", () => {
    seedProfiles(ACTIVE, [ACTIVE]);
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("QuotaExceededError");
    };

    try {
      expect(() => ensureLocalScope()).not.toThrow();
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });

  it("survives a corrupt profiles blob", () => {
    localStorage.setItem("astro_local_profiles", "{not json");

    expect(() => ensureLocalScope()).not.toThrow();
  });
});
