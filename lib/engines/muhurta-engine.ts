/**
 * Muhurta (Electional Astrology) Engine
 *
 * Finds auspicious time windows for specific activities by evaluating
 * five Panchanga factors: Tithi, Nakshatra, Yoga, Karana, and Weekday.
 *
 * Each factor is scored against activity-specific preferences.
 * Consecutive "good" hours are grouped into windows with a total score.
 */

import { computeTransitPositions } from "./swiss-ephemeris-engine";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type MuhurtaActivity =
  | "marriage"
  | "business_start"
  | "travel"
  | "education"
  | "property_purchase"
  | "medical_procedure"
  | "job_interview"
  | "investment"
  | "spiritual_practice"
  | "general_auspicious";

export interface MuhurtaFactor {
  name: string;
  value: string;
  quality: string;
  score: number;
}

export interface MuhurtaWindow {
  start: string; // ISO 8601
  end: string;   // ISO 8601
  score: number; // 0-100
  quality: "excellent" | "good" | "fair" | "poor";
  factors: MuhurtaFactor[];
  recommendation: string;
}

// --------------------------------------------------------------------------
// Tithi (Lunar Day) Constants
// --------------------------------------------------------------------------

const TITHI_NAMES: string[] = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
  "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
  "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima",
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
  "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
  "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Amavasya",
];

type TithiGroup = "nanda" | "bhadra" | "jaya" | "rikta" | "purna";

function getTithiGroup(tithiNum: number): TithiGroup {
  // tithiNum is 1-30
  const mod = ((tithiNum - 1) % 15) + 1;
  if (mod === 1 || mod === 6 || mod === 11) return "nanda";
  if (mod === 2 || mod === 7 || mod === 12) return "bhadra";
  if (mod === 3 || mod === 8 || mod === 13) return "jaya";
  if (mod === 4 || mod === 9 || mod === 14) return "rikta";
  return "purna"; // 5, 10, 15
}

const TITHI_GROUP_LABELS: Record<TithiGroup, string> = {
  nanda: "Nanda (joyful)",
  bhadra: "Bhadra (auspicious)",
  jaya: "Jaya (victorious)",
  rikta: "Rikta (empty)",
  purna: "Purna (full/complete)",
};

// --------------------------------------------------------------------------
// Nakshatra quality classifications
// --------------------------------------------------------------------------

type NakshatraQuality = "fixed" | "movable" | "soft" | "sharp" | "mixed";

const NAKSHATRAS: string[] = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
  "Jyeshtha", "Moola", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

const NAKSHATRA_QUALITY: Record<string, NakshatraQuality> = {
  // Fixed (Dhruva)
  "Uttara Phalguni": "fixed",
  "Uttara Ashadha": "fixed",
  "Uttara Bhadrapada": "fixed",
  "Rohini": "fixed",
  // Movable (Chara)
  "Ashwini": "movable",
  "Pushya": "movable",
  "Hasta": "movable",
  "Swati": "movable",
  "Punarvasu": "movable",
  "Shravana": "movable",
  "Dhanishta": "movable",
  "Shatabhisha": "movable",
  // Soft/Tender (Mridu)
  "Mrigashira": "soft",
  "Chitra": "soft",
  "Anuradha": "soft",
  "Revati": "soft",
  // Sharp/Fierce (Tikshna)
  "Ardra": "sharp",
  "Ashlesha": "sharp",
  "Jyeshtha": "sharp",
  "Moola": "sharp",
  // Mixed (Mishra/Sadharana)
  "Krittika": "mixed",
  "Vishakha": "mixed",
  // Remaining default to mixed
  "Bharani": "mixed",
  "Magha": "mixed",
  "Purva Phalguni": "mixed",
  "Purva Ashadha": "mixed",
  "Purva Bhadrapada": "mixed",
};

const NAKSHATRA_QUALITY_LABELS: Record<NakshatraQuality, string> = {
  fixed: "Fixed (Dhruva)",
  movable: "Movable (Chara)",
  soft: "Soft/Tender (Mridu)",
  sharp: "Sharp/Fierce (Tikshna)",
  mixed: "Mixed (Sadharana)",
};

// --------------------------------------------------------------------------
// Yoga (Sun + Moon combination)
// --------------------------------------------------------------------------

const YOGA_NAMES: string[] = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana",
  "Atiganda", "Sukarma", "Dhriti", "Shoola", "Ganda",
  "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra",
  "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva",
  "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma",
  "Indra", "Vaidhriti",
];

