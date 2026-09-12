/**
 * The moment a signed-out visitor runs out of free readings.
 *
 * Four panels can reach it — the dasha drill-down, the life-area briefs, the
 * palm reader and its follow-up questions — and none of them should carry its
 * own copy of the wording
 * or its own idea of what to do about it. So they announce, one component
 * mounted in the desktop shell listens, and the panels stay ignorant of the
 * prompt entirely.
 *
 * A window event rather than a context, matching lib/chart-sync-store.ts: the
 * publishers are lazily-imported panels several levels down from the listener,
 * and threading a provider through them to move one boolean is more wiring
 * than the thing being wired.
 */

/** The routes that spend money, named as the visitor met them. */
export type PaidFeature =
  | "dashaInterpretation"
  | "domainBrief"
  | "palmReading"
  | "palmQuestions";

const FREE_USAGE_EXHAUSTED_EVENT = "astro:free-usage-exhausted";

/**
 * The budget scope out of a refusal, or null if this was not one.
 *
 * `clone()` because the caller still owns the body: several of these panels
 * read the error message themselves, and a helper that quietly consumed the
 * stream would break them in a way that only shows up on the error path.
 */
export async function readBudgetRefusalScope(response: Response): Promise<string | null> {
  if (response.status !== 429) return null;
  try {
    const body: unknown = await response.clone().json();
    const details = (body as { error?: { details?: { scope?: unknown } } })?.error?.details;
    return typeof details?.scope === "string" ? details.scope : null;
  } catch {
    /* A 429 without a JSON body is still a refusal, just not one we can
       attribute. Silence is right: the panel's own fallback handles it. */
    return null;
  }
}

/**
 * Raise the sign-in prompt if `response` refused for want of an account.
 *
 * Returns whether it did, so a caller can skip its own error handling for the
 * case the prompt has now taken over. Only `anonymous` triggers it — the other
 * two scopes are ceilings signing in would not lift, and offering an account as
 * the remedy for those would be a lie.
 */
export async function announceIfFreeUsageExhausted(
  response: Response,
  feature: PaidFeature,
): Promise<boolean> {
  const scope = await readBudgetRefusalScope(response);
  if (scope !== "anonymous") return false;

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<PaidFeature>(FREE_USAGE_EXHAUSTED_EVENT, { detail: feature }),
    );
  }
  return true;
}

export function subscribeToFreeUsage(listener: (feature: PaidFeature) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onEvent = (event: Event) => {
    listener((event as CustomEvent<PaidFeature>).detail);
  };

  window.addEventListener(FREE_USAGE_EXHAUSTED_EVENT, onEvent);
  return () => window.removeEventListener(FREE_USAGE_EXHAUSTED_EVENT, onEvent);
}
