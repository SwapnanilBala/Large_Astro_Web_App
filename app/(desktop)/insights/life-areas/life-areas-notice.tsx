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
 */

type LifeAreasNoticeProps =
  | { variant: "missingInput" }
  /** The engine's own message, when it produced one. Falls back to the catalog. */
  | { variant: "error"; detail: string; backHref: string };

export default function LifeAreasNotice(props: LifeAreasNoticeProps) {
  const tr = useRouteMessages(lifeAreasMessages);

  if (props.variant === "missingInput") {
    return (
      <section className="dashboard-shell">
        <p className="kicker">{tr("lifeAreas.notice.missingKicker")}</p>
        <h1>{tr("lifeAreas.notice.missingHeading")}</h1>
        <p className="lead">{tr("lifeAreas.notice.missingLead")}</p>
        <Link href="/" className="ghost-link">
          {tr("lifeAreas.notice.backToIntake")}
        </Link>
      </section>
    );
  }

  return (
    <section className="dashboard-shell">
      <p className="kicker">{tr("lifeAreas.notice.errorKicker")}</p>
      <h1>{tr("lifeAreas.notice.errorHeading")}</h1>
      <p className="lead">{props.detail || tr("lifeAreas.notice.errorFallback")}</p>
      <Link href={props.backHref} className="ghost-link">
        {tr("lifeAreas.notice.backToReading")}
      </Link>
    </section>
  );
}
