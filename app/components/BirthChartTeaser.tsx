"use client";

import { useMemo, type CSSProperties } from "react";
import styles from "./BirthChartTeaser.module.css";
import {
  GiAries,
  GiAquarius,
  GiCancer,
  GiCapricorn,
  GiGemini,
  GiLeo,
  GiLibra,
  GiPisces,
  GiSagittarius,
  GiScorpio,
  GiTaurus,
  GiVirgo,
} from "react-icons/gi";

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

const HOUSE_TICKS = Array.from({ length: 12 }, (_, index) => index);

function getSunSign(dateStr?: string) {
  if (!dateStr) return null;
  const date = new Date(dateStr + "T00:00:00");
  const month = date.getMonth();
  const day = date.getDate();

  if ((month === 2 && day >= 21) || (month === 3 && day <= 19)) return ZODIAC_SIGNS[0];
  if ((month === 3 && day >= 20) || (month === 4 && day <= 20)) return ZODIAC_SIGNS[1];
  if ((month === 4 && day >= 21) || (month === 5 && day <= 20)) return ZODIAC_SIGNS[2];
  if ((month === 5 && day >= 21) || (month === 6 && day <= 22)) return ZODIAC_SIGNS[3];
  if ((month === 6 && day >= 23) || (month === 7 && day <= 22)) return ZODIAC_SIGNS[4];
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return ZODIAC_SIGNS[5];
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return ZODIAC_SIGNS[6];
  if ((month === 9 && day >= 23) || (month === 10 && day <= 21)) return ZODIAC_SIGNS[7];
  if ((month === 10 && day >= 22) || (month === 11 && day <= 21)) return ZODIAC_SIGNS[8];
  if ((month === 11 && day >= 22) || (month === 0 && day <= 19)) return ZODIAC_SIGNS[9];
  if ((month === 0 && day >= 20) || (month === 1 && day <= 18)) return ZODIAC_SIGNS[10];
  return ZODIAC_SIGNS[11];
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

function getDisplayName(name?: string) {
  const trimmedName = name?.trim();
  if (!trimmedName) return "Awaiting name";
  return trimmedName.length > 16 ? `${trimmedName.slice(0, 14)}...` : trimmedName;
}

function getConfidenceLabel(hasExactTime: boolean, unknownTime?: boolean, coarseTime?: string) {
  if (hasExactTime) return "Exact time";
  if (unknownTime || coarseTime === "unknown") return "Solar chart";
  if (coarseTime) {
    return COARSE_TIME_OPTIONS.find((option) => option.value === coarseTime)?.label ?? "Coarse time";
  }
  return "Awaiting time";
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
  const filledCount = useMemo(
    () => getFilledFieldsCount({ name, birthDate, birthTime, country, state, city }),
    [name, birthDate, birthTime, country, state, city]
  );

  const sunSign = useMemo(() => getSunSign(birthDate), [birthDate]);
  const hasName = Boolean(name?.trim());
  const hasDate = Boolean(birthDate?.trim());
  const hasExactTime = Boolean(birthTime?.trim());
  const hasTimeSignal = hasExactTime || Boolean(unknownTime) || Boolean(coarseTime);
  const hasLocation = Boolean(country?.trim() || state?.trim() || city?.trim());
  const completedUnlocks = [hasName, hasDate, hasTimeSignal, hasLocation].filter(Boolean).length;
  const readiness = Math.round((filledCount / 6) * 100);
  const isNearComplete = filledCount >= 5;
  const chartConfidence = getConfidenceLabel(hasExactTime, unknownTime, coarseTime);
  const SunIcon = sunSign?.icon;

  const astrolabeMarkers = [
    { label: "SUN", angle: -55, radius: 33, active: hasDate, className: styles.sunMarker },
    { label: "MOON", angle: 34, radius: 28, active: hasName && hasDate, className: styles.moonMarker },
    { label: "ASC", angle: 132, radius: 36, active: hasLocation, className: styles.ascMarker },
    { label: "MC", angle: 226, radius: 24, active: hasTimeSignal, className: styles.houseMarker },
  ];

  const infoRows = [
    {
      label: "Sun Sign",
      value: sunSign?.name ?? "Waiting for date",
      meta: sunSign ? `${sunSign.element} / ${sunSign.dates}` : "Unlocks from birth date",
      active: hasDate,
      accent: sunSign ? ELEMENT_COLORS[sunSign.element] : "#C89B3C",
      icon: SunIcon ? <SunIcon /> : "SUN",
    },
    {
      label: "Moon",
      value: hasName && hasDate ? "Orbital layer queued" : "Pending",
      meta: hasTimeSignal ? "Refines with time signal" : "Needs date and time context",
      active: hasName && hasDate,
      accent: "#6CE1D4",
      icon: "MOON",
    },
    {
      label: "Ascendant",
      value: hasLocation ? "Location locked" : "Awaiting place",
      meta: "Rising point uses birthplace",
      active: hasLocation,
      accent: "#8C64DC",
      icon: "ASC",
    },
    {
      label: "Houses",
      value: hasTimeSignal ? "12 sectors awake" : "Dormant",
      meta: hasExactTime ? "Exact timing active" : chartConfidence,
      active: hasTimeSignal,
      accent: "#F07068",
      icon: "HOUSES",
    },
  ];

  const containerClassName = [
    styles.teaserContainer,
    completedUnlocks === 0 ? styles.isDormant : "",
    isNearComplete ? styles.isReady : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={containerClassName}>
      <div className={styles.teaserHeader}>
        <div>
          <span className={styles.teaserKicker}>Living astrolabe</span>
          <span className={styles.teaserTitle}>Chart Preview</span>
        </div>
        <div className={styles.headerStatus}>
          <span className={styles.chartConfidence}>{chartConfidence}</span>
          <div className={styles.progressBar} aria-label={`${readiness}% chart readiness`}>
            <div className={styles.progressFill} style={{ width: `${readiness}%` }} />
          </div>
        </div>
      </div>

      <div className={styles.teaserBody}>
        <div className={styles.astrolabeWrap} aria-hidden="true">
          <div className={styles.astrolabe}>
            <div className={styles.outerRing} />
            <div className={styles.houseRing} />
            <div className={styles.innerOrbit} />
            {HOUSE_TICKS.map((tick) => (
              <span
                key={tick}
                className={[
                  styles.houseTick,
                  tick < completedUnlocks * 3 ? styles.houseTickActive : "",
                ].filter(Boolean).join(" ")}
                style={{ "--angle": `${tick * 30}deg` } as CSSProperties}
              />
            ))}
            {astrolabeMarkers.map((marker) => (
              <span
                key={marker.label}
                className={[
                  styles.planetMarker,
                  marker.className,
                  marker.active ? styles.planetMarkerActive : "",
                ].filter(Boolean).join(" ")}
                style={{
                  "--angle": `${marker.angle}deg`,
                  "--radius": `${marker.radius}%`,
                } as CSSProperties}
              >
                {marker.label}
              </span>
            ))}
            <div className={styles.centerSeal}>
              <span className={styles.centerName}>{getDisplayName(name)}</span>
              <span className={styles.centerMeta}>
                {isNearComplete ? "Ready" : `${filledCount}/6 fields`}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.teaserRows}>
          {infoRows.map((row) => (
            <div
              key={row.label}
              className={[
                styles.teaserRow,
                row.active ? styles.rowActive : styles.rowPending,
              ].filter(Boolean).join(" ")}
              style={{ "--accent": row.accent } as CSSProperties}
            >
              <span className={styles.rowIcon}>{row.icon}</span>
              <span className={styles.rowMain}>
                <span className={styles.rowLabel}>{row.label}</span>
                <span className={styles.rowValue}>{row.value}</span>
              </span>
              <span className={styles.rowMeta}>{row.meta}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.teaserFooter}>
        <span className={styles.readinessText}>
          {isNearComplete ? "Chart atmosphere is nearly formed" : "Add details to wake the chart"}
        </span>
        <span className={styles.readinessValue}>{readiness}% ready</span>
      </div>
    </div>
  );
}
