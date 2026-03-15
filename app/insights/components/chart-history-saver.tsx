"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { buildSavedChartPayload } from "@/lib/chart-query";

export type ChartHistoryEntry = {
  name: string;
  city: string;
  birthDate: string;
  ascendantSign: string;
  savedAt: string;
  queryString: string;
};

const STORAGE_KEY = "astro_chart_history";
const MAX_ENTRIES = 20;
const ASTRO_API =
  process.env.NEXT_PUBLIC_ASTRO_API_BASE_URL ?? "http://127.0.0.1:8000";

type ChartHistorySaverProps = {
  name: string;
  city: string;
  birthDate: string;
  ascendantSign: string;
  queryString: string;
};

export default function ChartHistorySaver({
  name,
  city,
  birthDate,
  ascendantSign,
  queryString,
}: ChartHistorySaverProps) {
  const { isAuthenticated, token } = useAuth();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const existing: ChartHistoryEntry[] = raw ? JSON.parse(raw) : [];

      /* Dedup by name + birthDate — same person replaces old entry */
      const deduped = existing.filter(
        (e) => !(e.name === name && e.birthDate === birthDate)
      );

      const entry: ChartHistoryEntry = {
        name,
        city,
        birthDate,
        ascendantSign,
        savedAt: new Date().toISOString(),
        queryString,
      };

      const updated = [entry, ...deduped].slice(0, MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      /* localStorage unavailable or corrupt — silently ignore */
    }
  }, [name, city, birthDate, ascendantSign, queryString]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const saveChart = async () => {
      try {
        await fetch(`${ASTRO_API}/api/v1/saved-charts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(buildSavedChartPayload(queryString, ascendantSign)),
        });
      } catch {
        /* ignore backend save failures and keep local fallback */
      }
    };

    void saveChart();
  }, [ascendantSign, birthDate, city, isAuthenticated, name, queryString, token]);

  return null;
}
