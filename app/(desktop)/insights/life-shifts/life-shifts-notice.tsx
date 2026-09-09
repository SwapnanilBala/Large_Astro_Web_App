"use client";

import Link from "next/link";
import { useRouteMessages } from "@/lib/i18n-context";
import lifeAreasMessages from "@/messages/en.life-areas.json";

/*
 * The two states this route can land in before it has a reading to show.
 *
 * Split out of page.tsx rather than translated in place: useRouteMessages is a
 * client hook, and the page awaits searchParams and builds the chart, so it has
 * to stay a server component. Only the copy moved -- the page still decides
 * which state it is in, and still owns the shell around this section.
 *
 * The keys sit under the lifeAreas namespace rather than getting a catalog of
 * their own: this route's whole body is MajorShiftsPanel, which belongs to the
 * results page and is translated with it, so the eight strings below are all
 * this directory has and are not worth a fourth file to ship them.
 */

type LifeShiftsNoticeProps =
  | { variant: "missingInput" }
  /** The engine's own message, when it produced one. Falls back to the catalog. */
  | { variant: "error"; detail: string; backHref: string };

export default function LifeShiftsNotice(props: LifeShiftsNoticeProps) {
  const tr = useRouteMessages(lifeAreasMessages);

  if (props.variant === "missingInput") {
    return (
      <section className="dashboard-shell">
        <p className="kicker">{tr("lifeAreas.lifeShifts.missingKicker")}</p>
        <h1>{tr("lifeAreas.lifeShifts.missingHeading")}</h1>
        <p className="lead">{tr("lifeAreas.lifeShifts.missingLead")}</p>
        <Link href="/" className="ghost-link">
          {tr("lifeAreas.lifeShifts.backToIntake")}
        </Link>
      </section>
    );
  }

  return (
    <section className="dashboard-shell">
      <p className="kicker">{tr("lifeAreas.lifeShifts.errorKicker")}</p>
      <h1>{tr("lifeAreas.lifeShifts.errorHeading")}</h1>
      <p className="lead">
        {props.detail || tr("lifeAreas.lifeShifts.errorFallback")}
      </p>
      <Link href={props.backHref} className="ghost-link">
        {tr("lifeAreas.lifeShifts.backToReading")}
      </Link>
    </section>
  );
}
