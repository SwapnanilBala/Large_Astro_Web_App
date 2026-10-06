import Link from "next/link";
import { ArrowUpRight, CalendarDays, Orbit, Sunrise } from "lucide-react";
import type { DashaInfo } from "@/lib/astro-types";
import { LOCALE_TAGS, useTranslation } from "@/lib/i18n-context";
import { planetName } from "@/lib/chart-labels";
import styles from "./reading-gateway-previews.module.css";

export const TIMING_STOPS = [
  { id: "forecast", key: "forecast", icon: CalendarDays },
  { id: "muhurta", key: "muhurta", icon: Sunrise },
  { id: "varshaphal", key: "yearAhead", icon: Orbit },
] as const;

export default function TimingGatewayPreview({ dasha, href }: { dasha?: DashaInfo; href: string }) {
  const { t, language } = useTranslation();
  const end = dasha ? new Date(dasha.current_antardasha_end) : null;
  const endLabel = end && Number.isFinite(end.getTime())
    ? new Intl.DateTimeFormat(LOCALE_TAGS[language], { month: "short", year: "numeric", timeZone: "UTC" }).format(end)
    : null;

  return (
    <div className={styles.timingPreview}>
      {dasha && (
        <div className={styles.currentPeriod}>
          <div>
            <span className={styles.previewLabel}>{t("insights.timingPreview.chapter")}</span>
            <strong>
              {planetName(dasha.current_dasha, t)} <span>/</span> {planetName(dasha.current_antardasha, t)}
            </strong>
          </div>
          {endLabel && (
            <time dateTime={dasha.current_antardasha_end}>
              {t("insights.timingPreview.until", { date: endLabel })}
            </time>
          )}
        </div>
      )}
      <nav aria-label={t("insights.page.gateways.timing.cta")}>
        <ol className={styles.timingStrip}>
          {TIMING_STOPS.map(({ id, key, icon: Icon }) => (
            <li key={id}>
              <Link href={`${href}#${id}`} prefetch={false} className={styles.timingStop}>
                <span className={styles.stopIcon} aria-hidden="true"><Icon /></span>
                <strong>{t(`insights.timingPreview.stops.${key}.label`)}</strong>
                <span className={styles.stopNote}>{t(`insights.timingPreview.stops.${key}.note`)}</span>
                <ArrowUpRight className={styles.stopArrow} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
