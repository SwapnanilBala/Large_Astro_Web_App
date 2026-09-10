"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { CalendarPlus } from "lucide-react";
import type { ForecastAspectInsight, ForecastReading } from "@/lib/astro-types";
import { buildBirthProfileApiUrl } from "@/lib/chart-query";
import { useRouteMessages, useTranslation, LOCALE_TAGS } from "@/lib/i18n-context";
import timingMessages from "@/messages/en.timing.json";

type FutureForecastPanelProps = {
  queryString: string;
};

type Translator = (key: string, params?: Record<string, string>) => string;

const FORECAST_TIMEOUT_MS = 30_000;
const DATE_STRIP_DAYS = 7;

/*
 * The failure, not a sentence about it.
 *
 * Holding the resolved English in state would freeze it at the moment of the
 * request, so switching language afterwards would leave the error behind in the
 * old one. Keeping the shape and translating at render also keeps `tr` out of
 * the fetch callback's dependencies, which would otherwise re-fire the effect —
 * and re-run the request — every time a translation file finished loading.
 */
type ForecastError =
  | { kind: "api"; status: string }
  | { kind: "timeout" }
  | { kind: "loadFailed" }
  | { kind: "message"; text: string };

function forecastErrorText(error: ForecastError, tr: Translator): string {
  switch (error.kind) {
    case "api":
      return tr("timing.forecast.apiError", { status: error.status });
    case "timeout":
      return tr("timing.forecast.timeoutMessage", {
        seconds: String(Math.round(FORECAST_TIMEOUT_MS / 1000)),
      });
    case "loadFailed":
      return tr("timing.forecast.loadFailed");
    default:
      return error.text;
  }
}

type LifeArea = "all" | "career" | "relationships" | "wellbeing" | "finances" | "learning" | "spiritual";

/*
 * `keywords` stay English on purpose: they are matched against the forecast
 * text the API returns, which is English regardless of the interface language.
 * Only `labelKey` is on screen.
 */
const LIFE_AREAS: Array<{ value: LifeArea; labelKey: string; keywords: string[] }> = [
  { value: "all", labelKey: "timing.forecast.areas.all", keywords: [] },
  { value: "career", labelKey: "timing.forecast.areas.career", keywords: ["career", "work", "leadership", "profession", "ambition", "authority", "achievement", "business"] },
  { value: "relationships", labelKey: "timing.forecast.areas.relationships", keywords: ["relationship", "love", "partner", "marriage", "family", "social"] },
  { value: "wellbeing", labelKey: "timing.forecast.areas.wellbeing", keywords: ["health", "wellbeing", "well-being", "rest", "healing", "emotional", "home", "inner"] },
  { value: "finances", labelKey: "timing.forecast.areas.finances", keywords: ["money", "wealth", "finance", "financial", "resources", "income", "investment"] },
  { value: "learning", labelKey: "timing.forecast.areas.learning", keywords: ["learning", "study", "education", "writing", "communication", "knowledge", "skill", "teaching"] },
  { value: "spiritual", labelKey: "timing.forecast.areas.spiritual", keywords: ["spiritual", "spirituality", "reflection", "intuition", "meditation", "dharma", "release"] },
];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, offsetDays: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + offsetDays);
  return localDateString(date);
}

/*
 * The values below are bare YYYY-MM-DD calendar dates, so they are read at UTC
 * noon and formatted in UTC. Formatting an instant in the viewer's own zone
 * would print the day before for anyone west of Greenwich, and the day after
 * past UTC+12.
 */
function formatFriendlyDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDateButton(value: string, locale: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return {
    day: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(date),
    date: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(date),
  };
}

function buildForecastUrl(queryString: string, targetDate: string) {
  return buildBirthProfileApiUrl("/api/chart/forecast", window.location.origin, queryString, {
    target_date: targetDate,
  });
}

function compactTransitText(value: string) {
  const firstSentence = value.split(".")[0]?.trim();
  if (!firstSentence) return value;
  return firstSentence.length > 120 ? `${firstSentence.slice(0, 117)}...` : firstSentence;
}

function matchesLifeArea(value: string, lifeArea: LifeArea) {
  if (lifeArea === "all") return true;
  const keywords = LIFE_AREAS.find((area) => area.value === lifeArea)?.keywords ?? [];
  return keywords.some((keyword) => value.toLowerCase().includes(keyword));
}

function getMajorSignals(forecast: ForecastReading) {
  return [...forecast.supportive_transits, ...forecast.challenging_transits]
    .sort((left, right) => left.orb - right.orb)
    .slice(0, 3);
}

