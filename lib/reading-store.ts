import type { ClientReadingRecord, GuestReadingRecord, ChartApiResponse } from "@/lib/astro-types";
import type { LifeDomainInsight } from "@/lib/engines/rule-engine";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Brief extraction helpers
// ---------------------------------------------------------------------------

/**
 * Combine headline + body, capped at `maxLen` chars.
 *
 * Reads the DISPLAY tier deliberately. These columns feed a client-facing
 * brief, and the technical tier would persist "Career: Capricorn house 10, led
 * by Saturn." into Supabase, where it outlives any later copy fix. The
 * house-lord notation is still available on the payload for anyone who wants
 * it; it just is not what gets written to the database.
 */
function domainBrief(
  insights: LifeDomainInsight[] | undefined | null,
  key: LifeDomainInsight["key"],
  maxLen = 150
): string {
  if (!insights) return "";
  const domain = insights.find((d) => d.key === key);
  if (!domain) return "";
  const raw = `${domain.display.headline}. ${domain.display.body}`;
  if (raw.length <= maxLen) return raw;
  // Truncate at word boundary
  const truncated = raw.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "\u2026";
}

/** Truncate chart summary to ~75 chars at a word boundary. */
function generalBrief(summary: string | undefined | null, maxLen = 75): string {
  if (!summary) return "";
  if (summary.length <= maxLen) return summary;
  const truncated = summary.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "\u2026";
}

// ---------------------------------------------------------------------------
// Input shape (matches InsightsLoader's ChartParams)
// ---------------------------------------------------------------------------

type ReadingInput = {
  name: string;
  birthDate: string;
  birthTime: string;
  timezoneOffsetMinutes: string;
  latitude: string;
  longitude: string;
  country: string;
  state: string;
  city: string;
  town: string;
  timeZoneId: string;
  engineId: string;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist a reading for an authenticated user.
 * Upserts on (user_id, name, birth_date, birth_time) so repeat calculations
 * update the existing row rather than creating duplicates.
 */
export async function saveAuthenticatedReading(
  userId: string,
  input: ReadingInput,
  chartData: ChartApiResponse
): Promise<ClientReadingRecord | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const insights = chartData.chart?.life_domain_insights;

  const row = {
    user_id: userId,
    name: input.name,
    birth_date: input.birthDate,
    birth_time: input.birthTime,
    city: input.city,
    country: input.country,
    state: input.state,
    town: input.town || "",
    latitude: parseFloat(input.latitude) || 0,
    longitude: parseFloat(input.longitude) || 0,
    timezone_offset: parseInt(input.timezoneOffsetMinutes, 10) || 0,
    time_zone_id: input.timeZoneId || "",
    engine_id: input.engineId || "lahiri_classic",
    ascendant_sign: chartData.chart?.ascendant?.sign || "",
    brief_career: domainBrief(insights, "career"),
    brief_love: domainBrief(insights, "love_life"),
    brief_family: domainBrief(insights, "family"),
    brief_travel: domainBrief(insights, "travel_destinations"),
  };

  try {
    const { data, error } = await supabase
      .from("client_readings")
      .upsert(row, { onConflict: "user_id,name,birth_date,birth_time" })
      .select("*")
      .single();

    if (error) {
      console.warn("[reading-store] client_readings upsert failed:", error.message);
      return null;
    }
    return data as ClientReadingRecord;
  } catch (err) {
    console.warn("[reading-store] client_readings unexpected error:", err);
    return null;
  }
}

/**
 * Persist a reading for an anonymous/guest user.
 * Insert-only (no upsert) — each guest calculation is logged separately.
 */
export async function saveGuestReading(
  input: ReadingInput,
  chartData: ChartApiResponse
): Promise<GuestReadingRecord | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const row = {
    name: input.name,
    birth_date: input.birthDate,
    birth_time: input.birthTime,
    city: input.city,
    country: input.country,
    state: input.state,
    latitude: parseFloat(input.latitude) || 0,
    longitude: parseFloat(input.longitude) || 0,
    timezone_offset: parseInt(input.timezoneOffsetMinutes, 10) || 0,
    time_zone_id: input.timeZoneId || "",
    engine_id: input.engineId || "lahiri_classic",
    brief_general: generalBrief(chartData.chart?.summary),
  };

  try {
    const { data, error } = await supabase
      .from("guest_readings")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      console.warn("[reading-store] guest_readings insert failed:", error.message);
      return null;
    }
    return data as GuestReadingRecord;
  } catch (err) {
    console.warn("[reading-store] guest_readings unexpected error:", err);
    return null;
  }
}
