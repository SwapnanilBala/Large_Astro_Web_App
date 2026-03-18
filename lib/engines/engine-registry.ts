
export interface EnginePreset {
  engine_id: string;
  label: string;
  ayanamsha: string;
  house_system: string;
  house_system_code: string;
  description: string;
  sidereal_mode_name: string;
}

export interface EnginePresetInfo {
  engine_id: string;
  label: string;
  ayanamsha: string;
  house_system: string;
  house_system_code: string;
  description: string;
}

export interface HouseSystemInfo {
  code: string;
  label: string;
  description: string;
}

export const HOUSE_SYSTEMS: HouseSystemInfo[] = [
  {
    code: "whole_sign",
    label: "Whole Sign",
    description:
      "Traditional Vedic system. Each house occupies an entire sign, starting from the ascendant sign.",
  },
  {
    code: "equal",
    label: "Equal",
    description:
      "Each house spans exactly 30 degrees starting from the ascendant degree.",
  },
  {
    code: "placidus",
    label: "Placidus",
    description:
      "Most popular Western system. Divides diurnal and nocturnal semi-arcs into thirds.",
  },
  {
    code: "koch",
    label: "Koch",
    description:
      "Birthplace-based system dividing the time for the MC degree to rise from horizon to culmination.",
  },
  {
    code: "campanus",
    label: "Campanus",
    description:
      "Divides the prime vertical into 12 equal 30-degree arcs and projects to the ecliptic.",
  },
  {
    code: "regiomontanus",
    label: "Regiomontanus",
    description:
      "Divides the celestial equator into 12 equal arcs and projects to the ecliptic via hour circles.",
  },
];

export const ENGINE_PRESETS: Record<string, EnginePreset> = {
  lahiri_classic: {
    engine_id: "lahiri_classic",
    label: "Lahiri Classic",
    ayanamsha: "Lahiri",
    house_system: "Whole Sign",
    house_system_code: "whole_sign",
    description:
      "Balanced Vedic default using Lahiri ayanamsha with whole-sign houses.",
    sidereal_mode_name: "SE_SIDM_LAHIRI",
  },
  lahiri_placidus: {
    engine_id: "lahiri_placidus",
    label: "Lahiri Placidus",
    ayanamsha: "Lahiri",
    house_system: "Placidus",
    house_system_code: "placidus",
    description:
      "Lahiri ayanamsha with Placidus houses for practitioners blending Vedic and Western techniques.",
    sidereal_mode_name: "SE_SIDM_LAHIRI",
  },
  raman_classic: {
    engine_id: "raman_classic",
    label: "Raman Classic",
    ayanamsha: "Raman",
    house_system: "Whole Sign",
    house_system_code: "whole_sign",
    description:
      "Alternative sidereal frame often used for comparative Vedic timing checks.",
    sidereal_mode_name: "SE_SIDM_RAMAN",
  },
  krishnamurti_classic: {
    engine_id: "krishnamurti_classic",
    label: "Krishnamurti Classic",
    ayanamsha: "Krishnamurti",
    house_system: "Whole Sign",
    house_system_code: "whole_sign",
    description:
      "KP-oriented ayanamsha option for clients who compare multiple calculation traditions.",
    sidereal_mode_name: "SE_SIDM_KRISHNAMURTI",
  },
  krishnamurti_placidus: {
    engine_id: "krishnamurti_placidus",
    label: "Krishnamurti Placidus",
    ayanamsha: "Krishnamurti",
    house_system: "Placidus",
    house_system_code: "placidus",
    description:
      "KP system with Placidus houses, the traditional KP house division method.",
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
    house_system_code: preset.house_system_code,
    description: preset.description,
  };
}
