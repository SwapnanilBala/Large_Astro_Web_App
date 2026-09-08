/**
 * Panchanga — the five limbs of the Vedic day.
 *
 * Tithi (lunar day), Nakshatra (lunar mansion), Yoga (Sun+Moon sum), Karana
 * (half-tithi) and Vaara (weekday). All five derive from nothing but the Sun's
 * and Moon's sidereal longitudes, which is why they live here rather than in
 * any one consumer: they are properties of a moment, not of a chart or of an
 * activity.
 *
 * This is a verbatim extraction from muhurta-engine.ts, which still imports
 * every one of these and remains the only caller of getKarana. It was moved so
 * the weekly-energy engine could read the same limbs rather than grow a second
 * copy of a longitude-to-limb mapping -- two copies that must agree about
 * which nakshatra a degree falls in is exactly the kind of duplication that
 * drifts silently, because both halves keep rendering either way.
 *
 * The mappings are pinned by lib/__tests__/muhurta-engine.test.ts through the
 * engine's public surface. If you change a table here, that test is what will
 * tell you.
 */

// --------------------------------------------------------------------------
// Shared angle helper
// --------------------------------------------------------------------------

export function normalize(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

// --------------------------------------------------------------------------
// Tithi (Lunar Day)
// --------------------------------------------------------------------------

export const TITHI_NAMES: string[] = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
  "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
  "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima",
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
  "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
  "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Amavasya",
];

export type TithiGroup = "nanda" | "bhadra" | "jaya" | "rikta" | "purna";

export function getTithiGroup(tithiNum: number): TithiGroup {
  // tithiNum is 1-30
  const mod = ((tithiNum - 1) % 15) + 1;
  if (mod === 1 || mod === 6 || mod === 11) return "nanda";
  if (mod === 2 || mod === 7 || mod === 12) return "bhadra";
  if (mod === 3 || mod === 8 || mod === 13) return "jaya";
  if (mod === 4 || mod === 9 || mod === 14) return "rikta";
  return "purna"; // 5, 10, 15
}

export const TITHI_GROUP_LABELS: Record<TithiGroup, string> = {
  nanda: "Nanda (joyful)",
  bhadra: "Bhadra (auspicious)",
  jaya: "Jaya (victorious)",
  rikta: "Rikta (empty)",
  purna: "Purna (full/complete)",
};

export function computeTithi(
  moonLong: number,
  sunLong: number
): { num: number; name: string; group: TithiGroup } {
  const diff = normalize(moonLong - sunLong);
  const num = Math.floor(diff / 12) + 1; // 1-30
  return {
    num,
    name: TITHI_NAMES[num - 1] ?? `Tithi ${num}`,
    group: getTithiGroup(num),
  };
}

// --------------------------------------------------------------------------
// Nakshatra quality classifications
// --------------------------------------------------------------------------

export type NakshatraQuality = "fixed" | "movable" | "soft" | "sharp" | "mixed";

export const NAKSHATRAS: string[] = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
  "Jyeshtha", "Moola", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

export const NAKSHATRA_QUALITY: Record<string, NakshatraQuality> = {
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

export const NAKSHATRA_QUALITY_LABELS: Record<NakshatraQuality, string> = {
  fixed: "Fixed (Dhruva)",
  movable: "Movable (Chara)",
  soft: "Soft/Tender (Mridu)",
  sharp: "Sharp/Fierce (Tikshna)",
  mixed: "Mixed (Sadharana)",
};

export function computeNakshatraFromLongitude(
  moonLong: number
): { name: string; quality: NakshatraQuality } {
  const lon = normalize(moonLong);
  const idx = Math.min(Math.floor(lon / (360 / 27)), 26);
  const name = NAKSHATRAS[idx];
  return {
    name,
    quality: NAKSHATRA_QUALITY[name] ?? "mixed",
  };
}

// --------------------------------------------------------------------------
// Yoga (Sun + Moon combination)
// --------------------------------------------------------------------------

export const YOGA_NAMES: string[] = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana",
  "Atiganda", "Sukarma", "Dhriti", "Shoola", "Ganda",
  "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra",
  "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva",
  "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma",
  "Indra", "Vaidhriti",
];

export type YogaQuality = "auspicious" | "neutral" | "inauspicious";

export const YOGA_QUALITY: Record<string, YogaQuality> = {
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

export function computeYoga(
  sunLong: number,
  moonLong: number
): { name: string; quality: YogaQuality } {
  const sum = normalize(sunLong + moonLong);
  const idx = Math.min(Math.floor(sum / (360 / 27)), 26);
  const name = YOGA_NAMES[idx];
  return {
    name,
    quality: YOGA_QUALITY[name] ?? "neutral",
  };
}

// --------------------------------------------------------------------------
// Karana (Half-tithi)
// --------------------------------------------------------------------------

export const CYCLING_KARANAS = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"];
export const FIXED_KARANAS = ["Shakuni", "Chatushpada", "Naga", "Kimstughna"];

export type KaranaQuality = "auspicious" | "neutral" | "inauspicious";

export function getKarana(tithiNum: number, half: 0 | 1): { name: string; quality: KaranaQuality } {
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

/**
 * Which half of the tithi a moment falls in, which is what selects the karana.
 *
 * Lifted out of scoreHour so that any caller computing a karana uses the same
 * halving rule rather than re-deriving it -- getKarana's `half` argument is
 * easy to pass the wrong way round, and the result is a plausible-looking
 * karana rather than an error.
 */
export function getKaranaHalf(moonLong: number, sunLong: number): 0 | 1 {
  return (normalize(moonLong - sunLong) % 12) < 6 ? 0 : 1;
}

// --------------------------------------------------------------------------
// Vaara (Weekday)
// --------------------------------------------------------------------------

export const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
