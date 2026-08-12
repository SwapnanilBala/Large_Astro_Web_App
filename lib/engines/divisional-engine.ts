
import type { PlanetPosition } from "./swiss-ephemeris-engine";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface DivisionalPosition {
  name: string;
  rashi_sign: string;
  divisional_sign: string;
  division_number: number;
}

export interface DivisionalChartResult {
  division: number;
  label: string;
  description: string;
  positions: DivisionalPosition[];
}

export interface DivisionInfo {
  division: number;
  name: string;
  label: string;
  description: string;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const SIGN_INDEX: Record<string, number> = {};
SIGNS.forEach((s, i) => { SIGN_INDEX[s] = i; });

/** Element of each sign: 0=Fire, 1=Earth, 2=Air, 3=Water */
function signElement(sign: string): number {
  const idx = SIGN_INDEX[sign] ?? 0;
  return idx % 4; // Aries=0(Fire), Taurus=1(Earth), Gemini=2(Air), Cancer=3(Water)
}

/** Whether a sign is odd (1-indexed: Aries=1=odd, Taurus=2=even, etc.) */
function isOddSign(sign: string): boolean {
  const idx = SIGN_INDEX[sign] ?? 0;
  return idx % 2 === 0; // 0-indexed: 0=odd(Aries), 1=even(Taurus), etc.
}

/** Modality of each sign: 0=Movable, 1=Fixed, 2=Dual. */
function signModality(sign: string): number {
  const idx = SIGN_INDEX[sign] ?? 0;
  return idx % 3;
}

// --------------------------------------------------------------------------
// Available divisions
// --------------------------------------------------------------------------

export const AVAILABLE_DIVISIONS: DivisionInfo[] = [
  { division: 1,  name: "Rashi",          label: "D1",  description: "Overall life, identity, and the natal foundation" },
  { division: 2,  name: "Hora",           label: "D2",  description: "Wealth and financial capacity" },
  { division: 3,  name: "Drekkana",       label: "D3",  description: "Siblings, courage, and initiative" },
  { division: 4,  name: "Chaturthamsa",   label: "D4",  description: "Property, fortune, and fixed assets" },
  { division: 5,  name: "Panchamsa",      label: "D5",  description: "Authority, influence, and recognition" },
  { division: 6,  name: "Shashtamsa",     label: "D6",  description: "Health patterns, routines, and everyday obstacles" },
  { division: 7,  name: "Saptamsa",       label: "D7",  description: "Children and progeny" },
  { division: 8,  name: "Ashtamsa",       label: "D8",  description: "Sudden change, transformation, and vulnerabilities" },
  { division: 9,  name: "Navamsa",        label: "D9",  description: "Marriage, dharma, and inner nature" },
  { division: 10, name: "Dasamsa",        label: "D10", description: "Career, profession, and public life" },
  { division: 11, name: "Rudramsa",       label: "D11", description: "Gains, networks, and the fulfillment of ambitions" },
  { division: 12, name: "Dwadasamsa",     label: "D12", description: "Parents and ancestral lineage" },
  { division: 16, name: "Shodasamsa",     label: "D16", description: "Vehicles, comforts, and happiness" },
  { division: 20, name: "Vimsamsa",       label: "D20", description: "Spiritual progress and worship" },
  { division: 24, name: "Chaturvimsamsa",  label: "D24", description: "Education, learning, and knowledge" },
  { division: 27, name: "Nakshatramsa",   label: "D27", description: "Strengths and weaknesses" },
  { division: 30, name: "Trimsamsa",      label: "D30", description: "Misfortune, disease, and evils" },
  { division: 40, name: "Khavedamsa",     label: "D40", description: "Auspicious and inauspicious effects" },
  { division: 45, name: "Akshavedamsa",   label: "D45", description: "General indications and character" },
  { division: 60, name: "Shashtiamsa",    label: "D60", description: "Past life karma and all general matters" },
];

// --------------------------------------------------------------------------
// Individual division calculators
// --------------------------------------------------------------------------

function computeD1(sign: string): string {
  return sign;
}

function computeD2(sign: string, degreeInSign: number): string {
  const odd = isOddSign(sign);
  if (degreeInSign < 15) {
    return odd ? "Leo" : "Cancer";
  }
  return odd ? "Cancer" : "Leo";
}

function computeD3(sign: string, degreeInSign: number): string {
  const signIdx = SIGN_INDEX[sign] ?? 0;
  const division = Math.min(Math.floor(degreeInSign / 10), 2);
  // 1st decanate: same sign, 2nd: 5th from it (+4), 3rd: 9th from it (+8)
  const offsets = [0, 4, 8];
  return SIGNS[(signIdx + offsets[division]) % 12];
}

function computeD4(sign: string, degreeInSign: number): string {
  const signIdx = SIGN_INDEX[sign] ?? 0;
  const division = Math.min(Math.floor(degreeInSign / 7.5), 3);
  // The four quarters map to the 1st, 4th, 7th, and 10th from the natal sign.
  return SIGNS[(signIdx + division * 3) % 12];
}

function computeD5(sign: string, degreeInSign: number): string {
  const division = Math.min(Math.floor(degreeInSign / 6), 4);
  // Extended/Tajika Panchamsa: the five planetary divisions are mapped to
  // their masculine signs in odd rashis and feminine signs in even rashis.
  const oddSigns = [0, 10, 8, 2, 6]; // Aries, Aquarius, Sagittarius, Gemini, Libra
  const evenSigns = [1, 5, 11, 9, 7]; // Taurus, Virgo, Pisces, Capricorn, Scorpio
  return SIGNS[(isOddSign(sign) ? oddSigns : evenSigns)[division]];
}

function computeD6(sign: string, degreeInSign: number): string {
  const division = Math.min(Math.floor(degreeInSign / 5), 5);
  // Extended/Tajika Shashtamsa: odd rashis begin at Aries; even at Libra.
  const startIdx = isOddSign(sign) ? 0 : 6;
  return SIGNS[(startIdx + division) % 12];
}

function computeD7(sign: string, degreeInSign: number): string {
  const signIdx = SIGN_INDEX[sign] ?? 0;
  const spanSize = 30 / 7;
  const division = Math.min(Math.floor(degreeInSign / spanSize), 6);
  const odd = isOddSign(sign);
  // Odd signs: start from same sign; Even signs: start from 7th sign (+6)
  const startIdx = odd ? signIdx : (signIdx + 6) % 12;
  return SIGNS[(startIdx + division) % 12];
}

function computeD8(sign: string, degreeInSign: number): string {
  const division = Math.min(Math.floor(degreeInSign / 3.75), 7);
  // Extended/Tajika Ashtamsa: movable, fixed, and dual signs begin from
  // Aries, Leo, and Sagittarius respectively.
  const starts = [0, 4, 8];
  return SIGNS[(starts[signModality(sign)] + division) % 12];
}

function computeD9(sign: string, degreeInSign: number): string {
  const element = signElement(sign);
  const spanSize = 30 / 9;
  const division = Math.min(Math.floor(degreeInSign / spanSize), 8);
  // Fire: Aries(0), Earth: Capricorn(9), Air: Libra(6), Water: Cancer(3)
  const starts = [0, 9, 6, 3];
  return SIGNS[(starts[element] + division) % 12];
}

function computeD10(sign: string, degreeInSign: number): string {
  const signIdx = SIGN_INDEX[sign] ?? 0;
  const spanSize = 3; // 30 / 10
  const division = Math.min(Math.floor(degreeInSign / spanSize), 9);
  const odd = isOddSign(sign);
  // Odd signs: start from same sign; Even signs: start from 9th sign (+8)
  const startIdx = odd ? signIdx : (signIdx + 8) % 12;
  return SIGNS[(startIdx + division) % 12];
}

function computeD11(sign: string, degreeInSign: number): string {
  const signIdx = SIGN_INDEX[sign] ?? 0;
  const division = Math.min(Math.floor(degreeInSign / (30 / 11)), 10);
  // Reflect the natal sign's ordinal position anti-zodiacally from Aries,
  // then proceed zodiacally through the eleven parts.
  const startIdx = (12 - signIdx) % 12;
  return SIGNS[(startIdx + division) % 12];
}

function computeD12(sign: string, degreeInSign: number): string {
  const signIdx = SIGN_INDEX[sign] ?? 0;
  const spanSize = 2.5; // 30 / 12
  const division = Math.min(Math.floor(degreeInSign / spanSize), 11);
  return SIGNS[(signIdx + division) % 12];
}

function computeD16(sign: string, degreeInSign: number): string {
  const spanSize = 30 / 16;
  const division = Math.min(Math.floor(degreeInSign / spanSize), 15);
  const starts = [0, 4, 8]; // movable, fixed, dual
  return SIGNS[(starts[signModality(sign)] + division) % 12];
}

function computeD20(sign: string, degreeInSign: number): string {
  const spanSize = 1.5; // 30 / 20
  const division = Math.min(Math.floor(degreeInSign / spanSize), 19);
  const starts = [0, 8, 4]; // movable, fixed, dual
  return SIGNS[(starts[signModality(sign)] + division) % 12];
}

function computeD24(sign: string, degreeInSign: number): string {
  const odd = isOddSign(sign);
  const spanSize = 1.25; // 30 / 24
  const division = Math.min(Math.floor(degreeInSign / spanSize), 23);
  // Odd signs: start at Leo(4), Even signs: start at Cancer(3)
  const startIdx = odd ? 4 : 3;
  return SIGNS[(startIdx + division) % 12];
}

function computeD27(sign: string, degreeInSign: number): string {
  const element = signElement(sign);
  const spanSize = 30 / 27;
  const division = Math.min(Math.floor(degreeInSign / spanSize), 26);
  // Fire: Aries(0), Earth: Cancer(3), Air: Libra(6), Water: Capricorn(9)
  const starts = [0, 3, 6, 9];
  return SIGNS[(starts[element] + division) % 12];
}

function computeD30(sign: string, degreeInSign: number): string {
  const odd = isOddSign(sign);
  const deg = degreeInSign;

  if (odd) {
    // Odd: Mars 0-5, Saturn 5-10, Jupiter 10-18, Mercury 18-25, Venus 25-30
    if (deg < 5) return "Aries";
    if (deg < 10) return "Aquarius";
    if (deg < 18) return "Sagittarius";
    if (deg < 25) return "Gemini";
    return "Libra";
  } else {
    // Even: Venus 0-5, Mercury 5-12, Jupiter 12-20, Saturn 20-25, Mars 25-30
    if (deg < 5) return "Taurus";
    if (deg < 12) return "Virgo";
    if (deg < 20) return "Pisces";
    if (deg < 25) return "Capricorn";
    return "Scorpio";
  }
}

function computeD40(sign: string, degreeInSign: number): string {
  const odd = isOddSign(sign);
  const spanSize = 0.75; // 30 / 40
  const division = Math.min(Math.floor(degreeInSign / spanSize), 39);
  // Odd signs: start at Aries(0); Even signs: start at Libra(6)
  const startIdx = odd ? 0 : 6;
  return SIGNS[(startIdx + division) % 12];
}

function computeD45(sign: string, degreeInSign: number): string {
  const spanSize = 30 / 45;
  const division = Math.min(Math.floor(degreeInSign / spanSize), 44);
  const starts = [0, 4, 8]; // movable, fixed, dual
  return SIGNS[(starts[signModality(sign)] + division) % 12];
}

function computeD60(sign: string, degreeInSign: number): string {
  const spanSize = 0.5; // 30 / 60
  const division = Math.min(Math.floor(degreeInSign / spanSize), 59);
  // The rashi is the 60th-part ordinal, independent of the natal sign.
  return SIGNS[division % 12];
}

// --------------------------------------------------------------------------
// Dispatch table
// --------------------------------------------------------------------------

type DivisionComputer = (sign: string, degreeInSign: number) => string;

const DIVISION_COMPUTERS: Record<number, DivisionComputer> = {
  1: computeD1,
  2: computeD2,
  3: computeD3,
  4: computeD4,
  5: computeD5,
  6: computeD6,
  7: computeD7,
  8: computeD8,
  9: computeD9,
  10: computeD10,
  11: computeD11,
  12: computeD12,
  16: computeD16,
  20: computeD20,
  24: computeD24,
  27: computeD27,
  30: computeD30,
  40: computeD40,
  45: computeD45,
  60: computeD60,
};

// --------------------------------------------------------------------------
// Main API
// --------------------------------------------------------------------------

export const ALL_DIVISIONAL_CHARTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60,
] as const;

