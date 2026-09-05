"use client";

import { useEffect } from "react";
import { useProfile } from "@/lib/profile-context";
import { recordChartVisit } from "@/lib/chart-history-store";

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

  return null;
}
