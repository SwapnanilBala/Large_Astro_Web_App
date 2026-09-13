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

/*
 * Two axes, not twelve cards.
 *
 * Every tradition offers the same six house systems, so the old layout drew
 * the same six chips and the same style sentence inside each of six cards --
 * and a Go button in each, plus one more at the foot of the page. What the
 * visitor is actually doing is picking a point on a 6x6 grid, so the tradition
 * is a list down the side and the style is chosen once, in the panel that
 * describes whichever tradition is selected.
 */

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

/* Which index the arrow keys should land on, or null for a key we do not
   handle. Shared by both radiogroups, which have the same behaviour and no
   reason to hold two copies of it. */
function nextRovingIndex(key: string, current: number, length: number): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return (current + 1) % length;
  if (key === "ArrowLeft" || key === "ArrowUp") return (current - 1 + length) % length;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return null;
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

        return { key, engines: groupEngines, defaultEngine };
      }),
    []
  );

  const selectedGroup =
    engineGroups.find((group) => group.key === selectedAyanamshaKey) ?? engineGroups[0];

  /*
   * Switching tradition keeps the house system you were already on.
   *
   * The two choices are independent -- someone who has deliberately picked
   * Placidus has not changed their mind about it by looking at what Raman
   * says -- so resetting to the group default would quietly undo a decision
   * every time they compared. Only when a group lacks that system at all does
   * it fall back.
   */
  const handleSelectTradition = (groupKey: AyanamshaKey) => {
    const group = engineGroups.find((entry) => entry.key === groupKey);
    if (!group) return;
    const keepStyle = group.engines.find(
      (engine) => engine.house_system_code === selectedEngine?.house_system_code
    );
    const next = keepStyle ?? group.defaultEngine;
    if (next) setSelectedId(next.engine_id);
  };

  /* Roving-tabindex arrow-key navigation, matching what a native <select>
     gives keyboard users for free. */
  const handleRailKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    const nextIndex = nextRovingIndex(event.key, currentIndex, engineGroups.length);
    if (nextIndex === null) return;
    event.preventDefault();
    handleSelectTradition(engineGroups[nextIndex].key);
    const rail = event.currentTarget.closest<HTMLElement>('[role="radiogroup"]');
    rail?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
  };

  const handleStyleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    groupEngines: EnginePreset[],
    currentIndex: number
  ) => {
    const nextIndex = nextRovingIndex(event.key, currentIndex, groupEngines.length);
    if (nextIndex === null) return;
    event.preventDefault();
    setSelectedId(groupEngines[nextIndex].engine_id);
    const radiogroup = event.currentTarget.closest<HTMLElement>('[role="radiogroup"]');
    radiogroup?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
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

  const detailAccent = {
    "--tradition-accent-rgb": TRADITION_ACCENT_RGB[selectedAyanamshaKey],
  } as CSSProperties;

  return (
    <section className={styles.panel}>
      <header className={`${styles.hero} ${styles.animHero}`}>
        <p className={styles.kicker}>{t("engineSelect.kicker")}</p>
        <h1 className={styles.heading}>{t("engineSelect.heading")}</h1>
        <p className={styles.lead}>{t("engineSelect.lead")}</p>
      </header>

      <div className={styles.split}>
        {/* --- Left rail: the tradition --- */}
        <div
          className={`${styles.rail} ${styles.animRail}`}
          role="radiogroup"
          aria-label={t("engineSelect.heading")}
        >
          {engineGroups.map((group, index) => {
            const isSelected = group.key === selectedAyanamshaKey;
            const isRecommended = group.defaultEngine?.engine_id === DEFAULT_ENGINE_ID;
            const accent = {
              "--tradition-accent-rgb": TRADITION_ACCENT_RGB[group.key],
            } as CSSProperties;

            return (
              <button
                key={group.key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                style={accent}
                className={`${styles.railItem}${isSelected ? ` ${styles.railItemActive}` : ""}`}
                onClick={() => handleSelectTradition(group.key)}
                onKeyDown={(event) => handleRailKeyDown(event, index)}
              >
                <TraditionGlyph tradition={group.key} className={styles.railGlyph} />
                <span className={styles.railText}>
                  <span className={styles.railName}>
                    {t(`engineSelect.groups.${group.key}.label`)}
                    {isRecommended && (
                      <span className={styles.railTag}>{t("engineSelect.recommended")}</span>
                    )}
                  </span>
                  <span className={styles.railOrigin}>
                    {t(`engineSelect.groups.${group.key}.origin`)}
                  </span>
                </span>
                <span className={styles.railCheck} aria-hidden="true">
                  <FiCheck size={15} strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>

        {/* --- Right panel: what it is, and the style --- */}
        <div className={`${styles.detail} ${styles.animDetail}`} style={detailAccent}>
          <div className={styles.detailHead}>
            <TraditionGlyph
              tradition={selectedAyanamshaKey}
              className={styles.detailGlyph}
            />
            <div className={styles.detailHeadText}>
              <p className={styles.detailOrigin}>
                {t(`engineSelect.groups.${selectedAyanamshaKey}.origin`)}
              </p>
              <h2 className={styles.detailTitle}>{selectedGroupLabel}</h2>
            </div>
          </div>

          <p className={styles.detailLead}>
            {t(`engineSelect.groups.${selectedAyanamshaKey}.description`)}
          </p>

          {/* The reference values and ephemeris constants. Kept, because a
              practitioner checking which ayanamsha this is needs them, and
              closed, because nobody else does. */}
          <details className={styles.tech} key={selectedAyanamshaKey}>
            <summary className={styles.techSummary}>
              {t("engineSelect.technicalDetail")}
            </summary>
            <p className={styles.techBody}>
              {t(`engineSelect.groups.${selectedAyanamshaKey}.method`)}
            </p>
          </details>

          <div className={styles.styleBlock}>
            <span className={styles.styleLabel} id="engine-style-label">
              {t("engineSelect.styleLabel")}
            </span>
            <div
              className={styles.styleChips}
              role="radiogroup"
              aria-labelledby="engine-style-label"
            >
              {selectedGroup?.engines.map((engine, engineIndex) => {
                const isActive = engine.engine_id === selectedId;
                return (
                  <button
                    key={engine.engine_id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    tabIndex={isActive ? 0 : -1}
                    className={`${styles.houseChip}${isActive ? ` ${styles.houseChipActive}` : ""}`}
                    onClick={() => setSelectedId(engine.engine_id)}
                    onKeyDown={(event) =>
                      handleStyleKeyDown(event, selectedGroup.engines, engineIndex)
                    }
                  >
                    {t(`engineSelect.styles.${engine.house_system_code}.label`)}
                  </button>
                );
              })}
            </div>
            <p className={styles.styleHint}>
              {selectedEngine
                ? t(`engineSelect.styles.${selectedEngine.house_system_code}.description`)
                : ""}
            </p>
          </div>

          <p className={styles.impact}>
            <span className={styles.impactLabel}>{t("engineSelect.summaryImpact")}</span>
            {t("engineSelect.summaryImpactText")}
          </p>

          <div className={styles.detailFoot}>
            <p className={styles.selection} aria-live="polite">
              <span>{t("engineSelect.selectedKicker")}</span>
              <strong title={`${selectedGroupLabel} - ${selectedHouseLabel}`}>
                {selectedGroupLabel} &middot; {selectedHouseLabel}
              </strong>
            </p>
            <button
              type="button"
              className={styles.cta}
              onClick={() => handleGenerate(selectedId)}
              disabled={isPending}
            >
              <span>
                {isPending ? t("engineSelect.computing") : t("engineSelect.generate")}
              </span>
              {!isPending && <FiArrowRight aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
