"use client";

import { useMemo, useState } from "react";
import type { CalculationAuditInfo, DashaInfo, NakshatraInfo, PlanetPosition } from "@/lib/astro-types";
import { chainKey, mahaSpans, pathAt, progressAt, type DashaSpan } from "@/lib/dasha-periods";
import { periodFacts } from "@/lib/dasha-reading-facts";
import { nakshatraName, planetName, signName } from "@/lib/chart-labels";
import { useTranslation, LOCALE_TAGS } from "@/lib/i18n-context";
import { DashaNow } from "./dasha-now";
import { DashaPeriodCard } from "./dasha-period-card";
import { DashaTimeline } from "./dasha-timeline";
import { DASHA_LORD_THEMES } from "./dasha-themes";
import { useCurrentPeriodReading } from "./use-current-period-reading";
import { useDashaReading } from "./use-dasha-reading";
import styles from "./nakshatra-dasha-panel.module.css";

/*
 * The Vimshottari dasha panel, four levels deep: where the reader is now (the
 * periods running today, Maha Dasha to Sookshma, as a dial), the timeline
 * zoomed down to whichever period they pick, and that period's card -- where
 * its planets stand in their chart, at once and for nothing, and on request a
 * reading written from those facts and the classical books, cited.
 *
 * It opens on the present chapter: the dial shows all four of today's
 * periods, and the timeline opens on today's Antardasha, with the
 * Pratyantardashas inside it laid out and today's marked -- one click from a
 * row of the dial or a bar reaches the Pratyantardasha or the Sookshma. A
 * reading of a weeks-long Sookshma is a closer look, not the place to start.
 * Every period is computed here from the
 * chart's Maha Dasha list by the engine's own rule (lib/dasha-periods.ts),
 * so walking the timeline costs no request at all; only "Read this period"
 * does, through /api/chart/dasha-reading, which rebuilds the chart and checks
 * the period before anything is paid for.
 *
 * Two paid calls can come from here, and only one without a click: the
 * written reading of the current periods (useCurrentPeriodReading), bought
 * once per mount as it always was. The period readings wait for the button.
 */

/** How deep the timeline opens along today's periods: the Antardasha. */
const OPENING_DEPTH = 2;

type NakshatraDashaPanelProps = {
  nakshatra: NakshatraInfo;
  dasha: DashaInfo;
  audit?: CalculationAuditInfo;
  planets?: PlanetPosition[];
  /** The rising sign, which the period card counts houses from; without it the card shows no chart facts. */
  ascendantSign?: string;
  /** The chart's query string, which a period reading is asked for under; without it there is no reading button. */
  historyQs?: string;
};

