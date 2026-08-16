/**
 * Where to send someone after they pick a local profile.
 *
 * A returning profile with a usable chart goes straight back to engine
 * selection for their most recent chart; anyone else lands on the requested
 * fallback path.
 */

import { readChartHistory } from "@/lib/chart-history-store";
import { listSavedCharts } from "@/lib/workspace-store";

type ResolvedChartQuery = {
  queryString: string;
  savedAt: string;
};

const requiredEngineSelectParams = [
  "name",
  "birthDate",
  "birthTime",
  "timezoneOffsetMinutes",
  "latitude",
  "longitude",
  "country",
  "state",
  "city",
] as const;

function isInternalPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//");
}

function normalizeInternalPath(path?: string | null) {
  if (!path) return "/";

  try {
    const decoded = decodeURIComponent(path);
    return isInternalPath(decoded) ? decoded : "/";
  } catch {
    return isInternalPath(path) ? path : "/";
  }
}

function isCompleteChartQuery(queryString?: string | null) {
  if (!queryString) return false;
  const params = new URLSearchParams(
    queryString.startsWith("?") ? queryString.slice(1) : queryString
  );
  return requiredEngineSelectParams.every(
    (param) => (params.get(param) ?? "").trim().length > 0
  );
}

function engineSelectDestination(queryString: string) {
  const params = new URLSearchParams(
    queryString.startsWith("?") ? queryString.slice(1) : queryString
  );
  return `/engine-select?${params.toString()}`;
}

function getLatestHistoryQuery(profileId?: string | null): ResolvedChartQuery | null {
  const latest = readChartHistory(profileId ?? null)
    .filter((entry) => isCompleteChartQuery(entry.queryString))
    .sort((left, right) => {
      const leftTime = left.savedAt ? new Date(left.savedAt).getTime() : 0;
      const rightTime = right.savedAt ? new Date(right.savedAt).getTime() : 0;
      return rightTime - leftTime;
    })[0];

  return latest?.queryString
    ? { queryString: latest.queryString, savedAt: latest.savedAt ?? "" }
    : null;
}

async function getLatestSavedChartQuery(
  profileId?: string | null
): Promise<ResolvedChartQuery | null> {
  if (!profileId) return null;

  try {
    const charts = await listSavedCharts(profileId);
    const latest = charts.find((chart) => isCompleteChartQuery(chart.query_string));
    return latest
      ? {
          queryString: latest.query_string,
          savedAt: latest.updated_at || latest.saved_at,
        }
      : null;
  } catch {
    return null;
  }
}

function pickLatestChartQuery(
  historyQuery: ResolvedChartQuery | null,
  savedQuery: ResolvedChartQuery | null
) {
  if (!historyQuery) return savedQuery;
  if (!savedQuery) return historyQuery;

  const historyTime = historyQuery.savedAt ? new Date(historyQuery.savedAt).getTime() : 0;
  const savedTime = savedQuery.savedAt ? new Date(savedQuery.savedAt).getTime() : 0;

  return savedTime > historyTime ? savedQuery : historyQuery;
}

export async function resolveProfileDestination(
  profileId?: string | null,
  fallbackPath?: string | null
) {
  const fallback = normalizeInternalPath(fallbackPath);

  const chartQuery = pickLatestChartQuery(
    getLatestHistoryQuery(profileId),
    await getLatestSavedChartQuery(profileId)
  );

  return chartQuery ? engineSelectDestination(chartQuery.queryString) : fallback;
}
