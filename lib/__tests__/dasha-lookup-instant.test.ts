// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildChart } from "../engines/chart-service";
import {
  calculateDashaTimeline,
  calculateNakshatra,
  DASHA_YEARS,
  NAKSHATRA_SPAN,
  YEAR_DAYS,
} from "../engines/nakshatra-engine";

/*
 * "Current" is decided at the moment of the request.
 *
 * It used to be decided at midnight UTC of today's date *at the birthplace*,
 * then cached for the day. For a chart born in India, read in New York between
 * 2:30 and 8pm, that could name the next pratyantardasha up to 5.5 hours
 * before it began; and the audit's
 * Timing Check printed birthplace wall time, unlabelled, as the lookup time --
 * 9.5 hours ahead of a reader in New York.
 */

const DAY_MS = 86_400_000;

afterEach(() => {
  vi.useRealTimers();
});

describe("calculateDashaTimeline looked up at an instant", () => {
  /* The fixture in dasha-birth-instant.test.ts: Uttara Ashadha, Sun lord. */
  const nak = calculateNakshatra(270 + 1 + 54 / 60);
  const BIRTH_DATE = "1990-05-15";
  const BIRTH_MS = Date.parse("1990-05-15T09:00:00Z");

  /* Sun's balance at birth, then Moon, Mars and Rahu in full: the instant
     Rahu hands over to Jupiter, straight from the definition. */
  const sunBalanceYears = DASHA_YEARS.Sun * (1 - nak.degree_in_nakshatra / NAKSHATRA_SPAN);
  const rahuEndsMs =
    BIRTH_MS +
    (sunBalanceYears + DASHA_YEARS.Moon + DASHA_YEARS.Mars + DASHA_YEARS.Rahu) *
      YEAR_DAYS *
      DAY_MS;

  it("changes mahadasha at the boundary instant, to the minute", () => {
    const before = calculateDashaTimeline(nak, BIRTH_DATE, rahuEndsMs - 60_000, BIRTH_MS);
    const after = calculateDashaTimeline(nak, BIRTH_DATE, rahuEndsMs + 60_000, BIRTH_MS);
    expect(before.current_dasha?.planet).toBe("Rahu");
    expect(after.current_dasha?.planet).toBe("Jupiter");
  });

  it("treats a non-finite instant as now, not as no time at all", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(rahuEndsMs + DAY_MS);
    const timeline = calculateDashaTimeline(nak, BIRTH_DATE, Number.NaN, BIRTH_MS);
    expect(timeline.current_dasha?.planet).toBe("Jupiter");
  });
});

describe("buildChart's current period", () => {
  /* Mumbai, 14:30 IST: Moon mahadasha, Rahu antardasha, and a Jupiter to
     Saturn pratyantardasha change in late October 2026. */
  const BIRTH = {
    name: "Test Reader",
    birth_date: "1990-04-15",
    birth_time: "14:30",
    timezone_offset_minutes: 330,
    latitude: 19.076,
    longitude: 72.8777,
    country: "India",
    state: "Maharashtra",
    city: "Mumbai",
  };
  const BIRTH_MS = Date.parse("1990-04-15T09:00:00Z");

  const auditOf = (birth: typeof BIRTH) =>
    buildChart(birth).chart.calculation_audit as Record<string, unknown>;

  /* Where the engine itself puts that change, to the second. */
  function jupiterEndsMs(): number {
    const nak = calculateNakshatra(auditOf(BIRTH).moon_sidereal_longitude as number);
    const lordAt = (ms: number) =>
      calculateDashaTimeline(nak, BIRTH.birth_date, ms, BIRTH_MS).current_pratyantar
        ?.pratyantar_lord;

    let lo = Date.parse("2026-10-20T00:00:00Z");
    let hi = Date.parse("2026-11-01T00:00:00Z");
    expect(lordAt(lo)).toBe("Jupiter");
    expect(lordAt(hi)).toBe("Saturn");
    while (hi - lo > 1000) {
      const mid = Math.floor((lo + hi) / 2);
      if (lordAt(mid) === "Jupiter") lo = mid;
      else hi = mid;
    }
    return hi;
  }

  it("changes pratyantardasha at the boundary, not at some midnight", () => {
    const boundary = jupiterEndsMs();
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(boundary - 60_000);
    expect(buildChart(BIRTH).chart.dasha?.current_pratyantar).toBe("Jupiter");

    /* Same date everywhere a minute later, so a date-keyed lookup or cache
       would still say Jupiter here. */
    vi.setSystemTime(boundary + 60_000);
    expect(buildChart(BIRTH).chart.dasha?.current_pratyantar).toBe("Saturn");
  });

  it("reports the instant it looked up, in UTC and at the birthplace", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-09-24T05:07:30Z"));
    const audit = auditOf(BIRTH);
    expect(audit.reference_utc_iso).toBe("2026-09-24T05:07");
    expect(audit.reference_local_iso).toBe("2026-09-24T10:37"); // Asia/Kolkata
  });

  it("gives birthplace time by that zone's rules today, not the offset at birth", () => {
    /* Born in a New York January (EST, -5:00), read in September (EDT, -4:00). */
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-09-24T16:00:00Z"));
    const audit = auditOf({
      ...BIRTH,
      birth_date: "1990-01-15",
      birth_time: "10:00",
      timezone_offset_minutes: -300,
      latitude: 40.7128,
      longitude: -74.006,
      country: "United States",
      state: "New York",
      city: "New York",
    });
    expect(audit.timezone_offset_minutes).toBe(-300);
    expect(audit.reference_local_iso).toBe("2026-09-24T12:00");
  });
});
