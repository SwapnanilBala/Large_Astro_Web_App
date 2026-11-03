import { NextResponse } from "next/server";

import { issueAndroidNonce } from "@/lib/identity/android-nonce";
import { readGoogleAndroidConfig } from "@/lib/identity/google-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step one of the Android app's Google sign-in: a one-use nonce.
 *
 * The app hands it to Google with its sign-in request, Google signs it into
 * the id_token, and POST /api/auth/google/android accepts that token only
 * with this nonce, once, within ten minutes. Rate-limited per caller in
 * lib/rate-limiter.ts. POST rather than GET because it writes a row, and a
 * GET that writes is one any page can fire.
 */

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

export async function POST() {
  if (!readGoogleAndroidConfig()) {
    return json(
      { error: { code: "not_configured", message: "Sign-in for the app is not set up yet." } },
      503,
    );
  }

  try {
    return json({ nonce: await issueAndroidNonce() });
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/auth/google/android/nonce",
      reason: "nonce_store_failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    return json(
      { error: { code: "unavailable", message: "Could not reach the account store." } },
      503,
    );
  }
}
