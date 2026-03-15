"use client";

import { useEffect, useState } from "react";
import type { ForecastReading } from "@/lib/astro-types";

type FutureForecastPanelProps = {
  queryString: string;
};

const DEFAULT_LOOKAHEAD_DAYS = 90;

function formatFutureDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split("T")[0] ?? "";
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
  const baseUrl = process.env.NEXT_PUBLIC_ASTRO_API_BASE_URL ?? "http://127.0.0.1:8000";
  const url = new URL("/api/v1/chart/forecast", baseUrl);

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

export default function FutureForecastPanel({ queryString }: FutureForecastPanelProps) {
  const [targetDate, setTargetDate] = useState(() => formatFutureDate(DEFAULT_LOOKAHEAD_DAYS));
  const [forecast, setForecast] = useState<ForecastReading | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadForecast = async (dateValue: string) => {
    if (!dateValue) {
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(buildForecastUrl(queryString, dateValue));
      if (!response.ok) {
        throw new Error(`Forecast API error (${response.status})`);
      }
      const data = (await response.json()) as ForecastReading;
      setForecast(data);
    } catch (fetchError) {
      setForecast(null);
      setError(fetchError instanceof Error ? fetchError.message : "Could not load forecast.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadForecast(targetDate);
    // The query string changes when the engine changes, so we deliberately refetch here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  return (
    <section className="rules-panel forecast-panel">
      <div className="rules-header">
        <p className="kicker">Forward Timing</p>
        <h2>Future Date Forecast</h2>
      </div>
      <p className="section-intro forecast-intro">
        Pick a date ahead and the engine will read the active dasha layer plus key transits for that
        period, including the main openings and the things worth handling carefully.
      </p>

      <form
        className="forecast-form"
        onSubmit={(event) => {
          event.preventDefault();
          void loadForecast(targetDate);
        }}
      >
        <label className="forecast-date-field input-glow-aqua">
          Forecast date
          <input
            type="date"
            value={targetDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        </label>
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Reading period..." : "Read that period"}
        </button>
      </form>

      {error && <p className="error-note">{error}</p>}

      {forecast && (
        <article className="forecast-card">
          <div className="forecast-card-header">
            <div>
              <p className="kicker">{formatFriendlyDate(forecast.target_date)}</p>
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
      )}
    </section>
  );
}
