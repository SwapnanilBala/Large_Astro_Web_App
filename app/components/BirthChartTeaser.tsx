"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "@/lib/i18n-context";
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
  engineId?: string;
  timezoneOffsetMinutes?: string;
  country?: string;
  state?: string;
  city?: string;
  unknownTime?: boolean;
  coarseTime?: string;
}

const ZODIAC_SIGNS = [
  { name: "Aries", icon: GiAries, element: "Fire" },
  { name: "Taurus", icon: GiTaurus, element: "Earth" },
  { name: "Gemini", icon: GiGemini, element: "Air" },
  { name: "Cancer", icon: GiCancer, element: "Water" },
  { name: "Leo", icon: GiLeo, element: "Fire" },
  { name: "Virgo", icon: GiVirgo, element: "Earth" },
  { name: "Libra", icon: GiLibra, element: "Air" },
  { name: "Scorpio", icon: GiScorpio, element: "Water" },
  { name: "Sagittarius", icon: GiSagittarius, element: "Fire" },
  { name: "Capricorn", icon: GiCapricorn, element: "Earth" },
  { name: "Aquarius", icon: GiAquarius, element: "Air" },
  { name: "Pisces", icon: GiPisces, element: "Water" },
];

const ZODIAC_SIGN_BY_NAME = new Map(ZODIAC_SIGNS.map((sign) => [sign.name, sign]));

const ELEMENT_COLORS: Record<string, string> = {
  Fire: "#F07068",
  Earth: "#C89B3C",
  Air: "#6CE1D4",
  Water: "#8C64DC",
};

const COARSE_TIME_OPTIONS = [
  { value: "morning", labelKey: "home.coarseMorning" },
  { value: "afternoon", labelKey: "home.coarseAfternoon" },
  { value: "evening", labelKey: "home.coarseEvening" },
  { value: "unknown", labelKey: "home.coarseUnknown" },
];

const HOUSE_TICKS = Array.from({ length: 12 }, (_, index) => index);

type SunSignPreview = (typeof ZODIAC_SIGNS)[number] & {
  degree: number;
  isExact: boolean;
};

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

function getDisplayName(name: string | undefined, awaitingName: string) {
  const trimmedName = name?.trim();
  if (!trimmedName) return awaitingName;
  return trimmedName.length > 16 ? `${trimmedName.slice(0, 14)}...` : trimmedName;
}

function getConfidenceLabel(
  hasExactTime: boolean,
  unknownTime: boolean | undefined,
  coarseTime: string | undefined,
  t: (key: string, params?: Record<string, string>) => string
) {
  if (hasExactTime) return t("birthChartTeaser.exactTime");
  if (unknownTime || coarseTime === "unknown") return t("birthChartTeaser.solarChart");
  if (coarseTime) {
    const option = COARSE_TIME_OPTIONS.find((item) => item.value === coarseTime);
    return option ? t(option.labelKey) : t("birthChartTeaser.coarseTime");
  }
  return t("birthChartTeaser.awaitingTime");
}

