"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getPalmReading, updatePalmReading } from "@/lib/palm-readings/local-store";
import PalmAnnotation from "@/app/(desktop)/insights/components/PalmAnnotation";
import type {
  PalmLineReading,
  PalmReadingJSON,
  PalmReadingRecord,
} from "@/lib/palm-readings/types";

/* ──────────────────────────────────────────────────────────
   Helpers / constants (mirroring palm-reading-panel where useful)
   ────────────────────────────────────────────────────────── */

const STRENGTH_COLORS: Record<PalmLineReading["strength"], string> = {
  strong: "var(--accent-aqua)",
  moderate: "var(--accent-gold)",
  faint: "var(--accent-coral)",
  absent: "#888",
};

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

/** Some persisted records may have stored richer image_quality / classical-framework
 *  shapes than the canonical types in lib/palm-readings/types.ts. We tolerate either. */
type AnyImageQuality = {
  rating?: string;
  notes?: string;
  reliable_for_reading?: boolean;
  issues?: unknown;
};

type AnyClassicalNotes =
  | string
  | {
      framework?: string;
      sanskrit_terms?: Array<{
        term?: string;
        meaning?: string;
        observation?: string;
      }>;
      classical_text_references?: string[];
    };

type ExtendedReading = PalmReadingJSON & {
  image_quality?: AnyImageQuality;
  classical_framework_notes?: AnyClassicalNotes;
  jyotish_correlation?: PalmReadingJSON["jyotish_correlation"] & {
    summary?: string;
    correlations?: Array<{
      palm_indicator?: string;
      chart_factor?: string;
      reinforcement?: string;
      reading?: string;
    }>;
  };
  dasha_relevance?: PalmReadingJSON["dasha_relevance"] & {
    active_period_summary?: string;
    relevant_palm_indicators?: Array<{
      indicator?: string;
      relevance_to_dasha?: string;
      timing_note?: string;
    }>;
  };
};

/* ──────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────── */

type Props = { id: string };