export default function NakshatraDashaPanel({
  nakshatra,
  dasha,
  audit,
  planets,
  ascendantSign,
  historyQs,
}: NakshatraDashaPanelProps) {
  const { t, language } = useTranslation();
  /* One "now" for the whole panel, taken at mount: the dial, the timeline's
     marks and the card's status all agree, and render stays pure. The panel
     only mounts in the browser. */
  const [now] = useState(() => Date.now());
  const maha = useMemo(() => mahaSpans(dasha), [dasha]);
  const nowPath = useMemo(() => pathAt(dasha, now), [dasha, now]);
  /* The period picked, Maha Dasha first; it opens on today's Antardasha. */
  const [focus, setFocus] = useState<DashaSpan[]>(() => {
    const today = pathAt(dasha, now, OPENING_DEPTH);
    return today.length > 0 ? today : mahaSpans(dasha).slice(0, 1);
  });
  const [showAudit, setShowAudit] = useState(false);
  const readings = useDashaReading(historyQs ?? "");

  const facts = useMemo(
    () =>
      ascendantSign && planets
        ? periodFacts({ ascendantSign, planets }, focus.map((span) => span.planet))
        : null,
    [ascendantSign, planets, focus],
  );
  const period = focus[focus.length - 1];
  const periodKey = chainKey(focus);
  const reading = periodKey ? readings.readingFor(periodKey, language) : undefined;
  /* How deep the card's period runs along today's periods, for the dial's highlight. */
  const focusedDepth =
    focus.length <= nowPath.length &&
    focus.every((span, index) => span.planet === nowPath[index].planet && span.start === nowPath[index].start)
      ? focus.length
      : 0;

  /*
   * The written reading for the stack the reader is standing in.
   *
   * Above everything that renders because this is a hook, and it is the one
   * call in this panel that fires without a click, so it is the one worth
   * reading twice before changing: whatever is passed here is bought, once per
   * mount, for every visitor who opens the timing section.
   */
  const antardashaProgress = nowPath[1] ? progressAt(nowPath[1], now) * 100 : 0;
  const currentPeriodReading = useCurrentPeriodReading(dasha, nakshatra, planets, antardashaProgress);
  const mahaTheme = DASHA_LORD_THEMES[dasha.current_dasha];
  const antarTheme = DASHA_LORD_THEMES[dasha.current_antardasha];
  /* The template stays the fallback rather than the thing replaced: it is on
     screen from the first paint, and it is what remains if the reading never
     arrives. */
  const templateSummary =
    mahaTheme && antarTheme
      ? `Your life is currently shaped by ${mahaTheme.theme} (${dasha.current_dasha} Maha Dasha), refined through ${antarTheme.theme} (${dasha.current_antardasha} Antardasha). Key themes include ${mahaTheme.keywords.slice(0, 3).join(", ")} blended with ${antarTheme.keywords.slice(0, 3).join(", ")}.`
      : null;

  const pick = (span: DashaSpan) => setFocus((previous) => [...previous.slice(0, span.level - 1), span]);
  const stepBack = () => setFocus((previous) => (previous.length > 1 ? previous.slice(0, -1) : previous));

  const formatAuditTimestamp = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return value.replace("T", " ");
    const [, year, month, day, hour, minute] = match;
    /* The wall-clock digits as written, in the reader's language: built in UTC
       and formatted in UTC, so no time zone moves them. */
    const instant = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
    return instant.toLocaleString(LOCALE_TAGS[language], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
  };

  /*
   * The lookup instant on the reader's own clock, with the zone named.
   *
   * Not the audit's local field: that is birthplace wall time, and printed
   * bare it read as a "now" 9.5 hours ahead to someone in New York looking at
   * a chart born in India. This panel only renders in the browser, so the
   * browser's zone is the reader's.
   */
  const formatReaderTime = (utcIso: string) => {
    const instant = new Date(`${utcIso}:00Z`);
    if (Number.isNaN(instant.getTime())) return `${formatAuditTimestamp(utcIso)} UTC`;
    return new Intl.DateTimeFormat(LOCALE_TAGS[language], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(instant);
  };

  const formatUtcOffset = (minutes: number) => {
    const sign = minutes >= 0 ? "+" : "-";
    const absolute = Math.abs(minutes);
    return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
  };

  /* Numbers in the reader's notation: 2.5 in English, 2,5 in German. */
  const formatYears = (years: number, digits: number) =>
    new Intl.NumberFormat(LOCALE_TAGS[language], { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(years);

  return (
    <section className="nakshatra-panel">
      <div className="rules-header">
        <p className="kicker">{t("dasha.kicker")}</p>
        <h2>{t("dasha.heading")}</h2>
      </div>

      <div className={styles.panel}>
        {nowPath.length > 0 && (
          <DashaNow
            path={nowPath}
            now={now}
            focusedDepth={focusedDepth}
            onFocus={(depth) => setFocus(nowPath.slice(0, depth))}
            nakshatra={nakshatra}
            meaning={{
              text: currentPeriodReading.reading ?? templateSummary,
              pending: currentPeriodReading.state === "pending",
            }}
          />
        )}

        {maha.length > 0 && (
          <DashaTimeline maha={maha} focus={focus} nowPath={nowPath} now={now} onPick={pick} onStepBack={stepBack} />
        )}

        {period && (
          <DashaPeriodCard
            focus={focus}
            now={now}
            facts={facts}
            reading={reading}
            canRead={Boolean(historyQs)}
            onRead={() =>
              readings.read(
                periodKey,
                focus.map((span) => span.planet),
                period.start,
                language,
              )
            }
            onFocusDepth={(depth) => setFocus((previous) => previous.slice(0, depth))}
          />
        )}
      </div>

      {audit && (
        <section className="dasha-audit">
          <div className="dasha-audit-header">
            <div>
              <p className="dasha-audit-kicker">{t("dasha.panel.auditKicker")}</p>
              <h3>{t("dasha.panel.auditHeading")}</h3>
            </div>
            <button className="dasha-audit-toggle" type="button" onClick={() => setShowAudit((previous) => !previous)}>
              {showAudit ? t("dasha.panel.hideAudit") : t("dasha.panel.showAudit")}
            </button>
          </div>

          {showAudit && (
            <>
              <p className="dasha-audit-note">{t("dasha.panel.auditNote")}</p>
              <div className="dasha-audit-grid">
                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditEngine")}</span>
                  <strong>{audit.engine_label}</strong>
                  <small>
                    {audit.ayanamsha} / {audit.house_system}
                  </small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditBirthTime")}</span>
                  <strong>{formatAuditTimestamp(audit.birth_local_iso)}</strong>
                  <small>
                    {audit.time_zone_id ? `${audit.time_zone_id} / ` : ""}
                    {formatUtcOffset(audit.timezone_offset_minutes)}
                  </small>
                  <small>UTC: {formatAuditTimestamp(audit.birth_utc_iso)} UTC</small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditCoordinates")}</span>
                  <strong>
                    {audit.latitude.toFixed(4)}, {audit.longitude.toFixed(4)}
                  </strong>
                  <small>{t("dasha.panel.auditCoordinatesNote")}</small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditMoon")}</span>
                  <strong>
                    {t("dasha.panel.auditMoonValue", {
                      sign: signName(audit.moon_sign, t),
                      degree: audit.moon_degree_in_sign.toFixed(4),
                    })}
                  </strong>
                  <small>{t("dasha.panel.auditSidereal", { degree: audit.moon_sidereal_longitude.toFixed(4) })}</small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditNakshatra")}</span>
                  <strong>
                    {nakshatraName(audit.nakshatra_name, t)} / {planetName(audit.nakshatra_lord, t)} /{" "}
                    {t("dasha.panel.auditPada", { pada: String(audit.nakshatra_pada) })}
                  </strong>
                  <small>{t("dasha.panel.auditIntoNakshatra", { degree: audit.degree_in_nakshatra.toFixed(4) })}</small>
                  <small>
                    {t("dasha.panel.auditCompleteAtBirth", { percent: audit.nakshatra_progress_percent.toFixed(2) })}
                  </small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditSeed")}</span>
                  <strong>{t("dasha.panel.auditSeedLord", { planet: planetName(audit.dasha_seed_lord, t) })}</strong>
                  <small>
                    {t("dasha.panel.auditElapsed", {
                      elapsed: formatYears(audit.dasha_seed_elapsed_years, 2),
                      total: formatYears(audit.dasha_seed_total_years, 2),
                    })}
                  </small>
                  <small>
                    {t("dasha.panel.auditRemaining", { remaining: formatYears(audit.dasha_seed_remaining_years, 2) })}
                  </small>
                  <small>
                    {t("dasha.panel.auditWindow", {
                      start: formatAuditTimestamp(audit.dasha_seed_start_local_iso),
                      end: formatAuditTimestamp(audit.dasha_seed_end_local_iso),
                    })}
                  </small>
                </article>

                <article className="dasha-audit-card">
                  <span className="dasha-audit-label">{t("dasha.panel.auditTimingCheck")}</span>
                  <strong>{formatReaderTime(audit.reference_utc_iso)}</strong>
                  <small>{t("dasha.panel.auditTimingNote")}</small>
                  <small>UTC: {formatAuditTimestamp(audit.reference_utc_iso)} UTC</small>
                </article>
              </div>
            </>
          )}
        </section>
      )}
    </section>
  );
}
