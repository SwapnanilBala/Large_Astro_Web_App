"use client";

import Link from "next/link";
import { useRouteMessages } from "@/lib/i18n-context";
import timingMessages from "@/messages/en.timing.json";

/*
 * The two dead ends of the timing page, split out so their copy can be
 * translated.
 *
 * page.tsx has to stay a server component — it awaits searchParams and calls
 * getChartPayload — and useRouteMessages is a client hook, so the copy cannot
 * live there. Only the panel itself moves across the boundary: the page still
 * decides which state to render and owns PageTransition.
 */

/** Birth details missing or incomplete — nothing to compute from. */
export function TimingMissingParams() {
  const tr = useRouteMessages(timingMessages);

  return (
    <div className="insights-shell">
      <section className="dashboard-shell">
        <p className="kicker">{tr("timing.page.missingKicker")}</p>
        <h1>{tr("timing.page.missingHeading")}</h1>
        <p className="lead">{tr("timing.page.missingLead")}</p>
        <Link href="/" className="ghost-link">
          {tr("timing.page.backToIntake")}
        </Link>
      </section>
    </div>
  );
}

/**
 * Details were complete but the chart could not be prepared.
 *
 * `errorMessage` is whatever the thrown Error carried, so it stays as the
 * server produced it; the two fallbacks below cover an empty message and a
 * non-Error throw respectively, which is the same pair the page rendered
 * before this split.
 */
export function TimingUnavailable({
  historyQs,
  errorMessage,
  calculationFailed,
}: {
  historyQs: string;
  errorMessage: string;
  calculationFailed: boolean;
}) {
  const tr = useRouteMessages(timingMessages);

  return (
    <div className="insights-shell">
      <section className="dashboard-shell">
        <p className="kicker">{tr("timing.page.errorKicker")}</p>
        <h1>{tr("timing.page.errorHeading")}</h1>
        <p className="lead">
          {errorMessage ||
            (calculationFailed
              ? tr("timing.page.calculationFailed")
              : tr("timing.page.noChartData"))}
        </p>
        <Link href={`/insights?${historyQs}`} className="ghost-link">
          {tr("timing.page.backToReading")}
        </Link>
      </section>
    </div>
  );
}
