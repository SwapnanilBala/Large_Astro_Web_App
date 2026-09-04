import { NextRequest, NextResponse } from "next/server";

import {
  GOOGLE_NONCE_COOKIE,
  GOOGLE_RETURN_COOKIE,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  handshakeCookieOptions,
  missingGoogleConfig,
  readGoogleConfig,
  startHandshake,
} from "@/lib/identity/google-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Begin Google sign-in.
 *
 * POST, not GET. A GET that starts an OAuth handshake can be triggered by any
 * `<img>` on any site, which burns through handshakes and lets a third party
 * decide when a sign-in begins. A form POST from this origin cannot be forged
 * the same way, and the `lax` cookies still survive the return trip.
 */
export async function POST(request: NextRequest) {
  const config = readGoogleConfig();

  if (!config) {
    return NextResponse.json(
      {
        detail: "Google sign-in is not configured on this server.",
        missing: missingGoogleConfig(),
      },
      { status: 503 },
    );
  }

  const handshake = startHandshake(config);

  /* Where to land afterwards. Only a path on this site is accepted: taking a
     full URL here turns sign-in into an open redirect, which is a ready-made
     phishing hop that borrows this domain's credibility. */
  const requestedReturn = request.nextUrl.searchParams.get("returnTo") ?? "";
  const returnTo =
    requestedReturn.startsWith("/") && !requestedReturn.startsWith("//")
      ? requestedReturn
      : "/";

  const response = NextResponse.json({ authorizeUrl: handshake.authorizeUrl });
  const options = handshakeCookieOptions();

  response.cookies.set(GOOGLE_STATE_COOKIE, handshake.state, options);
  response.cookies.set(GOOGLE_VERIFIER_COOKIE, handshake.codeVerifier, options);
  response.cookies.set(GOOGLE_NONCE_COOKIE, handshake.nonce, options);
  response.cookies.set(GOOGLE_RETURN_COOKIE, returnTo, options);
  response.headers.set("Cache-Control", "no-store, private");

  return response;
}
