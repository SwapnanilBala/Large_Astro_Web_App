"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { ForecastReading } from "@/lib/astro-types";
import { buildBirthProfileApiUrl } from "@/lib/chart-query";

type FutureForecastPanelProps = {
  queryString: string;
};

const DEFAULT_START_DAYS = 30;
const DEFAULT_END_DAYS = 90;
const FORECAST_TIMEOUT_MS = 30_000;

function formatFutureDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split("T")[0] ?? "";
}

function todayString() {
  return new Date().toISOString().split("T")[0] ?? "";
}

function formatFriendlyDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildForecastUrl(queryString: string, targetDate: string) {
  return buildBirthProfileApiUrl("/api/chart/forecast", window.location.origin, queryString, {
    target_date: targetDate,
  });
}

type RangeForecasts = {
  start: ForecastReading;
  end: ForecastReading;
};

function compactItems(items: string[], limit = 2) {
  return items.slice(0, limit);
}

function compactTransitText(value: string) {
  const firstSentence = value.split(".")[0]?.trim();
  if (!firstSentence) return value;
  return firstSentence.length > 120 ? `${firstSentence.slice(0, 117)}...` : firstSentence;
}

function ForecastCard({ forecast, label }: { forecast: ForecastReading; label: string }) {
  return (
    <article className="forecast-card">
      <div className="forecast-card-header">
        <div>
          <p className="kicker">
            {label} &mdash; {formatFriendlyDate(forecast.target_date)}
          </p>
          <h3>{forecast.headline}</h3>
        </div>
        <span className="access-pill access-pill--premium">
          {forecast.dasha.current_dasha} / {forecast.dasha.current_antardasha}
        </span>
      </div>

      <div className="forecast-grid">
        <section className="forecast-column">
          <h4>Focus</h4>
          <ul className="domain-reading-list">
            {compactItems(forecast.focus_areas).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="forecast-column">
          <h4>Openings</h4>
          <ul className="domain-reading-list">
            {compactItems(forecast.opportunities).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="forecast-column">
          <h4>Cautions</h4>
          <ul className="domain-reading-list">
            {compactItems(forecast.cautions).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="forecast-transits-grid">
        <section className="forecast-transit-column">
          <h4>Supportive signal</h4>
          <div className="forecast-transit-list">
            {forecast.supportive_transits.length > 0 ? (
              forecast.supportive_transits.slice(0, 1).map((item) => (
                <article key={`${item.transit_planet}-${item.natal_planet}-${item.aspect_type}`} className="forecast-transit-card forecast-transit-card--supportive">
                  <strong>
                    {item.transit_planet} {item.aspect_type} {item.natal_planet}
                  </strong>
                  <span>{item.orb.toFixed(2)}° orb</span>
                  <p>{compactTransitText(item.interpretation)}</p>
                </article>
              ))
            ) : (
              <p className="forecast-transit-empty">No standout support.</p>
            )}
          </div>
        </section>

        <section className="forecast-transit-column">
          <h4>Pressure point</h4>
          <div className="forecast-transit-list">
            {forecast.challenging_transits.length > 0 ? (
              forecast.challenging_transits.slice(0, 1).map((item) => (
                <article key={`${item.transit_planet}-${item.natal_planet}-${item.aspect_type}`} className="forecast-transit-card forecast-transit-card--challenging">
                  <strong>
                    {item.transit_planet} {item.aspect_type} {item.natal_planet}
                  </strong>
                  <span>{item.orb.toFixed(2)}° orb</span>
                  <p>{compactTransitText(item.interpretation)}</p>
                </article>
              ))
            ) : (
              <p className="forecast-transit-empty">No dominant friction.</p>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}

export default function FutureForecastPanel({ queryString }: FutureForecastPanelProps) {
  const [startDate, setStartDate] = useState(() => formatFutureDate(DEFAULT_START_DAYS));
  const [endDate, setEndDate] = useState(() => formatFutureDate(DEFAULT_END_DAYS));
  const [forecasts, setForecasts] = useState<RangeForecasts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isTimeout, setIsTimeout] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadForecasts = useCallback(
    async (start: string, end: string) => {
      if (!start || !end) return;

      // Abort any in-flight request
      abortControllerRef.current?.abort();

      setIsLoading(true);
      setError("");
      setIsTimeout(false);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      let didTimeout = false;
      const timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, FORECAST_TIMEOUT_MS);

      try {
        const [startResponse, endResponse] = await Promise.all([
          fetch(buildForecastUrl(queryString, start), { signal: controller.signal }),
          fetch(buildForecastUrl(queryString, end), { signal: controller.signal }),
        ]);

        clearTimeout(timeoutId);

        if (!startResponse.ok) {
          throw new Error(`Forecast API error for start date (${startResponse.status})`);
        }
        if (!endResponse.ok) {
          throw new Error(`Forecast API error for end date (${endResponse.status})`);
        }

        const [startData, endData] = await Promise.all([
          startResponse.json() as Promise<ForecastReading>,
          endResponse.json() as Promise<ForecastReading>,
        ]);

        setForecasts({ start: startData, end: endData });
        setError("");
        setIsTimeout(false);
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          if (didTimeout) {
            setForecasts(null);
            setIsTimeout(true);
            setError(
              `Request timed out after ${Math.round(FORECAST_TIMEOUT_MS / 1000)} seconds. ` +
                "The server may be busy. Please try again."
            );
          }
        } else {
          setForecasts(null);
          setError(
            fetchError instanceof Error ? fetchError.message : "Could not load forecast."
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [queryString]
  );

  useEffect(() => {
    void loadForecasts(startDate, endDate);
    return () => {
      abortControllerRef.current?.abort();
    };
    // The query string changes when the engine changes, so we deliberately refetch here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    // If start is pushed past end, bring end forward to match
    if (value > endDate) {
      setEndDate(value);
    }
  };

  return (
    <section className="rules-panel forecast-panel">
      <div className="rules-header">
        <p className="kicker">Forward Timing</p>
        <h2>Future Date Forecast</h2>
      </div>
      <p className="section-intro forecast-intro">
        Pick two dates to compare the active dasha layer and strongest transit signals.
      </p>

      <form
        className="forecast-form"
        onSubmit={(event) => {
          event.preventDefault();
          void loadForecasts(startDate, endDate);
        }}
      >
        <div className="forecast-date-row">
          <label className="forecast-date-field input-glow-aqua">
            Start Date
            <input
              type="date"
              value={startDate}
              min={todayString()}
              onChange={(event) => handleStartDateChange(event.target.value)}
            />
          </label>
          <label className="forecast-date-field input-glow-aqua">
            End Date
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Reading period..." : "Read that period"}
        </button>
      </form>

      <div className="forecast-timeline" aria-label="Timing timeline">
        <div className="forecast-timeline-item">
          <span>Now</span>
          <strong>Input chart</strong>
          <small>Birth pattern baseline</small>
        </div>
        <div className="forecast-timeline-item">
          <span>Start</span>
          <strong>{formatFriendlyDate(startDate)}</strong>
          <small>{forecasts ? `${forecasts.start.dasha.current_dasha} / ${forecasts.start.dasha.current_antardasha}` : "Pending read"}</small>
        </div>
        <div className="forecast-timeline-item forecast-timeline-item--active">
          <span>End</span>
          <strong>{formatFriendlyDate(endDate)}</strong>
          <small>{forecasts ? `${forecasts.end.dasha.current_dasha} / ${forecasts.end.dasha.current_antardasha}` : "Target window"}</small>
        </div>
      </div>

      {error && (
        <div className="forecast-error">
          <p className="error-note">
            {isTimeout ? "Timeout: " : "Error: "}
            {error}
          </p>
          <button
            type="button"
            className="skel-retry-btn"
            onClick={() => void loadForecasts(startDate, endDate)}
            disabled={isLoading}
          >
            <span className="skel-retry-icon">&#x21BB;</span>
            Retry
          </button>
        </div>
      )}

      {forecasts && (
        <>
          <div className="forecast-period-header">
            <h3>
              Period: {formatFriendlyDate(forecasts.start.target_date)} to{" "}
              {formatFriendlyDate(forecasts.end.target_date)}
            </h3>
          </div>
          <ForecastCard forecast={forecasts.end} label="Period End" />
        </>
      )}
    </section>
  );
}
