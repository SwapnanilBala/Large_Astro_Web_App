import { describe, expect, it } from "vitest";

import { resolveBirthMoment } from "../birth-moment";

describe("resolveBirthMoment", () => {
  it("uses birthplace coordinates ahead of a stale saved offset and zone", () => {
    const result = resolveBirthMoment({
      birth_date: "1990-06-15",
      birth_time: "14:30",
      timezone_offset_minutes: 0,
      latitude: 28.6139,
      longitude: 77.209,
      time_zone_id: "America/New_York",
    });

    expect(result.source).toBe("coordinates");
    expect(result.timeZoneId).toBe("Asia/Kolkata");
    expect(result.timezoneOffsetMinutes).toBe(330);
    expect(result.utcDate.toISOString()).toBe("1990-06-15T09:00:00.000Z");
  });

  it("applies the historical daylight-saving rule for the birth date", () => {
    const summer = resolveBirthMoment({
      birth_date: "2024-07-01",
      birth_time: "12:00:30",
      timezone_offset_minutes: 0,
      latitude: 40.7128,
      longitude: -74.006,
    });
    const winter = resolveBirthMoment({
      birth_date: "2024-01-01",
      birth_time: "12:00:30",
      timezone_offset_minutes: 0,
      latitude: 40.7128,
      longitude: -74.006,
    });

    expect(summer.timezoneOffsetMinutes).toBe(-240);
    expect(summer.utcDate.toISOString()).toBe("2024-07-01T16:00:30.000Z");
    expect(winter.timezoneOffsetMinutes).toBe(-300);
    expect(winter.utcDate.toISOString()).toBe("2024-01-01T17:00:30.000Z");
  });

  it("falls back to the numeric offset when no time zone can be resolved", () => {
    const result = resolveBirthMoment({
      birth_date: "2000-01-01",
      birth_time: "12:00",
      timezone_offset_minutes: 90,
      latitude: Number.NaN,
      longitude: Number.NaN,
      time_zone_id: "Not/AZone",
    });

    expect(result.source).toBe("numeric_offset");
    expect(result.utcDate.toISOString()).toBe("2000-01-01T10:30:00.000Z");
  });
});
