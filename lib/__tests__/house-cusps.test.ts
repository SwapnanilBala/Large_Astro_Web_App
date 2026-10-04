import { describe, expect, it } from "vitest";

import { ENGINE_PRESETS } from "../engines/engine-registry";
import {
  birthSky,
  calculate,
  computeHouseCusps,
  SIGNS,
  type BirthInput,
  type HouseSky,
  type HouseSystemCode,
} from "../engines/swiss-ephemeris-engine";

/*
 * House cusps, held to Swiss Ephemeris and to the geometry every system shares.
 *
 * Reference values are Swiss Ephemeris 2.10.03, through the pyswisseph that
 * `npm run pyjhora:setup` installs:
 *
 *   - swe.houses_armc(armc, lat, eps, hsys) for computeHouseCusps. Same three
 *     inputs, so the cusps agree to well under a millionth of a degree.
 *   - swe.houses_ex(jd, lat, lon, hsys, swe.FLG_SIDEREAL) for whole charts.
 *     There Swiss Ephemeris uses apparent sidereal time where this engine uses
 *     mean (about 0.003 deg of RAMC in 1990), and its own ayanamsha tables
 *     (KP differs by about 0.013 deg), so whole charts are held to 0.02 deg,
 *     the tolerance the ascendant regressions in swiss-ephemeris-engine.test.ts
 *     already use.
 *
 * Before these cusps were fixed, Placidus and Koch came out of zodiac order
 * with spans adding to 1080 degrees, Campanus to 3600, and Regiomontanus put
 * cusp 1 sixty degrees from the ascendant.
 */

const QUADRANT: HouseSystemCode[] = ["placidus", "koch", "campanus", "regiomontanus"];
const ALL_SYSTEMS: HouseSystemCode[] = ["whole_sign", "equal", ...QUADRANT];

const norm = (degrees: number) => ((degrees % 360) + 360) % 360;
/** The smaller angle between two longitudes. */
const separation = (a: number, b: number) => Math.abs(norm(a - b + 180) - 180);
const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

/* The angles from their textbook formulas (Meeus, ch. 14), written out here
   rather than imported so the tests do not grade the engine with its own
   arithmetic. */
function textbookAscendant({ ramc, obliquity, latitude }: HouseSky): number {
  const y = -Math.cos(rad(ramc));
  const x = Math.sin(rad(ramc)) * Math.cos(rad(obliquity)) + Math.tan(rad(latitude)) * Math.sin(rad(obliquity));
  return norm(deg(Math.atan2(y, x)) + 180);
}

function textbookMidheaven({ ramc, obliquity }: HouseSky): number {
  return norm(deg(Math.atan2(Math.sin(rad(ramc)), Math.cos(rad(ramc)) * Math.cos(rad(obliquity)))));
}

/**
 * Twelve cusps that go once round the zodiac: every house a positive arc, the
 * arcs adding to 360, and each cusp opposite the one six houses on.
 * `oppositeTolerance` allows for cusps rounded to four places.
 */
function expectOneTurnInOrder(cusps: number[], label: string, oppositeTolerance = 1e-9) {
  expect(cusps, label).toHaveLength(12);
  const arcs = cusps.map((cusp, index) => norm(cusps[(index + 1) % 12] - cusp));
  for (const arc of arcs) expect(arc, label).toBeGreaterThan(0);
  expect(Math.abs(arcs.reduce((sum, arc) => sum + arc, 0) - 360), label).toBeLessThan(1e-9);
  for (let house = 0; house < 6; house++) {
    expect(Math.abs(norm(cusps[house + 6] - cusps[house]) - 180), `${label} cusps ${house + 1}/${house + 7}`).toBeLessThan(
      oppositeTolerance
    );
  }
}

