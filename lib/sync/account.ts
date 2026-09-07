import "server-only";

/**
 * Which account does this request read and write?
 *
 * One answer now, where there used to be two. `workspaces` sat between
 * `auth_users` and the data so that a browser with no login still had a tenant
 * row to write into: an anonymous `anon:<device>` member and a signed-in
 * `user:<id>` member were the same shape, and signing in claimed the device's
 * workspace instead of migrating out of it. Migration 0006 removed that layer,
 * because Google is now the only way in and there is no second kind of subject
 * left for the indirection to abstract over.
 *
 * State the cost rather than discovering it later: **a visitor who has not
 * signed in has nowhere on the server to put a chart.** Guest persistence was a
 * real feature and it is gone. `lib/local-scope.ts` still keeps their charts in
 * the browser, so nothing breaks on the device in front of them — but that data
 * no longer survives a cleared browser and never reaches a second device.
 *
 * The find/ensure split this module used to carry is gone with it. It existed
 * so that a read could not bring a workspace into existence just because a
 * crawler loaded a page; a session cannot exist without the `auth_users` row it
 * points at, so there is no longer anything for a read to create by accident.
 */

import { SESSION_COOKIE, resolveSession } from "@/lib/identity/session";

export type RequestAccount = {
  userId: string;
};

/** The subset of NextRequest.cookies this module needs. */
export type CookieReader = {
  get(name: string): { value: string } | undefined;
};

/**
 * The account this request belongs to, or null when nobody is signed in.
 *
 * Creates nothing: sign-in is the only thing that writes `auth_users`.
 */
export async function findRequestAccount(
  cookies: CookieReader,
): Promise<RequestAccount | null> {
  const session = await resolveSession(cookies.get(SESSION_COOKIE)?.value);
  return session ? { userId: session.userId } : null;
}