type YogaQuality = "auspicious" | "neutral" | "inauspicious";

const YOGA_QUALITY: Record<string, YogaQuality> = {
  Priti: "auspicious",
  Ayushman: "auspicious",
  Saubhagya: "auspicious",
  Shobhana: "auspicious",
  Sukarma: "auspicious",
  Dhriti: "auspicious",
  Vriddhi: "auspicious",
  Harshana: "auspicious",
  Siddhi: "auspicious",
  Shiva: "auspicious",
  Siddha: "auspicious",
  Sadhya: "auspicious",
  Shubha: "auspicious",
  Shukla: "auspicious",
  Brahma: "auspicious",
  Indra: "auspicious",
  // Inauspicious
  Vishkambha: "inauspicious",
  Atiganda: "inauspicious",
  Shoola: "inauspicious",
  Ganda: "inauspicious",
  Vyaghata: "inauspicious",
  Vajra: "inauspicious",
  Vyatipata: "inauspicious",
  Parigha: "inauspicious",
  Vaidhriti: "inauspicious",
  // Neutral
  Dhruva: "neutral",
  Variyana: "neutral",
};

// --------------------------------------------------------------------------
// Karana (Half-tithi)
// --------------------------------------------------------------------------

const CYCLING_KARANAS = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"];
const FIXED_KARANAS = ["Shakuni", "Chatushpada", "Naga", "Kimstughna"];

type KaranaQuality = "auspicious" | "neutral" | "inauspicious";

function getKarana(tithiNum: number, half: 0 | 1): { name: string; quality: KaranaQuality } {
  // Karanas 1 (Kimstughna) is the first half of tithi 1,
  // then cycling karanas from 2nd half of tithi 1 through first half of tithi 30,
  // then fixed karanas for the last half of tithi 30.
  const karanaIndex = (tithiNum - 1) * 2 + half; // 0-59

  if (karanaIndex === 0) return { name: "Kimstughna", quality: "neutral" };
  if (karanaIndex >= 57) {
    const fixedIdx = karanaIndex - 57;
    const name = FIXED_KARANAS[fixedIdx] ?? "Kimstughna";
    return { name, quality: name === "Kimstughna" ? "neutral" : "inauspicious" };
  }

  const cyclingIdx = (karanaIndex - 1) % 7;
  const name = CYCLING_KARANAS[cyclingIdx];
  if (name === "Vishti") return { name, quality: "inauspicious" };
  if (name === "Bava" || name === "Balava" || name === "Kaulava" || name === "Taitila") {
    return { name, quality: "auspicious" };
  }
  return { name, quality: "neutral" };
}

// --------------------------------------------------------------------------
// Weekday
// --------------------------------------------------------------------------

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// --------------------------------------------------------------------------
// Activity preference maps
// --------------------------------------------------------------------------

interface ActivityPreferences {
  label: string;
  tithiGroups: Partial<Record<TithiGroup, number>>;     // score bonus per group
  nakshatraQualities: Partial<Record<NakshatraQuality, number>>;
  weekdays: Partial<Record<number, number>>;              // 0=Sun..6=Sat
  yogaBonus: { auspicious: number; neutral: number; inauspicious: number };
}

