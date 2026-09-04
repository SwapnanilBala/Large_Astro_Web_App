import { NextRequest, NextResponse } from "next/server";

import { DEVICE_COOKIE, readDeviceId } from "@/lib/identity/device-id";
import {
  GOOGLE_NONCE_COOKIE,
  GOOGLE_RETURN_COOKIE,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  exchangeCode,
  readGoogleConfig,
} from "@/lib/identity/google-oauth";
import { signInWithProvider } from "@/lib/identity/link-account";
import {
  SESSION_COOKIE,
  createSession,
  safeEquals,
  sessionCookieOptions,
} from "@/lib/identity/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDSHAKE_COOKIES = [
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  GOOGLE_NONCE_COOKIE,
  GOOGLE_RETURN_COOKIE,
];

/**
 * Send the visitor back to a page with a short reason code.
 *
 * The codes are deliberately coarse. Telling someone which step of the
 * handshake failed tells an attacker probing the flow the same thing, and
 * neither can act on the difference.
 */
function failed(origin: string, reason: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url, 303);
}

/** Handshake cookies are single-use; clear them however this ends. */
function clearHandshake(response: NextResponse) {
  for (const name of HANDSHAKE_COOKIES) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

export async function GET(request: NextRequest) {
  const config = readGoogleConfig();
  const origin = process.env.APP_ORIGIN ?? request.nextUrl.origin;

  if (!config) {
    return clearHandshake(failed(origin, "not_configured"));
  }

  const params = request.nextUrl.searchParams;

  /* Google reports a refusal here — most often `access_denied`, which in a
     Testing-mode project usually means the account is not on the test-user
     list rather than that anyone declined. */
  if (params.get("error")) {
    return clearHandshake(failed(origin, "declined"));
  }

  const code = params.get("code");
  const returnedState = params.get("state");

  const expectedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  const codeVerifier = request.cookies.get(GOOGLE_VERIFIER_COOKIE)?.value;
  const nonce = request.cookies.get(GOOGLE_NONCE_COOKIE)?.value;

  if (!code || !returnedState || !expectedState || !codeVerifier || !nonce) {
    return clearHandshake(failed(origin, "expired"));
  }

  /* The CSRF check: this response must belong to a handshake this browser
     started. Constant-time so the comparison leaks nothing. */
  if (!safeEquals(returnedState, expectedState)) {
    return clearHandshake(failed(origin, "state_mismatch"));
  }

  let identity;
  try {
    identity = await exchangeCode(config, code, codeVerifier, nonce);
  } catch {
    return clearHandshake(failed(origin, "exchange_failed"));
  }

  if (!identity.emailVerified) {
    /* Google can return addresses it has not verified. Signing someone in on
       one would let a provider-asserted claim stand in for proof. */
    return clearHandshake(failed(origin, "email_unverified"));
  }

  const deviceId = readDeviceId(request.cookies.get(DEVICE_COOKIE)?.value);

  try {
    const result = await signInWithProvider(
      {
        provider: "google",
        subject: identity.subject,
        email: identity.email,
        emailVerified: identity.emailVerified,
        name: identity.name,
      },
      deviceId,
    );

    const { token, expiresAt } = await createSession(result.userId, {
      userAgent: request.headers.get("user-agent"),
      ipAddress:
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        null,
    });

    const returnTo = request.cookies.get(GOOGLE_RETURN_COOKIE)?.value;
    const destination =
      returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
        ? returnTo
        : "/";

    const response = NextResponse.redirect(new URL(destination, origin), 303);
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return clearHandshake(response);
  } catch {
    return clearHandshake(failed(origin, "signin_failed"));
  }
}
