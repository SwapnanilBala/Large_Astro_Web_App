"use client";

import { useMemo, useState, useTransition, type CSSProperties, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_ENGINE_ID,
  TRADITION_ORDER,
  listEnginePresets,
  type EnginePreset,
  type TraditionKey,
} from "@/lib/engines/engine-registry";
import { useRouteMessages } from "@/lib/i18n-context";
import engineSelectMessages from "@/messages/en.engine-select.json";
import TraditionGlyph from "@/app/components/TraditionGlyph";
import shell from "../mobile.module.css";
import styles from "./engine-select.module.css";

/*
 * Mobile method chooser.
 *
 * The engine ids come from the shared registry, so this and the desktop
 * chooser cannot offer different methods or spell an id differently — a drift
 * there would be silent, producing a subtly different chart on one device.
 *
 * What differs is the shape. The desktop page lays six traditions out at once,
 * each with its own Go button, because there is room to compare them side by
 * side. Six expanded cards stacked on a 375px screen is several thousand
 * pixels of prose with six competing calls to action, so here the list reads
 * as a table of contents — a glyph, a name and one line each — and only the
 * chosen tradition opens to show its method and its house styles. Selecting
 * and expanding are the same gesture because they are the same decision, and
 * the single CTA lives in the pinned bar the rest of this tree uses.
 */

type Props = {
  /** The birth details, already parsed and re-serialised by the server page. */
  query: string;
  defaultEngineId: string;
};

const engines = listEnginePresets();

/* Decorative only — the glyph tint, so six entries in a list are separable at
   a glance. Nothing reads text against these, so they carry no contrast
   requirement; the labels stay on the tree's cream. */
const TRADITION_ACCENT: Record<TraditionKey, string> = {
  lahiri: "#c89b3c",
  raman: "#b8698a",
  krishnamurti: "#2a8b7e",
  fagan_bradley: "#5c84a8",
  pushyapaksha: "#7a9b5c",
  yukteshwar: "#7b6ba8",
};

function CheckMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}