const ACTIVITY_PREFERENCES: Record<MuhurtaActivity, ActivityPreferences> = {
  marriage: {
    label: "Marriage / Ceremony",
    tithiGroups: { bhadra: 20, purna: 18, nanda: 10, jaya: 5, rikta: -15 },
    nakshatraQualities: { soft: 20, fixed: 15, movable: 8, mixed: 0, sharp: -15 },
    weekdays: { 1: 10, 3: 8, 4: 15, 5: 12 }, // Mon, Wed, Thu, Fri
    yogaBonus: { auspicious: 15, neutral: 0, inauspicious: -15 },
  },
  business_start: {
    label: "Business Launch",
    tithiGroups: { nanda: 20, purna: 15, bhadra: 10, jaya: 5, rikta: -15 },
    nakshatraQualities: { movable: 18, fixed: 12, soft: 5, mixed: 0, sharp: -10 },
    weekdays: { 1: 8, 3: 12, 4: 10, 5: 8 },
    yogaBonus: { auspicious: 15, neutral: 0, inauspicious: -12 },
  },
  travel: {
    label: "Travel / Journey",
    tithiGroups: { nanda: 15, purna: 12, bhadra: 8, jaya: 5, rikta: -12 },
    nakshatraQualities: { movable: 20, soft: 10, mixed: 5, fixed: -5, sharp: -12 },
    weekdays: { 1: 12, 3: 10, 5: 8 }, // Mon, Wed, Fri
    yogaBonus: { auspicious: 12, neutral: 0, inauspicious: -10 },
  },
  education: {
    label: "Education / Study",
    tithiGroups: { purna: 18, bhadra: 15, nanda: 10, jaya: 5, rikta: -10 },
    nakshatraQualities: { soft: 15, movable: 12, fixed: 10, mixed: 5, sharp: -8 },
    weekdays: { 3: 18, 4: 12, 1: 8 }, // Wed, Thu, Mon
    yogaBonus: { auspicious: 15, neutral: 0, inauspicious: -10 },
  },
  property_purchase: {
    label: "Property / Real Estate",
    tithiGroups: { bhadra: 18, purna: 15, nanda: 10, jaya: 3, rikta: -15 },
    nakshatraQualities: { fixed: 20, movable: 5, soft: 5, mixed: 0, sharp: -15 },
    weekdays: { 4: 12, 5: 10, 6: 15 }, // Thu, Fri, Sat
    yogaBonus: { auspicious: 15, neutral: 0, inauspicious: -12 },
  },
  medical_procedure: {
    label: "Medical / Surgery",
    tithiGroups: { jaya: 15, purna: 10, bhadra: 8, nanda: 5, rikta: -10 },
    nakshatraQualities: { sharp: 15, mixed: 10, movable: 5, fixed: 0, soft: -5 },
    weekdays: { 2: 15, 6: 10 }, // Tue, Sat
    yogaBonus: { auspicious: 12, neutral: 0, inauspicious: -8 },
  },
  job_interview: {
    label: "Job Interview",
    tithiGroups: { nanda: 18, purna: 15, bhadra: 10, jaya: 8, rikta: -12 },
    nakshatraQualities: { movable: 15, soft: 12, fixed: 8, mixed: 5, sharp: -10 },
    weekdays: { 1: 10, 3: 15, 4: 12, 5: 8 },
    yogaBonus: { auspicious: 15, neutral: 0, inauspicious: -12 },
  },
  investment: {
    label: "Financial Investment",
    tithiGroups: { purna: 18, nanda: 15, bhadra: 10, jaya: 5, rikta: -15 },
    nakshatraQualities: { fixed: 15, movable: 10, soft: 5, mixed: 0, sharp: -12 },
    weekdays: { 4: 15, 5: 12, 3: 8 }, // Thu, Fri, Wed
    yogaBonus: { auspicious: 15, neutral: 0, inauspicious: -15 },
  },
  spiritual_practice: {
    label: "Spiritual Practice",
    tithiGroups: { purna: 20, bhadra: 12, nanda: 10, jaya: 5, rikta: -5 },
    nakshatraQualities: { soft: 18, fixed: 15, movable: 8, mixed: 5, sharp: 5 },
    weekdays: { 1: 12, 4: 15, 0: 10 }, // Mon, Thu, Sun
    yogaBonus: { auspicious: 18, neutral: 5, inauspicious: -8 },
  },
  general_auspicious: {
    label: "General Auspicious",
    tithiGroups: { purna: 18, nanda: 15, bhadra: 12, jaya: 5, rikta: -15 },
    nakshatraQualities: { movable: 15, soft: 15, fixed: 12, mixed: 5, sharp: -12 },
    weekdays: { 1: 8, 3: 10, 4: 12, 5: 10 },
    yogaBonus: { auspicious: 15, neutral: 0, inauspicious: -12 },
  },
};

// --------------------------------------------------------------------------
// Panchanga calculation helpers
// --------------------------------------------------------------------------

