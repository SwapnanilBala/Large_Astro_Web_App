/**
 * The North Indian diamond, held to the constellation wheel.
 *
 * The wheel draws each planet at its own longitude, so it cannot show a planet
 * in a sign it is not in. The diamond is drawn by houses: it writes a sign
 * number in each one and has to put every planet in the house carrying that
 * planet's sign. It used to take the house from the API, which follows the
 * chosen engine's house system, and under Placidus it drew eight planets in
 * one house while the wheel showed them spread over eight signs.
 *
 * So the wheel is the reference. These run real charts through every engine
 * the chooser offers and check the diamond against the wheel planet by planet:
 * the sign number in the house a planet is drawn in must be the sign wedge the
 * wheel draws it in.
 */
import { describe, expect, it } from "vitest";
import { SIGN_ORDER, lonToAngle, wheelPlacement } from "@/lib/constellation-geometry";
import { ENGINE_PRESETS } from "@/lib/engines/engine-registry";
import { calculate } from "@/lib/engines/swiss-ephemeris-engine";
import { rasiPlacements, signForHouse, signNumber } from "@/lib/north-indian-chart";

/*
 * The wedge the wheel draws a longitude in, read off the drawing itself rather
 * than off wheelPlacement: the wheel puts a planet at lonToAngle(longitude),
 * and draws the wedge for SIGN_ORDER[i] from angle 30i - 90 to 30i - 60.
 */
function wedgeOnWheel(longitude: number): number {
  const angle = lonToAngle(((longitude % 360) + 360) % 360);
  return Math.floor((angle + 90) / 30);
}

/* Spread over both hemispheres, the equator and a high latitude, and round
   the clock, so the ascendant lands in many signs. */
const BIRTHS = [
  { label: "Bengaluru 1990", utc: [1990, 5, 15, 5, 0], latitude: 12.9716, longitude: 77.5946 },
  { label: "London 1985", utc: [1985, 11, 3, 22, 15], latitude: 51.5074, longitude: -0.1278 },
  { label: "Sydney 2001", utc: [2001, 2, 28, 13, 40], latitude: -33.8688, longitude: 151.2093 },
  { label: "Oslo 1972", utc: [1972, 8, 9, 3, 5], latitude: 59.9139, longitude: 10.7522 },
  { label: "New York 2015", utc: [2015, 12, 21, 18, 30], latitude: 40.7128, longitude: -74.006 },
  { label: "Quito 1999", utc: [1999, 7, 1, 0, 0], latitude: -0.1807, longitude: -78.4678 },
] as const;

const ENGINES = Object.keys(ENGINE_PRESETS);

function chartFor(birth: (typeof BIRTHS)[number], engineId: string) {
  const [year, month, day, hour, minute] = birth.utc;
  return calculate({
    utc_year: year,
    utc_month: month,
    utc_day: day,
    utc_hour: hour,
    utc_minute: minute,
    utc_second: 0,
    latitude: birth.latitude,
    longitude: birth.longitude,
    engine_id: engineId,
  });
}

describe("the wheel's placement rule", () => {
  it("is the wedge the wheel draws, for every degree of the zodiac", () => {
    for (let tenth = 0; tenth < 3600; tenth++) {
      const longitude = tenth / 10;
      expect(SIGN_ORDER.indexOf(wheelPlacement(longitude, "Aries").sign), `${longitude}°`).toBe(
        wedgeOnWheel(longitude),
      );
    }
  });

  it("counts houses in whole signs from the ascendant's", () => {
    expect(wheelPlacement(271.54, "Cancer")).toMatchObject({ sign: "Capricorn", house: 7 });
    expect(wheelPlacement(14.33, "Cancer")).toMatchObject({ sign: "Aries", house: 10 });
    expect(wheelPlacement(5, "Pisces")).toMatchObject({ sign: "Aries", house: 2 });
  });

  it("refuses an unknown ascendant", () => {
    expect(() => wheelPlacement(10, "Ophiuchus")).toThrow();
  });
});

describe("the North Indian diamond against the wheel", () => {
  it(`draws every planet in its wheel sign, for ${ENGINES.length} engines and ${BIRTHS.length} births`, () => {
    const misplaced: string[] = [];

    for (const birth of BIRTHS) {
      for (const engineId of ENGINES) {
        const { ascendant, planets } = chartFor(birth, engineId);

        /* House 1 carries the ascendant's sign, as the wheel shows it. */
        const firstHouse = signNumber(signForHouse(ascendant.sign, 1));
        if (firstHouse !== wedgeOnWheel(ascendant.longitude) + 1) {
          misplaced.push(`${birth.label} ${engineId}: ascendant`);
        }

        for (const { planet, house } of rasiPlacements(planets, ascendant.sign)) {
          const drawnIn = signNumber(signForHouse(ascendant.sign, house));
          const onWheel = wedgeOnWheel(planet.longitude) + 1;
          if (drawnIn !== onWheel) {
            misplaced.push(`${birth.label} ${engineId}: ${planet.name} drawn in sign ${drawnIn}, wheel ${onWheel}`);
          }
        }
      }
    }

    expect(misplaced).toEqual([]);
  });

  it("agrees with the engine's own sign for each planet", () => {
    /* The wheel's reading and the API's `sign` field come from the same
       longitude; if they ever split, the positions table and the chart would
       name different signs. */
    for (const birth of BIRTHS) {
      for (const engineId of ENGINES) {
        const { ascendant, planets } = chartFor(birth, engineId);
        for (const { planet, sign } of rasiPlacements(planets, ascendant.sign)) {
          expect(sign, `${birth.label} ${engineId}: ${planet.name}`).toBe(planet.sign);
        }
      }
    }
  });
});
