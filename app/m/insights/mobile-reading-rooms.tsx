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

/*
 * The full reading's three rooms on /m: the desktop's rooms, stacked, in the
 * almanac's ink and paper.
 *
 * What each room lists and says comes from app/components/reading-room, the
 * same builders the desktop page uses, so a finding reads the same on a phone
 * as on a laptop; only the stylesheet and the layout differ. The list is the
 * page, and a tapped row opens its reading underneath it.
 *
 * mobile-insights.tsx loads this module only when one of the three sections
 * is opened -- they start closed -- so the two route catalogs and the karma
 * tables below cost the reading nothing until somebody asks for them.
 */

export function MobileFindingsRoom({ rules }: { rules: DeterministicRule[] }) {
  const tr = useRouteMessages(fullReadingMessages);
  return <ReadingRoom {...buildFindingRoom(rules, tr, room)} classes={room} layout="stacked" />;
}

export function MobileYogasRoom({ yogas }: { yogas: YogaDetectionResult[] }) {
  const tr = useRouteMessages(fullReadingMessages);
  const ts = useRouteMessages(strengthMessages);
  return <ReadingRoom {...buildYogaRoom(yogas, tr, ts, room)} classes={room} layout="stacked" />;
}

export function MobileKarmaRoom({ payload }: { payload: ChartApiResponse }) {
  const tr = useRouteMessages(fullReadingMessages);
  const { label, signals } = karmaSignalBar(payload, tr);

  return (
    <div className={room.karma}>
      {signals.length > 0 && (
        <ul className={room.signalBar} aria-label={label}>
          {signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      )}
      <ReadingRoom {...buildKarmaRoom(payload, tr, room)} classes={room} layout="stacked" />
      <p className={room.karmaNote}>{KARMA_NOTE}</p>
    </div>
  );
}
