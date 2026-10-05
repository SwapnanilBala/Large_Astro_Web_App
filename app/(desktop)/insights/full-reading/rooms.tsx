"use client";

import type { ChartApiResponse, DeterministicRule, YogaDetectionResult } from "@/lib/astro-types";
import { useRouteMessages } from "@/lib/i18n-context";
import fullReadingMessages from "@/messages/en.full-reading.json";
import strengthMessages from "@/messages/en.strength.json";
import ReadingRoom from "@/app/components/reading-room/ReadingRoom";
import { buildFindingRoom } from "@/app/components/reading-room/findings";
import { buildYogaRoom } from "@/app/components/reading-room/yogas";
import { buildKarmaRoom, karmaSignalBar } from "@/app/components/reading-room/karma";
import { KARMA_NOTE } from "@/lib/karma-reading";
import room from "./reading-room.module.css";
import styles from "./full-reading.module.css";

/*
 * The full reading's three rooms, in the desktop's dress.
 *
 * What each room lists and says is built in app/components/reading-room, which
 * the /m tree shares; this file only supplies the desktop stylesheet and the
 * split layout. tr, not t: the page's copy ships with the route rather than
 * riding in the desktop baseline.
 */

export function FindingsRoom({ rules }: { rules: DeterministicRule[] }) {
  const tr = useRouteMessages(fullReadingMessages);
  return <ReadingRoom {...buildFindingRoom(rules, tr, room)} classes={room} />;
}

export function YogasRoom({ yogas }: { yogas: YogaDetectionResult[] }) {
  const tr = useRouteMessages(fullReadingMessages);
  const ts = useRouteMessages(strengthMessages);
  return <ReadingRoom {...buildYogaRoom(yogas, tr, ts, room)} classes={room} />;
}

export function KarmaRoom({ payload }: { payload: ChartApiResponse }) {
  const tr = useRouteMessages(fullReadingMessages);
  const { label, signals } = karmaSignalBar(payload, tr);

  return (
    <div className={styles.karma}>
      {signals.length > 0 && (
        <ul className={styles.signalBar} aria-label={label}>
          {signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      )}
      <ReadingRoom {...buildKarmaRoom(payload, tr, room)} classes={room} />
      <p className={styles.karmaNote}>{KARMA_NOTE}</p>
    </div>
  );
}
