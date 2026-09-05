"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/profile-context";
import { getProfilesSnapshot } from "@/lib/local-profiles";
import { useTranslation } from "@/lib/i18n-context";
import { formatBirthDate } from "@/lib/format-birth-date";
import {
  readChartHistory,
  recordChartVisit,
  type ChartHistoryEntry,
} from "@/lib/chart-history-store";
import { HiOutlineSparkles } from "react-icons/hi2";

type ChartHistoryProps = {
  userName?: string;
};

/* ── Zodiac sign to planet color mapping ── */
const SIGN_COLORS: Record<string, string> = {
  Aries: "#e74c3c",       // Mars red
  Taurus: "#e91e8c",      // Venus pink
  Gemini: "#2ecc71",      // Mercury green
  Cancer: "#a8d8ea",      // Moon blue
  Leo: "#f5a623",         // Sun orange
  Virgo: "#2ecc71",       // Mercury green
  Libra: "#e91e8c",       // Venus pink
  Scorpio: "#e74c3c",     // Mars red
  Sagittarius: "#f1c40f", // Jupiter yellow
  Capricorn: "#7f8c8d",   // Saturn gray
  Aquarius: "#7f8c8d",    // Saturn gray
  Pisces: "#f1c40f",      // Jupiter yellow
};

function getSignColor(sign?: string): string | null {
  if (!sign) return null;
  const normalized = sign.trim();
  return SIGN_COLORS[normalized] ?? null;
}

