"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import { listSavedCharts } from "@/lib/workspace-store";
import { HiOutlineSparkles } from "react-icons/hi2";
import type { ChartHistoryEntry } from "@/app/insights/components/chart-history-saver";

type ChartHistoryProps = {
  userName?: string;
};

function loadLocalEntries(): ChartHistoryEntry[] {
  try {
    const raw = localStorage.getItem("astro_chart_history");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function ChartHistory({ userName }: ChartHistoryProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ChartHistoryEntry[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) return;
    setEntries(loadLocalEntries());
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let isCancelled = false;

    const loadSavedCharts = async () => {
      try {
        const data = await listSavedCharts(user.user_id);
        if (isCancelled || data.length === 0) return;

        setEntries(
          data.map((entry) => ({
            name: entry.name,
            city: entry.city,
            birthDate: entry.birth_date,
            ascendantSign: entry.ascendant_sign,
            savedAt: entry.saved_at,
            queryString: entry.query_string,
          }))
        );
      } catch {
        /* ignore and keep local fallback */
      }
    };

    void loadSavedCharts();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, user]);

  if (isLoading || !isAuthenticated) {
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

  return (
    <section className="chart-history-panel anim-fade-in">
      <p className="kicker">{t("chartHistory.pickUp")}</p>

      {/* ── Hero: Last viewed chart ── */}
      <button
        className="chart-history-hero"
        onClick={() => handleCardClick(hero.queryString)}
        type="button"
      >
        <div className="chart-history-hero-info">
          <span className="chart-history-hero-name">{hero.name}</span>
          <span className="chart-history-hero-meta">
            {hero.city} &middot; {hero.ascendantSign} Lagna &middot;{" "}
            {new Date(hero.birthDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <span className="chart-history-hero-cta">{t("chartHistory.viewChart")} &rarr;</span>
      </button>

      {/* ── Remaining history grid ── */}
      {rest.length > 0 && (
        <div className="chart-history-grid">
          {rest.map((entry) => (
            <button
              key={`${entry.name}-${entry.birthDate}`}
              className="chart-history-card"
              onClick={() => handleCardClick(entry.queryString)}
              type="button"
            >
              <span className="chart-history-name">{entry.name}</span>
              <span className="chart-history-meta">
                {entry.city} &middot; {entry.ascendantSign} Lagna
              </span>
              <span className="chart-history-date">
                {new Date(entry.birthDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Divider before form ── */}
      <div className="chart-history-divider">
        <span>{t("chartHistory.divider")}</span>
      </div>
    </section>
  );
}
