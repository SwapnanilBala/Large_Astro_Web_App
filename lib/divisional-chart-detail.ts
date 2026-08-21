import type {
  DivisionalChartInfo,
  PlanetDignity,
} from "@/lib/astro-types";
import {
  CLASSICAL_PLANETS,
  SIGN_RULERS,
  ZODIAC_SIGNS,
  planetDignity,
} from "@/lib/rules/context";
import {
  getImportantDivisionalChartGuide,
  IMPORTANT_DIVISION_NUMBERS,
  type DivisionalChartSensitivity,
} from "@/lib/divisional-chart-guide";

export type KeyDivisionalChartFocus = {
  division: number;
  label: string;
  name: string;
  focus: string;
  focusPlanets: string[];
  focusHouses: number[];
  mappingMethod: string;
};

export type DivisionalDetailPosition = {
  name: string;
  rashiSign: string;
  vargaSign: string;
  /** Zero-based source subdivision index returned by the calculation engine. */
  divisionPart: number;
  wholeSignHouse: number | null;
  signRuler: string | null;
  /** Intentionally null for the Ascendant, Rahu, Ketu, and unknown points. */
  dignity: PlanetDignity | null;
  repeatsD1: boolean;
  /** Other points occupying the same varga sign. */
  conjunctionPeers: string[];
  isFocusPlanet: boolean;
  isFocusHouse: boolean;
};

export type DivisionalDetailHouse = {
  houseNumber: number;
  sign: string;
  signRuler: string;
  occupants: string[];
  isFocusHouse: boolean;
};

export type DivisionalConjunctionGroup = {
  sign: string;
  wholeSignHouse: number | null;
  names: string[];
};

export type DivisionalChartDetail = KeyDivisionalChartFocus & {
  description: string;
  summary: string;
  readWith: string;
  clientQuestion: string;
  sensitivity: DivisionalChartSensitivity;
  sensitivityNote: string;
  ascendantSign: string | null;
  hasValidAscendant: boolean;
  positions: DivisionalDetailPosition[];
  /** Empty when the chart has no valid divisional Ascendant. */
  houses: DivisionalDetailHouse[];
  repeatedNames: string[];
  strongClassicalNames: string[];
  pressuredClassicalNames: string[];
  conjunctionGroups: DivisionalConjunctionGroup[];
};

export type DivisionalBoundaryDistance = {
  distanceDegrees: number;
  distanceArcMinutes: number;
  nearestBoundaryDegree: number;
  lowerBoundaryDegree: number;
  upperBoundaryDegree: number;
  /** One-based segment number within the natal sign. */
  segmentNumber: number;
  isAtBoundary: boolean;
};

