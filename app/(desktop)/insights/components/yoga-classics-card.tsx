"use client";

import { Fragment } from "react";
import type { YogaDetectionResult } from "@/lib/astro-types";
import { useRouteMessages, useTranslation } from "@/lib/i18n-context";
import { readingParagraphs } from "@/lib/knowledge/yoga-classics";
import strengthMessages from "@/messages/en.strength.json";
import { useYogaClassics } from "./use-yoga-classics";

/**
 * "From the classics": what the Brihat Jataka says about this chart's yogas,
 * with every statement numbered against the verse it rests on and the verses
 * printed underneath as the 1885 translation has them.
 *
 * The card holds its place while the note is written (several seconds on a
 * cold chart) so the yoga list below does not jump when it lands, and it
 * disappears on any failure or when the book names none of the chart's
 * yogas: the list is complete without it.
 */
export function YogaClassicsCard({ yogas }: { yogas: YogaDetectionResult[] }) {
  const { language } = useTranslation();
  const tr = useRouteMessages(strengthMessages);
  const { state, reading } = useYogaClassics(yogas, language);

  if (state === "empty" || state === "failed") return null;

  return (
    <section
      className="yoga-classics"
      aria-labelledby="yoga-classics-heading"
      aria-busy={state === "pending"}
    >
      <p className="kicker">{tr("strength.yogas.classics.kicker")}</p>
      <h3 id="yoga-classics-heading" className="yoga-classics-heading">
        {tr("strength.yogas.classics.heading")}
      </h3>

      {state === "ready" && reading ? (
        <>
          <div className="yoga-classics-reading">
            {readingParagraphs(reading).map((pieces, index) => (
              <p key={index}>
                {pieces.map((piece, pieceIndex) => (
                  <Fragment key={pieceIndex}>
                    {piece.text}
                    {piece.sources.length > 0 && (
                      <sup className="yoga-classics-mark">{piece.sources.join(",")}</sup>
                    )}
                  </Fragment>
                ))}
              </p>
            ))}
          </div>

          {/* Closed by default: the note is the card, the verses are its evidence. */}
          <details className="yoga-classics-verses">
            <summary>
              {tr("strength.yogas.classics.sourcesLabel", { count: String(reading.sources.length) })}
            </summary>
            <ol className="yoga-classics-sources">
              {reading.sources.map((source) => (
                <li key={source.number}>
                  <span className="yoga-classics-source-ref">
                    {tr("strength.yogas.classics.sourceRef", { ref: source.ref })}
                    {source.kind === "note" && ` · ${tr("strength.yogas.classics.noteLabel")}`}
                  </span>
                  {/* Quoted in the 1885 English whatever the page language. */}
                  <q className="yoga-classics-source-text" lang="en">
                    {source.text}
                  </q>
                </li>
              ))}
            </ol>
          </details>

          <p className="yoga-classics-credit">{tr("strength.yogas.classics.credit")}</p>
        </>
      ) : (
        <div className="yoga-classics-pending" role="status">
          <p>{tr("strength.yogas.classics.pending")}</p>
          <span className="yoga-classics-bar" aria-hidden="true" />
          <span className="yoga-classics-bar" aria-hidden="true" />
          <span className="yoga-classics-bar yoga-classics-bar--short" aria-hidden="true" />
        </div>
      )}
    </section>
  );
}
