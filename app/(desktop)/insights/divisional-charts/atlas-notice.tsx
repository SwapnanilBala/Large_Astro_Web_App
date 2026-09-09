"use client";

import Link from "next/link";
import { useRouteMessages } from "@/lib/i18n-context";
import divisionalMessages from "@/messages/en.divisional.json";

/*
 * The two dead ends of the varga atlas page.
 *
 * The page itself has to stay a server component — it awaits searchParams and
 * calls getChartPayload, and neither survives "use client" — so the copy it
 * used to hold inline lives here, where useRouteMessages can reach it. All
 * that crosses the boundary is the back href and whatever the calculation
 * itself said went wrong.
 */

type AtlasNoticeProps =
  | { variant: "missing-input" }
  | {
      variant: "unavailable";
      backHref: string;
      /** The calculation's own message; falls back to translated copy. */
      error: string;
    };

export default function AtlasNotice(props: AtlasNoticeProps) {
  const tr = useRouteMessages(divisionalMessages);

  if (props.variant === "missing-input") {
    return (
      <div className="insights-shell">
        <section className="dashboard-shell">
          <p className="kicker">{tr("divisional.atlas.missing.kicker")}</p>
          <h1>{tr("divisional.atlas.missing.title")}</h1>
          <p className="lead">{tr("divisional.atlas.missing.lead")}</p>
          <Link href="/" className="ghost-link">
            {tr("divisional.atlas.missing.back")}
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="insights-shell">
      <section className="dashboard-shell">
        <p className="kicker">{tr("divisional.atlas.unavailable.kicker")}</p>
        <h1>{tr("divisional.atlas.unavailable.title")}</h1>
        <p className="lead">
          {props.error || tr("divisional.atlas.unavailable.fallback")}
        </p>
        <Link href={props.backHref} className="ghost-link">
          {tr("divisional.atlas.unavailable.back")}
        </Link>
      </section>
    </div>
  );
}
