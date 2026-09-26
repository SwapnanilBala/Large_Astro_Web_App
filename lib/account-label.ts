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

/** localStorage key for the last signed-in account's label on this device. */
export const ACCOUNT_LABEL_KEY = "lagna-account-label";
