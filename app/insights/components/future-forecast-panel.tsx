"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { CalendarPlus } from "lucide-react";
import type { ForecastAspectInsight, ForecastReading } from "@/lib/astro-types";
import { buildBirthProfileApiUrl } from "@/lib/chart-query";

type FutureForecastPanelProps = {
  queryString: string;
};

const FORECAST_TIMEOUT_MS = 30_000;
const DATE_STRIP_DAYS = 7;

type LifeArea = "all" | "career" | "relationships" | "wellbeing" | "finances" | "learning" | "spiritual";

const LIFE_AREAS: Array<{ value: LifeArea; label: string; keywords: string[] }> = [
  { value: "all", label: "All", keywords: [] },
  { value: "career", label: "Career", keywords: ["career", "work", "leadership", "profession", "ambition", "authority", "achievement", "business"] },
  { value: "relationships", label: "Relationships", keywords: ["relationship", "love", "partner", "marriage", "family", "social"] },
  { value: "wellbeing", label: "Wellbeing", keywords: ["health", "wellbeing", "well-being", "rest", "healing", "emotional", "home", "inner"] },
  { value: "finances", label: "Finances", keywords: ["money", "wealth", "finance", "financial", "resources", "income", "investment"] },
  { value: "learning", label: "Learning", keywords: ["learning", "study", "education", "writing", "communication", "knowledge", "skill", "teaching"] },
  { value: "spiritual", label: "Spiritual", keywords: ["spiritual", "spirituality", "reflection", "intuition", "meditation", "dharma", "release"] },
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

function formatFriendlyDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatDateButton(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return {
    day: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
    date: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date),
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

function downloadForecastCalendarEvent(forecast: ForecastReading, lifeArea: LifeArea) {
  const nextDate = addDays(forecast.target_date, 1).replaceAll("-", "");
  const selectedArea = LIFE_AREAS.find((area) => area.value === lifeArea)?.label;
  const signals = getMajorSignals(forecast)
    .map((signal) => `${signal.transit_planet} ${signal.aspect_type} natal ${signal.natal_planet} (${signal.orb.toFixed(2)}° orb)`)
    .join("\n");
  const description = [forecast.headline, forecast.overview, selectedArea === "All" ? "" : `Focus: ${selectedArea}`, signals ? `Major signals:\n${signals}` : ""]
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
    `SUMMARY:${escapeIcs(`Astrology forecast: ${formatFriendlyDate(forecast.target_date)}`)}`,
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
  return (
    <article className={`forecast-event ${signal.tone === "supportive" ? "forecast-event--supportive" : "forecast-event--challenging"}`}>
      <span className="forecast-event-tone">{signal.tone === "supportive" ? "Support" : "Watch"}</span>
      <div>
        <strong>{signal.transit_planet} {signal.aspect_type} natal {signal.natal_planet}</strong>
        <p>{compactTransitText(signal.interpretation)}</p>
      </div>
      <span className="forecast-event-orb">{signal.orb.toFixed(2)}°</span>
    </article>
  );
}

function ForecastCard({ forecast, lifeArea }: { forecast: ForecastReading; lifeArea: LifeArea }) {
  const focusItems = forecast.focus_areas.filter((item) => matchesLifeArea(item, lifeArea));
  const openingItems = forecast.opportunities.filter((item) => matchesLifeArea(item, lifeArea));
  const cautionItems = forecast.cautions.filter((item) => matchesLifeArea(item, lifeArea));
  const majorSignals = getMajorSignals(forecast);

  return (
    <article className="forecast-card">
      <div className="forecast-card-header">
        <div>
          <p className="kicker">
            Daily outlook - {formatFriendlyDate(forecast.target_date)}
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
          <h4>Focus</h4>
          {focusItems.length > 0 ? (
            <ul className="domain-reading-list">
              {focusItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : <p className="forecast-filter-empty">No direct {lifeArea} themes surfaced for this date.</p>}
        </section>

        <section className="forecast-column">
          <h4>Openings</h4>
          {openingItems.length > 0 ? (
            <ul className="domain-reading-list">
              {openingItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : <p className="forecast-filter-empty">No direct {lifeArea} themes surfaced for this date.</p>}
        </section>

        <section className="forecast-column">
          <h4>Cautions</h4>
          {cautionItems.length > 0 ? (
            <ul className="domain-reading-list">
              {cautionItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : <p className="forecast-filter-empty">No direct {lifeArea} themes surfaced for this date.</p>}
        </section>
      </div>

      <section className="forecast-events" aria-labelledby="forecast-major-events">
        <div className="forecast-events-header">
          <div>
            <p className="kicker">Transit timeline</p>
            <h4 id="forecast-major-events">Major signals for this date</h4>
          </div>
          <button type="button" className="forecast-calendar-button" onClick={() => downloadForecastCalendarEvent(forecast, lifeArea)}>
            <CalendarPlus size={16} aria-hidden="true" />
            Save to calendar
          </button>
        </div>
        {majorSignals.length > 0 ? (
          <div className="forecast-event-list">
            {majorSignals.map((signal) => (
              <MajorSignal key={`${signal.transit_planet}-${signal.aspect_type}-${signal.natal_planet}`} signal={signal} />
            ))}
          </div>
        ) : <p className="forecast-transit-empty">No major transit aspects are exact enough to highlight on this date.</p>}
      </section>
    </article>
  );
}

export default function FutureForecastPanel({ queryString }: FutureForecastPanelProps) {
  const [selectedDate, setSelectedDate] = useState(() => localDateString());
  const [forecast, setForecast] = useState<ForecastReading | null>(null);
  const [lifeArea, setLifeArea] = useState<LifeArea>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isTimeout, setIsTimeout] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dateOptions = Array.from(
    { length: DATE_STRIP_DAYS },
    (_, index) => addDays(localDateString(), index)
  );

  const loadForecast = useCallback(async (targetDate: string) => {
    abortControllerRef.current?.abort();
    setIsLoading(true);
    setError("");
    setIsTimeout(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, FORECAST_TIMEOUT_MS);

    try {
      const response = await fetch(buildForecastUrl(queryString, targetDate), { signal: controller.signal });
      if (!response.ok) throw new Error(`Forecast API error (${response.status})`);
      setForecast(await response.json() as ForecastReading);
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        if (didTimeout) {
          setForecast(null);
          setIsTimeout(true);
          setError(`Request timed out after ${Math.round(FORECAST_TIMEOUT_MS / 1000)} seconds. Please try again.`);
        }
      } else {
        setForecast(null);
        setError(fetchError instanceof Error ? fetchError.message : "Could not load forecast.");
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
        <p className="kicker">Forward Timing</p>
        <h2>Future Date Forecast</h2>
      </div>
      <p className="section-intro forecast-intro">
        Choose a day to see the active timing cycle, practical themes, and strongest personal transit signals.
      </p>

      <div className="forecast-date-strip" role="group" aria-label="Choose a forecast date">
        {dateOptions.map((date) => {
          const label = formatDateButton(date);
          const isSelected = date === selectedDate;
          return (
            <button
              key={date}
              type="button"
              className={isSelected ? "forecast-date-option forecast-date-option--selected" : "forecast-date-option"}
              onClick={() => setSelectedDate(date)}
              aria-pressed={isSelected}
            >
              <span>{date === dateOptions[0] ? "Today" : label.day}</span>
              <strong>{label.date}</strong>
            </button>
          );
        })}
      </div>

      <div className="forecast-filter-bar" aria-label="Filter forecast themes">
        <span>View themes:</span>
        <div className="forecast-filter-list">
          {LIFE_AREAS.map((area) => (
            <button
              key={area.value}
              type="button"
              className={lifeArea === area.value ? "forecast-filter forecast-filter--active" : "forecast-filter"}
              onClick={() => setLifeArea(area.value)}
              aria-pressed={lifeArea === area.value}
            >
              {area.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="forecast-loading" role="status">Reading {formatFriendlyDate(selectedDate)}...</p>}

      {error && (
        <div className="forecast-error">
          <p className="error-note">
            {isTimeout ? "Timeout: " : "Error: "}
            {error}
          </p>
          <button
            type="button"
            className="skel-retry-btn"
            onClick={() => void loadForecast(selectedDate)}
            disabled={isLoading}
          >
            Retry
          </button>
        </div>
      )}

      {forecast && !isLoading && <ForecastCard forecast={forecast} lifeArea={lifeArea} />}
    </section>
  );
}
