"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import PalmAnnotation from "@/app/insights/components/PalmAnnotation";
import type { ComputedDiff } from "@/lib/palm-readings/diff";
import type { PalmReadingRecord } from "@/lib/palm-readings/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LINE_LABELS: Record<string, string> = {
  heart_line: "Heart Line",
  head_line: "Head Line",
  life_line: "Life Line",
  fate_line: "Fate Line",
};

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
  const router = useRouter();
  const { token, isAuthenticated, isLoading: authLoading, isPremium } = useAuth();

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

  // ── Auth gate ──
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace(
        `/login?returnTo=${encodeURIComponent(
          `/insights/palm-history/compare?ids=${ids}`,
        )}`,
      );
    }
  }, [authLoading, isAuthenticated, router, ids]);

  // ── Fetch ──
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !token) return;
    if (!isPremium) {
      setLoading(false);
      return;
    }
    if (!idsValid) {
      setLoading(false);
      setError("Select exactly two readings to compare.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const url = `/api/palm-readings/compare?ids=${parsedIds[0]},${parsedIds[1]}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (res.status === 404)
            throw new Error("One or both readings could not be found.");
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err && (err.error?.message || err.detail)) ||
              "Failed to load comparison.",
          );
        }
        const body = (await res.json()) as CompareResponse;
        if (cancelled) return;
        if (!body || !body.a || !body.b || !body.diff) {
          throw new Error("Comparison response was malformed.");
        }
        setData(body);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "Failed to load comparison.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, isPremium, token, idsValid, parsedIds]);

  // ── Auth-gated states ──
  if (authLoading) {
    return (
      <section className="palm-history-shell">
        <p className="palm-history-subtitle">Checking your session…</p>
      </section>
    );
  }
  if (!isAuthenticated) return null;

  if (!isPremium) {
    return (
      <section className="palm-history-shell">
        <header className="palm-history-header">
          <h1>Compare palm readings</h1>
        </header>
        <div className="palm-history-empty">
          <p>Compare is part of the Pro plan.</p>
          <div className="palm-history-empty-cta">
            <Link href="/pricing" className="palm-btn-camera">
              See plans
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!idsValid) {
    return (
      <section className="palm-history-shell">
        <header className="palm-history-header">
          <h1>Compare palm readings</h1>
          <p className="palm-history-subtitle">
            You must select two readings to compare.
          </p>
        </header>
        <div className="palm-history-empty-cta">
          <Link href="/insights/palm-history" className="palm-btn-camera">
            Pick readings
          </Link>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="palm-history-shell">
        <header className="palm-history-header">
          <h1>Comparing two readings…</h1>
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
          <h1>Compare palm readings</h1>
        </header>
        <div className="palm-error" role="alert">
          {error ?? "We couldn't load this comparison."}
        </div>
        <div className="palm-history-empty-cta">
          <Link href="/insights/palm-history" className="palm-btn-upload">
            Back to your readings
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
        <span className="palm-kicker">Side-by-side</span>
        <h1>Comparing two readings</h1>
        <p className="palm-history-subtitle">
          {formatDate(a.created_at)} &nbsp;·&nbsp; {formatDate(b.created_at)}
          {diff.days_apart > 0 && (
            <>
              {" "}
              &nbsp;·&nbsp; Taken {diff.days_apart} day
              {diff.days_apart === 1 ? "" : "s"} apart
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
          const tag = idx === 0 ? "Reading A" : "Reading B";
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
                      <img src={rec.image_data_url} alt={`${tag} palm`} />
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
                  Open full reading &rarr;
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
          <h3>Line strength</h3>
          {allLinesUnchanged ? (
            <p className="palm-section-lead">
              No strength changes across the four major lines.
            </p>
          ) : (
            <table className="palm-compare-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Reading A</th>
                  <th>Reading B</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {diff.line_strength_changes.map((c) => (
                  <tr key={c.line}>
                    <th scope="row">{LINE_LABELS[c.line] ?? c.line}</th>
                    <td>{c.from}</td>
                    <td>{c.to}</td>
                    <td>
                      <span
                        className={`palm-compare-arrow palm-compare-arrow--${c.direction}`}
                        aria-label={c.direction}
                      >
                        {arrowFor(c.direction)} {c.direction}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Line visibility changes */}
        {diff.line_visibility_changes.length > 0 && (
          <section className="palm-section-card">
            <h3>Line visibility</h3>
            <table className="palm-compare-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Reading A</th>
                  <th>Reading B</th>
                </tr>
              </thead>
              <tbody>
                {diff.line_visibility_changes.map((c) => (
                  <tr key={c.line}>
                    <th scope="row">{LINE_LABELS[c.line] ?? c.line}</th>
                    <td>{c.from}</td>
                    <td>{c.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Special markings delta */}
        {(diff.new_special_markings.length > 0 ||
          diff.lost_special_markings.length > 0) && (
          <section className="palm-section-card">
            <h3>Special markings</h3>
            <div className="palm-compare-delta-grid">
              <div className="palm-compare-marking-list palm-compare-marking-list--new">
                <h4>Newly visible</h4>
                {diff.new_special_markings.length === 0 ? (
                  <p className="palm-compare-empty">None</p>
                ) : (
                  <ul>
                    {diff.new_special_markings.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="palm-compare-marking-list palm-compare-marking-list--lost">
                <h4>No longer visible</h4>
                {diff.lost_special_markings.length === 0 ? (
                  <p className="palm-compare-empty">None</p>
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
            <h3>Prominent mounts</h3>
            <div className="palm-compare-delta-grid">
              <div className="palm-compare-marking-list palm-compare-marking-list--new">
                <h4>Newly prominent</h4>
                {diff.new_prominent_mounts.length === 0 ? (
                  <p className="palm-compare-empty">None</p>
                ) : (
                  <ul>
                    {diff.new_prominent_mounts.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="palm-compare-marking-list palm-compare-marking-list--lost">
                <h4>No longer prominent</h4>
                {diff.lost_prominent_mounts.length === 0 ? (
                  <p className="palm-compare-empty">None</p>
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
          <h3>Summary contrast</h3>
          <div className="palm-compare-summary-grid">
            <blockquote className="palm-compare-quote">
              <span className="palm-compare-quote-tag">Reading A</span>
              <p>{diff.summary_diff.a_summary || "(no summary)"}</p>
            </blockquote>
            <blockquote className="palm-compare-quote">
              <span className="palm-compare-quote-tag">Reading B</span>
              <p>{diff.summary_diff.b_summary || "(no summary)"}</p>
            </blockquote>
          </div>
        </section>
      </div>
    </section>
  );
}
