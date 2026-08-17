import { fromZonedTime } from "date-fns-tz";
import tzLookup from "tz-lookup";

export interface BirthMomentInput {
  birth_date: string;
  birth_time: string;
  timezone_offset_minutes: number;
  latitude: number;
  longitude: number;
  time_zone_id?: string;
}

export interface ResolvedBirthMoment {
  /** The actual UTC instant used by the astronomy engine. */
  utcDate: Date;
  /** A UTC-backed Date carrying the entered local wall-clock components. */
  localWallClockDate: Date;
  timeZoneId: string;
  timezoneOffsetMinutes: number;
  source: "coordinates" | "time_zone_id" | "numeric_offset";
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

function localWallClockDate(date: string, time: string): Date {
  const dateMatch = DATE_PATTERN.exec(date);
  const timeMatch = TIME_PATTERN.exec(time);
  if (!dateMatch || !timeMatch) {
    throw new RangeError("Birth date or time is not in a supported format");
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? "0");

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

function normalizedLocalIso(date: string, time: string): string {
  return `${date}T${time.length === 5 ? `${time}:00` : time}`;
}

function isValidTimeZone(timeZoneId: string): boolean {
  if (!timeZoneId) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timeZoneId }).format(0);
    return true;
  } catch {
    return false;
  }
}

/** Resolve one local wall-clock value through an IANA time-zone rule set. */
export function resolveZonedLocalMoment(
  date: string,
  time: string,
  timeZoneId: string,
): Omit<ResolvedBirthMoment, "source"> | null {
  if (!isValidTimeZone(timeZoneId)) return null;

  try {
    const localDate = localWallClockDate(date, time);
    const utcDate = fromZonedTime(normalizedLocalIso(date, time), timeZoneId);
    if (!Number.isFinite(utcDate.getTime())) return null;

    return {
      utcDate,
      localWallClockDate: localDate,
      timeZoneId,
      timezoneOffsetMinutes: Math.round(
        (localDate.getTime() - utcDate.getTime()) / 60_000,
      ),
    };
  } catch {
    return null;
  }
}

/**
 * Resolve the birth instant from the birthplace first, then fall back to the
 * supplied IANA zone and finally the numeric offset used by older saved links.
 *
 * Coordinates are authoritative because a restored draft can carry the
 * browser's zone or a stale numeric offset while already containing the
 * correct birthplace. Ascendant calculations are too time-sensitive to trust
 * that stale client value when the IANA rules can be derived locally.
 */
export function resolveBirthMoment(input: BirthMomentInput): ResolvedBirthMoment {
  let coordinateTimeZone = "";
  try {
    coordinateTimeZone = tzLookup(input.latitude, input.longitude);
  } catch {
    // Invalid or unavailable coordinates fall through to the saved zone.
  }

  const candidates: Array<{
    id: string;
    source: ResolvedBirthMoment["source"];
  }> = [
    { id: coordinateTimeZone, source: "coordinates" },
    { id: input.time_zone_id?.trim() ?? "", source: "time_zone_id" },
  ];

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.id || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    const resolved = resolveZonedLocalMoment(
      input.birth_date,
      input.birth_time,
      candidate.id,
    );
    if (resolved) return { ...resolved, source: candidate.source };
  }

  const localDate = localWallClockDate(input.birth_date, input.birth_time);
  const offset = Number.isFinite(input.timezone_offset_minutes)
    ? input.timezone_offset_minutes
    : 0;

  return {
    utcDate: new Date(localDate.getTime() - offset * 60_000),
    localWallClockDate: localDate,
    timeZoneId: "",
    timezoneOffsetMinutes: offset,
    source: "numeric_offset",
  };
}
