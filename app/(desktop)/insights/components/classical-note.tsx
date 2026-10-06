"use client";

import { Fragment } from "react";
import { WOMENS_BOOK_SLUG, readingParagraphs, type ClassicalReading } from "@/lib/knowledge/classical-reading";

/**
 * "From the classics": what the books say, with every statement numbered
 * against the passage it rests on and the passages printed underneath as the
 * books have them. The yoga section's note and each life area's are this card;
 * they differ in what they ask for and in their strings, which each keeps in
 * its own route catalog under `prefix`, with the keys in CLASSICAL_NOTE_KEYS
 * beneath it, and for the life areas, which can quote the book on women's
 * charts, WOMENS_BOOK_NOTE_KEYS too.
 *
 * The card holds its place while the note is written (several seconds on a
 * cold chart) so the content below does not jump when it lands, and it
 * disappears on any failure or when the book has nothing for this chart: the
 * page is complete without it.
 */

export type ClassicalNoteState = "pending" | "ready" | "empty" | "failed";

type ClassicalNoteProps = {
  state: ClassicalNoteState;
  reading: ClassicalReading | null;
  /** A route-catalog translator and the prefix this card's strings sit under. */
  tr: (key: string, params?: Record<string, string>) => string;
  prefix: string;
  /** A heading of the card's own, in place of the prefix's: the question an answer is to. */
  heading?: string;
  headingId: string;
  className?: string;
};

export function ClassicalNote({ state, reading, tr, prefix, heading, headingId, className }: ClassicalNoteProps) {
  if (state === "empty" || state === "failed") return null;
  if (state === "ready" && !reading) return null;

  /* Each book gets its own credit, shown when the reading quotes it. */
  const fromWomensBook = (book: string) => book === WOMENS_BOOK_SLUG;
  const quotesWomensBook = reading?.sources.some((source) => fromWomensBook(source.book)) ?? false;
  const quotesOtherBooks = reading?.sources.some((source) => !fromWomensBook(source.book)) ?? false;

  return (
    <section
      className={className ? `classical-note ${className}` : "classical-note"}
      aria-labelledby={headingId}
      aria-busy={state === "pending"}
    >
      <p className="kicker">{tr(`${prefix}.kicker`)}</p>
      <h3 id={headingId} className="classical-note-heading">
        {heading ?? tr(`${prefix}.heading`)}
      </h3>

      {state === "ready" && reading ? (
        <>
          <div className="classical-note-reading">
            {readingParagraphs(reading).map((pieces, index) => (
              <p key={index}>
                {pieces.map((piece, pieceIndex) => (
                  <Fragment key={pieceIndex}>
                    {piece.text}
                    {piece.sources.length > 0 && <sup className="classical-note-mark">{piece.sources.join(",")}</sup>}
                  </Fragment>
                ))}
              </p>
            ))}
          </div>

          {/* Closed by default: the note is the card, the verses are its evidence. */}
          <details className="classical-note-verses">
            <summary>{tr(`${prefix}.sourcesLabel`, { count: String(reading.sources.length) })}</summary>
            <ol className="classical-note-sources">
              {reading.sources.map((source) => (
                <li key={source.number}>
                  <span className="classical-note-source-ref">
                    {fromWomensBook(source.book)
                      ? tr(`${prefix}.sourceRefStrijataka`, { ref: source.ref })
                      : tr(`${prefix}.sourceRef`, { ref: source.ref })}
                    {source.kind === "note" && ` · ${tr(`${prefix}.noteLabel`)}`}
                  </span>
                  {/* Quoted in the books' English whatever the page language. */}
                  <q className="classical-note-source-text" lang="en">
                    {source.text}
                  </q>
                </li>
              ))}
            </ol>
          </details>

          {quotesOtherBooks && <p className="classical-note-credit">{tr(`${prefix}.credit`)}</p>}
          {quotesWomensBook && <p className="classical-note-credit">{tr(`${prefix}.creditStrijataka`)}</p>}
        </>
      ) : (
        <div className="classical-note-pending" role="status">
          <p>{tr(`${prefix}.pending`)}</p>
          <span className="classical-note-bar" aria-hidden="true" />
          <span className="classical-note-bar" aria-hidden="true" />
          <span className="classical-note-bar classical-note-bar--short" aria-hidden="true" />
        </div>
      )}
    </section>
  );
}
