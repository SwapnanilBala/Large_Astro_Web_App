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
const PROMPT_SEEN_KEY = "astro_free_usage_prompt_seen";
const PROMPT_MUTED_KEY = "astro_free_usage_prompt_muted";

/* Memory keeps dismissal working if this browser blocks storage. */
let seenDay = "";
let mutedDay = "";

function localDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/** Claim the one prompt for this browser session and local calendar day.
 * Session storage survives page navigation and reloads; an explicit daily mute
 * lives in local storage so it also applies to new tabs and browser sessions. */
export function claimFreeUsagePrompt(): boolean {
  if (typeof window === "undefined") return false;
  const today = localDay();
  if (seenDay === today || mutedDay === today) return false;
  try {
    if (window.localStorage.getItem(PROMPT_MUTED_KEY) === today) return false;
  } catch { /* The in-memory mute still applies. */ }
  try {
    if (window.sessionStorage.getItem(PROMPT_SEEN_KEY) === today) return false;
  } catch { /* The in-memory claim still applies. */ }

  seenDay = today;
  try {
    window.sessionStorage.setItem(PROMPT_SEEN_KEY, today);
  } catch { /* Already claimed in memory. */ }
  return true;
}

export function setFreeUsagePromptMutedForToday(muted: boolean): void {
  if (typeof window === "undefined") return;
  const today = localDay();
  mutedDay = muted ? today : "";
  try {
    if (muted) window.localStorage.setItem(PROMPT_MUTED_KEY, today);
    else if (window.localStorage.getItem(PROMPT_MUTED_KEY) === today) {
      window.localStorage.removeItem(PROMPT_MUTED_KEY);
    }
  } catch { /* Keep this page's in-memory mute. */ }
}

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
