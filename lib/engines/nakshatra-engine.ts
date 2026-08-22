
// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const NAKSHATRAS: string[] = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
  "Jyeshtha", "Moola", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

const NAKSHATRA_LORDS: string[] = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
];

export const DASHA_YEARS: Record<string, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7,
  Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};

export const NAKSHATRA_SPAN = 13.333333333;
export const YEAR_DAYS = 365.25;

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface NakshatraData {
  name: string;
  index: number;
  lord: string;
  pada: number;
  degree_in_nakshatra: number;
}

export interface DashaPeriod {
  planet: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  years: number;
  sequence_start_date: string;
  sequence_end_date: string;
  is_partial: boolean;
}

export interface AntarDashaPeriod {
  major_lord: string;
  sub_lord: string;
  start_date: string;
  end_date: string;
}

export interface PratyantarDashaPeriod {
  major_lord: string;
  sub_lord: string;
  pratyantar_lord: string;
  start_date: string;
  end_date: string;
}

export interface DashaTimeline {
  periods: DashaPeriod[];
  current_dasha: DashaPeriod | null;
  current_antardasha: AntarDashaPeriod | null;
  current_pratyantar: PratyantarDashaPeriod | null;
  pratyantar_periods: PratyantarDashaPeriod[];
  current_dasha_start: string | null;
  current_dasha_end: string | null;
  current_antardasha_start: string | null;
  current_antardasha_end: string | null;
  current_pratyantar_start: string | null;
  current_pratyantar_end: string | null;
}

export interface SubPeriodInfo {
  level: number;
  planet: string;
  lords: string[];
  start_date: string;
  end_date: string;
  sequence_start_date?: string;
  sequence_end_date?: string;
  is_partial: boolean;
}

// --------------------------------------------------------------------------
// Date helpers
// --------------------------------------------------------------------------

function dateToMs(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getTime();
}

