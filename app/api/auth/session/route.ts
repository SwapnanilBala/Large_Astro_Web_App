import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, resolveSession } from "@/lib/identity/session";

export const runtime = "nodejs";

/** Nothing here is cacheable, and a cached identity would be someone else's. */
export const dynamic = "force-dynamic";

/**
 * Who is signed in, if anyone.
 *
 * The session cookie is httpOnly, so the browser cannot read it and the answer
 * has to come from here. Reading it in a layout instead would work, but calling
 * `cookies()` there makes every route in the desktop tree dynamic, and 32 pages
 * that render fine as static are not worth trading for a name in the navbar.
 *
 * Only the fields the navbar renders are returned. The session id, user id and
 * token never cross into the browser, so a script that manages to read this
 * response learns a display name and an email it could already see on screen.
 */

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const user = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);

    return noStore(
      NextResponse.json({
        user: user ? { email: user.email, displayName: user.displayName } : null,
      }),
    );
  } catch {
    /* The database is unreachable. Say so rather than answering `null`, which
       the navbar would render as "signed out" — a signed-in visitor watching
       their name vanish will reasonably conclude they were logged out. */
    return noStore(
      NextResponse.json({ detail: "Could not reach the account store." }, { status: 503 }),
    );
  }
}
