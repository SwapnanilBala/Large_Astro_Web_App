"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { ForecastReading } from "@/lib/astro-types";

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
  const params = new URLSearchParams(queryString);
  const url = new URL("/api/chart/forecast", window.location.origin);

  url.searchParams.set("name", params.get("name") ?? "");
  url.searchParams.set("birth_date", params.get("birthDate") ?? "");
  url.searchParams.set("birth_time", params.get("birthTime") ?? "");
  url.searchParams.set("engine_id", params.get("engineId") ?? "lahiri_classic");
  url.searchParams.set("timezone_offset_minutes", params.get("timezoneOffsetMinutes") ?? "0");
  url.searchParams.set("latitude", params.get("latitude") ?? "0");
  url.searchParams.set("longitude", params.get("longitude") ?? "0");
  url.searchParams.set("country", params.get("country") ?? "");
  url.searchParams.set("state", params.get("state") ?? "");
  url.searchParams.set("city", params.get("city") ?? "");
  url.searchParams.set("town", params.get("town") ?? "");
  url.searchParams.set("time_zone_id", params.get("timeZoneId") ?? "");
  url.searchParams.set("target_date", targetDate);
  return url.toString();
}

type RangeForecasts = {
  start: ForecastReading;
  end: ForecastReading;
};

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

      <p className="forecast-overview">{forecast.overview}</p>

      <div className="forecast-grid">
        <section className="forecast-column">
          <h4>Where the focus goes</h4>
          <ul className="domain-reading-list">
            {forecast.focus_areas.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="forecast-column">
          <h4>Openings to use well</h4>
          <ul className="domain-reading-list">
            {forecast.opportunities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="forecast-column">
          <h4>What to be careful about</h4>
          <ul className="domain-reading-list">
            {forecast.cautions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="forecast-transits-grid">
        <section className="forecast-transit-column">
          <h4>Supportive transit signals</h4>
          <div className="forecast-transit-list">
            {forecast.supportive_transits.length > 0 ? (
              forecast.supportive_transits.map((item) => (
                <article key={`${item.transit_planet}-${item.natal_planet}-${item.aspect_type}`} className="forecast-transit-card forecast-transit-card--supportive">
                  <strong>
                    {item.transit_planet} {item.aspect_type} {item.natal_planet}
                  </strong>
                  <span>{item.orb.toFixed(2)}° orb</span>
                  <p>{item.interpretation}</p>
                </article>
              ))
            ) : (
              <p className="forecast-transit-empty">No especially supportive transit pattern stands out for that date.</p>
            )}
          </div>
        </section>

        <section className="forecast-transit-column">
          <h4>Pressure points to respect</h4>
          <div className="forecast-transit-list">
            {forecast.challenging_transits.length > 0 ? (
              forecast.challenging_transits.map((item) => (
                <article key={`${item.transit_planet}-${item.natal_planet}-${item.aspect_type}`} className="forecast-transit-card forecast-transit-card--challenging">
                  <strong>
                    {item.transit_planet} {item.aspect_type} {item.natal_planet}
                  </strong>
                  <span>{item.orb.toFixed(2)}° orb</span>
                  <p>{item.interpretation}</p>
                </article>
              ))
            ) : (
              <p className="forecast-transit-empty">No strong friction transit dominates that date.</p>
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
      const timeoutId = setTimeout(() => controller.abort(), FORECAST_TIMEOUT_MS);

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
      } catch (fetchError) {
        clearTimeout(timeoutId);
        setForecasts(null);

        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          setIsTimeout(true);
          setError(
            `Request timed out after ${Math.round(FORECAST_TIMEOUT_MS / 1000)} seconds. ` +
              "The server may be busy. Please try again."
          );
        } else {
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
        Set a date range and the engine will read the active dasha layers and key transits for both
        endpoints, giving you a window into how that stretch is likely to unfold.
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
              Period Overview &mdash; {formatFriendlyDate(forecasts.start.target_date)} to{" "}
              {formatFriendlyDate(forecasts.end.target_date)}
            </h3>
          </div>
          <ForecastCard forecast={forecasts.start} label="Period Start" />
          <ForecastCard forecast={forecasts.end} label="Period End" />
        </>
      )}
    </section>
  );
}
