"use client";

import { useMemo } from "react";
import styles from "./BirthChartTeaser.module.css";
import { GiAries, GiTaurus, GiGemini, GiCancer, GiLeo, GiVirgo, GiLibra, GiScorpio, GiSagittarius, GiCapricorn, GiAquarius, GiPisces } from "react-icons/gi";

interface BirthChartTeaserProps {
  name?: string;
  birthDate?: string;
  birthTime?: string;
  country?: string;
  state?: string;
  city?: string;
  unknownTime?: boolean;
  coarseTime?: string;
}

const ZODIAC_SIGNS = [
  { name: "Aries", icon: GiAries, element: "Fire", dates: "Mar 21 - Apr 19" },
  { name: "Taurus", icon: GiTaurus, element: "Earth", dates: "Apr 20 - May 20" },
  { name: "Gemini", icon: GiGemini, element: "Air", dates: "May 21 - Jun 20" },
  { name: "Cancer", icon: GiCancer, element: "Water", dates: "Jun 21 - Jul 22" },
  { name: "Leo", icon: GiLeo, element: "Fire", dates: "Jul 23 - Aug 22" },
  { name: "Virgo", icon: GiVirgo, element: "Earth", dates: "Aug 23 - Sep 22" },
  { name: "Libra", icon: GiLibra, element: "Air", dates: "Sep 23 - Oct 22" },
  { name: "Scorpio", icon: GiScorpio, element: "Water", dates: "Oct 23 - Nov 21" },
  { name: "Sagittarius", icon: GiSagittarius, element: "Fire", dates: "Nov 22 - Dec 21" },
  { name: "Capricorn", icon: GiCapricorn, element: "Earth", dates: "Dec 22 - Jan 19" },
  { name: "Aquarius", icon: GiAquarius, element: "Air", dates: "Jan 20 - Feb 18" },
  { name: "Pisces", icon: GiPisces, element: "Water", dates: "Feb 19 - Mar 20" },
];

const ELEMENT_COLORS: Record<string, string> = {
  Fire: "#F07068",
  Earth: "#C89B3C",
  Air: "#6CE1D4",
  Water: "#8C64DC",
};

const COARSE_TIME_OPTIONS = [
  { value: "morning", label: "Morning (5am-11am)" },
  { value: "afternoon", label: "Afternoon (11am-4pm)" },
  { value: "evening", label: "Evening (4pm-9pm)" },
  { value: "unknown", label: "Unknown" },
];

function getSunSign(dateStr?: string) {
  if (!dateStr) return null;
  const date = new Date(dateStr + "T00:00:00");
  const month = date.getMonth();
  const day = date.getDate();

  if ((month === 2 && day >= 21) || (month === 3 && day <= 19)) return ZODIAC_SIGNS[0]; // Aries
  if ((month === 3 && day >= 20) || (month === 4 && day <= 20)) return ZODIAC_SIGNS[1]; // Taurus
  if ((month === 4 && day >= 21) || (month === 5 && day <= 20)) return ZODIAC_SIGNS[2]; // Gemini
  if ((month === 5 && day >= 21) || (month === 6 && day <= 22)) return ZODIAC_SIGNS[3]; // Cancer
  if ((month === 6 && day >= 23) || (month === 7 && day <= 22)) return ZODIAC_SIGNS[4]; // Leo
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return ZODIAC_SIGNS[5]; // Virgo
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return ZODIAC_SIGNS[6]; // Libra
  if ((month === 9 && day >= 23) || (month === 10 && day <= 21)) return ZODIAC_SIGNS[7]; // Scorpio
  if ((month === 10 && day >= 22) || (month === 11 && day <= 21)) return ZODIAC_SIGNS[8]; // Sagittarius
  if ((month === 11 && day >= 22) || (month === 0 && day <= 19)) return ZODIAC_SIGNS[9]; // Capricorn
  if ((month === 0 && day >= 20) || (month === 1 && day <= 18)) return ZODIAC_SIGNS[10]; // Aquarius
  return ZODIAC_SIGNS[11]; // Pisces
}

