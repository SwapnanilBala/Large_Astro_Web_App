"use client";

import {
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { FiArrowRight, FiCheck } from "react-icons/fi";
import {
  listEnginePresets,
  DEFAULT_ENGINE_ID,
  TRADITION_ORDER,
  type EnginePreset,
  type TraditionKey,
} from "@/lib/engines/engine-registry";
import { useTranslation } from "@/lib/i18n-context";
import TraditionGlyph from "@/app/components/TraditionGlyph";
import styles from "./engine-select.module.css";

type EngineSelectClientProps = {
  profileParams: Record<string, string>;
  defaultEngineId: string;
};

const engines = listEnginePresets();
const ayanamshaOrder = TRADITION_ORDER;

type AyanamshaKey = TraditionKey;

/* RGB triplets (not hex) so CSS can compose them into rgba() at varying
   opacity for backgrounds/borders/text via a single custom property. */
const TRADITION_ACCENT_RGB: Record<AyanamshaKey, string> = {
  lahiri: "200, 155, 60",
  raman: "184, 105, 138",
  krishnamurti: "42, 139, 126",
  fagan_bradley: "92, 132, 168",
  pushyapaksha: "122, 155, 92",
  yukteshwar: "123, 107, 168",
};

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

  /* Roving-tabindex arrow-key navigation for the house-style radiogroup,
     matching what a native <select> gives keyboard users for free. */
  const handleChipKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    groupEngines: EnginePreset[],
    currentIndex: number
  ) => {
    let nextIndex: number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % groupEngines.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + groupEngines.length) % groupEngines.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = groupEngines.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    handleSelectEngine(groupEngines[nextIndex].engine_id);
    const radiogroup = event.currentTarget.closest<HTMLElement>('[role="radiogroup"]');
    const radios = radiogroup?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios?.[nextIndex]?.focus();
  };

  const handleGenerate = (engineId: string) => {
    const params = new URLSearchParams(profileParams);
    params.set("engineId", engineId);
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

          const styleGroupLabelId = `engine-style-label-${group.key}`;
          const accentStyle = {
            animationDelay: `${0.15 + index * 0.1}s`,
            "--tradition-accent-rgb": TRADITION_ACCENT_RGB[group.key],
          } as CSSProperties;

          return (
            <article
              key={group.key}
              className={`${styles.engineGroup} ${styles.animCard}${isGroupSelected ? ` ${styles.engineGroupSelected}` : ""}`}
              style={accentStyle}
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
                  <span className={`${styles.cardBadge} ${styles.groupOriginBadge}`}>
                    <TraditionGlyph tradition={group.key} className={styles.groupGlyph} />
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

              <span className={styles.styleLabel} id={styleGroupLabelId}>
                {t("engineSelect.styleLabel")}
              </span>
              <div className={styles.engineChoiceRow}>
                <div
                  className={`${styles.houseGrid} ${styles.compactChips}`}
                  role="radiogroup"
                  aria-labelledby={styleGroupLabelId}
                >
                  {group.engines.map((engine, engineIndex) => {
                    const isChipActive = engine.engine_id === activeEngine?.engine_id;
                    return (
                      <button
                        key={engine.engine_id}
                        type="button"
                        role="radio"
                        className={`${styles.houseChip}${isChipActive ? ` ${styles.houseChipActive}` : ""}`}
                        aria-checked={isChipActive}
                        tabIndex={isChipActive ? 0 : -1}
                        onClick={() => handleSelectEngine(engine.engine_id)}
                        onKeyDown={(event) => handleChipKeyDown(event, group.engines, engineIndex)}
                      >
                        <span className={styles.houseChipLabel}>
                          {t(`engineSelect.styles.${engine.house_system_code}.label`)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className={styles.cardGoButton}
                  onClick={() => activeEngine && handleGenerate(activeEngine.engine_id)}
                  disabled={!activeEngine || isPending}
                  aria-label={`${t("engineSelect.goWith")} ${t(`engineSelect.groups.${group.key}.label`)} - ${activeEngine ? t(`engineSelect.styles.${activeEngine.house_system_code}.label`) : ""}`}
                >
                  <span>{t("engineSelect.go")}</span>
                  <FiArrowRight aria-hidden="true" />
                </button>
              </div>

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
        <p className={styles.footerContext} aria-live="polite">
          <span>{t("engineSelect.selectedKicker")}</span>
          <strong title={`${selectedGroupLabel} - ${selectedHouseLabel}`}>
            {selectedGroupLabel} - {selectedHouseLabel}
          </strong>
        </p>
        <button
          type="button"
          className={styles.cta}
          onClick={() => handleGenerate(selectedId)}
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
