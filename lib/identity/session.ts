import "server-only";

/**
 * Signed-in sessions.
 *
 * The cookie carries a random token and nothing else — no user id, no claims,
 * no signature to check. Every request looks the session up, which is what
 * makes signing out work: delete the row and the cookie is inert everywhere,
 * immediately. A JWT cannot do that without a revocation list, which is a
 * session table wearing a hat.
 *
 * Only the SHA-256 of the token is stored. A leaked database backup then
 * contains no usable cookies. There is no salt because the input is already 32
 * random bytes: salting defends against precomputation over a small input
 * space, and there is no such space here.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { authSessions, authUsers } from "@/lib/db/schema";

export const SESSION_COOKIE = "astro_session";

/** How long a new session lasts. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Refresh `expires_at` only once a session is this far in. Writing on every
 * request would turn a page view into a database write for no benefit.
 */
const REFRESH_AFTER_SECONDS = 60 * 60 * 24;

const TOKEN_BYTES = 32;

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionUser = {
  sessionId: string;
  userId: string;
  email: string;
  displayName: string | null;
  emailVerifiedAt: Date | null;
};

/**
 * Start a session and return the token to put in the cookie.
 *
 * The plaintext token is returned once and never stored; if the caller loses
 * it, the session is unreachable and simply expires.
 */
export async function createSession(
  userId: string,
  context: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await getDb()
    .insert(authSessions)
    .values({
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      /* Truncated rather than rejected: these are diagnostics, and a long
         User-Agent must not be a reason someone cannot sign in. */
      userAgent: context.userAgent?.slice(0, 255) ?? null,
      ipAddress: context.ipAddress?.slice(0, 45) ?? null,
    });

  return { token, expiresAt };
}

/**
 * Resolve a cookie value to the signed-in person, or null.
 *
 * Expiry and revocation are checked in SQL rather than in JavaScript, so a row
 * that has expired between the read and the check cannot slip through.
 */
export async function resolveSession(
  token: string | undefined | null,
): Promise<SessionUser | null> {
  if (!token) return null;

  const db = getDb();
  const tokenHash = hashSessionToken(token);

  const rows = await db
    .select({
      sessionId: authSessions.id,
      userId: authUsers.id,
      email: authUsers.email,
      displayName: authUsers.displayName,
      emailVerifiedAt: authUsers.emailVerifiedAt,
      lastSeenAt: authSessions.lastSeenAt,
    })
    .from(authSessions)
    .innerJoin(authUsers, eq(authUsers.id, authSessions.userId))
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, sql`now()`),
        /* A disabled account's existing sessions must stop working, not just
           its next sign-in attempt. */
        isNull(authUsers.disabledAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const staleBy = Date.now() - row.lastSeenAt.getTime();
  if (staleBy > REFRESH_AFTER_SECONDS * 1000) {
    await db
      .update(authSessions)
      .set({
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
      })
      .where(eq(authSessions.id, row.sessionId));
  }

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    emailVerifiedAt: row.emailVerifiedAt,
  };
}

/** End one session. Idempotent. */
export async function revokeSession(token: string | undefined | null): Promise<void> {
  if (!token) return;

  await getDb()
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authSessions.tokenHash, hashSessionToken(token)),
        isNull(authSessions.revokedAt),
      ),
    );
}

/** End every session for a person — after a password change, or on request. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await getDb()
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
}

export function sessionCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    /* `lax` and not `strict`: the Google callback is a cross-site navigation
       back into this app, and `strict` would withhold the cookie on exactly
       that hop, so the visitor would land signed out having just signed in. */
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : { maxAge: SESSION_MAX_AGE_SECONDS }),
  };
}

/** Constant-time compare for short opaque values (OAuth `state`, and similar). */
export function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