/**
 * Compute a divisional chart for all planets.
 * @param planets - Array of natal planet positions
 * @param divisionNumber - The varga division (2, 3, 4, 7, 9, 10, 12, etc.)
 * @returns Array of divisional positions for each planet
 */
export function computeDivisionalChart(
  planets: PlanetPosition[],
  divisionNumber: number
): DivisionalPosition[] {
  const computer = DIVISION_COMPUTERS[divisionNumber];
  if (!computer) {
    throw new Error(`Unsupported divisional chart: D${divisionNumber}`);
  }

  return planets.map((planet) => {
    const divisionalSign = computer(planet.sign, planet.degree_in_sign);
    const spanSize = 30 / divisionNumber;
    const division = Math.min(
      Math.floor(planet.degree_in_sign / spanSize),
      divisionNumber - 1
    );

    return {
      name: planet.name,
      rashi_sign: planet.sign,
      divisional_sign: divisionalSign,
      division_number: division,
    };
  });
}

/**
 * Compute multiple divisional charts at once.
 * @param planets - Array of natal planet positions
 * @param divisions - Array of division numbers to compute (defaults to common set)
 * @returns Record keyed by division number
 */
export function computeMultipleDivisionalCharts(
  planets: PlanetPosition[],
  divisions: readonly number[] = ALL_DIVISIONAL_CHARTS
): Record<number, DivisionalChartResult> {
  const results: Record<number, DivisionalChartResult> = {};

  for (const div of divisions) {
    const info = AVAILABLE_DIVISIONS.find((d) => d.division === div);
    if (!info) continue;

    results[div] = {
      division: div,
      label: info.label,
      description: info.description,
      positions: computeDivisionalChart(planets, div),
    };
  }

  return results;
}
