"use client";

import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { useTranslation } from "@/lib/i18n-context";

/*
 * DetailPageShell's "Back to your reading", worded in the visitor's language.
 *
 * The shell is a server component and has no translator, so its two back
 * links are this. The label is the results page's own key, which sits in the
 * desktop baseline.
 */
export default function DetailPageBackLink({
  href,
  className,
}: {
  href: string;
  className: string;
}) {
  const { t } = useTranslation();
  return (
    <Link href={href} className={className}>
      <FiArrowLeft aria-hidden="true" />
      {t("insights.backToReading")}
    </Link>
  );
}
