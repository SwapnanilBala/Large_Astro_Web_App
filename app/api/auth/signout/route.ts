import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, revokeSession } from "@/lib/identity/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * End the current session.
 *
 * POST, not GET, for the same reason `/start` is: a GET that signs someone out
 * can be fired by any `<img>` on any page, and being logged out by a third
 * party is a nuisance attack that costs nothing to prevent.
 *
 * The cookie is cleared whatever happens to the database write. If revocation
 * fails and the cookie survives, the visitor stays signed in on a screen that
 * just told them they were signed out; clearing it regardless leaves at worst a
 * row that expires on its own, which is the better failure. The error is logged
 * so a store that is failing this way is visible rather than silent.
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  try {
    await revokeSession(token);
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      route: "/api/auth/signout",
      error: error instanceof Error ? error.message : String(error),
    }));
  }

  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}