describe("computeHouseCusps against Swiss Ephemeris", () => {
  // swe.houses_armc(armc, lat, eps, hsys), cusps 1 to 12.
  const references: Array<{ label: string; sky: HouseSky; cusps: Record<string, number[]> }> = [
    {
      label: "London, 51.5 N",
      sky: { ramc: 123.4, latitude: 51.5074, obliquity: 23.4393 },
      cusps: {
        placidus: [203.497583, 230.02322, 263.106766, 301.172592, 335.624658, 2.717765, 23.497583, 50.02322, 83.106766, 121.172592, 155.624658, 182.717765],
        koch: [203.497583, 230.8096, 259.965344, 301.172592, 328.635116, 356.032631, 23.497583, 50.8096, 79.965344, 121.172592, 148.635116, 176.032631],
        campanus: [203.497583, 238.949053, 272.775273, 301.172592, 326.4342, 352.64447, 23.497583, 58.949053, 92.775273, 121.172592, 146.4342, 172.64447],
        regiomontanus: [203.497583, 226.652701, 258.908611, 301.172592, 337.301362, 2.517175, 23.497583, 46.652701, 78.908611, 121.172592, 157.301362, 182.517175],
      },
    },
    {
      label: "Cape Town, 33.9 S",
      sky: { ramc: 301.25, latitude: -33.9249, obliquity: 23.4393 },
      cusps: {
        placidus: [26.251201, 54.708416, 85.976145, 119.106512, 151.713164, 181.140657, 206.251201, 234.708416, 265.976145, 299.106512, 331.713164, 1.140657],
        koch: [26.251201, 55.007039, 84.505653, 119.106512, 147.826871, 176.994331, 206.251201, 235.007039, 264.505653, 299.106512, 327.826871, 356.994331],
        campanus: [26.251201, 57.088877, 88.547857, 119.106512, 148.249908, 176.851864, 206.251201, 237.088877, 268.547857, 299.106512, 328.249908, 356.851864],
        regiomontanus: [26.251201, 52.489131, 83.508494, 119.106512, 152.855924, 181.087718, 206.251201, 232.489131, 263.508494, 299.106512, 332.855924, 1.087718],
      },
    },
    {
      label: "60 N",
      sky: { ramc: 15, latitude: 60, obliquity: 23.44 },
      cusps: {
        placidus: [133.804971, 147.607756, 166.951078, 196.280444, 240.389521, 284.589278, 313.804971, 327.607756, 346.951078, 16.280444, 60.389521, 104.589278],
        koch: [133.804971, 154.433817, 175.314569, 196.280444, 266.372568, 292.604601, 313.804971, 334.433817, 355.314569, 16.280444, 86.372568, 112.604601],
        campanus: [133.804971, 161.11278, 179.005832, 196.280444, 220.987752, 265.620605, 313.804971, 341.11278, 359.005832, 16.280444, 40.987752, 85.620605],
        regiomontanus: [133.804971, 150.413912, 168.123725, 196.280444, 246.718385, 290.399875, 313.804971, 330.413912, 348.123725, 16.280444, 66.718385, 110.399875],
      },
    },
    {
      label: "60 S",
      sky: { ramc: 200, latitude: -60, obliquity: 23.44 },
      cusps: {
        placidus: [316.86035, 331.159865, 351.290776, 21.638608, 66.059275, 108.40767, 136.86035, 151.159865, 171.290776, 201.638608, 246.059275, 288.40767],
        koch: [316.86035, 338.265131, 359.951394, 21.638608, 88.840238, 115.079475, 136.86035, 158.265131, 179.951394, 201.638608, 268.840238, 295.079475],
        campanus: [316.86035, 344.751044, 3.515752, 21.638608, 46.961609, 90.311866, 136.86035, 164.751044, 183.515752, 201.638608, 226.961609, 270.311866],
        regiomontanus: [316.86035, 333.681249, 352.078867, 21.638608, 72.24761, 113.946561, 136.86035, 153.681249, 172.078867, 201.638608, 252.24761, 293.946561],
      },
    },
    {
      // A quarter of a degree short of the polar circle, where the upper
      // quadrant has shrunk to 11 degrees: the hardest case Placidus still has.
      label: "66.3 N",
      sky: { ramc: 250, latitude: 66.3, obliquity: 23.44 },
      cusps: {
        placidus: [262.662553, 31.361272, 61.529107, 71.534064, 76.775784, 80.163528, 82.662553, 211.361272, 241.529107, 251.534064, 256.775784, 260.163528],
        koch: [262.662553, 267.084437, 274.334349, 71.534064, 75.125577, 78.797326, 82.662553, 87.084437, 94.334349, 251.534064, 255.125577, 258.797326],
        campanus: [262.662553, 68.022628, 70.563975, 71.534064, 72.361692, 73.698097, 82.662553, 248.022628, 250.563975, 251.534064, 252.361692, 253.698097],
        regiomontanus: [262.662553, 55.631954, 68.767959, 71.534064, 73.389764, 75.71572, 82.662553, 235.631954, 248.767959, 251.534064, 253.389764, 255.71572],
      },
    },
  ];

  for (const { label, sky, cusps } of references) {
    for (const system of QUADRANT) {
      it(`${system} at ${label}`, () => {
        const result = computeHouseCusps(system, sky);
        expect(result.system).toBe(system);
        result.cusps.forEach((cusp, index) => {
          expect(separation(cusp, cusps[system][index]), `cusp ${index + 1}`).toBeLessThan(1e-5);
        });
      });
    }
  }

  it("stands Placidus and Koch in for Porphyry inside the polar circles, as Swiss Ephemeris does", () => {
    // swe.houses_armc(armc, lat, eps, b"O"). Swiss Ephemeris itself refuses
    // Placidus and Koch here and falls back to these same Porphyry cusps.
    const polar: Array<{ sky: HouseSky; porphyry: number[] }> = [
      {
        sky: { ramc: 45, latitude: 70, obliquity: 23.44 },
        porphyry: [157.903156, 181.090214, 204.277272, 227.46433, 264.277272, 301.090214, 337.903156, 1.090214, 24.277272, 47.46433, 84.277272, 121.090214],
      },
      {
        sky: { ramc: 160, latitude: -69.65, obliquity: 23.44 },
        porphyry: [308.916717, 318.731609, 328.546500, 338.361392, 28.5465, 78.731609, 128.916717, 138.731609, 148.5465, 158.361392, 208.5465, 258.731609],
      },
    ];
    for (const { sky, porphyry } of polar) {
      for (const system of ["placidus", "koch"] as const) {
        const result = computeHouseCusps(system, sky);
        expect(result.system, `${system} at ${sky.latitude}`).toBe("porphyry");
        result.cusps.forEach((cusp, index) => {
          expect(separation(cusp, porphyry[index]), `${system} at ${sky.latitude}, cusp ${index + 1}`).toBeLessThan(1e-5);
        });
      }
    }
  });
});

