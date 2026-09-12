"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouteMessages } from "@/lib/i18n-context";
import { announceIfFreeUsageExhausted } from "@/lib/free-usage-store";
import palmMessages from "@/messages/en.palm.json";
import type { JyotishContext, PalmReadingJSON } from "@/lib/palm-readings/types";

/*
 * Follow-up questions about the reading on screen.
 *
 * The reading answers "what does my hand show". This answers "so what does
 * that mean for me", which is the part a fixed JSON schema cannot reach and
 * the part people actually want. It is a thin client over
 * /api/palm-reading/ask: the whole thread is held here and replayed on each
 * turn, because readings live on the device and the server keeps no copy.
 *
 * That replay is why the server re-derives everything it sends to the model
 * from a closed field list rather than trusting this component -- see
 * lib/palm-readings/prompt-context.ts. Nothing in this file is a security
 * boundary, and it should not grow into one: the caps below are here to keep
 * the UI honest about the server's limits, not to enforce them.
 */

const MAX_QUESTION_CHARS = 500;

/** Matches MAX_HISTORY_TURNS on the server; the server trims, this just warns. */
const MAX_TURNS = 12;

type Turn = { role: "user" | "assistant"; content: string; offTopic?: boolean };

type PalmQaPanelProps = {
  reading: PalmReadingJSON;
  jyotishContext?: JyotishContext;
  classicalMode: boolean;
};

/*
 * Openers, chosen so the first tap lands on something the reading can actually
 * answer. A blank box after a long document is a real drop-off point: people
 * do not know what this thing is willing to be asked, and the honest way to
 * tell them is to show three questions rather than describe the rules.
 */
const STARTER_KEYS = [
  "palm.qa.starterCareer",
  "palm.qa.starterTiming",
  "palm.qa.starterStrength",
] as const;

export default function PalmQaPanel({
  reading,
  jyotishContext,
  classicalMode,
}: PalmQaPanelProps) {
  const tr = useRouteMessages(palmMessages);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const atLimit = turns.filter((turn) => turn.role === "user").length * 2 >= MAX_TURNS;

  /* Keep the newest exchange in view. Guarded on there being something to
     scroll, so the first render does not yank the page. */
  useEffect(() => {
    if (turns.length === 0) return;
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  const ask = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || pending) return;

      setError(null);
      setDraft("");
      setPending(true);

      /* The question goes up optimistically, and the history sent with it is
         the thread as it stood BEFORE this question -- the server appends the
         new one itself. Sending it twice is the obvious bug here. */
      const priorTurns = turns.map(({ role, content }) => ({ role, content }));
      setTurns((previous) => [...previous, { role: "user", content: question }]);

      try {
        const response = await fetch("/api/palm-reading/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reading,
            jyotishContext,
            classicalMode,
            history: priorTurns,
            question,
          }),
        });

        if (!response.ok) {
          /* Before the body is read, because this clones it: a refused free
             allowance raises the sign-in dialog, exactly as the reading itself
             does. The inline error below still appears -- the dialog is the
             call to action, the message is what remains once it is gone. */
          void announceIfFreeUsageExhausted(response, "palmQuestions");
        }

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          /* The route sends a usable sentence for the cases a reader can act
             on -- out of questions for today, sign in for more -- so prefer it
             over our generic copy when it is there. */
          setError(payload?.error?.message ?? tr("palm.qa.errorGeneric"));
          /* Take the optimistic question back out: leaving it in a thread that
             never got an answer reads as though it was ignored. */
          setTurns((previous) => previous.slice(0, -1));
          setDraft(question);
          return;
        }

        setTurns((previous) => [
          ...previous,
          {
            role: "assistant",
            content: payload.answer,
            offTopic: payload.offTopic === true,
          },
        ]);

        /* Put the cursor back. A follow-up usually follows an answer, and
           without this the reader has to click the box again every turn --
           which is exactly the friction that ends a conversation at one
           question. Harmless if the box has since been replaced by the
           thread-full notice; the ref is null then. */
        inputRef.current?.focus();
      } catch {
        setError(tr("palm.qa.errorGeneric"));
        setTurns((previous) => previous.slice(0, -1));
        setDraft(question);
      } finally {
        setPending(false);
      }
    },
    [classicalMode, jyotishContext, pending, reading, tr, turns],
  );

  return (
    <section className="palm-qa" aria-labelledby="palm-qa-heading">
      <h3 id="palm-qa-heading">{tr("palm.qa.heading")}</h3>
      <p className="palm-qa-lead">{tr("palm.qa.lead")}</p>

      {turns.length > 0 && (
        <div className="palm-qa-thread" ref={threadRef}>
          {turns.map((turn, index) => (
            <div
              key={index}
              className={[
                "palm-qa-turn",
                `palm-qa-turn--${turn.role}`,
                turn.offTopic ? "palm-qa-turn--offtopic" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <p>{turn.content}</p>
            </div>
          ))}
          {pending && (
            <div
              className="palm-qa-turn palm-qa-turn--assistant palm-qa-turn--pending"
              /* The thread is the live region rather than this node, so a
                 screen reader hears the answer when it lands instead of only
                 hearing that something is loading. */
              aria-live="polite"
            >
              <p>{tr("palm.qa.thinking")}</p>
            </div>
          )}
        </div>
      )}

      {turns.length === 0 && !pending && (
        <div className="palm-qa-starters">
          {STARTER_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className="palm-qa-starter"
              onClick={() => ask(tr(key))}
            >
              {tr(key)}
            </button>
          ))}
        </div>
      )}

      {atLimit ? (
        <p className="palm-qa-limit">{tr("palm.qa.threadFull")}</p>
      ) : (
        <div className="palm-qa-compose">
          <textarea
            ref={inputRef}
            className="palm-qa-input"
            value={draft}
            maxLength={MAX_QUESTION_CHARS}
            placeholder={tr("palm.qa.placeholder")}
            aria-label={tr("palm.qa.inputLabel")}
            rows={2}
            disabled={pending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              /* Enter sends, Shift+Enter breaks the line. Standard for a chat
                 box, and the textarea is here for the second one. */
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask(draft);
              }
            }}
          />
          <button
            type="button"
            className="palm-qa-send"
            disabled={pending || draft.trim().length === 0}
            onClick={() => void ask(draft)}
          >
            {pending ? tr("palm.qa.sending") : tr("palm.qa.send")}
          </button>
        </div>
      )}

      {error && (
        <p className="palm-qa-error" role="alert">
          {error}
        </p>
      )}

      <p className="palm-qa-footnote">{tr("palm.qa.footnote")}</p>
    </section>
  );
}