function normalize(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function computeTithi(moonLong: number, sunLong: number): { num: number; name: string; group: TithiGroup } {
  const diff = normalize(moonLong - sunLong);
  const num = Math.floor(diff / 12) + 1; // 1-30
  return {
    num,
    name: TITHI_NAMES[num - 1] ?? `Tithi ${num}`,
    group: getTithiGroup(num),
  };
}

function computeNakshatraFromLongitude(moonLong: number): { name: string; quality: NakshatraQuality } {
  const lon = normalize(moonLong);
  const idx = Math.min(Math.floor(lon / (360 / 27)), 26);
  const name = NAKSHATRAS[idx];
  return {
    name,
    quality: NAKSHATRA_QUALITY[name] ?? "mixed",
  };
}

function computeYoga(sunLong: number, moonLong: number): { name: string; quality: YogaQuality } {
  const sum = normalize(sunLong + moonLong);
  const idx = Math.min(Math.floor(sum / (360 / 27)), 26);
  const name = YOGA_NAMES[idx];
  return {
    name,
    quality: YOGA_QUALITY[name] ?? "neutral",
  };
}

// --------------------------------------------------------------------------
// Scoring
// --------------------------------------------------------------------------

function scoreHour(
  activity: MuhurtaActivity,
  sunLong: number,
  moonLong: number,
  weekday: number, // 0=Sun..6=Sat
): { score: number; factors: MuhurtaFactor[] } {
  const prefs = ACTIVITY_PREFERENCES[activity];
  const factors: MuhurtaFactor[] = [];
  let rawScore = 50; // baseline

  // 1. Tithi
  const tithi = computeTithi(moonLong, sunLong);
  const tithiBonus = prefs.tithiGroups[tithi.group] ?? 0;
  rawScore += tithiBonus;
  factors.push({
    name: "Tithi",
    value: `${tithi.name} (${tithi.num}/30)`,
    quality: TITHI_GROUP_LABELS[tithi.group],
    score: tithiBonus,
  });

  // 2. Nakshatra
  const nak = computeNakshatraFromLongitude(moonLong);
  const nakBonus = prefs.nakshatraQualities[nak.quality] ?? 0;
  rawScore += nakBonus;
  factors.push({
    name: "Nakshatra",
    value: nak.name,
    quality: NAKSHATRA_QUALITY_LABELS[nak.quality],
    score: nakBonus,
  });

  // 3. Yoga
  const yoga = computeYoga(sunLong, moonLong);
  const yogaBonus = prefs.yogaBonus[yoga.quality];
  rawScore += yogaBonus;
  factors.push({
    name: "Yoga",
    value: yoga.name,
    quality: yoga.quality,
    score: yogaBonus,
  });

  // 4. Karana
  const karanaHalf: 0 | 1 = (normalize(moonLong - sunLong) % 12) < 6 ? 0 : 1;
  const karana = getKarana(tithi.num, karanaHalf);
  const karanaBonus = karana.quality === "auspicious" ? 8 : karana.quality === "inauspicious" ? -10 : 0;
  rawScore += karanaBonus;
  factors.push({
    name: "Karana",
    value: karana.name,
    quality: karana.quality,
    score: karanaBonus,
  });

  // 5. Weekday
  const weekdayBonus = prefs.weekdays[weekday] ?? 0;
  rawScore += weekdayBonus;
  factors.push({
    name: "Weekday",
    value: WEEKDAY_NAMES[weekday],
    quality: weekdayBonus > 0 ? "favorable" : "neutral",
    score: weekdayBonus,
  });

  // Clamp to 0-100
  const score = Math.max(0, Math.min(100, rawScore));
  return { score, factors };
}

// --------------------------------------------------------------------------
// Recommendation text
// --------------------------------------------------------------------------

function buildRecommendation(
  activity: MuhurtaActivity,
  score: number,
  factors: MuhurtaFactor[],
): string {
  const prefs = ACTIVITY_PREFERENCES[activity];
  const tithiFactor = factors.find((f) => f.name === "Tithi");
  const nakFactor = factors.find((f) => f.name === "Nakshatra");
  const yogaFactor = factors.find((f) => f.name === "Yoga");

  const quality = score >= 75 ? "excellent" : score >= 60 ? "good" : "modest";
  const parts: string[] = [
    `${quality === "excellent" ? "Highly" : quality === "good" ? "Generally" : "Moderately"} favorable for ${prefs.label.toLowerCase()}.`,
  ];

  if (tithiFactor && tithiFactor.score > 0) {
    parts.push(`${tithiFactor.value} tithi supports this activity.`);
  }
  if (nakFactor && nakFactor.score > 0) {
    parts.push(`Moon in ${nakFactor.value} adds a ${nakFactor.quality.toLowerCase()} quality.`);
  }
  if (yogaFactor && yogaFactor.score > 0) {
    parts.push(`${yogaFactor.value} yoga enhances the timing.`);
  }

  return parts.join(" ");
}

// --------------------------------------------------------------------------
// Main search function
// --------------------------------------------------------------------------

const MAX_SEARCH_DAYS = 30;
const HOUR_STEP_MS = 60 * 60 * 1000; // 1 hour
const MIN_WINDOW_HOURS = 2;
const GOOD_THRESHOLD = 60;

export function findMuhurta(
  activity: MuhurtaActivity,
  startDate: Date,
  endDate: Date,
  latitude: number,
  longitude: number,
  timezoneOffsetMinutes: number,
): MuhurtaWindow[] {
  // Cap at MAX_SEARCH_DAYS
  const maxEnd = new Date(startDate.getTime() + MAX_SEARCH_DAYS * 24 * 60 * 60 * 1000);
  const effectiveEnd = endDate.getTime() < maxEnd.getTime() ? endDate : maxEnd;

  // Step through in 1-hour increments; compute Sun/Moon at each step
  interface HourSlot {
    utcDate: Date;
    score: number;
    factors: MuhurtaFactor[];
    weekday: number;
  }

  const slots: HourSlot[] = [];
  let cursor = startDate.getTime();
  const endMs = effectiveEnd.getTime();

  while (cursor <= endMs) {
    const utcDate = new Date(cursor);
    // Get local date for weekday calculation
    const localDate = new Date(cursor + timezoneOffsetMinutes * 60 * 1000);
    const weekday = localDate.getUTCDay(); // 0=Sun

    // Compute Sun and Moon positions using the existing engine
    const positions = computeTransitPositions(utcDate);
    const sun = positions.find((p) => p.name === "Sun");
    const moon = positions.find((p) => p.name === "Moon");

    if (sun && moon) {
      const { score, factors } = scoreHour(activity, sun.longitude, moon.longitude, weekday);
      slots.push({ utcDate, score, factors, weekday });
    }

    cursor += HOUR_STEP_MS;
  }

  // Group consecutive good slots into windows
  const windows: MuhurtaWindow[] = [];
  let windowStart = -1;
  let windowScores: number[] = [];
  let windowFactors: MuhurtaFactor[] = [];

  for (let i = 0; i <= slots.length; i++) {
    const slot = slots[i];
    const isGood = slot && slot.score >= GOOD_THRESHOLD;

    if (isGood) {
      if (windowStart === -1) {
        windowStart = i;
        windowScores = [];
        windowFactors = slot.factors;
      }
      windowScores.push(slot.score);
    }

    if (!isGood || i === slots.length - 1) {
      if (windowStart !== -1 && windowScores.length >= MIN_WINDOW_HOURS) {
        const startSlot = slots[windowStart];
        const endSlotIdx = isGood ? i : i - 1;
        const endSlot = slots[endSlotIdx];
        const avgScore = Math.round(windowScores.reduce((a, b) => a + b, 0) / windowScores.length);
        const peakIdx = windowScores.indexOf(Math.max(...windowScores));
        const peakFactors = slots[windowStart + peakIdx]?.factors ?? windowFactors;

        // Format as local ISO timestamps
        const startLocal = new Date(startSlot.utcDate.getTime() + timezoneOffsetMinutes * 60 * 1000);
        const endLocal = new Date(endSlot.utcDate.getTime() + timezoneOffsetMinutes * 60 * 1000 + HOUR_STEP_MS);

        const quality: MuhurtaWindow["quality"] =
          avgScore >= 75 ? "excellent" : avgScore >= 60 ? "good" : avgScore >= 45 ? "fair" : "poor";

        windows.push({
          start: startLocal.toISOString(),
          end: endLocal.toISOString(),
          score: avgScore,
          quality,
          factors: peakFactors,
          recommendation: buildRecommendation(activity, avgScore, peakFactors),
        });
      }
      windowStart = -1;
      windowScores = [];
    }
  }

  // Sort by score descending, return top 10
  windows.sort((a, b) => b.score - a.score);
  return windows.slice(0, 10);
}

// --------------------------------------------------------------------------
// Exports for API
// --------------------------------------------------------------------------

export const MUHURTA_ACTIVITIES = Object.keys(ACTIVITY_PREFERENCES) as MuhurtaActivity[];

export function getActivityLabel(activity: MuhurtaActivity): string {
  return ACTIVITY_PREFERENCES[activity]?.label ?? activity;
}
