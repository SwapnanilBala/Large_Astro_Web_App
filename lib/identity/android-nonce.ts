import "server-only";

/**
 * The nonce for one Android sign-in.
 *
 * The web flow carries its nonce in a cookie set when the handshake starts.
 * The app has no cookie jar, so the server issues the nonce, keeps its hash in
 * `auth_nonces`, and the sign-in route consumes it. The phone passes the nonce
 * to Google, Google signs it into the id_token, and the route accepts the
 * token only if that nonce was issued here, has not expired and has not been
 * used. That is what stops a captured token being replayed.
 */

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { authNonces } from "@/lib/db/schema";
import { OAUTH_HANDSHAKE_MAX_AGE } from "@/lib/identity/google-oauth";

/** 32 random bytes in base64url: 43 characters. */
export const ANDROID_NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashNonce(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}

/** A fresh nonce. Only its hash is stored; the plaintext goes to the phone once. */
export async function issueAndroidNonce(now: Date = new Date()): Promise<string> {
  const nonce = randomBytes(32).toString("base64url");
  const db = getDb();

  /* Unused nonces would otherwise sit here for ever. Pruned as new ones are
     issued, under the same per-minute limit, so the table stays the size of
     ten minutes of sign-in attempts. */
  await db.batch([
    db.delete(authNonces).where(lt(authNonces.expiresAt, sql`now()`)),
    db.insert(authNonces).values({
      nonceHash: hashNonce(nonce),
      createdAt: now,
      expiresAt: new Date(now.getTime() + OAUTH_HANDSHAKE_MAX_AGE * 1000),
    }),
  ]);

  return nonce;
}

/**
 * Use up a nonce. True only the first time, and only before it expires.
 *
 * One statement, so two requests racing with the same nonce cannot both see
 * the row: the delete that returns it is the one that wins.
 */
export async function consumeAndroidNonce(nonce: string): Promise<boolean> {
  if (!ANDROID_NONCE_PATTERN.test(nonce)) return false;

  const rows = await getDb()
    .delete(authNonces)
    .where(
      and(eq(authNonces.nonceHash, hashNonce(nonce)), gt(authNonces.expiresAt, sql`now()`)),
    )
    .returning({ nonceHash: authNonces.nonceHash });

  return rows.length > 0;
}
