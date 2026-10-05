import type { ChartApiResponse } from "@/lib/astro-types";
import { buildPastLifeInsights, karmaSignals, type InsightTone } from "@/lib/karma-reading";
import type { ReadingRoomContent, ReadingRoomItem } from "./ReadingRoom";
import type { ReadingRoomClasses, Translate } from "./classes";
import { roomNavigation } from "./navigation";

/*
 * The karma reading as reading-room content: Karma, Fate, Vocation and
 * Integration, each with the placements it was read from.
 *
 * The readings themselves are built in lib/karma-reading.ts from tables of
 * English phrases, and stay English in every language -- as they always have.
 * Only the room's own labels are translated. `tr` must resolve fullReading.
 */

/* The three accents the old cards used, mapped onto the rooms' tones. */
const TONE: Record<InsightTone, string> = { gold: "core", teal: "career", coral: "coral" };

export function buildKarmaRoom(
  payload: ChartApiResponse,
  tr: Translate,
  c: ReadingRoomClasses,
): ReadingRoomContent {
  const items: ReadingRoomItem[] = buildPastLifeInsights(payload).map((insight) => ({
    key: insight.label,
    row: (
      <>
        <span className={c.mark}>
          <span className={`${c.dot} ${c.tone}`} data-tone={TONE[insight.tone]} />
        </span>
        <span className={c.rowText}>
          <span className={c.rowTitle}>{insight.title}</span>
          <span className={c.rowMeta}>{insight.label}</span>
        </span>
      </>
    ),
    detail: (headingId) => (
      <article>
        <p className={c.meta}>
          <span className={c.tone} data-tone={TONE[insight.tone]}>
            {insight.label}
          </span>
        </p>
        <h3 id={headingId} className={c.title}>
          {insight.title}
        </h3>
        <div className={c.detailBody}>
          <div>
            <p className={c.text}>{insight.body}</p>
          </div>
          {insight.evidence.length > 0 && (
            <aside className={c.evidence} aria-labelledby={`${headingId}-why`}>
              <p id={`${headingId}-why`} className={c.label}>
                {tr("fullReading.whyThisReading")}
              </p>
              <ul className={c.signals}>
                {insight.evidence.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </article>
    ),
  }));

  return {
    items,
    listLabel: tr("fullReading.karmaList"),
    ...roomNavigation(tr),
  };
}

/** The placements the whole karma reading is drawn from, and the label for them. */
export function karmaSignalBar(payload: ChartApiResponse, tr: Translate) {
  return { label: tr("fullReading.karmaSignals"), signals: karmaSignals(payload) };
}
