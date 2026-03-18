"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FiCheck } from "react-icons/fi";
import {
  listEnginePresets,
  HOUSE_SYSTEMS,
  DEFAULT_ENGINE_ID,
} from "@/lib/engines/engine-registry";
import styles from "./engine-select.module.css";

type EngineSelectClientProps = {
  profileParams: Record<string, string>;
  defaultEngineId: string;
};

const engines = listEnginePresets();
const houseSystems = HOUSE_SYSTEMS;

export default function EngineSelectClient({
  profileParams,
  defaultEngineId,
}: EngineSelectClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(
    defaultEngineId || DEFAULT_ENGINE_ID
  );
  const [isPending, startTransition] = useTransition();

  // Derive the currently-selected engine's house system code for the
  // house system selector highlight
  const selectedEngine = engines.find((e) => e.engine_id === selectedId);
  const selectedHouseCode = selectedEngine?.house_system_code ?? "whole_sign";

  const handleSelectEngine = (engineId: string) => {
    setSelectedId(engineId);
  };

  const handleSelectHouseSystem = (houseCode: string) => {
    // When user picks a house system, try to find a preset that matches
    // the current ayanamsha + new house system. If none exists, stay on
    // the current preset (the house system badge will just reflect the
    // engine preset's built-in house system).
    if (!selectedEngine) return;

    const match = engines.find(
      (e) =>
        e.ayanamsha === selectedEngine.ayanamsha &&
        e.house_system_code === houseCode
    );
    if (match) {
      setSelectedId(match.engine_id);
    }
    // If no matching preset exists for this ayanamsha+house combo,
    // we don't change the engine (the preset defines the pairing).
  };

  const handleGenerate = () => {
    const params = new URLSearchParams(profileParams);
    params.set("engineId", selectedId);
    startTransition(() => {
      router.push(`/insights?${params.toString()}`);
    });
  };

  return (
    <section className={styles.panel}>
      {/* --- Hero --- */}
      <div className={`${styles.hero} ${styles.animHero}`}>
        <p className={styles.kicker}>Calculation Framework</p>
        <h1 className={styles.heading}>Choose Your Engine</h1>
        <p className={styles.lead}>
          Each engine uses a different ayanamsha correction to align the sidereal
          zodiac with the fixed stars. The choice affects degree positions,
          sign boundaries, and timing analysis. Lahiri is the standard Indian
          government reference; Raman and Krishnamurti serve practitioners who
          cross-reference multiple traditions.
        </p>
      </div>

      {/* --- Engine Cards Grid --- */}
      <div className={styles.grid}>
        {engines.map((engine, index) => {
          const isSelected = engine.engine_id === selectedId;
          const isDefault = engine.engine_id === DEFAULT_ENGINE_ID;

          return (
            <button
              key={engine.engine_id}
              type="button"
              className={`${styles.card} ${styles.animCard}${isSelected ? ` ${styles.cardSelected}` : ""}`}
              style={{ animationDelay: `${0.15 + index * 0.1}s` }}
              onClick={() => handleSelectEngine(engine.engine_id)}
              aria-pressed={isSelected}
            >
              {/* Checkmark */}
              <span
                className={`${styles.cardCheck}${isSelected ? ` ${styles.cardCheckVisible}` : ""}`}
              >
                <FiCheck size={16} strokeWidth={3} />
              </span>

              {/* Engine Name */}
              <h2 className={styles.cardLabel}>
                {engine.label}
                {isDefault && (
                  <span className={styles.cardDefaultTag}>
                    Recommended
                  </span>
                )}
              </h2>

              {/* Badges */}
              <div className={styles.cardBadges}>
                <span className={`${styles.cardBadge} ${styles.cardBadgeAyanamsha}`}>
                  {engine.ayanamsha}
                </span>
                <span className={`${styles.cardBadge} ${styles.cardBadgeHouse}`}>
                  {engine.house_system}
                </span>
              </div>

              {/* Description */}
              <p className={styles.cardDesc}>{engine.description}</p>
            </button>
          );
        })}
      </div>

      {/* --- House System Selector --- */}
      <div className={`${styles.houseSection} ${styles.animCard}`} style={{ animationDelay: "0.45s" }}>
        <h3 className={styles.houseSectionTitle}>House System</h3>
        <p className={styles.houseSectionLead}>
          The house system determines how the sky is divided into twelve sectors.
          Whole Sign is the Vedic default; Placidus is the most popular Western choice.
        </p>
        <div className={styles.houseGrid}>
          {houseSystems.map((hs) => {
            const isActive = hs.code === selectedHouseCode;
            // Check if there's a preset available for this house system
            // with the currently selected ayanamsha
            const hasPreset = engines.some(
              (e) =>
                e.ayanamsha === selectedEngine?.ayanamsha &&
                e.house_system_code === hs.code
            );

            return (
              <button
                key={hs.code}
                type="button"
                className={`${styles.houseChip}${isActive ? ` ${styles.houseChipActive}` : ""}${!hasPreset ? ` ${styles.houseChipDisabled}` : ""}`}
                onClick={() => hasPreset && handleSelectHouseSystem(hs.code)}
                disabled={!hasPreset}
                title={hasPreset ? hs.description : `Not available with ${selectedEngine?.ayanamsha ?? "this"} ayanamsha`}
                aria-pressed={isActive}
              >
                <span className={styles.houseChipLabel}>{hs.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* --- CTA Button --- */}
      <div className={`${styles.footer} ${styles.animFooter}`}>
        <button
          type="button"
          className={styles.cta}
          onClick={handleGenerate}
          disabled={isPending}
        >
          {isPending ? (
            <>Computing Chart&hellip;</>
          ) : (
            <>Generate Chart Intelligence &rarr;</>
          )}
        </button>
      </div>
    </section>
  );
}
