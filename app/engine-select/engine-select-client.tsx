"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FiCheck } from "react-icons/fi";
import {
  listEnginePresets,
  DEFAULT_ENGINE_ID,
} from "@/lib/engines/engine-registry";
import styles from "./engine-select.module.css";

type EngineSelectClientProps = {
  profileParams: Record<string, string>;
  defaultEngineId: string;
};

const engines = listEnginePresets();

export default function EngineSelectClient({
  profileParams,
  defaultEngineId,
}: EngineSelectClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(
    defaultEngineId || DEFAULT_ENGINE_ID
  );
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    const params = new URLSearchParams(profileParams);
    params.set("engineId", selectedId);
    startTransition(() => {
      router.push(`/insights?${params.toString()}`);
    });
  };

  return (
    <section className={styles.panel}>
      {/* ─── Hero ─── */}
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

      {/* ─── Engine Cards Grid ─── */}
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
              onClick={() => setSelectedId(engine.engine_id)}
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

      {/* ─── CTA Button ─── */}
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
