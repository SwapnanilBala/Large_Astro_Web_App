"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { buildSavedChartPayload } from "@/lib/chart-query";
import { saveChart as saveChartRecord } from "@/lib/workspace-store";

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
  const { isAuthenticated, user } = useAuth();

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
    if (!isAuthenticated || !user) return;

    const syncChart = async () => {
      try {
        await saveChartRecord(user.user_id, buildSavedChartPayload(queryString, ascendantSign));
      } catch {
        /* ignore remote sync failures and keep local fallback */
      }
    };

    void syncChart();
  }, [ascendantSign, birthDate, city, isAuthenticated, name, queryString, user]);

  return null;
}
