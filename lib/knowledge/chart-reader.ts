import { ApiError, ErrorCode } from "../api-errors";
import type { ChartApiResponse } from "../astro-types";
import { parseBirthSex, type BirthSex } from "../birth-sex";
import { chartParamsToBirthInput, getChartPayload, hasAllChartParams, readChartParams } from "../chart-params";
import type { AreaChart } from "./area-classics-reading";
import { chartPlacementKeys } from "./placements";

/*
 * The reader's chart as the routes that read the books for one reader rebuild
 * it: from the birth details in the request's query, never from anything the
 * browser says about the chart. It is the same cached chart the page was
 * rendered from (getChartPayload), so it costs nothing on a warm server.
 */

export type Reader = { payload: ChartApiResponse; chart: AreaChart; sex: BirthSex | undefined };

/** The reader's chart, or a validation error naming what the request is for when the birth details are missing or invalid. */
export function readerFrom(searchParams: URLSearchParams, purpose: string): Reader {
  const chartParams = readChartParams(Object.fromEntries(searchParams.entries()));
  if (!hasAllChartParams(chartParams)) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, `Complete birth details are required ${purpose}.`);
  }
  try {
    chartParamsToBirthInput(chartParams);
  } catch (error) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, error instanceof Error ? error.message : "Invalid birth details.");
  }
  const payload = getChartPayload(chartParams);
  const sex = parseBirthSex(chartParams.birthSex);
  const chart: AreaChart = {
    keys: chartPlacementKeys({
      planets: payload.chart.planets,
      ascendantSign: payload.chart.ascendant.sign,
      navamsa: payload.chart.navamsa,
      moonNakshatra: payload.chart.nakshatra?.name,
      sex,
    }),
    yogas: (payload.chart.yogas ?? [])
      .filter((yoga) => yoga.present)
      .map((yoga) => ({ id: yoga.yoga_id, planets: yoga.involved_planets })),
  };
  return { payload, chart, sex };
}
