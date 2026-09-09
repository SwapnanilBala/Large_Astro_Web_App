"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPalmReadingsByIds } from "@/lib/palm-readings/local-store";
import PalmAnnotation from "@/app/(desktop)/insights/components/PalmAnnotation";
import { computeReadingDiff, type ComputedDiff } from "@/lib/palm-readings/diff";
import type { PalmReadingRecord } from "@/lib/palm-readings/types";
import { useRouteMessages } from "@/lib/i18n-context";
import palmMessages from "@/messages/en.palm.json";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d.toDateString();
  }
}

function arrowFor(direction: "stronger" | "weaker" | "unchanged") {
  if (direction === "stronger") return "↑";
  if (direction === "weaker") return "↓";
  return "→";
}

type CompareResponse = {
  a: PalmReadingRecord;
  b: PalmReadingRecord;
  diff: ComputedDiff;
};

type Props = { ids: string };

export default function PalmCompareClient({ ids }: Props) {
  const tr = useRouteMessages(palmMessages);

  /* Row headings for the diff tables, and the one-word verdict beside each
     arrow. Both are ours rather than the model's, so both are translated. */
  const lineLabels = useMemo<Record<string, string>>(
    () => ({
      heart_line: tr("palm.lines.heartLine"),
      head_line: tr("palm.lines.headLine"),
      life_line: tr("palm.lines.lifeLine"),
      fate_line: tr("palm.lines.fateLine"),
    }),
    [tr],
  );

  const directionLabels = useMemo<
    Record<"stronger" | "weaker" | "unchanged", string>
  >(
    () => ({
      stronger: tr("palm.compare.direction.stronger"),
      weaker: tr("palm.compare.direction.weaker"),
      unchanged: tr("palm.compare.direction.unchanged"),
    }),
    [tr],
  );

  const parsedIds = useMemo(() => {
    return ids
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [ids]);

  const idsValid =
    parsedIds.length === 2 &&
    parsedIds[0] !== parsedIds[1] &&
    parsedIds.every((id) => UUID_RE.test(id));

  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load both readings from the local archive ──
  useEffect(() => {
    setData(null);

    if (!idsValid) {
      setLoading(false);
      setError(tr("palm.compare.errorSelectTwo"));
      return;
    }

    setLoading(true);
    setError(null);

    const [a, b] = getPalmReadingsByIds([parsedIds[0], parsedIds[1]]);
    if (!a || !b) {
      setError(tr("palm.compare.errorNotFound"));
    } else {
      setData({ a, b, diff: computeReadingDiff(a, b) });
    }
    setLoading(false);
  }, [idsValid, parsedIds, tr]);

  if (!idsValid) {
    return (
      <section className="palm-history-shell">
        <header className="palm-history-header">
          <h1>{tr("palm.compare.title")}</h1>
          <p className="palm-history-subtitle">
            {tr("palm.compare.mustSelectTwo")}
          </p>
        </header>
        <div className="palm-history-empty-cta">
          <Link href="/insights/palm-history" className="palm-btn-camera">
            {tr("palm.compare.pickReadings")}
          </Link>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="palm-history-shell">
        <header className="palm-history-header">
          <h1>{tr("palm.compare.loadingTitle")}</h1>
        </header>
        <div className="palm-compare-grid" aria-hidden="true">
          <div className="palm-compare-side">
            <div className="palm-skel-block" style={{ height: 220 }} />
            <div className="palm-skel-block" style={{ height: 60, marginTop: 12 }} />
          </div>
          <div className="palm-compare-side">
            <div className="palm-skel-block" style={{ height: 220 }} />
            <div className="palm-skel-block" style={{ height: 60, marginTop: 12 }} />
          </div>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="palm-history-shell">
        <header className="palm-history-header">
          <h1>{tr("palm.compare.title")}</h1>
        </header>
        <div className="palm-error" role="alert">
          {error ?? tr("palm.compare.loadFailed")}
        </div>
        <div className="palm-history-empty-cta">
          <Link href="/insights/palm-history" className="palm-btn-upload">
            {tr("palm.common.backToReadings")}
          </Link>
        </div>
      </section>
    );
  }

  const { a, b, diff } = data;
  const allLinesUnchanged = diff.line_strength_changes.every(
    (c) => c.direction === "unchanged",
  );

  return (
    <section className="palm-history-shell">
      {/* Header */}
      <header className="palm-history-header">
        <span className="palm-kicker">{tr("palm.compare.kicker")}</span>
        <h1>{tr("palm.compare.heading")}</h1>
        <p className="palm-history-subtitle">
          {formatDate(a.created_at)} &nbsp;·&nbsp; {formatDate(b.created_at)}
          {diff.days_apart > 0 && (
            <>
              {" "}
              &nbsp;·&nbsp;{" "}
              {diff.days_apart === 1
                ? tr("palm.compare.takenDayApart", {
                    count: String(diff.days_apart),
                  })
                : tr("palm.compare.takenDaysApart", {
                    count: String(diff.days_apart),
                  })}
            </>
          )}
        </p>
      </header>

      {/* Side-by-side images + summaries */}
      <div className="palm-compare-grid">
        {[a, b].map((rec, idx) => {
          const coords = rec.reading?.line_coordinates ?? {};
          const hasCoords = Object.values(coords).some(
            (pts) => Array.isArray(pts) && pts.length > 0,
          );
          const tag =
            idx === 0
              ? tr("palm.compare.readingA")
              : tr("palm.compare.readingB");
          return (
            <div key={rec.id} className="palm-compare-side">
              <header className="palm-compare-side-header">
                <span className="palm-compare-side-tag">{tag}</span>
                <span className="palm-compare-side-date">
                  {formatDate(rec.created_at)}
                </span>
              </header>
              {rec.title && (
                <h3 className="palm-compare-side-title">{rec.title}</h3>
              )}
              {rec.image_data_url && (
                <div className="palm-compare-side-image">
                  {hasCoords ? (
                    <PalmAnnotation
                      imageDataUrl={rec.image_data_url}
                      coordinates={coords}
                      showLabels={true}
                      highlightLine={null}
                    />
                  ) : (
                    <div className="palm-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={rec.image_data_url}
                        alt={tr("palm.alt.comparePalm", { tag })}
                      />
                    </div>
                  )}
                </div>
              )}
              {rec.reading?.overall_summary && (
                <div className="palm-summary-card palm-compare-side-summary">
                  <p>{rec.reading.overall_summary}</p>
                </div>
              )}
              <div className="palm-compare-side-link">
                <Link href={`/insights/palm-history/${rec.id}`}>
                  {tr("palm.compare.openFull")}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Diff panels */}
      <div className="palm-compare-diff">
        {/* Line strength changes */}
        <section className="palm-section-card">
          <h3>{tr("palm.compare.lineStrength")}</h3>
          {allLinesUnchanged ? (
            <p className="palm-section-lead">
              {tr("palm.compare.noStrengthChanges")}
            </p>
          ) : (
            <div className="palm-compare-table-scroll" tabIndex={0} role="region" aria-label={tr("palm.compare.lineStrengthAria")}>
              <table className="palm-compare-table">
                <thead>
                  <tr>
                    <th>{tr("palm.compare.colLine")}</th>
                    <th>{tr("palm.compare.readingA")}</th>
                    <th>{tr("palm.compare.readingB")}</th>
                    <th>{tr("palm.compare.colChange")}</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.line_strength_changes.map((c) => (
                    <tr key={c.line}>
                      <th scope="row">{lineLabels[c.line] ?? c.line}</th>
                      <td>{c.from}</td>
                      <td>{c.to}</td>
                      <td>
                        <span
                          className={`palm-compare-arrow palm-compare-arrow--${c.direction}`}
                          aria-label={directionLabels[c.direction]}
                        >
                          {arrowFor(c.direction)} {directionLabels[c.direction]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Line visibility changes */}
        {diff.line_visibility_changes.length > 0 && (
          <section className="palm-section-card">
            <h3>{tr("palm.compare.lineVisibility")}</h3>
            <div className="palm-compare-table-scroll" tabIndex={0} role="region" aria-label={tr("palm.compare.lineVisibilityAria")}>
              <table className="palm-compare-table">
                <thead>
                  <tr>
                    <th>{tr("palm.compare.colLine")}</th>
                    <th>{tr("palm.compare.readingA")}</th>
                    <th>{tr("palm.compare.readingB")}</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.line_visibility_changes.map((c) => (
                    <tr key={c.line}>
                      <th scope="row">{lineLabels[c.line] ?? c.line}</th>
                      <td>{c.from}</td>
                      <td>{c.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Special markings delta */}
        {(diff.new_special_markings.length > 0 ||
          diff.lost_special_markings.length > 0) && (
          <section className="palm-section-card">
            <h3>{tr("palm.compare.specialMarkings")}</h3>
            <div className="palm-compare-delta-grid">
              <div className="palm-compare-marking-list palm-compare-marking-list--new">
                <h4>{tr("palm.compare.newlyVisible")}</h4>
                {diff.new_special_markings.length === 0 ? (
                  <p className="palm-compare-empty">{tr("palm.compare.none")}</p>
                ) : (
                  <ul>
                    {diff.new_special_markings.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="palm-compare-marking-list palm-compare-marking-list--lost">
                <h4>{tr("palm.compare.noLongerVisible")}</h4>
                {diff.lost_special_markings.length === 0 ? (
                  <p className="palm-compare-empty">{tr("palm.compare.none")}</p>
                ) : (
                  <ul>
                    {diff.lost_special_markings.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Prominent mounts delta */}
        {(diff.new_prominent_mounts.length > 0 ||
          diff.lost_prominent_mounts.length > 0) && (
          <section className="palm-section-card">
            <h3>{tr("palm.compare.prominentMounts")}</h3>
            <div className="palm-compare-delta-grid">
              <div className="palm-compare-marking-list palm-compare-marking-list--new">
                <h4>{tr("palm.compare.newlyProminent")}</h4>
                {diff.new_prominent_mounts.length === 0 ? (
                  <p className="palm-compare-empty">{tr("palm.compare.none")}</p>
                ) : (
                  <ul>
                    {diff.new_prominent_mounts.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="palm-compare-marking-list palm-compare-marking-list--lost">
                <h4>{tr("palm.compare.noLongerProminent")}</h4>
                {diff.lost_prominent_mounts.length === 0 ? (
                  <p className="palm-compare-empty">{tr("palm.compare.none")}</p>
                ) : (
                  <ul>
                    {diff.lost_prominent_mounts.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Summary contrast */}
        <section className="palm-section-card">
          <h3>{tr("palm.compare.summaryContrast")}</h3>
          <div className="palm-compare-summary-grid">
            <blockquote className="palm-compare-quote">
              <span className="palm-compare-quote-tag">
                {tr("palm.compare.readingA")}
              </span>
              <p>
                {diff.summary_diff.a_summary || tr("palm.compare.noSummary")}
              </p>
            </blockquote>
            <blockquote className="palm-compare-quote">
              <span className="palm-compare-quote-tag">
                {tr("palm.compare.readingB")}
              </span>
              <p>
                {diff.summary_diff.b_summary || tr("palm.compare.noSummary")}
              </p>
            </blockquote>
          </div>
        </section>
      </div>
    </section>
  );
}