/* ── 3D tilt card wrapper ── */
function TiltCard({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className: string;
  onClick: () => void;
}) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const rafRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const el = cardRef.current;
    if (!el) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateY = ((x - centerX) / centerX) * 8;
      const rotateX = ((centerY - y) / centerY) * 8;
      const percX = (x / rect.width) * 100;
      const percY = (y / rect.height) * 100;
      setStyle({
        transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`,
        transition: "transform 150ms ease-out",
        "--tilt-light-x": `${percX}%`,
        "--tilt-light-y": `${percY}%`,
        "--tilt-light-opacity": "1",
      } as React.CSSProperties);
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setStyle({
      transform: "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)",
      transition: "transform 300ms ease-out",
      "--tilt-light-opacity": "0",
    } as React.CSSProperties);
  }, []);

  return (
    <button
      ref={cardRef}
      className={className}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
      type="button"
    >
      {children}
    </button>
  );
}

export default function ChartHistory({ userName }: ChartHistoryProps) {
  const { isLoading, profileId } = useProfile();
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ChartHistoryEntry[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Read on every profile change, so a switch never shows the previous
    // profile's charts.
    const local = readChartHistory(profileId);
    setEntries(local);

    /*
     * Hydration: the browser is empty, so ask the account whether it is.
     *
     * Only when empty. Charts are stored per workspace — one device or one
     * signed-in account — while this list is per local profile, and the two
     * do not nest. Filling a profile that already has charts would interleave
     * two people's histories under one name.
     */
    if (local.length > 0 || !profileId) return;

    let cancelled = false;

    const hydrate = async () => {
      try {
        const response = await fetch("/api/sync/charts", {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        if (!response.ok || cancelled) return;

        const { charts, workspace } = (await response.json()) as {
          workspace: "account" | "device" | null;
          charts: {
            name: string;
            city: string;
            birthDate: string;
            ascendantSign: string | null;
            queryString: string;
            savedAt: string;
          }[];
        };
        if (cancelled || charts.length === 0) return;

        /*
         * An empty list is not on its own permission to fill it.
         *
         * A second profile made on a shared browser is empty too, and it
         * resolves to the same device workspace as the first — so hydrating it
         * would hand one housemate the other's charts, which is the single
         * thing profiles exist to prevent.
         *
         * A signed-in account is different: it is one person by construction,
         * and giving them their charts on a new device is the entire promise
         * of signing in. So an account hydrates anywhere, and a device only
         * hydrates while it holds one profile — which is what a genuinely
         * fresh browser, or one whose storage was cleared, looks like.
         */
        const profileCount = getProfilesSnapshot().profiles.length;
        if (workspace === "device" && profileCount > 1) return;

        /* Oldest first, because recordChartVisit prepends — this leaves the
           newest chart at the head, matching how local history reads. */
        for (const chart of [...charts].reverse()) {
          recordChartVisit(profileId, {
            name: chart.name,
            city: chart.city,
            birthDate: chart.birthDate,
            ascendantSign: chart.ascendantSign ?? "",
            queryString: chart.queryString,
            savedAt: chart.savedAt,
          });
        }

        if (!cancelled) setEntries(readChartHistory(profileId));
      } catch {
        /* Offline, or the account store is down. The welcome panel is the
           honest thing to show; it is what a genuinely new visitor sees. */
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (isLoading) {
    return null;
  }

  const handleCardClick = (queryString: string) => {
    router.push(`/insights?${queryString}`);
  };

  /* ── Authenticated but no history yet ── */
  if (entries.length === 0) {
    return (
      <section className="chart-history-panel anim-fade-in">
        <div className="chart-history-welcome">
          <HiOutlineSparkles className="chart-history-welcome-icon" />
          <h2 className="chart-history-welcome-heading">
            {t("chartHistory.welcomeHeading")}{userName ? `, ${userName}` : ""}!
          </h2>
          <p className="chart-history-welcome-text">
            {t("chartHistory.welcomeText")}
          </p>
        </div>
      </section>
    );
  }

  /* ── Has chart history ── */
  const [hero, ...rest] = entries;
  const heroSignColor = getSignColor(hero.ascendantSign);

  return (
    <section className="chart-history-panel anim-fade-in">
      <p className="kicker">{t("chartHistory.pickUp")}</p>

      {/* ── Hero: Last viewed chart ── */}
      <TiltCard
        className="chart-history-hero"
        onClick={() => handleCardClick(hero.queryString)}
      >
        <span className="chart-history-tilt-light" aria-hidden="true" />
        <div className="chart-history-hero-info">
          <span className="chart-history-hero-name">
            {heroSignColor && (
              <span
                className="chart-history-sign-dot"
                style={{ background: heroSignColor, boxShadow: `0 0 6px ${heroSignColor}` }}
                aria-hidden="true"
              />
            )}
            {hero.name}
          </span>
          <span className="chart-history-hero-meta">
            {hero.city} &middot; {hero.ascendantSign} Lagna &middot;{" "}
            {formatBirthDate(hero.birthDate)}
          </span>
        </div>
        <span className="chart-history-hero-cta">{t("chartHistory.viewChart")} &rarr;</span>
      </TiltCard>

      {/* ── Remaining history: horizontal scroll carousel ── */}
      {rest.length > 0 && (
        <div className="chart-history-carousel-wrapper">
          <div className="chart-history-carousel">
            {rest.map((entry) => {
              const signColor = getSignColor(entry.ascendantSign);
              return (
                <TiltCard
                  key={`${entry.name}-${entry.birthDate}`}
                  className="chart-history-card"
                  onClick={() => handleCardClick(entry.queryString)}
                >
                  <span className="chart-history-tilt-light" aria-hidden="true" />
                  <span className="chart-history-name">
                    {signColor && (
                      <span
                        className="chart-history-sign-dot"
                        style={{ background: signColor, boxShadow: `0 0 6px ${signColor}` }}
                        aria-hidden="true"
                      />
                    )}
                    {entry.name}
                  </span>
                  <span className="chart-history-meta">
                    {entry.city} &middot; {entry.ascendantSign} Lagna
                  </span>
                  <span className="chart-history-date">
                    {formatBirthDate(entry.birthDate)}
                  </span>
                </TiltCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Divider before form ── */}
      <div className="chart-history-divider">
        <span>{t("chartHistory.divider")}</span>
      </div>
    </section>
  );
}
