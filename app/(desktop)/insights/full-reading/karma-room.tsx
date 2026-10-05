"use client";

import type { ChartApiResponse } from "@/lib/astro-types";
import { useRouteMessages } from "@/lib/i18n-context";
import fullReadingMessages from "@/messages/en.full-reading.json";
import { buildPastLifeInsights, karmaSignals, type InsightTone } from "./karma";
import ReadingRoom, { type ReadingRoomItem } from "./reading-room";
import room from "./reading-room.module.css";
import styles from "./full-reading.module.css";

/*
 * The karma reading in the reading room: Karma, Fate, Vocation and
 * Integration, each with the placements it was read from beside it.
 *
 * The readings themselves are built in karma.ts from tables of English
 * phrases, and stay English in every language -- as they were before the
 * move. Only the room's own labels are translated.
 */

/* The three accents the cards used, mapped onto the room's tones. */
const TONE: Record<InsightTone, string> = { gold: "core", teal: "career", coral: "coral" };

export default function KarmaRoom({ payload }: { payload: ChartApiResponse }) {
  const tr = useRouteMessages(fullReadingMessages);
  const insights = buildPastLifeInsights(payload);
  const signals = karmaSignals(payload);

  const items: ReadingRoomItem[] = insights.map((insight) => ({
    key: insight.label,
    row: (
      <>
        <span className={room.mark}>
          <span className={`${room.dot} ${room.tone}`} data-tone={TONE[insight.tone]} />
        </span>
        <span className={room.rowText}>
          <span className={room.rowTitle}>{insight.title}</span>
          <span className={room.rowMeta}>{insight.label}</span>
        </span>
      </>
    ),
    detail: (headingId) => (
      <article>
        <p className={room.meta}>
          <span className={room.tone} data-tone={TONE[insight.tone]}>
            {insight.label}
          </span>
        </p>
        <h3 id={headingId} className={room.title}>
          {insight.title}
        </h3>
        <div className={room.detailBody}>
          <div>
            <p className={room.text}>{insight.body}</p>
          </div>
          {insight.evidence.length > 0 && (
            <aside className={room.evidence} aria-labelledby={`${headingId}-why`}>
              <p id={`${headingId}-why`} className={room.label}>
                {tr("fullReading.whyThisReading")}
              </p>
              <ul className={room.signals}>
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

  return (
    <div className={styles.karma}>
      {signals.length > 0 && (
        <ul className={styles.signalBar} aria-label={tr("fullReading.karmaSignals")}>
          {signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      )}

      <ReadingRoom
        items={items}
        listLabel={tr("fullReading.karmaList")}
        previousLabel={tr("fullReading.previous")}
        nextLabel={tr("fullReading.next")}
        positionLabel={(position, total) =>
          tr("fullReading.position", { position: String(position), total: String(total) })
        }
      />

      <p className={styles.karmaNote}>
        These insights are framed as reflective astrology, not fixed destiny.
        The useful part is the pattern your chart actually carries: what to
        mature, what to release, and what kind of work makes the old story
        serve the present one.
      </p>
    </div>
  );
}