const KEY_DIVISIONAL_FOCUS: Record<number, KeyDivisionalChartFocus> = {
  1: {
    division: 1,
    label: "D1",
    name: "Rashi",
    focus: "Natal foundation",
    focusPlanets: ["Ascendant", "Sun", "Moon"],
    focusHouses: [1, 4, 7, 10],
    mappingMethod: "Natal sidereal sign placement without subdivision.",
  },
  2: {
    division: 2,
    label: "D2",
    name: "Hora",
    focus: "Resources and stewardship",
    focusPlanets: ["Jupiter", "Venus", "Mercury"],
    focusHouses: [2, 11],
    mappingMethod:
      "Parashari Hora: odd signs run from Leo to Cancer; even signs run from Cancer to Leo.",
  },
  4: {
    division: 4,
    label: "D4",
    name: "Chaturthamsa",
    focus: "Home, property, and rootedness",
    focusPlanets: ["Moon", "Mars"],
    focusHouses: [4, 11, 12],
    mappingMethod:
      "Chaturthamsa quarters map to the 1st, 4th, 7th, and 10th signs from the natal sign.",
  },
  7: {
    division: 7,
    label: "D7",
    name: "Saptamsa",
    focus: "Children, care, and legacy",
    focusPlanets: ["Jupiter", "Moon"],
    focusHouses: [1, 5, 9],
    mappingMethod:
      "Parashari Saptamsa: odd signs begin from the natal sign; even signs begin from its seventh.",
  },
  9: {
    division: 9,
    label: "D9",
    name: "Navamsa",
    focus: "Partnership and inner maturity",
    focusPlanets: ["Venus", "Jupiter"],
    focusHouses: [1, 7, 9],
    mappingMethod:
      "Parashari Navamsa: movable signs begin from themselves, fixed signs from the ninth, and dual signs from the fifth.",
  },
  10: {
    division: 10,
    label: "D10",
    name: "Dashamsa",
    focus: "Career and public contribution",
    focusPlanets: ["Sun", "Saturn", "Mercury"],
    focusHouses: [6, 10, 11],
    mappingMethod:
      "Parashari Dashamsa: odd signs begin from the natal sign; even signs begin from its ninth.",
  },
  12: {
    division: 12,
    label: "D12",
    name: "Dwadashamsa",
    focus: "Parents and inherited patterns",
    focusPlanets: ["Sun", "Moon"],
    focusHouses: [4, 9],
    mappingMethod:
      "Dwadashamsa portions proceed zodiacally from the natal sign.",
  },
  24: {
    division: 24,
    label: "D24",
    name: "Chaturvimshamsa",
    focus: "Learning and mastery",
    focusPlanets: ["Mercury", "Jupiter"],
    focusHouses: [4, 5, 9],
    mappingMethod:
      "Chaturvimshamsa portions begin from Leo in odd signs and Cancer in even signs.",
  },
  30: {
    division: 30,
    label: "D30",
    name: "Trimshamsa",
    focus: "Pressure and resilience",
    focusPlanets: ["Saturn", "Mars"],
    focusHouses: [6, 8, 12],
    mappingMethod:
      "Parashari Trimshamsa uses five unequal planetary portions whose boundaries differ in odd and even signs.",
  },
  60: {
    division: 60,
    label: "D60",
    name: "Shashtiamsa",
    focus: "Fine-grained patterning",
    focusPlanets: ["Ascendant", "Sun", "Moon"],
    focusHouses: [1, 5, 9],
    mappingMethod:
      "Shashtiamsa divides each natal sign into sixty half-degree portions whose signs cycle zodiacally from Aries.",
  },
};

const CLASSICAL_PLANET_SET = new Set<string>(CLASSICAL_PLANETS);
const KEY_DIVISION_SET = new Set<number>(IMPORTANT_DIVISION_NUMBERS);
const BOUNDARY_EPSILON = 1e-9;

function isZodiacSign(sign: string): boolean {
  return ZODIAC_SIGNS.includes(sign);
}

function wholeSignHouse(
  ascendantSign: string | null,
  targetSign: string,
): number | null {
  if (!ascendantSign || !isZodiacSign(targetSign)) return null;
  const ascendantIndex = ZODIAC_SIGNS.indexOf(ascendantSign);
  const targetIndex = ZODIAC_SIGNS.indexOf(targetSign);
  return ((targetIndex - ascendantIndex + 12) % 12) + 1;
}

export function getKeyDivisionalChartFocus(
  division: number,
): KeyDivisionalChartFocus | null {
  return KEY_DIVISIONAL_FOCUS[division] ?? null;
}