export default function PalmReadingDetailClient({ id }: Props) {
  const router = useRouter();
  const [record, setRecord] = useState<PalmReadingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable title / notes state
  const [titleDraft, setTitleDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleSaveState, setTitleSaveState] =
    useState<"idle" | "saving" | "saved" | "error">("idle");
  const [notesSaveState, setNotesSaveState] =
    useState<"idle" | "saving" | "saved" | "error">("idle");

  const titleInputRef = useRef<HTMLInputElement>(null);

  // ── Load the reading from the local archive ──
  useEffect(() => {
    setError(null);

    const found = getPalmReading(id);
    if (!found) {
      setError("Reading not found.");
    } else {
      setRecord(found);
      setTitleDraft(found.title ?? "");
      setNotesDraft(found.notes ?? "");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  // ── Save title / notes ──
  const persistMetadata = useCallback(
    (
      patch: { title?: string | null; notes?: string | null },
      kind: "title" | "notes",
    ) => {
      if (!record) return;
      const setState =
        kind === "title" ? setTitleSaveState : setNotesSaveState;
      setState("saving");
      try {
        const updated = updatePalmReading(record.id, patch);
        if (!updated) {
          throw new Error(`Failed to save ${kind}.`);
        }
        setState("saved");
        setRecord(updated);
        // Reset to idle after a beat
        window.setTimeout(() => setState("idle"), 1600);
      } catch {
        setState("error");
      }
    },
    [record],
  );

  const onTitleBlur = useCallback(() => {
    setEditingTitle(false);
    if (!record) return;
    const trimmed = titleDraft.trim();
    const next = trimmed.length > 0 ? trimmed : null;
    const current = record.title ?? null;
    if (next === current) return;
    void persistMetadata({ title: next }, "title");
  }, [titleDraft, record, persistMetadata]);

  const onNotesBlur = useCallback(() => {
    if (!record) return;
    const trimmed = notesDraft.trim();
    const next = trimmed.length > 0 ? trimmed : null;
    const current = record.notes ?? null;
    if (next === current) return;
    void persistMetadata({ notes: next }, "notes");
  }, [notesDraft, record, persistMetadata]);

  // ── Memoize pieces of the reading ──
  const reading = record?.reading as ExtendedReading | undefined;

  const lineCoordsObj = useMemo(() => reading?.line_coordinates ?? {}, [reading]);
  const hasAnyCoords = useMemo(
    () =>
      Object.values(lineCoordsObj).some(
        (pts) => Array.isArray(pts) && pts.length > 0,
      ),
    [lineCoordsObj],
  );

  if (loading) {
    return (
      <section className="palm-history-shell">
        <header className="palm-history-header">
          <h1>Loading reading…</h1>
        </header>
        <div className="palm-skeleton">
          <div className="palm-skel-block palm-skel-summary" />
          <div className="palm-skel-grid">
            <div className="palm-skel-block" />
            <div className="palm-skel-block" />
            <div className="palm-skel-block" />
            <div className="palm-skel-block" />
          </div>
        </div>
      </section>
    );
  }

  if (error || !record || !reading) {
    return (
      <section className="palm-history-shell">
        <header className="palm-history-header">
          <h1>Palm Reading</h1>
        </header>
        <div className="palm-error" role="alert">
          {error ?? "This reading could not be loaded."}
        </div>
        <div className="palm-history-empty-cta">
          <Link href="/insights/palm-history" className="palm-btn-upload">
            Back to your readings
          </Link>
        </div>
      </section>
    );
  }

  const iq = reading.image_quality as AnyImageQuality | undefined;
  const showQualityWarning =
    !!iq &&
    (iq.reliable_for_reading === false ||
      (typeof iq.rating === "string" && iq.rating === "marginal"));

  // ── Main render ──
  return (
    <section className="palm-history-shell">
      {/* Header with date & editable title */}
      <header className="palm-detail-header">
        <span className="palm-history-card-date">
          {formatDate(record.created_at)}
        </span>
        <div className="palm-detail-title-edit">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              className="palm-detail-title-input"
              value={titleDraft}
              maxLength={200}
              placeholder="Untitled reading"
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={onTitleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setTitleDraft(record.title ?? "");
                  setEditingTitle(false);
                }
              }}
              aria-label="Reading title"
            />
          ) : (
            <button
              type="button"
              className="palm-detail-title-button"
              onClick={() => setEditingTitle(true)}
              title="Click to edit title"
            >
              <h1>{record.title?.trim() || "Untitled reading"}</h1>
              <span className="palm-detail-title-edit-hint">Edit</span>
            </button>
          )}
          {titleSaveState === "saving" && (
            <span className="palm-detail-save-state">Saving…</span>
          )}
          {titleSaveState === "saved" && (
            <span className="palm-detail-save-state palm-detail-save-state--ok">
              Saved ✓
            </span>
          )}
          {titleSaveState === "error" && (
            <span className="palm-detail-save-state palm-detail-save-state--err">
              Couldn't save
            </span>
          )}
        </div>
        {record.classical_mode && (
          <span className="palm-history-card-badge">
            Hasta Samudrika Shastra
          </span>
        )}
      </header>

      {/* Image quality — subtle */}
      {showQualityWarning && iq && (
        <div
          className="palm-image-warning palm-image-warning--soft"
          role="note"
        >
          <div className="palm-image-warning-head">
            <AlertTriangle size={16} aria-hidden="true" />
            <span className="palm-image-warning-title">
              Image quality was marked as{" "}
              {iq.rating ? iq.rating : "marginal"} when this reading was taken
            </span>
          </div>
          {iq.notes && <p className="palm-image-warning-notes">{iq.notes}</p>}
        </div>
      )}

      {/* Annotated image */}
      {record.image_data_url && (
        <div className="palm-section-card palm-section-card--annotated">
          {hasAnyCoords ? (
            <>
              <h3>Palm</h3>
              <PalmAnnotation
                imageDataUrl={record.image_data_url}
                coordinates={lineCoordsObj}
                showLabels={true}
                highlightLine={null}
              />
            </>
          ) : (
            <div className="palm-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={record.image_data_url} alt="Saved palm" />
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {(reading.overall_summary || reading.dominant_hand_note) && (
        <div className="palm-summary-card">
          <h3>Overall Summary</h3>
          {reading.overall_summary && <p>{reading.overall_summary}</p>}
          {reading.dominant_hand_note && (
            <p className="palm-hand-note">
              <em>{reading.dominant_hand_note}</em>
            </p>
          )}
        </div>
      )}

      {/* Lines */}
      {reading.lines && (
        <div className="palm-lines-grid">
          {(Object.entries(reading.lines) as [string, PalmLineReading][]).map(
            ([key, line]) => {
              const conf = reading.line_confidence?.[key as keyof NonNullable<
                PalmReadingJSON["line_confidence"]
              >];
              return (
                <div
                  key={key}
                  className="palm-line-card"
                  style={{
                    borderLeftColor: STRENGTH_COLORS[line.strength] ?? "#888",
                  }}
                >
                  <div className="palm-line-header">
                    <h4>{LINE_LABELS[key] || key}</h4>
                    <span className={`palm-strength palm-strength--${line.strength}`}>
                      {line.strength}
                    </span>
                  </div>
                  {conf && (
                    <div className="palm-line-confidence">
                      Confidence:{" "}
                      <strong>
                        {conf.visibility.replace(/_/g, " ")}
                        {typeof conf.confidence === "number"
                          ? ` (${Math.round(conf.confidence * 100)}%)`
                          : ""}
                      </strong>
                    </div>
                  )}
                  {line.description && (
                    <p className="palm-line-desc">{line.description}</p>
                  )}
                  {line.interpretation && (
                    <p className="palm-line-interp">{line.interpretation}</p>
                  )}
                </div>
              );
            },
          )}
        </div>
      )}

      {/* Trajectory */}
      {reading.life_trajectory && (
        <div className="palm-trajectory-hero">
          <h3>Life Trajectory</h3>
          <div className="palm-trajectory-grid">
            {reading.life_trajectory.current_phase && (
              <div className="palm-trajectory-item">
                <span className="palm-trajectory-label">Current Phase</span>
                <p>{reading.life_trajectory.current_phase}</p>
              </div>
            )}
            {reading.life_trajectory.near_future && (
              <div className="palm-trajectory-item">
                <span className="palm-trajectory-label">Near Future</span>
                <p>{reading.life_trajectory.near_future}</p>
              </div>
            )}
            {reading.life_trajectory.long_term_path && (
              <div className="palm-trajectory-item">
                <span className="palm-trajectory-label">Long-Term Path</span>
                <p>{reading.life_trajectory.long_term_path}</p>
              </div>
            )}
            {reading.life_trajectory.challenges && (
              <div className="palm-trajectory-item palm-trajectory-item--challenge">
                <span className="palm-trajectory-label">Challenges</span>
                <p>{reading.life_trajectory.challenges}</p>
              </div>
            )}
            {reading.life_trajectory.opportunities && (
              <div className="palm-trajectory-item palm-trajectory-item--opportunity">
                <span className="palm-trajectory-label">Opportunities</span>
                <p>{reading.life_trajectory.opportunities}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Jyotish correlation */}
      {reading.jyotish_correlation && (
        <div className="palm-section-card palm-section-card--jyotish">
          <h3>Chart &times; Palm Synthesis</h3>
          {reading.jyotish_correlation.summary && (
            <p className="palm-section-lead">
              {reading.jyotish_correlation.summary}
            </p>
          )}
          {Array.isArray(reading.jyotish_correlation.correlations) &&
            reading.jyotish_correlation.correlations.length > 0 && (
              <ul className="palm-correlation-list">
                {reading.jyotish_correlation.correlations.map((c, i) => (
                  <li key={i} className="palm-correlation-item">
                    <div className="palm-correlation-row">
                      {c.palm_indicator && (
                        <span className="palm-correlation-palm">
                          {c.palm_indicator}
                        </span>
                      )}
                      {c.chart_factor && (
                        <>
                          <span className="palm-correlation-link">&harr;</span>
                          <span className="palm-correlation-chart">
                            {c.chart_factor}
                          </span>
                        </>
                      )}
                      {c.reinforcement && (
                        <span
                          className={`palm-reinforcement palm-reinforcement--${c.reinforcement}`}
                        >
                          {c.reinforcement}
                        </span>
                      )}
                    </div>
                    {c.reading && (
                      <p className="palm-correlation-reading">{c.reading}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}

      {/* Dasha relevance */}
      {reading.dasha_relevance && (
        <div className="palm-section-card palm-section-card--dasha">
          <h3>Active Dasha Lens</h3>
          {reading.dasha_relevance.active_period_summary && (
            <p className="palm-section-lead">
              {reading.dasha_relevance.active_period_summary}
            </p>
          )}
          {Array.isArray(reading.dasha_relevance.relevant_palm_indicators) &&
            reading.dasha_relevance.relevant_palm_indicators.length > 0 && (
              <ul className="palm-dasha-list">
                {reading.dasha_relevance.relevant_palm_indicators.map(
                  (item, i) => (
                    <li key={i} className="palm-dasha-item">
                      {item.indicator && (
                        <h4 className="palm-dasha-indicator">
                          {item.indicator}
                        </h4>
                      )}
                      {item.relevance_to_dasha && (
                        <p>{item.relevance_to_dasha}</p>
                      )}
                      {item.timing_note && (
                        <p className="palm-dasha-timing">
                          <em>{item.timing_note}</em>
                        </p>
                      )}
                    </li>
                  ),
                )}
              </ul>
            )}
        </div>
      )}

      {/* Career */}
      {reading.career_and_purpose && (
        <div className="palm-section-card palm-section-card--career">
          <h3>Career &amp; Life Purpose</h3>
          {reading.career_and_purpose.natural_talents && (
            <div className="palm-subsection">
              <h4>Natural Talents</h4>
              <p>{reading.career_and_purpose.natural_talents}</p>
            </div>
          )}
          {reading.career_and_purpose.career_direction && (
            <div className="palm-subsection">
              <h4>Career Direction</h4>
              <p>{reading.career_and_purpose.career_direction}</p>
            </div>
          )}
          {reading.career_and_purpose.purpose_alignment && (
            <div className="palm-subsection">
              <h4>Purpose Alignment</h4>
              <p>{reading.career_and_purpose.purpose_alignment}</p>
            </div>
          )}
        </div>
      )}

      {/* Relationships */}
      {reading.relationships_and_emotional && (
        <div className="palm-section-card palm-section-card--relationships">
          <h3>Relationships &amp; Emotional Landscape</h3>
          {reading.relationships_and_emotional.emotional_state && (
            <div className="palm-subsection">
              <h4>Emotional State</h4>
              <p>{reading.relationships_and_emotional.emotional_state}</p>
            </div>
          )}
          {reading.relationships_and_emotional.relationship_dynamics && (
            <div className="palm-subsection">
              <h4>Relationship Dynamics</h4>
              <p>
                {reading.relationships_and_emotional.relationship_dynamics}
              </p>
            </div>
          )}
          {reading.relationships_and_emotional.connection_style && (
            <div className="palm-subsection">
              <h4>Connection Style</h4>
              <p>{reading.relationships_and_emotional.connection_style}</p>
            </div>
          )}
        </div>
      )}

      {/* Health */}
      {reading.health_and_vitality && (
        <div className="palm-section-card palm-section-card--health">
          <h3>Health &amp; Vitality</h3>
          {reading.health_and_vitality.energy_levels && (
            <div className="palm-subsection">
              <h4>Energy Levels</h4>
              <p>{reading.health_and_vitality.energy_levels}</p>
            </div>
          )}
          {reading.health_and_vitality.stress_indicators && (
            <div className="palm-subsection">
              <h4>Stress Indicators</h4>
              <p>{reading.health_and_vitality.stress_indicators}</p>
            </div>
          )}
          {reading.health_and_vitality.wellness_advice && (
            <div className="palm-subsection">
              <h4>Wellness Advice</h4>
              <p>{reading.health_and_vitality.wellness_advice}</p>
            </div>
          )}
        </div>
      )}

      {/* Mounts */}
      {reading.mounts && (
        <div className="palm-section-card">
          <h3>Mounts</h3>
          {Array.isArray(reading.mounts.prominent) &&
            reading.mounts.prominent.length > 0 && (
              <div className="palm-chips">
                {reading.mounts.prominent.map((m) => (
                  <span key={m} className="palm-chip">
                    {m}
                  </span>
                ))}
              </div>
            )}
          {reading.mounts.interpretation && (
            <p>{reading.mounts.interpretation}</p>
          )}
        </div>
      )}

      {/* Fingers */}
      {reading.fingers && (
        <div className="palm-section-card">
          <h3>Fingers</h3>
          {reading.fingers.observation && (
            <p className="palm-observation">{reading.fingers.observation}</p>
          )}
          {reading.fingers.interpretation && (
            <p>{reading.fingers.interpretation}</p>
          )}
        </div>
      )}

      {/* Special markings */}
      {reading.special_markings && (
        <div className="palm-section-card">
          <h3>Special Markings</h3>
          {Array.isArray(reading.special_markings.observed) &&
            reading.special_markings.observed.length > 0 && (
              <div className="palm-chips">
                {reading.special_markings.observed.map((m) => (
                  <span key={m} className="palm-chip">
                    {m}
                  </span>
                ))}
              </div>
            )}
          {reading.special_markings.interpretation && (
            <p>{reading.special_markings.interpretation}</p>
          )}
        </div>
      )}

      {/* Classical framework notes */}
      {reading.classical_framework_notes && (() => {
        const cfn = reading.classical_framework_notes as AnyClassicalNotes;
        if (typeof cfn === "string") {
          return (
            <div className="palm-section-card palm-section-card--classical">
              <h3>Hasta Samudrika Shastra Framework</h3>
              <p>{cfn}</p>
            </div>
          );
        }
        const sanskritTerms = Array.isArray(cfn.sanskrit_terms)
          ? cfn.sanskrit_terms
          : [];
        const classicalRefs = Array.isArray(cfn.classical_text_references)
          ? cfn.classical_text_references
          : [];
        if (sanskritTerms.length === 0 && classicalRefs.length === 0) {
          return null;
        }
        return (
          <div className="palm-section-card palm-section-card--classical">
            <h3>Hasta Samudrika Shastra Framework</h3>
            {sanskritTerms.length > 0 && (
              <ul className="palm-sanskrit-list">
                {sanskritTerms.map((t, i) => (
                  <li
                    key={`${t.term ?? "term"}-${i}`}
                    className="palm-sanskrit-item"
                  >
                    {t.term && (
                      <span className="palm-sanskrit-term">{t.term}</span>
                    )}
                    {t.meaning && (
                      <span className="palm-sanskrit-meaning">
                        {t.meaning}
                      </span>
                    )}
                    {t.observation && (
                      <p className="palm-sanskrit-observation">
                        {t.observation}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {classicalRefs.length > 0 && (
              <div className="palm-classical-refs">
                {classicalRefs.map((ref, i) => (
                  <span
                    key={`${ref}-${i}`}
                    className="palm-chip palm-chip--ref"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Guidance */}
      {reading.guidance && (
        <div className="palm-guidance">
          <h3>Guidance</h3>
          <p>{reading.guidance}</p>
        </div>
      )}

      {/* Notes — editable */}
      <div className="palm-section-card palm-detail-notes-card">
        <h3>Your Notes</h3>
        <p className="palm-section-lead palm-detail-notes-help">
          Private notes for yourself — anything you want to remember about this
          reading.
        </p>
        <textarea
          className="palm-detail-notes"
          value={notesDraft}
          placeholder="Add a note…"
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={onNotesBlur}
          rows={5}
        />
        <div className="palm-detail-notes-state">
          {notesSaveState === "saving" && <span>Saving…</span>}
          {notesSaveState === "saved" && (
            <span className="palm-detail-save-state--ok">Notes saved ✓</span>
          )}
          {notesSaveState === "error" && (
            <span className="palm-detail-save-state--err">
              Couldn't save notes
            </span>
          )}
        </div>
      </div>

      {/* Compare CTA */}
      <div className="palm-history-toolbar palm-history-toolbar--bottom">
        <Link
          href={`/insights/palm-history?compareWith=${record.id}`}
          className="palm-history-compare-cta"
        >
          Compare with another reading &rarr;
        </Link>
      </div>
    </section>
  );
}
