"use client";

import Link from "next/link";
import { useRouteMessages, useTranslation } from "@/lib/i18n-context";
import strengthMessages from "@/messages/en.strength.json";

/*
 * The copy for /insights/house-support, split out of the page.
 *
 * The page itself awaits searchParams and calls the chart service, so it has
 * to stay a server component and cannot call useRouteMessages. These are the
 * pieces of it that are only text: the two dead ends, and the hero's title and
 * lead. The page still decides which one renders and supplies the values.
 *
 * The hero's `kicker` is not here. DetailPageShell types that prop as `string`
 * rather than ReactNode, so it cannot take a rendered fragment, and that file
 * is not part of this change.
 */

/** Shown when the URL is missing birth details entirely. */
export function HouseSupportMissingState() {
  const { t } = useTranslation();
  const tr = useRouteMessages(strengthMessages);

  return (
    <section className="dashboard-shell">
      <p className="kicker">{t("insights.missingKicker")}</p>
      <h1>{t("insights.missingHeading")}</h1>
      <p className="lead">{tr("strength.page.missingLead")}</p>
      <Link href="/" className="ghost-link">
        {t("insights.backToIntake")}
      </Link>
    </section>
  );
}

/**
 * Shown when the chart came back without a complete Ashtakavarga, or did not
 * come back at all.
 *
 * `error` carries a message thrown by the chart service, which is English
 * whatever the visitor's language is; `failed` distinguishes "the calculation
 * threw and said nothing useful" from "it succeeded but the data is short",
 * so each gets its own translated sentence.
 */
export function HouseSupportUnavailableState({
  backHref,
  error,
  failed,
}: {
  backHref: string;
  error: string;
  failed: boolean;
}) {
  const tr = useRouteMessages(strengthMessages);

  return (
    <section className="dashboard-shell">
      <p className="kicker">{tr("strength.page.unavailableKicker")}</p>
      <h1>{tr("strength.page.unavailableHeading")}</h1>
      <p className="lead">
        {error ||
          (failed
            ? tr("strength.page.calculationFailed")
            : tr("strength.page.unavailableLead"))}
      </p>
      <Link href={backHref} className="ghost-link">
        {tr("strength.page.backToReading")}
      </Link>
    </section>
  );
}

/** The hero heading, passed to DetailPageShell's ReactNode `title`. */
export function HouseSupportHeroTitle({ name }: { name: string }) {
  const tr = useRouteMessages(strengthMessages);
  return <>{tr("strength.page.heroTitle", { name })}</>;
}

/** The hero standfirst, passed to DetailPageShell's ReactNode `lead`. */
export function HouseSupportHeroLead() {
  const tr = useRouteMessages(strengthMessages);
  return <>{tr("strength.page.heroLead")}</>;
}
