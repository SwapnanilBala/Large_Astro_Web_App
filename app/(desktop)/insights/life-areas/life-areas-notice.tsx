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
 * Three of the strings come from `insights` rather than this route's catalog.
 * The missing-input notice is word-for-word the one the results page shows, and
 * that namespace is in the desktop baseline and already translated in all five
 * languages, so a copy here would be a second thing to keep in step for no
 * gain. The error half does differ -- "Service Unreachable" is about the chart
 * service being down, not about a domain reading failing -- so it stays local.
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
        <p className="kicker">{tr("insights.missingKicker")}</p>
        <h1>{tr("insights.missingHeading")}</h1>
        <p className="lead">{tr("lifeAreas.notice.missingLead")}</p>
        <Link href="/" className="ghost-link">
          {tr("insights.backToIntake")}
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
