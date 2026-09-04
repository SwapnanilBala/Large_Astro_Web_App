import { NextRequest, NextResponse } from "next/server";

import {
  DEVICE_COOKIE,
  deviceCookieOptions,
  mintDeviceId,
  readDeviceId,
} from "@/lib/identity/device-id";
import {
  findAnonymousWorkspace,
  resolveAnonymousWorkspace,
} from "@/lib/identity/anonymous-account";

/**
 * The device's workspace: the one thing that has to exist in Postgres before
 * anything else about a visitor can be stored.
 *
 * GET reads and never creates. POST creates on demand. The split is the point:
 * loading a page must not bring an account into existence, or every crawler
 * that touches the site leaves a row behind. Only a deliberate action — saving
 * a chart, agreeing to keep birth details — should POST here.
 *
 * A workspace row holds a random id, the name "Personal" and two timestamps.
 * No personal data reaches the database on this path, which is why it needs no
 * consent record; `birth_profiles` is where consent becomes mandatory, and the
 * database enforces that itself.
 */

/** node, not edge: the id is signed with node:crypto. */
export const runtime = "nodejs";

/** Nothing here is cacheable, and a cached identity would be someone else's. */
export const dynamic = "force-dynamic";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

export async function GET(request: NextRequest) {
  const deviceId = readDeviceId(request.cookies.get(DEVICE_COOKIE)?.value);

  if (!deviceId) {
    return noStore(NextResponse.json({ workspaceId: null, deviceKnown: false }));
  }

  try {
    const account = await findAnonymousWorkspace(deviceId);
    return noStore(
      NextResponse.json({
        workspaceId: account?.workspaceId ?? null,
        deviceKnown: true,
      }),
    );
  } catch {
    /* The device is real even when the database is unreachable; say so rather
       than implying the visitor has no identity and inviting a fresh one. */
    return noStore(
      NextResponse.json(
        { detail: "Could not reach the account store." },
        { status: 503 },
      ),
    );
  }
}

export async function POST(request: NextRequest) {
  const presented = request.cookies.get(DEVICE_COOKIE)?.value;
  const existingId = readDeviceId(presented);

  /* One source of truth for the pair: either the cookie already carries a
     valid id and is reused verbatim, or a new cookie is minted and its id read
     back out of it. Never assemble an id and a tag from different mints. */
  const cookieValue = existingId ? presented! : mintDeviceId();
  const deviceId = existingId ?? readDeviceId(cookieValue)!;

  try {
    const account = await resolveAnonymousWorkspace(deviceId);

    const response = noStore(
      NextResponse.json({
        workspaceId: account.workspaceId,
        createdDevice: existingId === null,
      }),
    );
    response.cookies.set(DEVICE_COOKIE, cookieValue, deviceCookieOptions());
    return response;
  } catch {
    return noStore(
      NextResponse.json(
        { detail: "Could not reach the account store." },
        { status: 503 },
      ),
    );
  }
}
