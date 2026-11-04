"use client";

import { useState } from "react";
import {
  ASK_TYPED_MAX_LENGTH,
  ASK_TYPED_MIN_LENGTH,
  type AskQuestionId,
  type AskRefusal,
} from "@/lib/knowledge/ask-questions";
import { useTranslation } from "@/lib/i18n-context";
import { ReadingProgress } from "@/app/(desktop)/insights/components/reading-progress";
import { useAskClassics, type AskAnswer } from "@/app/(desktop)/insights/life-areas/use-ask-classics";
import { MobileCitedReading } from "./mobile-cited-reading";
import styles from "./mobile-tabs.module.css";

type Translate = (key: string, params?: Record<string, string>) => string;

/* Literal, so the catalog tests can find each key. */
const REFUSALS: Record<AskRefusal, string> = {
  instructions: "mobileInsights.ask.refusedInstructions",
  forbidden_topic: "mobileInsights.ask.refusedForbidden",
  not_about_chart: "mobileInsights.ask.refusedNotAboutChart",
};

/* A typed question is screened, then answered: about 12s, as on the desktop. */
const ANSWER_EXPECTED_MS = 12_000;

/**
 * "Ask the classics" on the phone: the desktop life areas page's questions,
 * through the same hook and route, drawn in this tree's look. Only the fixed
 * questions the books can answer for this chart are offered, and the tab
 * says so plainly when that cannot be found out.
 */
export function MobileAsk({ historyQs, tr }: { historyQs: string; tr: Translate }) {
  const { language } = useTranslation();
  const { available, unavailable, answerFor, ask, typed, askTyped } = useAskClassics(historyQs);
  const [showing, setShowing] = useState<AskQuestionId | "typed" | null>(null);
  const [draft, setDraft] = useState("");

  const typing = typed?.answer.status === "pending";
  const question = draft.trim();
  const answer: AskAnswer | undefined =
    showing === "typed" ? typed?.answer : showing ? answerFor(showing, language) : undefined;
  const heading = showing === "typed" ? typed?.text : showing ? tr(`mobileInsights.ask.questions.${showing}`) : undefined;

  return (
    <section className={styles.ask} aria-labelledby="m-ask-heading">
      <p className={styles.cardKicker}>{tr("mobileInsights.ask.kicker")}</p>
      <h2 id="m-ask-heading" className={styles.askHeading}>
        {tr("mobileInsights.ask.heading")}
      </h2>
      <p className={styles.askLead}>{tr("mobileInsights.ask.lead")}</p>

      {available === null ? (
        <p className={styles.askMessage} role="status">
          {tr("mobileInsights.ask.loading")}
        </p>
      ) : (
        !unavailable &&
        available.length > 0 && (
          <div className={styles.askChips} role="group" aria-label={tr("mobileInsights.ask.chooseLabel")}>
            {available.map((id) => (
              <button
                key={id}
                type="button"
                className={styles.askChip}
                aria-pressed={showing === id}
                onClick={() => {
                  setShowing(id);
                  ask(id, language);
                }}
              >
                {tr(`mobileInsights.ask.questions.${id}`)}
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
        <label htmlFor="m-ask-own" className={styles.askLabel}>
          {tr("mobileInsights.ask.ownLabel")}
        </label>
        <div className={styles.askRow}>
          <input
            id="m-ask-own"
            type="text"
            className={styles.askInput}
            value={draft}
            maxLength={ASK_TYPED_MAX_LENGTH}
            placeholder={tr("mobileInsights.ask.ownPlaceholder")}
            aria-describedby="m-ask-own-hint"
            enterKeyHint="send"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="submit"
            className={styles.askSubmit}
            disabled={typing || question.length < ASK_TYPED_MIN_LENGTH}
          >
            {tr("mobileInsights.ask.submit")}
          </button>
        </div>
        <p id="m-ask-own-hint" className={styles.askHint}>
          {tr("mobileInsights.ask.ownHint", { max: String(ASK_TYPED_MAX_LENGTH) })}
        </p>
      </form>

      {answer && (
        <div className={styles.answer} aria-live="polite">
          {heading && <h3 className={styles.answerHeading}>{heading}</h3>}
          {answer.status === "pending" && (
            <div className={styles.progressHost}>
              <ReadingProgress label={tr("mobileInsights.askPending")} expectedMs={ANSWER_EXPECTED_MS} />
            </div>
          )}
          {answer.status === "ready" && <MobileCitedReading reading={answer.reading} tr={tr} />}
          {answer.status === "empty" && <p className={styles.askMessage}>{tr("mobileInsights.ask.empty")}</p>}
          {answer.status === "refused" && (
            <p className={styles.askMessage} role="alert">
              {tr(REFUSALS[answer.reason])}
            </p>
          )}
          {answer.status === "limited" && (
            <p className={styles.askMessage} role="alert">
              {answer.signIn ? tr("mobileInsights.ask.limitedSignIn") : tr("mobileInsights.ask.limited")}
            </p>
          )}
          {answer.status === "failed" && (
            <p className={styles.askMessage} role="alert">
              {tr("mobileInsights.ask.failed")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
