from dataclasses import dataclass

from app.models.chart_models import EnginePresetInfo


@dataclass(frozen=True)
class EnginePreset:
    engine_id: str
    label: str
    ayanamsha: str
    house_system: str
    description: str
    sidereal_mode_name: str

    def to_metadata(self) -> EnginePresetInfo:
        return EnginePresetInfo(
            engine_id=self.engine_id,
            label=self.label,
            ayanamsha=self.ayanamsha,
            house_system=self.house_system,
            description=self.description,
        )


ENGINE_PRESETS: dict[str, EnginePreset] = {
    "lahiri_classic": EnginePreset(
        engine_id="lahiri_classic",
        label="Lahiri Classic",
        ayanamsha="Lahiri",
        house_system="Whole Sign",
        description="Balanced Vedic default using Lahiri ayanamsha with whole-sign houses.",
        sidereal_mode_name="SIDM_LAHIRI",
    ),
    "raman_classic": EnginePreset(
        engine_id="raman_classic",
        label="Raman Classic",
        ayanamsha="Raman",
        house_system="Whole Sign",
        description="Alternative sidereal frame often used for comparative Vedic timing checks.",
        sidereal_mode_name="SIDM_RAMAN",
    ),
    "krishnamurti_classic": EnginePreset(
        engine_id="krishnamurti_classic",
        label="Krishnamurti Classic",
        ayanamsha="Krishnamurti",
        house_system="Whole Sign",
        description="KP-oriented ayanamsha option for clients who compare multiple calculation traditions.",
        sidereal_mode_name="SIDM_KRISHNAMURTI",
    ),
}

DEFAULT_ENGINE_ID = "lahiri_classic"


def get_engine_preset(engine_id: str | None) -> EnginePreset:
    if not engine_id:
        return ENGINE_PRESETS[DEFAULT_ENGINE_ID]
    return ENGINE_PRESETS.get(engine_id, ENGINE_PRESETS[DEFAULT_ENGINE_ID])


def list_engine_presets() -> list[EnginePreset]:
    return list(ENGINE_PRESETS.values())
