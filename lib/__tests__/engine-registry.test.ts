import { describe, it, expect } from "vitest";
import {
  getEnginePreset,
  listEnginePresets,
  presetToMetadata,
  ENGINE_PRESETS,
  HOUSE_SYSTEMS,
  DEFAULT_ENGINE_ID,
  type EnginePreset,
  type EnginePresetInfo,
} from "../engines/engine-registry";

describe("engine-registry", () => {
  describe("ENGINE_PRESETS", () => {
    it("has lahiri_classic preset", () => {
      expect(ENGINE_PRESETS).toHaveProperty("lahiri_classic");
    });

    it("has raman_classic preset", () => {
      expect(ENGINE_PRESETS).toHaveProperty("raman_classic");
    });

    it("has krishnamurti_classic preset", () => {
      expect(ENGINE_PRESETS).toHaveProperty("krishnamurti_classic");
    });

    it("has the additional requested ayanamsha presets", () => {
      expect(ENGINE_PRESETS).toHaveProperty("fagan_bradley_classic");
      expect(ENGINE_PRESETS).toHaveProperty("pushyapaksha_classic");
      expect(ENGINE_PRESETS).toHaveProperty("yukteshwar_classic");
    });

    it("each preset has all required fields", () => {
      for (const [id, preset] of Object.entries(ENGINE_PRESETS)) {
        expect(preset).toHaveProperty("engine_id");
        expect(preset).toHaveProperty("label");
        expect(preset).toHaveProperty("ayanamsha");
        expect(preset).toHaveProperty("house_system");
        expect(preset).toHaveProperty("house_system_code");
        expect(preset).toHaveProperty("description");
        expect(preset).toHaveProperty("sidereal_mode_name");

        expect(preset.engine_id).toBe(id);
        expect(typeof preset.label).toBe("string");
        expect(typeof preset.ayanamsha).toBe("string");
        expect(typeof preset.house_system).toBe("string");
        expect(typeof preset.house_system_code).toBe("string");
        expect(typeof preset.description).toBe("string");
        expect(typeof preset.sidereal_mode_name).toBe("string");
      }
    });

    it("classic presets use Whole Sign house system", () => {
      expect(ENGINE_PRESETS.lahiri_classic.house_system).toBe("Whole Sign");
      expect(ENGINE_PRESETS.raman_classic.house_system).toBe("Whole Sign");
      expect(ENGINE_PRESETS.krishnamurti_classic.house_system).toBe("Whole Sign");
    });

    it("has Placidus variant presets", () => {
      expect(ENGINE_PRESETS).toHaveProperty("lahiri_placidus");
      expect(ENGINE_PRESETS.lahiri_placidus.house_system).toBe("Placidus");
      expect(ENGINE_PRESETS.lahiri_placidus.house_system_code).toBe("placidus");
    });

    it("has every house system for each ayanamsha", () => {
      const ayanamshaKeys = [
        "fagan_bradley",
        "lahiri",
        "raman",
        "krishnamurti",
        "pushyapaksha",
        "yukteshwar",
      ];
      const expectedSuffixes = HOUSE_SYSTEMS.map((system) =>
        system.code === "whole_sign" ? "classic" : system.code
      );

      for (const ayanamshaKey of ayanamshaKeys) {
        for (const suffix of expectedSuffixes) {
          expect(ENGINE_PRESETS).toHaveProperty(`${ayanamshaKey}_${suffix}`);
        }
      }
    });

    it("each preset has a valid sidereal mode name", () => {
      const validModes = [
        "SE_SIDM_FAGAN_BRADLEY",
        "SE_SIDM_LAHIRI",
        "SE_SIDM_RAMAN",
        "SE_SIDM_KRISHNAMURTI",
        "SE_SIDM_TRUE_PUSHYA",
        "SE_SIDM_YUKTESHWAR",
      ];
      for (const preset of Object.values(ENGINE_PRESETS)) {
        expect(validModes).toContain(preset.sidereal_mode_name);
      }
    });
  });

  describe("DEFAULT_ENGINE_ID", () => {
    it("is lahiri_classic", () => {
      expect(DEFAULT_ENGINE_ID).toBe("lahiri_classic");
    });

    it("exists in ENGINE_PRESETS", () => {
      expect(ENGINE_PRESETS[DEFAULT_ENGINE_ID]).toBeDefined();
    });
  });

  describe("getEnginePreset()", () => {
    it("returns lahiri_classic for undefined input", () => {
      const preset = getEnginePreset(undefined);
      expect(preset.engine_id).toBe("lahiri_classic");
    });

    it("returns lahiri_classic for null input", () => {
      const preset = getEnginePreset(null);
      expect(preset.engine_id).toBe("lahiri_classic");
    });

    it("returns lahiri_classic for empty string", () => {
      const preset = getEnginePreset("");
      expect(preset.engine_id).toBe("lahiri_classic");
    });

    it("returns correct preset for lahiri_classic", () => {
      const preset = getEnginePreset("lahiri_classic");
      expect(preset.engine_id).toBe("lahiri_classic");
      expect(preset.ayanamsha).toBe("Lahiri");
      expect(preset.label).toBe("Lahiri Classic");
    });

    it("returns correct preset for raman_classic", () => {
      const preset = getEnginePreset("raman_classic");
      expect(preset.engine_id).toBe("raman_classic");
      expect(preset.ayanamsha).toBe("Raman");
      expect(preset.sidereal_mode_name).toBe("SE_SIDM_RAMAN");
    });

    it("returns correct preset for krishnamurti_classic", () => {
      const preset = getEnginePreset("krishnamurti_classic");
      expect(preset.engine_id).toBe("krishnamurti_classic");
      expect(preset.ayanamsha).toBe("Krishnamurti");
      expect(preset.sidereal_mode_name).toBe("SE_SIDM_KRISHNAMURTI");
    });

    it("returns correct preset for pushyapaksha_classic", () => {
      const preset = getEnginePreset("pushyapaksha_classic");
      expect(preset.engine_id).toBe("pushyapaksha_classic");
      expect(preset.ayanamsha).toBe("Pushyapaksha");
      expect(preset.sidereal_mode_name).toBe("SE_SIDM_TRUE_PUSHYA");
    });

    it("falls back to default for invalid engine_id", () => {
      const preset = getEnginePreset("nonexistent_engine");
      expect(preset.engine_id).toBe("lahiri_classic");
    });
  });

  describe("listEnginePresets()", () => {
    it("returns an array of all presets", () => {
      const list = listEnginePresets();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(Object.keys(ENGINE_PRESETS).length);
    });

    it("contains all presets", () => {
      const list = listEnginePresets();
      const ids = list.map((p) => p.engine_id);
      expect(ids).toContain("lahiri_classic");
      expect(ids).toContain("lahiri_placidus");
      expect(ids).toContain("raman_classic");
      expect(ids).toContain("krishnamurti_classic");
      expect(ids).toContain("krishnamurti_placidus");
      expect(ids).toContain("fagan_bradley_placidus");
      expect(ids).toContain("pushyapaksha_placidus");
      expect(ids).toContain("yukteshwar_placidus");
      expect(ids).toContain("lahiri_koch");
      expect(ids).toContain("raman_campanus");
      expect(ids).toContain("krishnamurti_regiomontanus");
    });

    it("each item is a full EnginePreset", () => {
      const list = listEnginePresets();
      for (const preset of list) {
        expect(preset).toHaveProperty("engine_id");
        expect(preset).toHaveProperty("sidereal_mode_name");
      }
    });
  });

  describe("presetToMetadata()", () => {
    it("strips sidereal_mode_name from preset", () => {
      const preset = getEnginePreset("lahiri_classic");
      const meta = presetToMetadata(preset);

      expect(meta).toHaveProperty("engine_id");
      expect(meta).toHaveProperty("label");
      expect(meta).toHaveProperty("ayanamsha");
      expect(meta).toHaveProperty("house_system");
      expect(meta).toHaveProperty("description");
      // sidereal_mode_name should NOT be in the metadata
      expect((meta as Record<string, unknown>)).not.toHaveProperty("sidereal_mode_name");
    });

    it("preserves all public-facing fields", () => {
      const preset = getEnginePreset("raman_classic");
      const meta = presetToMetadata(preset);

      expect(meta.engine_id).toBe("raman_classic");
      expect(meta.label).toBe("Raman Classic");
      expect(meta.ayanamsha).toBe("Raman");
      expect(meta.house_system).toBe("Whole Sign");
      expect(meta.description.length).toBeGreaterThan(0);
    });
  });
});
