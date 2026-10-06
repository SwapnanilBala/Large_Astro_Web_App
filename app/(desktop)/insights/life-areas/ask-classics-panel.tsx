"use client";

import { useState } from "react";
import { ClassicalNote } from "@/app/(desktop)/insights/components/classical-note";
import type { AskQuestionId } from "@/lib/knowledge/ask-questions";
import { useTranslation } from "@/lib/i18n-context";
import { useAskClassics } from "./use-ask-classics";
import styles from "./life-areas.module.css";

/*
 * "Ask the classics": a row of questions a reader can put to the books, and
 * the answer to the one they pick, written from the passages that apply to
 * their chart and cited verse by verse in the same card as the life areas'
 * notes.
 *
 * English only for now: the answers are written in English, so the panel is
 * not shown in another language, and its strings are in the route catalog's
 * English alone. When the answers learn other languages, its keys get their
 * translations and this card joins the CARDS list in
 * lib/__tests__/classical-note-catalogs.test.ts.
 *
 * Only the questions the books can answer for this chart are offered; with
 * none, or when that cannot be found out, the panel does not appear.
 */

type AskClassicsPanelProps = {
  historyQs: string;
  /** The life-areas route catalog's translator. */
  tr: (key: string, params?: Record<string, string>) => string;
};

export function AskClassicsPanel({ historyQs, tr }: AskClassicsPanelProps) {
  const { language } = useTranslation();
  const english = language === "en";
  const { available, answers, ask } = useAskClassics(historyQs, english);
  const [selected, setSelected] = useState<AskQuestionId | null>(null);

  if (!english) return null;
  if (available !== null && available.length === 0) return null;

  const answer = selected ? answers[selected] : undefined;

  return (
    <section className={styles.askCard} aria-labelledby="ask-classics-heading">
      <div className={styles.askHeader}>
        <p className={styles.kicker}>{tr("lifeAreas.ask.kicker")}</p>
        <h2 id="ask-classics-heading">{tr("lifeAreas.ask.heading")}</h2>
        <p className={styles.askLead}>{tr("lifeAreas.ask.lead")}</p>
      </div>

      {available === null ? (
        <p className={styles.askMessage} role="status">
          {tr("lifeAreas.ask.loading")}
        </p>
      ) : (
        <div className={styles.domainChips} role="group" aria-label={tr("lifeAreas.ask.chooseLabel")}>
          {available.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={selected === id}
              className={selected === id ? styles.domainChipActive : styles.domainChip}
              onClick={() => {
                setSelected(id);
                ask(id);
              }}
            >
              {tr(`lifeAreas.ask.questions.${id}`)}
            </button>
          ))}
        </div>
      )}

      {selected && answer && (answer.status === "pending" || answer.status === "ready") && (
        <ClassicalNote
          state={answer.status}
          reading={answer.status === "ready" ? answer.reading : null}
          tr={tr}
          prefix="lifeAreas.ask.note"
          heading={tr(`lifeAreas.ask.questions.${selected}`)}
          headingId="ask-classics-answer-heading"
          className="classical-note--single"
        />
      )}
      {selected && answer?.status === "empty" && (
        <p className={styles.askMessage}>{tr("lifeAreas.ask.empty")}</p>
      )}
      {selected && answer?.status === "limited" && (
        <p className={styles.askMessage} role="alert">
          {tr(answer.signIn ? "lifeAreas.ask.limitedSignIn" : "lifeAreas.ask.limited")}
        </p>
      )}
      {selected && answer?.status === "failed" && (
        <p className={styles.askMessage} role="alert">
          {tr("lifeAreas.ask.failed")}
        </p>
      )}
    </section>
  );
}
