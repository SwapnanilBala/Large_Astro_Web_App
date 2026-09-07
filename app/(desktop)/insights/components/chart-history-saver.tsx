"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    recordChartVisit({
      name,
      city,
      birthDate,
      ascendantSign,
      queryString,
    });
  }, [ascendantSign, birthDate, city, name, queryString]);

  return null;
}
