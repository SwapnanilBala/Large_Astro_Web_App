"use client";

import type { KalatraFacet, KalatraResult } from "@/lib/engines/kalatra-engine";
import styles from "./life-areas.module.css";

/*
 * The married-life detail, under the love_life area only.
 *
 * Five facets the domain summary above deliberately does not go near, each read
 * from its own bhava and karaka. The panel's job is mostly to keep the
 * derivation visible: every finding shows the chart fact it fired on, and every
 * facet names the houses it was read from, because this is the material a
 * reader is most likely to want to argue with.
 */

type KalatraPanelProps = {
  detail: KalatraResult;
  /** Route-catalog translator, passed down so the panel needs no hook of its own. */
  tr: (key: string, params?: Record<string, string>) => string;
};

const POLARITY_MARK: Record<string, string> = {
  support: "+",
  pressure: "−",
  context: "·",
};

function Facet({ facet, tr }: { facet: KalatraFacet; tr: KalatraPanelProps["tr"] }) {
  return (
    <article className={styles.kalatraCard}>
      <header className={styles.kalatraCardHead}>
        <div>
          <strong>{facet.label}</strong>
          <small>{tr(`lifeAreas.kalatraBand.${facet.band}`)}</small>
        </div>
        {/* The score is a meter, not a grade: it exists so the five facets can
            be compared against each other at a glance. Labelled as such rather
            than left as a bare number. */}
        <div
          className={styles.kalatraMeter}
          role="img"
          aria-label={tr("lifeAreas.kalatraMeterLabel", {
            label: facet.label,
            score: String(facet.score),
          })}
        >
          <span style={{ width: `${facet.score}%` }} data-band={facet.band} />
        </div>
      </header>

      <p className={styles.kalatraSummary}>{facet.summary}</p>

      {facet.findings.length > 0 && (
        <ul className={styles.kalatraFindings}>
          {facet.findings.map((finding) => (
            <li key={finding.basis} data-polarity={finding.polarity}>
              <span className={styles.kalatraMark} aria-hidden="true">
                {POLARITY_MARK[finding.polarity]}
              </span>
              <div>
                <p>{finding.text}</p>
                <cite>{finding.basis}</cite>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.kalatraSourcing}>
        <span>{tr("lifeAreas.kalatraReadFrom")}</span> {facet.sourcing}
      </p>
    </article>
  );
}

export default function KalatraPanel({ detail, tr }: KalatraPanelProps) {
  return (
    <section className={styles.kalatra} aria-labelledby="kalatra-heading">
      <div className={styles.kalatraHeader}>
        <h3 id="kalatra-heading">{tr("lifeAreas.kalatraHeading")}</h3>
        <span>{tr("lifeAreas.kalatraNote")}</span>
      </div>

      <div className={styles.kalatraGrid}>
        {detail.facets.map((facet) => (
          <Facet key={facet.key} facet={facet} tr={tr} />
        ))}
      </div>

      <details className={styles.kalatraMethod}>
        <summary>{tr("lifeAreas.kalatraMethodSummary")}</summary>
        <div>
          <p>{detail.method}</p>
          {detail.mangal.present && (
            <p>
              {tr("lifeAreas.kalatraMangalCaveat")}
              {detail.mangal.cancellations.length > 0 && (
                <>
                  {" "}
                  {tr("lifeAreas.kalatraMangalCancelled", {
                    list: detail.mangal.cancellations.join("; "),
                  })}
                </>
              )}
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
