"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n-context";

/*
 * What a chart page shows when its query is missing birth details.
 *
 * /insights, /insights/advanced and /engine-select are server components --
 * they await searchParams to decide which state they are in -- so they cannot
 * translate this copy themselves, and each carried it as English. Only the copy
 * moved here: the page still decides whether to show it, and still owns the
 * shell and the back button around it.
 *
 * The four strings are the `insights` ones the desktop baseline already
 * carries in all six languages. The subpages whose lead says something more
 * specific (the full reading, life areas, timing) keep their own notice beside
 * them, reading the same kicker, heading and link.
 */
export default function MissingChartNotice() {
  const { t } = useTranslation();

  return (
    <section className="dashboard-shell">
      <p className="kicker">{t("insights.missingKicker")}</p>
      <h1>{t("insights.missingHeading")}</h1>
      <p className="lead">{t("insights.missingLead")}</p>
      <Link href="/" className="ghost-link">
        {t("insights.backToIntake")}
      </Link>
    </section>
  );
}