export default function MobileEngineSelect({ query, defaultEngineId }: Props) {
  const router = useRouter();
  /* tr, not t: this page's copy is a namespace of its own that ships with the
     route rather than riding in the layout's baseline, where every mobile page
     would download it. tr reads the shared baseline first and falls back to
     that catalog, so "home.back" below resolves exactly as it always did. */
  const tr = useRouteMessages(engineSelectMessages);
  const [selectedId, setSelectedId] = useState(defaultEngineId || DEFAULT_ENGINE_ID);
  const [isPending, startTransition] = useTransition();

  const groups = useMemo(
    () =>
      TRADITION_ORDER.map((key) => {
        const groupEngines = engines.filter((engine) => engine.engine_id.startsWith(`${key}_`));
        return {
          key,
          engines: groupEngines,
          /* Whole sign is the Vedic default, so it is what a tradition opens
             on when the visitor has not chosen a style inside it yet. */
          defaultEngine:
            groupEngines.find((engine) => engine.house_system_code === "whole_sign") ??
            groupEngines[0],
        };
      }),
    [],
  );

  /* Derived from the selection rather than parsed out of the id, so adding a
     tradition to the registry needs no change here. */
  const selectedGroup =
    groups.find((group) => group.engines.some((engine) => engine.engine_id === selectedId)) ??
    groups[0];
  const selectedEngine =
    selectedGroup.engines.find((engine) => engine.engine_id === selectedId) ??
    selectedGroup.defaultEngine;

  const selectedTraditionLabel = tr(`engineSelect.groups.${selectedGroup.key}.label`);
  const selectedStyleLabel = selectedEngine
    ? tr(`engineSelect.styles.${selectedEngine.house_system_code}.label`)
    : "";

  /* Arrow keys move between house styles, the way a native radiogroup does.
     Cheap to keep, and the only way through this control for anyone on a
     paired keyboard or a switch device. */
  const handleChipKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    groupEngines: EnginePreset[],
    currentIndex: number,
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
    setSelectedId(groupEngines[nextIndex].engine_id);
    const radios = event.currentTarget
      .closest<HTMLElement>('[role="radiogroup"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios?.[nextIndex]?.focus();
  };

  const handleGenerate = () => {
    if (!selectedEngine) return;
    const params = new URLSearchParams(query);
    params.set("engineId", selectedEngine.engine_id);
    /* Straight to the mobile results route. Pushing /insights would work —
       the middleware would bounce it here — but that is a redirect on the
       slowest step of the whole product. */
    startTransition(() => {
      router.push(`/m/insights?${params.toString()}`);
    });
  };

  return (
    <div className={`${shell.page} ${styles.page}`}>
      <header className={shell.header}>
        <span className={shell.step}>{tr("engineSelect.kicker")}</span>
        <h1 className={`${shell.title} mGold`}>{tr("engineSelect.heading")}</h1>
        <p className={shell.lead}>{tr("engineSelect.lead")}</p>
      </header>

      <div className={styles.traditions}>
        {TRADITION_ORDER.map((key) => {
          const group = groups.find((candidate) => candidate.key === key);
          if (!group) return null;

          const isOpen = group.key === selectedGroup.key;
          const activeEngine = isOpen ? selectedEngine : group.defaultEngine;
          const isRecommended = group.defaultEngine?.engine_id === DEFAULT_ENGINE_ID;
          const bodyId = `m-tradition-${group.key}`;
          const styleLabelId = `m-style-label-${group.key}`;

          return (
            <article
              key={group.key}
              className={`${styles.card}${isOpen ? ` ${styles.cardOpen}` : ""}`}
              style={{ "--tradition-accent": TRADITION_ACCENT[group.key] } as CSSProperties}
            >
              <button
                type="button"
                className={styles.cardHead}
                onClick={() =>
                  group.defaultEngine && setSelectedId(activeEngine?.engine_id ?? group.defaultEngine.engine_id)
                }
                aria-expanded={isOpen}
                aria-controls={bodyId}
              >
                <span className={styles.glyph} aria-hidden="true">
                  <TraditionGlyph tradition={group.key} />
                </span>

                <span className={styles.headText}>
                  <span className={styles.titleRow}>
                    <span className={styles.cardTitle}>
                      {tr(`engineSelect.groups.${group.key}.label`)}
                    </span>
                    {isRecommended && (
                      <span className={styles.tag}>{tr("engineSelect.recommended")}</span>
                    )}
                  </span>
                  <span className={styles.origin}>
                    {tr(`engineSelect.groups.${group.key}.origin`)}
                  </span>
                  <span className={styles.summary}>
                    {tr(`engineSelect.groups.${group.key}.summary`)}
                  </span>
                </span>

                <span
                  className={`${styles.check}${isOpen ? ` ${styles.checkOn}` : ""}`}
                  aria-hidden="true"
                >
                  <CheckMark />
                </span>
              </button>

              <div id={bodyId} className={styles.cardBody} hidden={!isOpen}>
                <p className={styles.detail}>
                  {tr(`engineSelect.groups.${group.key}.description`)}
                </p>
                <p className={styles.method}>{tr(`engineSelect.groups.${group.key}.method`)}</p>

                <span className={styles.styleLabel} id={styleLabelId}>
                  {tr("engineSelect.styleLabel")}
                </span>
                <div className={styles.chips} role="radiogroup" aria-labelledby={styleLabelId}>
                  {group.engines.map((engine, engineIndex) => {
                    const isActive = engine.engine_id === activeEngine?.engine_id;
                    return (
                      <button
                        key={engine.engine_id}
                        type="button"
                        role="radio"
                        className={`${styles.chip}${isActive ? ` ${styles.chipActive}` : ""}`}
                        aria-checked={isActive}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => setSelectedId(engine.engine_id)}
                        onKeyDown={(event) => handleChipKeyDown(event, group.engines, engineIndex)}
                      >
                        {tr(`engineSelect.styles.${engine.house_system_code}.label`)}
                      </button>
                    );
                  })}
                </div>

                <p className={styles.styleHint}>
                  {activeEngine
                    ? tr(`engineSelect.styles.${activeEngine.house_system_code}.description`)
                    : ""}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {/* The one sentence that says why this page exists at all, parked at the
          end for whoever scrolled the whole list and is still deciding. */}
      <section className={styles.note}>
        <h2 className={styles.noteTitle}>{tr("engineSelect.summaryImpact")}</h2>
        <p className={styles.noteText}>{tr("engineSelect.summaryImpactText")}</p>
      </section>

      <div className={shell.actions}>
        <p className={styles.selection} aria-live="polite">
          <span className={styles.selectionLabel}>{tr("engineSelect.selectedKicker")}</span>
          <strong className={styles.selectionValue}>
            {selectedTraditionLabel} · {selectedStyleLabel}
          </strong>
        </p>
        <div className={shell.actionRow}>
          <a className={styles.back} href="/m">
            {tr("home.back")}
          </a>
          <button
            type="button"
            className={shell.button}
            onClick={handleGenerate}
            disabled={isPending || !selectedEngine}
          >
            {isPending ? tr("engineSelect.computing") : tr("engineSelect.generate")}
          </button>
        </div>
      </div>
    </div>
  );
}
