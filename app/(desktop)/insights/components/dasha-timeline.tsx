"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { childSpans, dayMs, type DashaSpan } from "@/lib/dasha-periods";
import { planetAbbreviation, planetName } from "@/lib/chart-labels";
import { useTranslation } from "@/lib/i18n-context";
import { LEVEL_LABEL_KEYS, planetStyle } from "./dasha-now";
import { formatDay, formatSpan } from "./dasha-format";
import styles from "./nakshatra-dasha-panel.module.css";

/*
 * The timeline, zoomed down to the period the reader picked: the Maha Dasha
 * track across the whole life, and under it the inside of each period picked,
 * one level per track down to Sookshma, with a wedge from the picked period to
 * the track that opens it. Picking a period on any track opens the one below
 * and puts the period in the reading card; Escape steps back up a level.
 */

/* One colour per level, for the track names, as the drill-down had them. */
const LEVEL_COLORS: Record<number, string> = {
  1: "var(--accent-gold)",
  2: "var(--accent-aqua)",
  3: "var(--accent-coral)",
  4: "var(--dasha-level-4)",
};

/* Below these widths, in percent of the track, a bar shows the planet's abbreviation, then nothing. */
const FULL_NAME_WIDTH = 9;
const ABBREVIATION_WIDTH = 3.5;

type Track = { level: number; parent: DashaSpan | null; spans: DashaSpan[]; picked: DashaSpan | null };

const sameSpan = (a: DashaSpan | null | undefined, b: DashaSpan) =>
  Boolean(a) && a!.level === b.level && a!.planet === b.planet && a!.start === b.start;

type DashaTimelineProps = {
  maha: DashaSpan[];
  /** The period picked and the levels above it, Maha Dasha first. */
  focus: DashaSpan[];
  /** The periods running today, to mark them. */
  nowPath: DashaSpan[];
  now: number;
  onPick: (span: DashaSpan) => void;
  onStepBack: () => void;
};

export function DashaTimeline({ maha, focus, nowPath, now, onPick, onStepBack }: DashaTimelineProps) {
  const { t, language } = useTranslation();
  const levelLabel = (level: number) => t(LEVEL_LABEL_KEYS[level] ?? "dasha.mahaDasha");

  const tracks: Track[] = [{ level: 1, parent: null, spans: maha, picked: focus[0] ?? null }];
  for (const [index, parent] of focus.slice(0, 3).entries()) {
    tracks.push({ level: index + 2, parent, spans: childSpans(parent), picked: focus[index + 1] ?? null });
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || focus.length <= 1) return;
    event.preventDefault();
    onStepBack();
  };

  return (
    <section className={styles.explorer} aria-labelledby="dasha-timeline-title" onKeyDown={onKeyDown}>
      <div className={styles.explorerHead}>
        <div>
          <h3 id="dasha-timeline-title">{t("dasha.panel.timelineTitle")}</h3>
          <p className={styles.explorerHint}>{t("dasha.explorer.hint")}</p>
        </div>
        <button
          type="button"
          className={styles.stepBack}
          onClick={onStepBack}
          disabled={focus.length <= 1}
          aria-label={focus.length > 1 ? t("dasha.stepBackTo", { level: levelLabel(focus.length - 1) }) : undefined}
        >
          <span aria-hidden="true">&larr;</span>
          {t("dasha.stepBack")}
        </button>
      </div>

      {tracks.map((track, index) => {
        if (track.spans.length === 0) return null;
        const rangeStart = track.parent ? track.parent.start : track.spans[0].start;
        const rangeEnd = track.parent ? track.parent.end : track.spans[track.spans.length - 1].end;
        const from = dayMs(rangeStart);
        const length = dayMs(rangeEnd) - from || 1;
        const percent = (iso: string) => ((dayMs(iso) - from) / length) * 100;
        const todayAt = ((now - from) / length) * 100;
        const picked = track.picked;
        const next = tracks[index + 1];

        return (
          <div key={`${track.level}-${rangeStart}`}>
            <div className={styles.track}>
              <div className={styles.trackHead} style={{ "--level-color": LEVEL_COLORS[track.level] } as CSSProperties}>
                <span className={styles.trackLevel}>{levelLabel(track.level)}</span>
                {track.parent && (
                  <span className={styles.trackInside}>
                    {t("dasha.explorer.inside", { planet: planetName(track.parent.planet, t) })}
                  </span>
                )}
                <span className={styles.trackRange}>{formatSpan({ start: rangeStart, end: rangeEnd }, language)}</span>
              </div>
              <div className={styles.bars} role="group" aria-label={levelLabel(track.level)}>
                {track.spans.map((span) => {
                  const left = percent(span.start);
                  const width = percent(span.end) - left;
                  const isPicked = sameSpan(picked, span);
                  const isNow = sameSpan(nowPath[span.level - 1], span);
                  const label =
                    width >= FULL_NAME_WIDTH
                      ? planetName(span.planet, t)
                      : width >= ABBREVIATION_WIDTH
                        ? planetAbbreviation(span.planet, t)
                        : "";
                  return (
                    <button
                      key={`${span.planet}-${span.start}`}
                      type="button"
                      className={[
                        styles.bar,
                        isPicked ? styles.barSelected : "",
                        isNow ? styles.barCurrent : "",
                        dayMs(span.end) <= now && !isPicked ? styles.barPast : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{ ...planetStyle(span.planet), left: `${left}%`, width: `${width}%` }}
                      aria-pressed={isPicked}
                      aria-label={
                        t("dasha.explorer.barLabel", {
                          planet: planetName(span.planet, t),
                          level: levelLabel(span.level),
                          start: formatDay(span.start, language),
                          end: formatDay(span.end, language),
                        }) + (isNow ? ` · ${t("dasha.activeNow")}` : "")
                      }
                      onClick={() => onPick(span)}
                    >
                      {label && <span className={styles.barLabel}>{label}</span>}
                    </button>
                  );
                })}
                {todayAt >= 0 && todayAt < 100 && (
                  <span className={styles.today} style={{ left: `${todayAt}%` }} aria-hidden="true">
                    {index === 0 && <span className={styles.todayLabel}>{t("dasha.panel.today")}</span>}
                  </span>
                )}
              </div>
            </div>
            {picked && next && next.spans.length > 0 && (
              <svg
                className={styles.wedge}
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                aria-hidden="true"
                style={planetStyle(picked.planet)}
              >
                <polygon points={`${percent(picked.start)},0 ${percent(picked.end)},0 100,10 0,10`} />
              </svg>
            )}
          </div>
        );
      })}
    </section>
  );
}