describe("computeHouseCusps geometry", () => {
  const OBLIQUITY = 23.44;
  const skies: HouseSky[] = [];
  for (let latitude = -66; latitude <= 66; latitude += 6) {
    for (let ramc = 0; ramc < 360; ramc += 10) skies.push({ ramc, latitude, obliquity: OBLIQUITY });
  }

  it("keeps every system's cusps in zodiac order outside the polar circles", () => {
    for (const sky of skies) {
      for (const system of ALL_SYSTEMS) {
        const label = `${system} at ${sky.latitude}, RAMC ${sky.ramc}`;
        const result = computeHouseCusps(system, sky);
        expect(result.system, label).toBe(system);
        expectOneTurnInOrder(result.cusps, label);
      }
    }
  });

  it("starts at the ascendant and, for the quadrant systems, puts the MC on cusp 10", () => {
    for (const sky of skies) {
      const ascendant = textbookAscendant(sky);
      const midheaven = textbookMidheaven(sky);
      for (const system of ALL_SYSTEMS) {
        const label = `${system} at ${sky.latitude}, RAMC ${sky.ramc}`;
        const { cusps } = computeHouseCusps(system, sky);
        if (system === "whole_sign") {
          expect(cusps[0], label).toBe(Math.floor(ascendant / 30) * 30);
          continue;
        }
        expect(separation(cusps[0], ascendant), label).toBeLessThan(1e-9);
        if (QUADRANT.includes(system)) expect(separation(cusps[9], midheaven), label).toBeLessThan(1e-9);
      }
    }
  });

  it("subtracts the ayanamsha from every cusp alike", () => {
    // Sidereal cusps are the tropical ones relabelled: the same houses, the
    // same sizes, each moved back by the ayanamsha. RAMC never takes it.
    const ayanamsa = 23.7225;
    for (const sky of skies) {
      for (const system of QUADRANT) {
        const tropical = computeHouseCusps(system, sky).cusps;
        const sidereal = computeHouseCusps(system, sky, ayanamsa).cusps;
        sidereal.forEach((cusp, index) => {
          expect(separation(cusp, tropical[index] - ayanamsa), `${system} at ${sky.latitude}, RAMC ${sky.ramc}`).toBeLessThan(1e-9);
        });
      }
    }
  });
});

