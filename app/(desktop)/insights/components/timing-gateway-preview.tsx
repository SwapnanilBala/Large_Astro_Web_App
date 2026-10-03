import Link from "next/link";
import { ArrowUpRight, CalendarDays, Orbit, Sunrise } from "lucide-react";
import type { DashaInfo } from "@/lib/astro-types";
import styles from "./reading-gateway-previews.module.css";

const TIMING_STOPS = [
  { id: "forecast", label: "Forecast", note: "Periods now and next", icon: CalendarDays },
  { id: "muhurta", label: "Muhurta", note: "When to begin", icon: Sunrise },
  { id: "varshaphal", label: "Year ahead", note: "Your annual chart", icon: Orbit },
] as const;

export default function TimingGatewayPreview({ dasha, href }: { dasha?: DashaInfo; href: string }) {
  const end = dasha ? new Date(dasha.current_antardasha_end) : null;
  const endLabel = end && Number.isFinite(end.getTime())
    ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(end)
    : null;

  return (
    <div className={styles.timingPreview}>
      {dasha && (
        <div className={styles.currentPeriod}>
          <div>
            <span className={styles.previewLabel}>Current chapter</span>
            <strong>{dasha.current_dasha} <span>/</span> {dasha.current_antardasha}</strong>
          </div>
          {endLabel && <time dateTime={dasha.current_antardasha_end}>Until {endLabel}</time>}
        </div>
      )}
      <nav aria-label="Explore your timing">
        <ol className={styles.timingStrip}>
          {TIMING_STOPS.map(({ id, label, note, icon: Icon }) => (
            <li key={id}>
              <Link href={`${href}#${id}`} prefetch={false} className={styles.timingStop}>
                <span className={styles.stopIcon} aria-hidden="true"><Icon /></span>
                <strong>{label}</strong>
                <span className={styles.stopNote}>{note}</span>
                <ArrowUpRight className={styles.stopArrow} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