function msToDateStr(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(ms: number, days: number): number {
  return ms + days * 86400000;
}

function durationYears(startMs: number, endMs: number): number {
  const totalMs = Math.max(endMs - startMs, 0);
  return totalMs / (86400000 * YEAR_DAYS);
}

// --------------------------------------------------------------------------
// Nakshatra calculation
// --------------------------------------------------------------------------

export function calculateNakshatra(moonLongitude: number): NakshatraData {
  const lon = ((moonLongitude % 360) + 360) % 360;
  let nakIndex = Math.floor(lon / NAKSHATRA_SPAN);
  nakIndex = Math.max(0, Math.min(nakIndex, 26));

  const degreeInNak = lon - nakIndex * NAKSHATRA_SPAN;
  let pada = Math.floor(degreeInNak / (NAKSHATRA_SPAN / 4)) + 1;
  pada = Math.max(1, Math.min(pada, 4));

  const lord = NAKSHATRA_LORDS[nakIndex % 9];

  return {
    name: NAKSHATRAS[nakIndex],
    index: nakIndex,
    lord,
    pada,
    degree_in_nakshatra: degreeInNak,
  };
}

// --------------------------------------------------------------------------
// Internal sub-period window builder
// --------------------------------------------------------------------------

interface SubPeriodWindow {
  level: number;
  planet: string;
  lords: string[];
  start_date: string;
  end_date: string;
  sequence_start_date: string;
  sequence_end_date: string;
  is_partial: boolean;
  sequence_start_ms: number;
  sequence_end_ms: number;
}

function buildSubPeriodWindows(
  parentLord: string,
  parentStartStr: string,
  parentEndStr: string,
  level: number,
  parentLords: string[],
  sequenceStartStr?: string,
  sequenceEndStr?: string
): SubPeriodWindow[] {
  const visibleStartMs = dateToMs(parentStartStr);
  const visibleEndMs = dateToMs(parentEndStr);
  const fullStartMs = dateToMs(sequenceStartStr || parentStartStr);
  const fullEndMs = dateToMs(sequenceEndStr || parentEndStr);
  const totalMs = fullEndMs - fullStartMs;
  if (totalMs <= 0) return [];

  const startIdx = NAKSHATRA_LORDS.indexOf(parentLord);
  let cursorMs = fullStartMs;
  const results: SubPeriodWindow[] = [];

  for (let i = 0; i < 9; i++) {
    const subLord = NAKSHATRA_LORDS[(startIdx + i) % 9];
    const proportion = DASHA_YEARS[subLord] / 120;
    const subMs = totalMs * proportion;
    let rawEndMs = cursorMs + subMs;

    if (i === 8 || rawEndMs > fullEndMs) {
      rawEndMs = fullEndMs;
    }

    const clippedStartMs = Math.max(cursorMs, visibleStartMs);
    const clippedEndMs = Math.min(rawEndMs, visibleEndMs);

    if (clippedStartMs < clippedEndMs) {
      results.push({
        level,
        planet: subLord,
        lords: [...parentLords, subLord],
        start_date: msToDateStr(clippedStartMs),
        end_date: msToDateStr(clippedEndMs),
        sequence_start_date: msToDateStr(cursorMs),
        sequence_end_date: msToDateStr(rawEndMs),
        is_partial: clippedStartMs !== cursorMs || clippedEndMs !== rawEndMs,
        sequence_start_ms: cursorMs,
        sequence_end_ms: rawEndMs,
      });
    }

    cursorMs = rawEndMs;
  }

  return results;
}

// --------------------------------------------------------------------------
// Full Dasha timeline
// --------------------------------------------------------------------------

export function calculateDashaTimeline(
  nakshatra: NakshatraData,
  birthDateStr: string,
  currentDateStr?: string,
  /**
   * The true birth instant in epoch ms.
   *
   * Without it the timeline is anchored to midnight UTC of birthDateStr, which
   * throws away the birth time entirely — a 14:30 IST birth was being anchored
   * nine hours early. The Moon's longitude already uses the exact time (that is
   * where the dasha balance comes from), so the balance was right and the
   * timeline it was added to was not.
   *
   * It barely matters for an eighteen-year mahadasha. It matters for the
   * pratyantardasha this panel prints to the day: a nine-hour error against a
   * ~32-day window is over 1%, and near a boundary it changes which period
   * "today" falls in.
   *
   * Optional so existing callers and tests that only have a date keep working.
   */
  birthInstantMs?: number
): DashaTimeline {
  const birthMs = Number.isFinite(birthInstantMs)
    ? (birthInstantMs as number)
    : dateToMs(birthDateStr);
  const currentMs = currentDateStr
    ? dateToMs(currentDateStr)
    : Date.now();

  // Anchor the birth lord dasha to its true start
  const birthLord = nakshatra.lord;
  const fractionElapsed = nakshatra.degree_in_nakshatra / NAKSHATRA_SPAN;
  const lordTotalYears = DASHA_YEARS[birthLord];
  const elapsedDays = lordTotalYears * fractionElapsed * YEAR_DAYS;

  const lordStartIdx = NAKSHATRA_LORDS.indexOf(birthLord);

  const periods: DashaPeriod[] = [];
  const lookupPeriods: Array<{
    period: DashaPeriod;
    sequenceStartMs: number;
    sequenceEndMs: number;
  }> = [];

  let cursorMs = addDays(birthMs, -elapsedDays);
  const visibleStartMs = birthMs;
  const maxEndMs = addDays(birthMs, 120 * YEAR_DAYS);

  let seqIdx = lordStartIdx;

  while (cursorMs < maxEndMs) {
    const lord = NAKSHATRA_LORDS[seqIdx % 9];
    const years = DASHA_YEARS[lord];
    const sequenceStartMs = cursorMs;
    const sequenceEndMs = addDays(cursorMs, years * YEAR_DAYS);

    const clippedStartMs = Math.max(sequenceStartMs, visibleStartMs);
    const clippedEndMs = Math.min(sequenceEndMs, maxEndMs);

    if (clippedStartMs < clippedEndMs) {
      const period: DashaPeriod = {
        planet: lord,
        start_date: msToDateStr(clippedStartMs),
        end_date: msToDateStr(clippedEndMs),
        years: Math.round(durationYears(clippedStartMs, clippedEndMs) * 100) / 100,
        sequence_start_date: msToDateStr(sequenceStartMs),
        sequence_end_date: msToDateStr(sequenceEndMs),
        is_partial: clippedStartMs !== sequenceStartMs || clippedEndMs !== sequenceEndMs,
      };
      periods.push(period);
      lookupPeriods.push({ period, sequenceStartMs, sequenceEndMs });
    }

    cursorMs = sequenceEndMs;
    seqIdx++;
  }

  // Locate current Maha Dasha
  let currentDasha: DashaPeriod | null = null;
  let currentDashaSeqStartStr: string | null = null;
  let currentDashaSeqEndStr: string | null = null;
  let currentDashaSeqStartMs = 0;
  let currentDashaSeqEndMs = 0;

  for (let i = 0; i < lookupPeriods.length; i++) {
    const { period, sequenceStartMs, sequenceEndMs } = lookupPeriods[i];
    const isLast = i === lookupPeriods.length - 1;
    if (isLast ? sequenceStartMs <= currentMs && currentMs <= sequenceEndMs
      : sequenceStartMs <= currentMs && currentMs < sequenceEndMs) {
      currentDasha = period;
      currentDashaSeqStartStr = msToDateStr(sequenceStartMs);
      currentDashaSeqEndStr = msToDateStr(sequenceEndMs);
      currentDashaSeqStartMs = sequenceStartMs;
      currentDashaSeqEndMs = sequenceEndMs;
      break;
    }
  }

  // Compute Antardasha inside current Maha Dasha
  let currentAntardasha: AntarDashaPeriod | null = null;
  let currentAntardashaStart: string | null = null;
  let currentAntardashaEnd: string | null = null;
  let currentAntarSeqStartMs = 0;
  let currentAntarSeqEndMs = 0;

  if (currentDasha) {
    const subPeriods = buildSubPeriodWindows(
      currentDasha.planet,
      currentDasha.start_date,
      currentDasha.end_date,
      2,
      [currentDasha.planet],
      currentDashaSeqStartStr ?? undefined,
      currentDashaSeqEndStr ?? undefined
    );

    for (let i = 0; i < subPeriods.length; i++) {
      const sp = subPeriods[i];
      const isLast = i === subPeriods.length - 1;
      if (isLast ? sp.sequence_start_ms <= currentMs && currentMs <= sp.sequence_end_ms
        : sp.sequence_start_ms <= currentMs && currentMs < sp.sequence_end_ms) {
        currentAntardasha = {
          major_lord: currentDasha.planet,
          sub_lord: sp.planet,
          start_date: sp.sequence_start_date,
          end_date: sp.sequence_end_date,
        };
        currentAntardashaStart = sp.sequence_start_date;
        currentAntardashaEnd = sp.sequence_end_date;
        currentAntarSeqStartMs = sp.sequence_start_ms;
        currentAntarSeqEndMs = sp.sequence_end_ms;
        break;
      }
    }
  }

  // Compute Pratyantar Dasha inside current Antar Dasha
  let currentPratyantar: PratyantarDashaPeriod | null = null;
  let currentPratyantarStart: string | null = null;
  let currentPratyantarEnd: string | null = null;
  const pratyantarPeriods: PratyantarDashaPeriod[] = [];

  if (currentAntardasha && currentDasha) {
    const pratyantarWindows = buildSubPeriodWindows(
      currentAntardasha.sub_lord,
      currentAntardasha.start_date,
      currentAntardasha.end_date,
      3,
      [currentDasha.planet, currentAntardasha.sub_lord],
      currentAntardashaStart ?? undefined,
      currentAntardashaEnd ?? undefined
    );

    for (let i = 0; i < pratyantarWindows.length; i++) {
      const pw = pratyantarWindows[i];

      // Collect all Pratyantar periods within this Antardasha
      pratyantarPeriods.push({
        major_lord: currentDasha.planet,
        sub_lord: currentAntardasha.sub_lord,
        pratyantar_lord: pw.planet,
        start_date: pw.sequence_start_date,
        end_date: pw.sequence_end_date,
      });

      // Identify the currently active Pratyantar
      if (!currentPratyantar) {
        const isLast = i === pratyantarWindows.length - 1;
        if (isLast ? pw.sequence_start_ms <= currentMs && currentMs <= pw.sequence_end_ms
          : pw.sequence_start_ms <= currentMs && currentMs < pw.sequence_end_ms) {
          currentPratyantar = {
            major_lord: currentDasha.planet,
            sub_lord: currentAntardasha.sub_lord,
            pratyantar_lord: pw.planet,
            start_date: pw.sequence_start_date,
            end_date: pw.sequence_end_date,
          };
          currentPratyantarStart = pw.sequence_start_date;
          currentPratyantarEnd = pw.sequence_end_date;
        }
      }
    }
  }

  return {
    periods,
    current_dasha: currentDasha,
    current_antardasha: currentAntardasha,
    current_pratyantar: currentPratyantar,
    pratyantar_periods: pratyantarPeriods,
    current_dasha_start: currentDashaSeqStartStr,
    current_dasha_end: currentDashaSeqEndStr,
    current_antardasha_start: currentAntardashaStart,
    current_antardasha_end: currentAntardashaEnd,
    current_pratyantar_start: currentPratyantarStart,
    current_pratyantar_end: currentPratyantarEnd,
  };
}

// --------------------------------------------------------------------------
// Public sub-period computation (for drill-down API)
// --------------------------------------------------------------------------

export function computeSubPeriods(
  parentLord: string,
  parentStart: string,
  parentEnd: string,
  level: number,
  parentLords: string[],
  sequenceStart?: string,
  sequenceEnd?: string
): SubPeriodInfo[] {
  const raw = buildSubPeriodWindows(
    parentLord,
    parentStart,
    parentEnd,
    level,
    parentLords,
    sequenceStart,
    sequenceEnd
  );

  return raw.map(({ sequence_start_ms, sequence_end_ms, ...rest }) => rest);
}