describe("computeHouseCusps inside the polar circles", () => {
  // Placidus and Koch are undefined at or past 90 - obliquity, about 66.56
  // degrees; see "House systems" in swiss-ephemeris-engine.ts.
  const OBLIQUITY = 23.44;
  const skies: HouseSky[] = [];
  for (const latitude of [66.6, 67, 69.65, 72, 78.2, 85, -66.6, -67, -69.65, -72, -77.8, -85]) {
    for (let ramc = 0; ramc < 360; ramc += 5) skies.push({ ramc, latitude, obliquity: OBLIQUITY });
  }

  it("still gives twelve cusps in order from the ascendant, whatever the system", () => {
    for (const sky of skies) {
      const ascendant = textbookAscendant(sky);
      for (const system of ALL_SYSTEMS) {
        const label = `${system} at ${sky.latitude}, RAMC ${sky.ramc}`;
        const { cusps } = computeHouseCusps(system, sky);
        expectOneTurnInOrder(cusps, label);
        if (system === "whole_sign") expect(cusps[0], label).toBe(Math.floor(ascendant / 30) * 30);
        else expect(separation(cusps[0], ascendant), label).toBeLessThan(1e-9);
      }
    }
  });

  it("uses Porphyry for Placidus and Koch while the MC is above the horizon, Equal once it sets", () => {
    let porphyry = 0;
    let equal = 0;
    for (const sky of skies) {
      // The MC is above the horizon exactly when the ascendant is less than
      // half a circle ahead of it in the zodiac.
      const mcAboveHorizon = norm(textbookAscendant(sky) - textbookMidheaven(sky)) < 180;
      for (const system of ["placidus", "koch"] as const) {
        const result = computeHouseCusps(system, sky);
        const label = `${system} at ${sky.latitude}, RAMC ${sky.ramc}`;
        expect(result.system, label).toBe(mcAboveHorizon ? "porphyry" : "equal");
        if (mcAboveHorizon) {
          expect(separation(result.cusps[9], textbookMidheaven(sky)), label).toBeLessThan(1e-9);
          porphyry++;
        } else {
          equal++;
        }
      }
    }
    // Both branches are exercised, not just one.
    expect(porphyry).toBeGreaterThan(0);
    expect(equal).toBeGreaterThan(0);
  });

  it("keeps Campanus and Regiomontanus unless the MC has set", () => {
    for (const sky of skies) {
      const mcAboveHorizon = norm(textbookAscendant(sky) - textbookMidheaven(sky)) < 180;
      for (const system of ["campanus", "regiomontanus"] as const) {
        expect(computeHouseCusps(system, sky).system, `${system} at ${sky.latitude}, RAMC ${sky.ramc}`).toBe(
          mcAboveHorizon ? system : "equal"
        );
      }
    }
  });
});

describe("calculate() house cusps for every engine", () => {
  const moments = [
    { utc_year: 1947, utc_month: 8, utc_day: 15, utc_hour: 0, utc_minute: 5, utc_second: 0 },
    { utc_year: 1969, utc_month: 7, utc_day: 20, utc_hour: 20, utc_minute: 17, utc_second: 40 },
    { utc_year: 1990, utc_month: 5, utc_day: 15, utc_hour: 5, utc_minute: 0, utc_second: 0 },
    { utc_year: 2001, utc_month: 12, utc_day: 21, utc_hour: 11, utc_minute: 30, utc_second: 0 },
    { utc_year: 2024, utc_month: 3, utc_day: 20, utc_hour: 16, utc_minute: 45, utc_second: 0 },
  ];
  const longitudes = [-122.42, -43.2, 0, 77.59, 151.21];
  const latitudes = [-60, -45, -30, -15, 0, 15, 30, 45, 60];

  const births: BirthInput[] = [];
  moments.forEach((moment, index) => {
    for (const latitude of latitudes) {
      births.push({ ...moment, latitude, longitude: longitudes[index] });
    }
  });

  for (const preset of Object.values(ENGINE_PRESETS)) {
    it(`${preset.engine_id}: cusps in order from the ascendant, and planets in the houses the cusps make`, () => {
      const system = preset.house_system_code as HouseSystemCode;
      for (const birth of births) {
        const input = { ...birth, engine_id: preset.engine_id };
        const label = `${preset.engine_id} ${birth.utc_year} at ${birth.latitude}`;
        const result = calculate(input);
        const cusps = result.house_cusps;

        expect(result.house_system, label).toBe(system);
        expectOneTurnInOrder(cusps, label, 2e-4);

        // Cusp 1 is the ascendant the chart reports, to the last digit.
        if (system === "whole_sign") {
          expect(cusps[0], label).toBe(SIGNS.indexOf(result.ascendant.sign) * 30);
        } else {
          expect(cusps[0], label).toBe(result.ascendant.longitude);
        }

        // Cusp 10 is the MC, in the same ayanamsha as the ascendant.
        if (QUADRANT.includes(system)) {
          const sky = birthSky(input);
          const ayanamsa = textbookAscendant(sky) - result.ascendant.longitude;
          expect(separation(cusps[9], textbookMidheaven(sky) - ayanamsa), label).toBeLessThan(1e-3);
        }

        // Each planet sits between its house's cusp and the next. Longitudes
        // and cusps are both rounded to four places, so a planet within a
        // thousandth of a degree of a cusp may read either side of it.
        for (const planet of result.planets) {
          const start = cusps[planet.house - 1];
          const arc = norm(cusps[planet.house % 12] - start);
          const into = norm(planet.longitude - start);
          const inside = into < arc || separation(planet.longitude, start) < 1e-3 || separation(planet.longitude, start + arc) < 1e-3;
          expect(inside, `${label}: ${planet.name} at ${planet.longitude} in house ${planet.house}`).toBe(true);
        }

        // The houses array agrees with the planets and names each cusp's sign.
        result.houses.forEach((house, index) => {
          expect(house.planets.sort(), label).toEqual(
            result.planets.filter((planet) => planet.house === index + 1).map((planet) => planet.name).sort()
          );
          expect(house.sign, label).toBe(SIGNS[Math.floor(norm(cusps[index]) / 30)]);
        });
      }
    });
  }
});

