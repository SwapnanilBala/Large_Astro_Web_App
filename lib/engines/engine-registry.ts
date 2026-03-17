
export interface EnginePreset {
  engine_id: string;
  label: string;
  ayanamsha: string;
  house_system: string;
  description: string;
  sidereal_mode_name: string;
}

export interface EnginePresetInfo {
  engine_id: string;
  label: string;
  ayanamsha: string;
  house_system: string;
  description: string;
}

export const ENGINE_PRESETS: Record<string, EnginePreset> = {
  lahiri_classic: {
    engine_id: "lahiri_classic",
    label: "Lahiri Classic",
    ayanamsha: "Lahiri",
    house_system: "Whole Sign",
    description:
      "Balanced Vedic default using Lahiri ayanamsha with whole-sign houses.",
    sidereal_mode_name: "SE_SIDM_LAHIRI",
  },
  raman_classic: {
    engine_id: "raman_classic",
    label: "Raman Classic",
    ayanamsha: "Raman",
    house_system: "Whole Sign",
    description:
      "Alternative sidereal frame often used for comparative Vedic timing checks.",
    sidereal_mode_name: "SE_SIDM_RAMAN",
  },
  krishnamurti_classic: {
    engine_id: "krishnamurti_classic",
    label: "Krishnamurti Classic",
    ayanamsha: "Krishnamurti",
    house_system: "Whole Sign",
    description:
      "KP-oriented ayanamsha option for clients who compare multiple calculation traditions.",
    sidereal_mode_name: "SE_SIDM_KRISHNAMURTI",
  },
};

export const DEFAULT_ENGINE_ID = "lahiri_classic";

export function getEnginePreset(engineId?: string | null): EnginePreset {
  if (!engineId) return ENGINE_PRESETS[DEFAULT_ENGINE_ID];
  return ENGINE_PRESETS[engineId] ?? ENGINE_PRESETS[DEFAULT_ENGINE_ID];
}

export function listEnginePresets(): EnginePreset[] {
  return Object.values(ENGINE_PRESETS);
}

export function presetToMetadata(preset: EnginePreset): EnginePresetInfo {
  return {
    engine_id: preset.engine_id,
    label: preset.label,
    ayanamsha: preset.ayanamsha,
    house_system: preset.house_system,
    description: preset.description,
  };
}
