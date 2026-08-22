import { describe, expect, it } from "vitest";
import {
  calculateNakshatra,
  calculateDashaTimeline,
} from "../engines/nakshatra-engine";

/*
 * The dasha timeline must be anchored to the birth *instant*, not to midnight
 * of the birth date.
 *
 * The Moon's longitude already depends on the exact time — that is where the
 * dasha balance comes from — so anchoring the resulting timeline to midnight
 * threw away the time on one side of the same calculation. It is negligible for
 * an eighteen-year mahadasha and not negligible for a pratyantardasha the panel
 * prints to the day.
 */

// 1990-05-15 14:30 IST, Kolkata. Moon at Capricorn 1°54'.
const MOON_LONGITUDE = 270 + 1 + 54 / 60;
const BIRTH_DATE = "1990-05-15";
const BIRTH_INSTANT_MS = Date.parse("1990-05-15T09:00:00Z"); // 14:30 IST

describe("dasha timeline anchoring", () => {
  const nak = calculateNakshatra(MOON_LONGITUDE);

  it("reads the expected nakshatra for the fixture", () => {
    expect(nak.name).toBe("Uttara Ashadha");
    expect(nak.lord).toBe("Sun");
    expect(nak.pada).toBe(2);
  });

  it("shifts every boundary by the birth time rather than ignoring it", () => {
    const midnight = calculateDashaTimeline(nak, BIRTH_DATE, "2026-08-22");
    const exact = calculateDashaTimeline(nak, BIRTH_DATE, "2026-08-22", BIRTH_INSTANT_MS);

    /* Same sequence, same lords — only the anchor moves. */
    expect(exact.periods.map((p) => p.planet)).toEqual(
      midnight.periods.map((p) => p.planet),
    );

    /* Nine hours later, so a boundary landing before 15:00 UTC rolls to the
       next calendar day. At least one must differ, or the argument is being
       ignored. */
    const changed = exact.periods.filter(
      (p, i) => p.end_date !== midnight.periods[i].end_date,
    );
    expect(changed.length).toBeGreaterThan(0);
  });

  it("keeps the classical sequence and durations intact", () => {
    const t = calculateDashaTimeline(nak, BIRTH_DATE, "2026-08-22", BIRTH_INSTANT_MS);
    expect(t.periods.slice(0, 4).map((p) => p.planet)).toEqual([
      "Sun", "Moon", "Mars", "Rahu",
    ]);
    /* Sun is partial at birth: 6 years less the elapsed portion of Uttara
       Ashadha. 5.233° of 13.333° elapsed leaves 3.645 years. */
    expect(t.periods[0].is_partial).toBe(true);
    expect(t.periods[0].years).toBeCloseTo(3.64, 1);
    /* The rest run their full classical lengths. */
    expect(t.periods[1].years).toBeCloseTo(10, 1);
    expect(t.periods[2].years).toBeCloseTo(7, 1);
    expect(t.periods[3].years).toBeCloseTo(18, 1);
  });

  it("ignores a non-finite anchor instead of producing NaN dates", () => {
    const t = calculateDashaTimeline(nak, BIRTH_DATE, "2026-08-22", Number.NaN);
    expect(t.periods[0].start_date).toBe("1990-05-15");
  });
});
