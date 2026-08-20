"use client";

import { useEffect } from "react";
import { useProfile } from "@/lib/profile-context";
import { buildSavedChartPayload } from "@/lib/chart-query";
import { recordChartVisit } from "@/lib/chart-history-store";
import { saveChart as saveChartRecord } from "@/lib/workspace-store";

export type { ChartHistoryEntry } from "@/lib/chart-history-store";

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
  const { profileId } = useProfile();

  useEffect(() => {
    recordChartVisit(profileId, {
      name,
      city,
      birthDate,
      ascendantSign,
      queryString,
    });
  }, [ascendantSign, birthDate, city, name, profileId, queryString]);

  useEffect(() => {
    if (!profileId) return;

    const syncChart = async () => {
      try {
        await saveChartRecord(profileId, buildSavedChartPayload(queryString, ascendantSign));
      } catch {
        /* ignore workspace write failures and keep the history entry */
      }
    };

    void syncChart();
  }, [ascendantSign, profileId, queryString]);

  return null;
}