describe("calculate() against Swiss Ephemeris for a whole chart", () => {
  // 1990-05-15 05:00 UTC, Bengaluru. Before the fix, Placidus and KP put eight
  // of these nine planets in house 3, and Koch put eight in house 4.
  const birth: BirthInput = {
    utc_year: 1990,
    utc_month: 5,
    utc_day: 15,
    utc_hour: 5,
    utc_minute: 0,
    utc_second: 0,
    latitude: 12.9716,
    longitude: 77.5946,
  };

  // swe.houses_ex(2448026.708333, 12.9716, 77.5946, hsys, swe.FLG_SIDEREAL).
  const sidereal: Record<string, number[]> = {
    lahiri_placidus: [94.3894, 121.3169, 151.2796, 183.4941, 215.3551, 245.4341, 274.3894, 301.3169, 331.2796, 3.4941, 35.3551, 65.4341],
    lahiri_koch: [94.3894, 123.078, 153.1946, 183.4941, 216.9488, 246.4405, 274.3894, 303.078, 333.1946, 3.4941, 36.9488, 66.4405],
    lahiri_campanus: [94.3894, 122.5168, 152.0156, 183.4941, 215.4678, 245.8589, 274.3894, 302.5168, 332.0156, 3.4941, 35.4678, 65.8589],
    lahiri_regiomontanus: [94.3894, 121.9105, 151.3586, 183.4941, 216.1435, 246.4811, 274.3894, 301.9105, 331.3586, 3.4941, 36.1435, 66.4811],
    krishnamurti_placidus: [94.4863, 121.4138, 151.3764, 183.591, 215.4519, 245.531, 274.4863, 301.4138, 331.3764, 3.591, 35.4519, 65.531],
  };

  for (const [engine_id, expected] of Object.entries(sidereal)) {
    it(`${engine_id} matches to 0.02 degrees and spreads the planets across the chart`, () => {
      const result = calculate({ ...birth, engine_id });
      result.house_cusps.forEach((cusp, index) => {
        expect(separation(cusp, expected[index]), `cusp ${index + 1}`).toBeLessThan(0.02);
      });
      const houses = Object.fromEntries(result.planets.map((planet) => [planet.name, planet.house]));
      expect(houses).toEqual({
        Sun: 10,
        Moon: 6,
        Mercury: 10,
        Venus: 9,
        Mars: 8,
        Jupiter: 12,
        Saturn: 6,
        Rahu: 7,
        Ketu: 1,
      });
    });
  }
});

describe("calculate() inside the polar circles", () => {
  it("reports the stand-in system and keeps the cusps whole", () => {
    // Tromso, 69.65 N, through a day: some hours Porphyry, some Equal.
    const seen = new Set<string>();
    for (let hour = 0; hour < 24; hour++) {
      const input: BirthInput = {
        utc_year: 1990,
        utc_month: 12,
        utc_day: 21,
        utc_hour: hour,
        utc_minute: 0,
        utc_second: 0,
        latitude: 69.6492,
        longitude: 18.9553,
        engine_id: "krishnamurti_placidus",
      };
      const result = calculate(input);
      seen.add(result.house_system);
      expect(["porphyry", "equal"]).toContain(result.house_system);
      expectOneTurnInOrder(result.house_cusps, `hour ${hour}`, 2e-4);
      expect(result.house_cusps[0]).toBe(result.ascendant.longitude);
    }
    expect([...seen].sort()).toEqual(["equal", "porphyry"]);
  });
});
