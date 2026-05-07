
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

type AyanamshaInfo = {
  key: string;
  label: string;
  sidereal_mode_name: string;
  classicDescription: string;
};

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

const AYANAMSHAS: AyanamshaInfo[] = [
  {
    key: "fagan_bradley",
    label: "Fagan-Bradley",
    sidereal_mode_name: "SE_SIDM_FAGAN_BRADLEY",
    classicDescription:
      "Western sidereal ayanamsha used by the Fagan-Bradley tradition with whole-sign houses.",
  },
  {
    key: "lahiri",
    label: "Lahiri",
    sidereal_mode_name: "SE_SIDM_LAHIRI",
    classicDescription:
      "Balanced Vedic default using Lahiri ayanamsha with whole-sign houses.",
  },
  {
    key: "raman",
    label: "Raman",
    sidereal_mode_name: "SE_SIDM_RAMAN",
    classicDescription:
      "Alternative sidereal frame often used for comparative Vedic timing checks.",
  },
  {
    key: "krishnamurti",
    label: "Krishnamurti",
    sidereal_mode_name: "SE_SIDM_KRISHNAMURTI",
    classicDescription:
      "KP-oriented ayanamsha option for clients who compare multiple calculation traditions.",
  },
  {
    key: "pushyapaksha",
    label: "Pushyapaksha",
    sidereal_mode_name: "SE_SIDM_TRUE_PUSHYA",
    classicDescription:
      "Pushya-star anchored sidereal option using delta Cancri with whole-sign houses.",
  },
  {
    key: "yukteshwar",
    label: "Yukteshwar",
    sidereal_mode_name: "SE_SIDM_YUKTESHWAR",
    classicDescription:
      "Sri Yukteshwar-inspired ayanamsha option for comparative sidereal chart analysis.",
  },
];

function engineIdFor(ayanamshaKey: string, houseSystemCode: string) {
  return `${ayanamshaKey}_${houseSystemCode === "whole_sign" ? "classic" : houseSystemCode}`;
}

function descriptionFor(ayanamsha: AyanamshaInfo, houseSystem: HouseSystemInfo) {
  if (houseSystem.code === "whole_sign") {
    return ayanamsha.classicDescription;
  }

  if (ayanamsha.key === "lahiri" && houseSystem.code === "placidus") {
    return "Lahiri ayanamsha with Placidus houses for practitioners blending Vedic and Western techniques.";
  }

  if (ayanamsha.key === "krishnamurti" && houseSystem.code === "placidus") {
    return "KP system with Placidus houses, the traditional KP house division method.";
  }

  return `${ayanamsha.label} ayanamsha paired with ${houseSystem.label} houses for comparative chart analysis.`;
}

export const ENGINE_PRESETS: Record<string, EnginePreset> = AYANAMSHAS.reduce(
  (presets, ayanamsha) => {
    for (const houseSystem of HOUSE_SYSTEMS) {
      const engine_id = engineIdFor(ayanamsha.key, houseSystem.code);
      presets[engine_id] = {
        engine_id,
        label: `${ayanamsha.label} ${houseSystem.code === "whole_sign" ? "Classic" : houseSystem.label}`,
        ayanamsha: ayanamsha.label,
        house_system: houseSystem.label,
        house_system_code: houseSystem.code,
        description: descriptionFor(ayanamsha, houseSystem),
        sidereal_mode_name: ayanamsha.sidereal_mode_name,
      };
    }

    return presets;
  },
  {} as Record<string, EnginePreset>
);

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
