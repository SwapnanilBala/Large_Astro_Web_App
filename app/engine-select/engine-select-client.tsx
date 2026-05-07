"use client";

import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { FiCheck } from "react-icons/fi";
import {
  listEnginePresets,
  DEFAULT_ENGINE_ID,
  type EnginePreset,
} from "@/lib/engines/engine-registry";
import { useTranslation } from "@/lib/i18n-context";
import styles from "./engine-select.module.css";

type EngineSelectClientProps = {
  profileParams: Record<string, string>;
  defaultEngineId: string;
};

const engines = listEnginePresets();
const ayanamshaOrder = [
  "lahiri",
  "raman",
  "krishnamurti",
  "fagan_bradley",
  "pushyapaksha",
  "yukteshwar",
] as const;

type AyanamshaKey = (typeof ayanamshaOrder)[number];

function ayanamshaKeyFor(engine: EnginePreset | undefined): AyanamshaKey {
  if (!engine) return "lahiri";
  if (engine.engine_id.startsWith("raman_")) return "raman";
  if (engine.engine_id.startsWith("krishnamurti_")) return "krishnamurti";
  if (engine.engine_id.startsWith("fagan_bradley_")) return "fagan_bradley";
  if (engine.engine_id.startsWith("pushyapaksha_")) return "pushyapaksha";
  if (engine.engine_id.startsWith("yukteshwar_")) return "yukteshwar";
  return "lahiri";
}

export default function EngineSelectClient({
  profileParams,
  defaultEngineId,
}: EngineSelectClientProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(
    defaultEngineId || DEFAULT_ENGINE_ID
  );
  const [isPending, startTransition] = useTransition();

  const selectedEngine = engines.find((e) => e.engine_id === selectedId);
  const selectedAyanamshaKey = ayanamshaKeyFor(selectedEngine);

  const engineGroups = useMemo(
    () =>
      ayanamshaOrder.map((key) => {
        const groupEngines = engines.filter((engine) =>
          engine.engine_id.startsWith(`${key}_`)
        );
        const defaultEngine =
          groupEngines.find((engine) => engine.house_system_code === "whole_sign") ??
          groupEngines[0];

        return {
          key,
          engines: groupEngines,
          defaultEngine,
        };
      }),
    []
  );

  const handleSelectEngine = (engineId: string) => {
    setSelectedId(engineId);
  };

  const handleStyleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedId(event.target.value);
  };

  const handleGenerate = () => {
    const params = new URLSearchParams(profileParams);
    params.set("engineId", selectedId);
    startTransition(() => {
      router.push(`/insights?${params.toString()}`);
    });
  };

  const selectedHouseLabel = selectedEngine
    ? t(`engineSelect.styles.${selectedEngine.house_system_code}.label`)
    : "";
  const selectedGroupLabel = t(`engineSelect.groups.${selectedAyanamshaKey}.label`);

  return (
    <section className={styles.panel}>
      {/* --- Hero --- */}
      <div className={`${styles.hero} ${styles.animHero}`}>
        <p className={styles.kicker}>{t("engineSelect.kicker")}</p>
        <h1 className={styles.heading}>{t("engineSelect.heading")}</h1>
        <p className={styles.lead}>
          {t("engineSelect.lead")}
        </p>
      </div>

      <div className={styles.guidanceStrip}>
        <span>{t("engineSelect.guidanceStep1")}</span>
        <span>{t("engineSelect.guidanceStep2")}</span>
        <span>{t("engineSelect.guidanceStep3")}</span>
      </div>

      {/* --- Tradition Groups --- */}
      <div className={styles.engineGroups}>
        {engineGroups.map((group, index) => {
          const activeEngine =
            group.engines.find((engine) => engine.engine_id === selectedId) ??
            group.defaultEngine;
          const isGroupSelected = group.key === selectedAyanamshaKey;
          const isRecommended = group.defaultEngine?.engine_id === DEFAULT_ENGINE_ID;

          return (
            <article
              key={group.key}
              className={`${styles.engineGroup} ${styles.animCard}${isGroupSelected ? ` ${styles.engineGroupSelected}` : ""}`}
              style={{ animationDelay: `${0.15 + index * 0.1}s` }}
            >
              <button
                type="button"
                className={styles.groupSelectButton}
                onClick={() => activeEngine && handleSelectEngine(activeEngine.engine_id)}
                aria-pressed={isGroupSelected}
              >
                <span
                  className={`${styles.cardCheck}${isGroupSelected ? ` ${styles.cardCheckVisible}` : ""}`}
                  aria-hidden="true"
                >
                  <FiCheck size={16} strokeWidth={3} />
                </span>

                <span className={styles.groupText}>
                  <span className={styles.groupMeta}>
                    {t(`engineSelect.groups.${group.key}.origin`)}
                  </span>
                  <span className={styles.groupTitleRow}>
                    <span className={styles.groupTitle}>
                      {t(`engineSelect.groups.${group.key}.label`)}
                    </span>
                    {isRecommended && (
                      <span className={styles.cardDefaultTag}>
                        {t("engineSelect.recommended")}
                      </span>
                    )}
                  </span>
                </span>
              </button>

              <p className={styles.groupDescription}>
                {t(`engineSelect.groups.${group.key}.description`)}
              </p>
              <p className={styles.groupOrigin}>
                {t(`engineSelect.groups.${group.key}.method`)}
              </p>

              <label className={styles.styleLabel} htmlFor={`engine-style-${group.key}`}>
                {t("engineSelect.styleLabel")}
              </label>
              <select
                id={`engine-style-${group.key}`}
                className={styles.styleSelect}
                value={activeEngine?.engine_id ?? ""}
                onChange={handleStyleChange}
              >
                {group.engines.map((engine) => (
                  <option key={engine.engine_id} value={engine.engine_id}>
                    {t(`engineSelect.styles.${engine.house_system_code}.label`)}
                  </option>
                ))}
              </select>

              <p className={styles.styleHint}>
                {activeEngine
                  ? t(`engineSelect.styles.${activeEngine.house_system_code}.description`)
                  : ""}
              </p>
            </article>
          );
        })}
      </div>

      {/* --- Selected Method Summary --- */}
      <div className={`${styles.summarySection} ${styles.animCard}`} style={{ animationDelay: "0.45s" }}>
        <div>
          <p className={styles.summaryKicker}>{t("engineSelect.selectedKicker")}</p>
          <h3 className={styles.summaryTitle}>
            {selectedGroupLabel} - {selectedHouseLabel}
          </h3>
        </div>
        <dl className={styles.summaryList}>
          <div>
            <dt>{t("engineSelect.summaryAyanamsha")}</dt>
            <dd>{t(`engineSelect.groups.${selectedAyanamshaKey}.summary`)}</dd>
          </div>
          <div>
            <dt>{t("engineSelect.summaryStyle")}</dt>
            <dd>
              {selectedEngine
                ? t(`engineSelect.styles.${selectedEngine.house_system_code}.description`)
                : ""}
            </dd>
          </div>
          <div>
            <dt>{t("engineSelect.summaryImpact")}</dt>
            <dd>{t("engineSelect.summaryImpactText")}</dd>
          </div>
        </dl>
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
            <>{t("engineSelect.computing")}</>
          ) : (
            <>{t("engineSelect.generate")}</>
          )}
        </button>
      </div>
    </section>
  );
}
