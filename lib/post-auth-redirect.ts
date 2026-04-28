import { listSavedCharts } from "@/lib/workspace-store";

type LocalChartHistoryEntry = {
  queryString?: string;
  savedAt?: string;
};

type ResolvedChartQuery = {
  queryString: string;
  savedAt: string;
};

const CHART_HISTORY_STORAGE_KEY = "astro_chart_history";

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
  const params = new URLSearchParams(queryString.startsWith("?") ? queryString.slice(1) : queryString);
  return requiredEngineSelectParams.every((param) => (params.get(param) ?? "").trim().length > 0);
}

function engineSelectDestination(queryString: string) {
  const params = new URLSearchParams(queryString.startsWith("?") ? queryString.slice(1) : queryString);
  return `/engine-select?${params.toString()}`;
}

function getLatestLocalChartQuery(): ResolvedChartQuery | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CHART_HISTORY_STORAGE_KEY);
    if (!raw) return null;

    const entries = JSON.parse(raw) as LocalChartHistoryEntry[];
    if (!Array.isArray(entries)) return null;

    const latest = entries
      .filter((entry) => isCompleteChartQuery(entry.queryString))
      .sort((left, right) => {
        const leftTime = left.savedAt ? new Date(left.savedAt).getTime() : 0;
        const rightTime = right.savedAt ? new Date(right.savedAt).getTime() : 0;
        return rightTime - leftTime;
      })[0];

    return latest?.queryString
      ? {
          queryString: latest.queryString,
          savedAt: latest.savedAt ?? "",
        }
      : null;
  } catch {
    return null;
  }
}

async function getLatestRemoteChartQuery(userId?: string | null): Promise<ResolvedChartQuery | null> {
  if (!userId) return null;

  try {
    const charts = await listSavedCharts(userId);
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

function pickLatestChartQuery(localQuery: ResolvedChartQuery | null, remoteQuery: ResolvedChartQuery | null) {
  if (!localQuery) return remoteQuery;
  if (!remoteQuery) return localQuery;

  const localTime = localQuery.savedAt ? new Date(localQuery.savedAt).getTime() : 0;
  const remoteTime = remoteQuery.savedAt ? new Date(remoteQuery.savedAt).getTime() : 0;

  return remoteTime > localTime ? remoteQuery : localQuery;
}

function getPublicAppOrigin() {
  if (typeof window === "undefined") return null;

  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredUrl) return window.location.origin;

  try {
    const urlWithProtocol = /^https?:\/\//i.test(configuredUrl)
      ? configuredUrl
      : `https://${configuredUrl}`;
    return new URL(urlWithProtocol).origin;
  } catch {
    return window.location.origin;
  }
}

export async function resolvePostAuthDestination(userId?: string | null, fallbackPath?: string | null) {
  const fallback = normalizeInternalPath(fallbackPath);

  const localQuery = getLatestLocalChartQuery();
  const remoteQuery = await getLatestRemoteChartQuery(userId);
  const chartQuery = pickLatestChartQuery(localQuery, remoteQuery);
  if (chartQuery) {
    return engineSelectDestination(chartQuery.queryString);
  }

  return fallback;
}

export function buildAuthCallbackUrl(returnTo?: string) {
  if (typeof window === "undefined") return "/auth/callback";

  const callbackUrl = new URL("/auth/callback", getPublicAppOrigin() ?? window.location.origin);
  const next = normalizeInternalPath(returnTo);
  if (next !== "/") {
    callbackUrl.searchParams.set("next", next);
  }

  return callbackUrl.toString();
}
