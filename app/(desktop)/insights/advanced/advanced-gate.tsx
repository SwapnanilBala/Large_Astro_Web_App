"use client";

import Link from "next/link";
import { useRouteMessages, useTranslation } from "@/lib/i18n-context";
import advancedMessages from "@/messages/en.advanced.json";

/*
 * What a signed-out visitor sees instead of the advanced reading.
 *
 * The page reads the session cookie and builds the return path, so it stays a
 * server component; this is only its copy, in the visitor's language. The
 * page still decides whether the gate shows and supplies both links.
 */
export default function AdvancedGate({
  signInHref,
  readingHref,
}: {
  signInHref: string;
  readingHref: string;
}) {
  const { t } = useTranslation();
  const tr = useRouteMessages(advancedMessages);

  return (
    <section className="dashboard-shell advanced-gate">
      <p className="kicker">{tr("advanced.gate.kicker")}</p>
      <h1>{tr("advanced.gate.heading")}</h1>
      <p className="lead">{tr("advanced.gate.lead")}</p>
      <div className="advanced-gate-actions">
        <Link href={signInHref} className="ghost-link advanced-gate-primary">
          {tr("advanced.gate.signIn")}
        </Link>
        <Link href={readingHref} className="ghost-link">
          {t("insights.backToReading")}
        </Link>
      </div>
    </section>
  );
}
