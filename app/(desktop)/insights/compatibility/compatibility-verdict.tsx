"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import type { CompatibilityResponse } from "@/lib/engines/compatibility-service";

/*
 * The verdict band and the tabbed evidence below it.
 *
 * The results section used to be one column four sections tall: score, themes,
 * married life, then every inter-chart aspect. Each of those is a different
 * altitude of the same answer, and stacking them meant the reader scrolled
 * past the summary to reach detail they might not want, while the one number
 * they came for sat alone in a card with nothing around it to interpret it.
 *
 * So: the judgement and the evidence separate. The band is what you read if
 * you read nothing else -- the score, and three tiles that say what the score
 * is made of. The three sections underneath become tabs, because they are
 * alternatives rather than a sequence: nobody needs the married-life read and
 * the raw aspect graph at the same moment.
 *
 * EVERY TILE IS COUNTED FROM ENGINE OUTPUT. That constraint is the whole
 * reason the tiles are these three and not more interesting ones. The obvious
 * fourth -- an elemental or dominant-modality read -- would have to be derived
 * from two sun signs, which is a thinner basis than it would look at that size
 * on the page. `CompatibilityTheme.confidence_score` is likewise off limits:
 * it is a hardcoded constant in compatibility-service.ts, and its percentage
 * badge was already removed once for presenting an authored guess as a
 * measurement. A stat tile is the most measurement-looking component there is,
 * so it is the last place that number should reappear.
 */

type VerdictTilesProps = {
  aspects: CompatibilityResponse["synastry_aspects"];
  /* The API response types this as optional as well as nullable, so the tile
     has to tolerate both absences rather than only the one the engine emits. */
  kalatra: CompatibilityResponse["kalatra_synastry"] | undefined;
};

export function VerdictTiles({ aspects, kalatra }: VerdictTilesProps) {
  const supportive = aspects.filter((a) => a.harmonious).length;
  const friction = aspects.length - supportive;

  /* Widest orb wins nothing; the tightest contact is the one doing the most
     work in the reading, and it is the single most useful fact in this whole
     array. */
  const tightest = aspects.reduce<CompatibilityResponse["synastry_aspects"][number] | null>(
    (best, aspect) => (best === null || aspect.orb < best.orb ? aspect : best),
    null,
  );

  const findings = kalatra?.facets.flatMap((facet) => facet.findings) ?? [];
  const clear = findings.filter((f) => f.polarity === "clear").length;
  const caution = findings.filter((f) => f.polarity === "caution").length;

  return (
    <dl className="verdict-tiles">
      <div className="verdict-tile">
        <dt>Balance</dt>
        <dd>
          <span className="verdict-tile-strong">{supportive}</span> supportive
          <span className="verdict-tile-sep">·</span>
          <span className="verdict-tile-strong">{friction}</span> friction
        </dd>
      </div>

      {tightest && (
        <div className="verdict-tile">
          <dt>Tightest contact</dt>
          <dd>
            <span className="verdict-tile-strong">
              {tightest.primary_planet} {tightest.aspect_type} {tightest.partner_planet}
            </span>
            <span className="verdict-tile-sep">·</span>
            {tightest.orb.toFixed(2)}&deg;
          </dd>
        </div>
      )}

      {findings.length > 0 && (
        <div className="verdict-tile">
          <dt>Married life</dt>
          <dd>
            <span className="verdict-tile-strong">{clear}</span> clear
            <span className="verdict-tile-sep">·</span>
            <span className="verdict-tile-strong">{caution}</span> caution
          </dd>
        </div>
      )}
    </dl>
  );
}

/* ------------------------------------------------------------------------- */

export type ResultTab = {
  id: string;
  label: string;
  panel: ReactNode;
};

/**
 * A tablist over the three evidence sections.
 *
 * Roles and `aria-selected` rather than styled buttons, plus arrow-key
 * movement between tabs and the roving tabindex that pattern requires -- a
 * tablist that cannot be driven from the keyboard is a worse control than the
 * four stacked headings it replaced, which at least anyone could reach.
 *
 * Panels are unmounted rather than hidden. The aspect graph is an SVG with a
 * line per contact, and keeping it mounted behind two other tabs would have it
 * laying out and painting for readers who never open it.
 */
export function ResultTabs({ tabs }: { tabs: ResultTab[] }) {
  const [active, setActive] = useState(0);
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const last = tabs.length - 1;
      let next: number | null = null;
      if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
      else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = last;
      if (next === null) return;
      event.preventDefault();
      setActive(next);
      refs.current[next]?.focus();
    },
    [tabs.length],
  );

  if (tabs.length === 0) return null;
  const current = tabs[Math.min(active, tabs.length - 1)];

  return (
    <div className="verdict-tabs">
      <div className="verdict-tablist" role="tablist" aria-label="Compatibility evidence">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            aria-controls={`${baseId}-panel-${tab.id}`}
            aria-selected={index === active}
            tabIndex={index === active ? 0 : -1}
            className={`verdict-tab${index === active ? " is-active" : ""}`}
            onClick={() => setActive(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${current.id}`}
        aria-labelledby={`${baseId}-tab-${current.id}`}
        tabIndex={0}
        className="verdict-tabpanel"
      >
        {current.panel}
      </div>
    </div>
  );
}