function getFilledFieldsCount(props: BirthChartTeaserProps) {
  return [
    props.name?.trim(),
    props.birthDate?.trim(),
    props.birthTime?.trim(),
    props.country?.trim(),
    props.state?.trim(),
    props.city?.trim(),
  ].filter(Boolean).length;
}

export default function BirthChartTeaser({
  name,
  birthDate,
  birthTime,
  country,
  state,
  city,
  unknownTime,
  coarseTime,
}: BirthChartTeaserProps) {
  const filledCount = useMemo(() => 
    getFilledFieldsCount({ name, birthDate, birthTime, country, state, city }), 
    [name, birthDate, birthTime, country, state, city]
  );

  const sunSign = useMemo(() => getSunSign(birthDate), [birthDate]);
  const hasBasicInfo = name?.trim() && birthDate?.trim();
  const hasLocation = country?.trim() || state?.trim() || city?.trim();


  // Show 'Solar chart' confidence if unknownTime is set
  const chartConfidence = unknownTime ? "Solar chart" : undefined;

  if (filledCount < 2) return null;

  return (
    <div className={styles.teaserContainer}>
      <div className={styles.teaserHeader}>
        <span className={styles.teaserSparkle}>✦</span>
        <span className={styles.teaserTitle}>Chart Preview</span>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${(filledCount / 6) * 100}%` }}
          />
        </div>
        {chartConfidence && (
          <div className={styles.chartConfidence}>
            <span>{chartConfidence}</span>
            {coarseTime && (
              <span style={{ marginLeft: 8, fontStyle: "italic", fontSize: "0.95em" }}>
                ({COARSE_TIME_OPTIONS.find(opt => opt.value === coarseTime)?.label || ""})
              </span>
            )}
          </div>
        )}
      </div>

      <div className={styles.teaserGrid}>
        {sunSign && (
          <div 
            className={styles.teaserCard}
            style={{ borderColor: `${ELEMENT_COLORS[sunSign.element]}40` }}
          >
            <div className={styles.cardIcon} style={{ color: ELEMENT_COLORS[sunSign.element] }}>
              <sunSign.icon />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardLabel}>Sun Sign</span>
              <span className={styles.cardValue}>{sunSign.name}</span>
              <span className={styles.cardMeta}>{sunSign.element} • {sunSign.dates}</span>
            </div>
          </div>
        )}

        {hasBasicInfo && (
          <div className={styles.teaserCard} style={{ borderColor: "rgba(200, 155, 60, 0.25)" }}>
            <div className={styles.cardIcon} style={{ color: "#6CE1D4" }}>☽</div>
            <div className={styles.cardContent}>
              <span className={styles.cardLabel}>Moon</span>
              <span className={styles.cardValueHint}>Calculating...</span>
              <span className={styles.cardMeta}>Based on time & location</span>
            </div>
          </div>
        )}

        {hasLocation && (
          <div className={styles.teaserCard} style={{ borderColor: "rgba(140, 100, 220, 0.25)" }}>
            <div className={styles.cardIcon} style={{ color: "#8C64DC" }}>☌</div>
            <div className={styles.cardContent}>
              <span className={styles.cardLabel}>Ascendant</span>
              <span className={styles.cardValueHint}>Revealing...</span>
              <span className={styles.cardMeta}>Rising sign at birth</span>
            </div>
          </div>
        )}

        {birthTime?.trim() && (
          <div className={styles.teaserCard} style={{ borderColor: "rgba(240, 112, 104, 0.25)" }}>
            <div className={styles.cardIcon} style={{ color: "#F07068" }}>♁</div>
            <div className={styles.cardContent}>
              <span className={styles.cardLabel}>Houses</span>
              <span className={styles.cardValueHint}>12 sectors</span>
              <span className={styles.cardMeta}>Life domains await</span>
            </div>
          </div>
        )}
      </div>

      {filledCount >= 5 && (
        <div className={styles.teaserGlow}>
          <span className={styles.teaserReady}>Your chart is nearly ready...</span>
        </div>
      )}
    </div>
  );
}
