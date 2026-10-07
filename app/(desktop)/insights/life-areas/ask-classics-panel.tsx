"use client";

import { useState } from "react";
import { ClassicalNote } from "@/app/(desktop)/insights/components/classical-note";
import {
  ASK_TYPED_MAX_LENGTH,
  ASK_TYPED_MIN_LENGTH,
  type AskQuestionId,
  type AskRefusal,
} from "@/lib/knowledge/ask-questions";
import { useTranslation } from "@/lib/i18n-context";
import { useAskClassics, type AskAnswer } from "./use-ask-classics";
import styles from "./life-areas.module.css";

/*
 * "Ask the classics": a row of questions a reader can put to the books, a box
 * to type their own, and the answer to whichever they asked last, written from
 * the passages that apply to their chart, in their language, and cited verse
 * by verse in the same card as the life areas' notes (whose strings it shares,
 * under lifeAreas.classics, with the question as its heading).
 *
 * Only the fixed questions the books can answer for this chart are offered.
 * The panel does not appear when that cannot be found out.
 */

/* Literal, so the catalog test can find each key. */
const REFUSALS: Record<AskRefusal, string> = {
  instructions: "lifeAreas.ask.refusedInstructions",
  forbidden_topic: "lifeAreas.ask.refusedForbidden",
  not_about_chart: "lifeAreas.ask.refusedNotAboutChart",
};

type AskClassicsPanelProps = {
  historyQs: string;
  /** The life-areas route catalog's translator. */
  tr: (key: string, params?: Record<string, string>) => string;
};

export function AskClassicsPanel({ historyQs, tr }: AskClassicsPanelProps) {
  const { language } = useTranslation();
  const { available, unavailable, answerFor, ask, typed, askTyped } = useAskClassics(historyQs);
  /* What the answer area shows: a fixed question, or the typed one. */
  const [showing, setShowing] = useState<AskQuestionId | "typed" | null>(null);
  const [draft, setDraft] = useState("");

  if (unavailable) return null;

  const typing = typed?.answer.status === "pending";
  const question = draft.trim();
  const answer: AskAnswer | undefined =
    showing === "typed" ? typed?.answer : showing ? answerFor(showing, language) : undefined;
  const heading = showing === "typed" ? typed?.text : showing ? tr(`lifeAreas.ask.questions.${showing}`) : undefined;

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
        available.length > 0 && (
          <div className={styles.domainChips} role="group" aria-label={tr("lifeAreas.ask.chooseLabel")}>
            {available.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={showing === id}
                className={showing === id ? styles.domainChipActive : styles.domainChip}
                onClick={() => {
                  setShowing(id);
                  ask(id, language);
                }}
              >
                {tr(`lifeAreas.ask.questions.${id}`)}
              </button>
            ))}
          </div>
        )
      )}

      <form
        className={styles.askForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (typing || question.length < ASK_TYPED_MIN_LENGTH) return;
          setShowing("typed");
          askTyped(question, language);
        }}
      >
        <label htmlFor="ask-classics-own" className={styles.askFormLabel}>
          {tr("lifeAreas.ask.ownLabel")}
        </label>
        <div className={styles.askFormRow}>
          <input
            id="ask-classics-own"
            type="text"
            className={styles.askInput}
            value={draft}
            maxLength={ASK_TYPED_MAX_LENGTH}
            placeholder={tr("lifeAreas.ask.ownPlaceholder")}
            aria-describedby="ask-classics-own-hint"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="submit"
            className={`btn-sm ${styles.askSubmit}`}
            disabled={typing || question.length < ASK_TYPED_MIN_LENGTH}
          >
            {tr("lifeAreas.ask.ownSubmit")}
          </button>
        </div>
        <p id="ask-classics-own-hint" className={styles.askHint}>
          {tr("lifeAreas.ask.ownHint", { max: String(ASK_TYPED_MAX_LENGTH) })}
        </p>
      </form>

      {answer && (answer.status === "pending" || answer.status === "ready") && (
        <ClassicalNote
          state={answer.status}
          reading={answer.status === "ready" ? answer.reading : null}
          tr={tr}
          prefix="lifeAreas.classics"
          heading={heading}
          headingId="ask-classics-answer-heading"
          className="classical-note--single"
        />
      )}
      {answer?.status === "empty" && <p className={styles.askMessage}>{tr("lifeAreas.ask.empty")}</p>}
      {answer?.status === "refused" && (
        <p className={styles.askMessage} role="alert">
          {tr(REFUSALS[answer.reason])}
        </p>
      )}
      {answer?.status === "limited" && (
        <p className={styles.askMessage} role="alert">
          {tr(answer.signIn ? "lifeAreas.ask.limitedSignIn" : "lifeAreas.ask.limited")}
        </p>
      )}
      {answer?.status === "failed" && (
        <p className={styles.askMessage} role="alert">
          {tr("lifeAreas.ask.failed")}
        </p>
      )}
    </section>
  );
}