export default function BirthChartTeaser({
  name,
  birthDate,
  birthTime,
  engineId,
  timezoneOffsetMinutes,
  country,
  state,
  city,
  unknownTime,
  coarseTime,
}: BirthChartTeaserProps) {
  const { t } = useTranslation();
  const filledCount = useMemo(
    () => getFilledFieldsCount({ name, birthDate, birthTime, country, state, city }),
    [name, birthDate, birthTime, country, state, city]
  );

  const [sunSign, setSunSign] = useState<SunSignPreview | null>(null);
  const [isSunSignLoading, setIsSunSignLoading] = useState(false);
  const hasName = Boolean(name?.trim());
  const hasDate = Boolean(birthDate?.trim());
  const hasExactTime = Boolean(birthTime?.trim());
  const hasTimeSignal = hasExactTime || Boolean(unknownTime) || Boolean(coarseTime);
  const hasLocation = Boolean(country?.trim() || state?.trim() || city?.trim());
  const completedUnlocks = [hasName, hasDate, hasTimeSignal, hasLocation].filter(Boolean).length;
  const readiness = Math.round((filledCount / 6) * 100);
  const isNearComplete = filledCount >= 5;
  const chartConfidence = getConfidenceLabel(hasExactTime, unknownTime, coarseTime, t);
  const SunIcon = sunSign?.icon;
  const displaySunSign = sunSign ? t(`zodiacSigns.${sunSign.name.toLowerCase()}`) : null;
  const displaySunElement = sunSign ? t(`zodiacElements.${sunSign.element.toLowerCase()}`) : null;

  useEffect(() => {
    if (!birthDate?.trim()) {
      setSunSign(null);
      setIsSunSignLoading(false);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      birth_date: birthDate.trim(),
      birth_time: birthTime?.trim() || "12:00",
      engine_id: engineId?.trim() || "lahiri_classic",
      timezone_offset_minutes: timezoneOffsetMinutes?.trim() || "0",
    });

    setIsSunSignLoading(true);
    fetch(`/api/chart/sun-sign?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Sun sign lookup failed");
        return response.json() as Promise<{ sign: string; degree_in_sign: number }>;
      })
      .then((sun) => {
        const sign = ZODIAC_SIGN_BY_NAME.get(sun.sign);
        setSunSign(
          sign
            ? {
                ...sign,
                degree: sun.degree_in_sign,
                isExact: Boolean(birthTime?.trim()),
              }
            : null
        );
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setSunSign(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsSunSignLoading(false);
      });

    return () => controller.abort();
  }, [birthDate, birthTime, engineId, timezoneOffsetMinutes]);

  const astrolabeMarkers = [
    { label: "SUN", angle: -55, radius: 33, active: hasDate, className: styles.sunMarker },
    { label: "MOON", angle: 34, radius: 28, active: hasName && hasDate, className: styles.moonMarker },
    { label: "ASC", angle: 132, radius: 36, active: hasLocation, className: styles.ascMarker },
    { label: "MC", angle: 226, radius: 24, active: hasTimeSignal, className: styles.houseMarker },
  ];

  const infoRows = [
    {
      label: t("birthChartTeaser.sunSign"),
      value: isSunSignLoading ? t("birthChartTeaser.calculating") : displaySunSign ?? t("birthChartTeaser.waitingForDate"),
      meta: sunSign
        ? t("birthChartTeaser.sunMeta", {
            element: displaySunElement ?? sunSign.element,
            degree: sunSign.degree.toFixed(1),
            kind: sunSign.isExact ? t("birthChartTeaser.sunKindExact") : t("birthChartTeaser.sunKindEstimate"),
          })
        : isSunSignLoading
          ? t("birthChartTeaser.readingChartEngine")
        : t("birthChartTeaser.unlocksFromBirthDate"),
      active: hasDate,
      accent: sunSign ? ELEMENT_COLORS[sunSign.element] : "#C89B3C",
      icon: SunIcon ? <SunIcon /> : "SUN",
    },
    {
      label: t("birthChartTeaser.moon"),
      value: hasName && hasDate ? t("birthChartTeaser.orbitalLayerQueued") : t("birthChartTeaser.pending"),
      meta: hasTimeSignal ? t("birthChartTeaser.refinesWithTimeSignal") : t("birthChartTeaser.needsDateAndTime"),
      active: hasName && hasDate,
      accent: "#6CE1D4",
      icon: "MOON",
    },
    {
      label: t("birthChartTeaser.ascendant"),
      value: hasLocation ? t("birthChartTeaser.locationLocked") : t("birthChartTeaser.awaitingPlace"),
      meta: t("birthChartTeaser.risingPointUsesBirthplace"),
      active: hasLocation,
      accent: "#8C64DC",
      icon: "ASC",
    },
    {
      label: t("birthChartTeaser.houses"),
      value: hasTimeSignal ? t("birthChartTeaser.sectorsAwake") : t("birthChartTeaser.dormant"),
      meta: hasExactTime ? t("birthChartTeaser.exactTimingActive") : chartConfidence,
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
          <span className={styles.teaserKicker}>{t("birthChartTeaser.kicker")}</span>
          <span className={styles.teaserTitle}>{t("home.chartPreview")}</span>
        </div>
        <div className={styles.headerStatus}>
          <span className={styles.chartConfidence}>{chartConfidence}</span>
          <div
            className={styles.progressBar}
            aria-label={t("birthChartTeaser.readinessAria", { percent: String(readiness) })}
          >
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
              <span className={styles.centerName}>{getDisplayName(name, t("birthChartTeaser.awaitingName"))}</span>
              <span className={styles.centerMeta}>
                {isNearComplete
                  ? t("birthChartTeaser.ready")
                  : t("birthChartTeaser.fields", { filled: String(filledCount), total: "6" })}
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
          {isNearComplete ? t("birthChartTeaser.nearlyFormed") : t("birthChartTeaser.addDetails")}
        </span>
        <span className={styles.readinessValue}>
          {t("birthChartTeaser.readyPercent", { percent: String(readiness) })}
        </span>
      </div>
    </div>
  );
}
