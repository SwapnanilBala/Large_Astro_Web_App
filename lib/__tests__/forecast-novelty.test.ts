import { describe, expect, it } from "vitest";
import {
  measureAspect,
  rankAspectsByNovelty,
  aspectKey,
  FORECAST_SAMPLE_SPACING_DAYS,
  type RawAspect,
} from "@/lib/engines/forecast-novelty";

const SPACING = FORECAST_SAMPLE_SPACING_DAYS;

function aspect(partial: Partial<RawAspect> = {}): RawAspect {
  return {
    transit_planet: "Moon",
    natal_planet: "Mercury",
    aspect_type: "Square",
    orb: 1,
    ...partial,
  };
}

describe("measureAspect", () => {
  it("reads a closing orb as applying, with a time to exact", () => {
    /* 3.3 deg per quarter-day is the Moon's rate. */
    const m = measureAspect(aspect({ orb: 3.3 }), 6.6, 0, SPACING);
    expect(m.applying).toBe(true);
    expect(m.speedPerDay).toBeCloseTo(13.2, 1);
    expect(m.daysToExact).toBeCloseTo(0.25, 2);
  });

  it("reads an opening orb as separating, with no time to exact", () => {
    const m = measureAspect(aspect({ orb: 3.3 }), 0, 6.6, SPACING);
    expect(m.applying).toBe(false);
    expect(m.daysToExact).toBeNull();
  });

  it("recognises an aspect perfecting right now, where a centred difference reads as still", () => {
    /* Orb is a V through exact, so both neighbours sit above the middle and
       (before - after) / 2 is zero. Without the turn check this would look
       stationary at the one moment it matters most. */
    const m = measureAspect(aspect({ orb: 0.1 }), 3.2, 3.2, SPACING);
    expect(m.applying).toBe(true);
    expect(m.daysToExact).toBe(0);
  });

  it("treats a missing earlier sample as having just entered orb", () => {
    const m = measureAspect(aspect({ orb: 7.6 }), undefined, 4.3, SPACING);
    expect(m.ageInOrbDays).toBe(0);
  });

  it("calls an unreadably slow aspect as old as it gets, and not applying", () => {
    const m = measureAspect(aspect({ transit_planet: "Saturn", orb: 2 }), 2, 2, SPACING);
    expect(m.applying).toBe(false);
    expect(m.ageInOrbDays).toBe(Number.POSITIVE_INFINITY);
  });

  it("scales rates by the sample spacing, not by the raw step", () => {
    const quarterDay = measureAspect(aspect({ orb: 1 }), 2, 0, 0.25);
    const wholeDay = measureAspect(aspect({ orb: 1 }), 2, 0, 1);
    expect(quarterDay.speedPerDay).toBeCloseTo(wholeDay.speedPerDay * 4, 5);
  });

  it("ages a separating aspect beyond an applying one at the same orb", () => {
    const applying = measureAspect(aspect({ orb: 2 }), 2.5, 1.5, SPACING);
    const separating = measureAspect(aspect({ orb: 2 }), 1.5, 2.5, SPACING);
    expect(separating.ageInOrbDays).toBeGreaterThan(applying.ageInOrbDays);
  });
});

describe("rankAspectsByNovelty", () => {
  /* The regression this whole module exists for: a slow planet parked at a
     tight orb used to win on tightness alone and hold the slot for weeks. */
  it("puts a fresh fast aspect ahead of a tighter one that has been parked for months", () => {
    const parkedSaturn = aspect({
      transit_planet: "Saturn",
      natal_planet: "Mars",
      aspect_type: "Conjunction",
      orb: 0.6,
    });
    const freshMoon = aspect({
      transit_planet: "Moon",
      natal_planet: "Mercury",
      aspect_type: "Square",
      orb: 0.9,
    });

    const ranked = rankAspectsByNovelty(
      [parkedSaturn, freshMoon],
      [
        { ...parkedSaturn, orb: 0.6075 }, // 0.03 deg/day
        { ...freshMoon, orb: 4.2 }, // 13.2 deg/day, closing
      ],
      [
        { ...parkedSaturn, orb: 0.5925 },
        { ...freshMoon, orb: 2.4 },
      ],
      SPACING
    );

    expect(ranked[0].transit_planet).toBe("Moon");
    expect(ranked[0].ageInOrbDays).toBeLessThan(ranked[1].ageInOrbDays);
  });

  /* ...but a slow planet still earns its turn in the days around exact, which
     is when it is genuinely news rather than furniture. */
  it("lets a slow planet lead when it is about to be exact", () => {
    const saturnNearExact = aspect({
      transit_planet: "Saturn",
      natal_planet: "Mars",
      aspect_type: "Conjunction",
      orb: 0.02,
    });
    const ordinaryMoon = aspect({
      transit_planet: "Moon",
      natal_planet: "Venus",
      aspect_type: "Trine",
      orb: 5.5,
    });

    const ranked = rankAspectsByNovelty(
      [saturnNearExact, ordinaryMoon],
      [
        { ...saturnNearExact, orb: 0.0275 },
        { ...ordinaryMoon, orb: 8.0 },
      ],
      [
        { ...saturnNearExact, orb: 0.0125 },
        { ...ordinaryMoon, orb: 2.2 },
      ],
      SPACING
    );

    expect(ranked[0].transit_planet).toBe("Saturn");
  });

  it("does not prefer a barely-in-orb aspect over a tight one from the same planet", () => {
    /* Age is (limit - orb) / speed, so "just arrived" and "barely in orb" are
       the same statement. Freshness alone would rank the widest one first. */
    const wide = aspect({ natal_planet: "Sun", orb: 7.8 });
    const tight = aspect({ natal_planet: "Mercury", orb: 0.4 });

    const ranked = rankAspectsByNovelty(
      [wide, tight],
      [
        { ...wide, orb: 11 },
        { ...tight, orb: 3.7 },
      ],
      [
        { ...wide, orb: 4.5 },
        { ...tight, orb: 2.9 },
      ],
      SPACING
    );

    expect(ranked[0].natal_planet).toBe("Mercury");
  });

  it("breaks ties deterministically, so a cached payload matches a fresh one", () => {
    const a = aspect({ transit_planet: "Venus", natal_planet: "Sun", orb: 2 });
    const b = aspect({ transit_planet: "Mars", natal_planet: "Sun", orb: 2 });
    const forwards = rankAspectsByNovelty([a, b], [], [], SPACING);
    const backwards = rankAspectsByNovelty([b, a], [], [], SPACING);
    expect(forwards.map(aspectKey)).toEqual(backwards.map(aspectKey));
  });
});