export function buildDivisionalChartDetail(
  chart: DivisionalChartInfo,
): DivisionalChartDetail | null {
  const focus = getKeyDivisionalChartFocus(chart.division);
  const guide = getImportantDivisionalChartGuide(chart.division);
  if (!focus || !guide) return null;

  const ascendantPosition = chart.positions.find(
    (position) =>
      position.name === "Ascendant" && isZodiacSign(position.divisional_sign),
  );
  const ascendantSign = ascendantPosition?.divisional_sign ?? null;

  const occupantsBySign = new Map<string, string[]>();
  for (const position of chart.positions) {
    if (!isZodiacSign(position.divisional_sign)) continue;
    const occupants = occupantsBySign.get(position.divisional_sign) ?? [];
    occupants.push(position.name);
    occupantsBySign.set(position.divisional_sign, occupants);
  }

  const positions: DivisionalDetailPosition[] = chart.positions.map(
    (position) => {
      const validRashiSign = isZodiacSign(position.rashi_sign);
      const validVargaSign = isZodiacSign(position.divisional_sign);
      const house = validVargaSign
        ? wholeSignHouse(ascendantSign, position.divisional_sign)
        : null;
      const isClassicalPlanet = CLASSICAL_PLANET_SET.has(position.name);
      const dignity =
        isClassicalPlanet && validVargaSign
          ? planetDignity(position.name, position.divisional_sign)
          : null;

      return {
        name: position.name,
        rashiSign: position.rashi_sign,
        vargaSign: position.divisional_sign,
        divisionPart: position.division_number,
        wholeSignHouse: house,
        signRuler: validVargaSign
          ? (SIGN_RULERS[position.divisional_sign] ?? null)
          : null,
        dignity,
        repeatsD1:
          validRashiSign &&
          validVargaSign &&
          position.rashi_sign === position.divisional_sign,
        conjunctionPeers: validVargaSign
          ? (occupantsBySign.get(position.divisional_sign) ?? []).filter(
              (name) => name !== position.name,
            )
          : [],
        isFocusPlanet: focus.focusPlanets.includes(position.name),
        isFocusHouse: house !== null && focus.focusHouses.includes(house),
      };
    },
  );

  const houses: DivisionalDetailHouse[] = ascendantSign
    ? ZODIAC_SIGNS.map((_, index) => {
        const houseNumber = index + 1;
        const sign = ZODIAC_SIGNS[
          (ZODIAC_SIGNS.indexOf(ascendantSign) + index) % 12
        ];
        return {
          houseNumber,
          sign,
          signRuler: SIGN_RULERS[sign],
          occupants: [...(occupantsBySign.get(sign) ?? [])],
          isFocusHouse: focus.focusHouses.includes(houseNumber),
        };
      })
    : [];

  const conjunctionGroups: DivisionalConjunctionGroup[] = Array.from(
    occupantsBySign.entries(),
  )
    .filter(([, names]) => names.length > 1)
    .map(([sign, names]) => ({
      sign,
      wholeSignHouse: wholeSignHouse(ascendantSign, sign),
      names: [...names],
    }));

  return {
    ...focus,
    description: chart.description,
    summary: guide.summary,
    readWith: guide.readWith,
    clientQuestion: guide.clientQuestion,
    sensitivity: guide.sensitivity,
    sensitivityNote: guide.sensitivityNote,
    ascendantSign,
    hasValidAscendant: ascendantSign !== null,
    positions,
    houses,
    repeatedNames: positions
      .filter((position) => position.repeatsD1)
      .map((position) => position.name),
    strongClassicalNames: positions
      .filter(
        (position) =>
          position.dignity === "exalted" ||
          position.dignity === "own_sign",
      )
      .map((position) => position.name),
    pressuredClassicalNames: positions
      .filter((position) => position.dignity === "debilitated")
      .map((position) => position.name),
    conjunctionGroups,
  };
}

function equalBoundaries(division: number): number[] {
  const span = 30 / division;
  return Array.from({ length: division + 1 }, (_, index) => index * span);
}

function boundariesFor(
  division: number,
  rashiSign: string,
): number[] | null {
  if (!KEY_DIVISION_SET.has(division) || !isZodiacSign(rashiSign)) return null;
  if (division !== 30) return equalBoundaries(division);

  const signIndex = ZODIAC_SIGNS.indexOf(rashiSign);
  const isOddSign = signIndex % 2 === 0;
  return isOddSign
    ? [0, 5, 10, 18, 25, 30]
    : [0, 5, 12, 20, 25, 30];
}

export function distanceToDivisionalBoundary(
  division: number,
  rashiSign: string,
  degreeInSign: number,
): DivisionalBoundaryDistance | null {
  const boundaries = boundariesFor(division, rashiSign);
  if (
    !boundaries ||
    !Number.isFinite(degreeInSign) ||
    degreeInSign < 0 ||
    degreeInSign >= 30
  ) {
    return null;
  }

  let segmentIndex = boundaries.length - 2;
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    if (
      degreeInSign >= boundaries[index] &&
      degreeInSign < boundaries[index + 1]
    ) {
      segmentIndex = index;
      break;
    }
  }

  const lowerBoundaryDegree = boundaries[segmentIndex];
  const upperBoundaryDegree = boundaries[segmentIndex + 1];
  const distanceToLower = degreeInSign - lowerBoundaryDegree;
  const distanceToUpper = upperBoundaryDegree - degreeInSign;
  const nearestBoundaryDegree =
    distanceToLower <= distanceToUpper
      ? lowerBoundaryDegree
      : upperBoundaryDegree;
  const distanceDegrees = Math.min(distanceToLower, distanceToUpper);

  return {
    distanceDegrees,
    distanceArcMinutes: distanceDegrees * 60,
    nearestBoundaryDegree,
    lowerBoundaryDegree,
    upperBoundaryDegree,
    segmentNumber: segmentIndex + 1,
    isAtBoundary: distanceDegrees <= BOUNDARY_EPSILON,
  };
}
