/**
 * The navbar's account label, and where this device remembers it.
 *
 * A plain module rather than part of use-account.ts, because the desktop
 * layout is a server component: a constant imported from a "use client" file
 * reaches it as a client reference, not as the string. See use-account.ts for
 * when the label is written and cleared, and app/(desktop)/layout.tsx for the
 * script that reads it before first paint.
 */
import type { Account } from "@/lib/use-account";

/** What the navbar shows for an account: the name, or the address without one. */
export function accountLabel(account: Account): string {
  return account.displayName ?? account.email;
}

/**
 * localStorage key for the last signed-in account on this device, stored as
 * {@link StoredAccountLabel} JSON.
 */
export const ACCOUNT_LABEL_KEY = "lagna-account-label";

/** The label, and when a session check last confirmed it (ms since epoch). */
export type StoredAccountLabel = { label: string; at: number };

/**
 * How long a stored label is trusted before first paint.
 *
 * A session lasts 30 days from its last refresh (SESSION_MAX_AGE_SECONDS in
 * lib/identity/session.ts), and a refresh happens at most once a day, so a
 * label confirmed less than 29 days ago belongs to a session that is still
 * live unless something revoked it. Past that, the pre-paint script ignores
 * the label. Someone back after the session lapsed then gets the signed-out
 * shape straight away, rather than a signed-in stand-in that collapses (0.11
 * of layout shift on the intake page, where the welcome panel's room is held
 * as well). Kept here rather than imported from session.ts, which pulls in
 * the database; lib/__tests__/account-label.test.ts keeps the two in step.
 */
export const ACCOUNT_LABEL_MAX_AGE_MS = 29 * 24 * 60 * 60 * 1000;
