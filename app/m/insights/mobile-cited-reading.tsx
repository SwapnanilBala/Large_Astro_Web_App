"use client";

import { Fragment } from "react";
import { WOMENS_BOOK_SLUG, readingParagraphs, type ClassicalReading } from "@/lib/knowledge/classical-reading";
import styles from "./mobile-tabs.module.css";

type Translate = (key: string, params?: Record<string, string>) => string;

/*
 * A reading written from the classics, in the phone's own look: its
 * paragraphs, each statement followed by the number of the passage it rests
 * on, and the passages themselves under a disclosure, quoted as printed. The
 * desktop's ClassicalNote draws the same thing from insights-global.css,
 * which this tree does not load.
 */
export function MobileCitedReading({ reading, tr }: { reading: ClassicalReading; tr: Translate }) {
  const fromWomensBook = (book: string) => book === WOMENS_BOOK_SLUG;
  const quotesWomensBook = reading.sources.some((source) => fromWomensBook(source.book));
  const quotesOtherBooks = reading.sources.some((source) => !fromWomensBook(source.book));

  return (
    <>
      <div className={styles.cited}>
        {readingParagraphs(reading).map((pieces, index) => (
          <p key={index}>
            {pieces.map((piece, pieceIndex) => (
              <Fragment key={pieceIndex}>
                {piece.text}
                {piece.sources.length > 0 && <sup className={styles.mark}>{piece.sources.join(",")}</sup>}
              </Fragment>
            ))}
          </p>
        ))}
      </div>

      {reading.sources.length > 0 && (
        <details className={styles.sources}>
          <summary>{tr("mobileInsights.sources.label", { count: String(reading.sources.length) })}</summary>
          <ol>
            {reading.sources.map((source) => (
              <li key={source.number}>
                <span className={styles.sourceRef}>
                  {fromWomensBook(source.book)
                    ? tr("mobileInsights.sources.refStrijataka", { ref: source.ref })
                    : tr("mobileInsights.sources.ref", { ref: source.ref })}
                  {source.kind === "note" && ` · ${tr("mobileInsights.sources.note")}`}
                </span>
                {/* Quoted in the books' English whatever the page language. */}
                <q lang="en">{source.text}</q>
              </li>
            ))}
          </ol>
          {quotesOtherBooks && <p className={styles.credit}>{tr("mobileInsights.sources.credit")}</p>}
          {quotesWomensBook && <p className={styles.credit}>{tr("mobileInsights.sources.creditStrijataka")}</p>}
        </details>
      )}
    </>
  );
}