function escapeIcs(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function downloadForecastCalendarEvent(
  forecast: ForecastReading,
  lifeArea: LifeArea,
  tr: Translator,
  locale: string
) {
  const nextDate = addDays(forecast.target_date, 1).replaceAll("-", "");
  const areaLabelKey = LIFE_AREAS.find((area) => area.value === lifeArea)?.labelKey;
  const signals = getMajorSignals(forecast)
    .map((signal) =>
      tr("timing.forecast.calendar.signalLine", {
        transit: signal.transit_planet,
        aspect: signal.aspect_type,
        natal: signal.natal_planet,
        orb: signal.orb.toFixed(2),
      })
    )
    .join("\n");
  const description = [
    forecast.headline,
    forecast.overview,
    lifeArea === "all" || !areaLabelKey
      ? ""
      : tr("timing.forecast.calendar.focusLine", { area: tr(areaLabelKey) }),
    signals ? tr("timing.forecast.calendar.signalsBlock", { signals }) : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const dateStamp = forecast.target_date.replaceAll("-", "");
  const event = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lagna Atelier//Future Forecast//EN",
    "BEGIN:VEVENT",
    `UID:forecast-${forecast.target_date}-${forecast.dasha.current_dasha}-${forecast.dasha.current_antardasha}@lagna-atelier`,
    `DTSTAMP:${localDateString().replaceAll("-", "")}T000000Z`,
    `DTSTART;VALUE=DATE:${dateStamp}`,
    `DTEND;VALUE=DATE:${nextDate}`,
    `SUMMARY:${escapeIcs(
      tr("timing.forecast.calendar.summary", {
        date: formatFriendlyDate(forecast.target_date, locale),
      })
    )}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([event], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `future-forecast-${forecast.target_date}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function MajorSignal({ signal }: { signal: ForecastAspectInsight }) {
  const tr = useRouteMessages(timingMessages);

  return (
    <article className={`forecast-event ${signal.tone === "supportive" ? "forecast-event--supportive" : "forecast-event--challenging"}`}>
      <span className="forecast-event-tone">
        {signal.tone === "supportive"
          ? tr("timing.forecast.signal.support")
          : tr("timing.forecast.signal.watch")}
      </span>
      <div>
        <strong>
          {tr("timing.forecast.signal.title", {
            transit: signal.transit_planet,
            aspect: signal.aspect_type,
            natal: signal.natal_planet,
          })}
        </strong>
        <p>{compactTransitText(signal.interpretation)}</p>
      </div>
      <span className="forecast-event-orb">{signal.orb.toFixed(2)}°</span>
    </article>
  );
}

function ForecastCard({ forecast, lifeArea }: { forecast: ForecastReading; lifeArea: LifeArea }) {
  const { language } = useTranslation();
  const tr = useRouteMessages(timingMessages);
  const locale = LOCALE_TAGS[language];
  const focusItems = forecast.focus_areas.filter((item) => matchesLifeArea(item, lifeArea));
  const openingItems = forecast.opportunities.filter((item) => matchesLifeArea(item, lifeArea));
  const cautionItems = forecast.cautions.filter((item) => matchesLifeArea(item, lifeArea));
  const majorSignals = getMajorSignals(forecast);
  const emptyNote = tr("timing.forecast.card.filterEmpty", { area: lifeArea });

  return (
    <article className="forecast-card">
      <div className="forecast-card-header">
        <div>
          <p className="kicker">
            {tr("timing.forecast.card.dailyOutlook", {
              date: formatFriendlyDate(forecast.target_date, locale),
            })}
          </p>
          <h3>{forecast.headline}</h3>
        </div>
        <span className="access-pill access-pill--premium">
          {forecast.dasha.current_dasha} / {forecast.dasha.current_antardasha}
        </span>
      </div>

      <p className="forecast-overview">{forecast.overview}</p>

      <div className="forecast-grid">
        <section className="forecast-column">
          <h4>{tr("timing.forecast.card.focus")}</h4>
          {focusItems.length > 0 ? (
            <ul className="domain-reading-list">
              {focusItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : <p className="forecast-filter-empty">{emptyNote}</p>}
        </section>

        <section className="forecast-column">
          <h4>{tr("timing.forecast.card.openings")}</h4>
          {openingItems.length > 0 ? (
            <ul className="domain-reading-list">
              {openingItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : <p className="forecast-filter-empty">{emptyNote}</p>}
        </section>

        <section className="forecast-column">
          <h4>{tr("timing.forecast.card.cautions")}</h4>
          {cautionItems.length > 0 ? (
            <ul className="domain-reading-list">
              {cautionItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : <p className="forecast-filter-empty">{emptyNote}</p>}
        </section>
      </div>

      <section className="forecast-events" aria-labelledby="forecast-major-events">
        <div className="forecast-events-header">
          <div>
            <p className="kicker">{tr("timing.forecast.card.transitTimeline")}</p>
            <h4 id="forecast-major-events">{tr("timing.forecast.card.majorSignals")}</h4>
          </div>
          <button type="button" className="forecast-calendar-button" onClick={() => downloadForecastCalendarEvent(forecast, lifeArea, tr, locale)}>
            <CalendarPlus size={16} aria-hidden="true" />
            {tr("timing.forecast.card.saveToCalendar")}
          </button>
        </div>
        {majorSignals.length > 0 ? (
          <div className="forecast-event-list">
            {majorSignals.map((signal) => (
              <MajorSignal key={`${signal.transit_planet}-${signal.aspect_type}-${signal.natal_planet}`} signal={signal} />
            ))}
          </div>
        ) : <p className="forecast-transit-empty">{tr("timing.forecast.card.noMajorTransits")}</p>}
      </section>
    </article>
  );
}

export default function FutureForecastPanel({ queryString }: FutureForecastPanelProps) {
  const { language } = useTranslation();
  const tr = useRouteMessages(timingMessages);
  const locale = LOCALE_TAGS[language];
  const [selectedDate, setSelectedDate] = useState(() => localDateString());
  const [forecast, setForecast] = useState<ForecastReading | null>(null);
  const [lifeArea, setLifeArea] = useState<LifeArea>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ForecastError | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dateOptions = Array.from(
    { length: DATE_STRIP_DAYS },
    (_, index) => addDays(localDateString(), index)
  );

  const loadForecast = useCallback(async (targetDate: string) => {
    abortControllerRef.current?.abort();
    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, FORECAST_TIMEOUT_MS);

    try {
      const response = await fetch(buildForecastUrl(queryString, targetDate), { signal: controller.signal });
      if (!response.ok) {
        setForecast(null);
        setError({ kind: "api", status: String(response.status) });
        return;
      }
      setForecast(await response.json() as ForecastReading);
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        if (didTimeout) {
          setForecast(null);
          setError({ kind: "timeout" });
        }
      } else {
        setForecast(null);
        setError(
          fetchError instanceof Error
            ? { kind: "message", text: fetchError.message }
            : { kind: "loadFailed" }
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void loadForecast(selectedDate);
    return () => abortControllerRef.current?.abort();
  }, [loadForecast, selectedDate]);

  return (
    <section className="rules-panel forecast-panel">
      <div className="rules-header">
        <p className="kicker">{tr("timing.forecast.kicker")}</p>
        <h2>{tr("timing.forecast.heading")}</h2>
      </div>
      <p className="section-intro forecast-intro">{tr("timing.forecast.intro")}</p>

      <div className="forecast-date-strip" role="group" aria-label={tr("timing.forecast.dateStripLabel")}>
        {dateOptions.map((date) => {
          const label = formatDateButton(date, locale);
          const isSelected = date === selectedDate;
          return (
            <button
              key={date}
              type="button"
              className={isSelected ? "forecast-date-option forecast-date-option--selected" : "forecast-date-option"}
              onClick={() => setSelectedDate(date)}
              aria-pressed={isSelected}
            >
              <span>{date === dateOptions[0] ? tr("timing.forecast.today") : label.day}</span>
              <strong>{label.date}</strong>
            </button>
          );
        })}
      </div>

      <div className="forecast-filter-bar" aria-label={tr("timing.forecast.filterBarLabel")}>
        <span>{tr("timing.forecast.viewThemes")}</span>
        <div className="forecast-filter-list">
          {LIFE_AREAS.map((area) => (
            <button
              key={area.value}
              type="button"
              className={lifeArea === area.value ? "forecast-filter forecast-filter--active" : "forecast-filter"}
              onClick={() => setLifeArea(area.value)}
              aria-pressed={lifeArea === area.value}
            >
              {tr(area.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <p className="forecast-loading" role="status">
          {tr("timing.forecast.loading", { date: formatFriendlyDate(selectedDate, locale) })}
        </p>
      )}

      {error && (
        <div className="forecast-error">
          <p className="error-note">
            {error.kind === "timeout"
              ? tr("timing.forecast.timeoutPrefix")
              : tr("timing.forecast.errorPrefix")}
            {forecastErrorText(error, tr)}
          </p>
          <button
            type="button"
            className="skel-retry-btn"
            onClick={() => void loadForecast(selectedDate)}
            disabled={isLoading}
          >
            {tr("timing.forecast.retry")}
          </button>
        </div>
      )}

      {forecast && !isLoading && <ForecastCard forecast={forecast} lifeArea={lifeArea} />}
    </section>
  );
}
