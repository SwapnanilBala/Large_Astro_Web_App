import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ANDROID_NONCE_PATTERN, consumeAndroidNonce } from "@/lib/identity/android-nonce";
import {
  readGoogleAndroidConfig,
  verifyGoogleIdToken,
  type GoogleIdentity,
} from "@/lib/identity/google-oauth";
import { signInWithProvider } from "@/lib/identity/link-account";
import { createSession, resolveSession } from "@/lib/identity/session";
import { getClientIp } from "@/lib/rate-limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step two of the Android app's Google sign-in: swap a Google id_token for a
 * session.
 *
 * The phone gets the id_token from Credential Manager, asking for one minted
 * for the WEB client (AUTH_GOOGLE_ID) with the nonce from step one. This
 * route runs the same check the web callback runs (verifyGoogleIdToken:
 * Google's signature, issuer, audience, expiry, nonce), plus two the web does
 * not need: `azp` must be one of the Android clients in
 * AUTH_GOOGLE_ANDROID_IDS, and the nonce must be one this server issued and
 * nobody has used. Then it links the account exactly as the callback does and
 * starts the same kind of session. The session token is returned in the body
 * for the app to keep encrypted and send as `Authorization: Bearer`. No
 * cookie is set: the app is not a browser.
 *
 * Failures are coarse on purpose. The caller learns "invalid_token", not which
 * check failed; the reason goes to the server log.
 */

/** An id_token is 1-2 KB and the body little more; this is a ceiling, not an estimate. */
const MAX_BODY_BYTES = 8 * 1024;

const BodySchema = z.object({
  idToken: z
    .string()
    .min(1)
    .max(4096)
    .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
  nonce: z.string().regex(ANDROID_NONCE_PATTERN),
});

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

function failed(code: string, status: number) {
  const messages: Record<string, string> = {
    invalid_request: "The sign-in request was not complete.",
    invalid_token: "Google sign-in could not be confirmed.",
    email_unverified: "That Google account's email address is not verified.",
    not_configured: "Sign-in for the app is not set up yet.",
    signin_failed: "Sign-in did not go through.",
  };
  return json({ error: { code, message: messages[code] ?? messages.signin_failed } }, status);
}

/** The reason, server-side only; see the callback's logAuthFailure. */
function logAuthFailure(reason: string, error?: unknown) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    route: "/api/auth/google/android",
    reason,
    error: error instanceof Error ? error.message : error === undefined ? undefined : String(error),
  }));
}

export async function POST(request: NextRequest) {
  const config = readGoogleAndroidConfig();
  if (!config) return failed("not_configured", 503);

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return failed("invalid_request", 413);
  }

  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) return failed("invalid_request", 413);

  let raw: unknown = null;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = null;
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return failed("invalid_request", 400);

  const { idToken, nonce } = parsed.data;

  let identity: GoogleIdentity;
  try {
    identity = await verifyGoogleIdToken(idToken, {
      audience: config.audience,
      expectedNonce: nonce,
      authorizedParties: config.authorizedParties,
    });
  } catch (error) {
    logAuthFailure("token_rejected", error);
    return failed("invalid_token", 401);
  }

  /* After the signature check, so that only a token Google really signed for
     this nonce can use it up. One statement: a replay racing the first use
     loses. */
  let fresh: boolean;
  try {
    fresh = await consumeAndroidNonce(nonce);
  } catch (error) {
    logAuthFailure("nonce_store_failed", error);
    return failed("signin_failed", 503);
  }
  if (!fresh) {
    logAuthFailure("nonce_unknown_expired_or_used");
    return failed("invalid_token", 401);
  }

  if (!identity.emailVerified) {
    /* Same rule as the web callback, and signInWithProvider's email linking
       depends on it. */
    return failed("email_unverified", 403);
  }

  try {
    const result = await signInWithProvider({
      provider: "google",
      subject: identity.subject,
      email: identity.email,
      emailVerified: identity.emailVerified,
      name: identity.name,
    });

    if (result.createdUser) {
      console.info(JSON.stringify({
        timestamp: new Date().toISOString(),
        route: "/api/auth/google/android",
        event: "account_created",
        provider: "google",
        userId: result.userId,
      }));
    }

    const { token, expiresAt } = await createSession(result.userId, {
      userAgent: request.headers.get("user-agent"),
      ipAddress: getClientIp(request),
    });

    /* The account's own name and address, as /api/auth/session will report
       them, rather than what this token said: an existing account keeps the
       name it already has. */
    const user = await resolveSession(token);

    return json({
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        email: user?.email ?? identity.email,
        displayName: user ? user.displayName : identity.name,
      },
    });
  } catch (error) {
    logAuthFailure("signin_failed", error);
    return failed("signin_failed", 500);
  }
}
