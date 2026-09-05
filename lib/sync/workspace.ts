import "server-only";

/**
 * Which workspace does this request write to?
 *
 * One answer for two kinds of visitor, which is the whole point. A signed-in
 * account and an anonymous device both resolve to a `workspaces` row and a
 * `workspace_members` row; the only difference is the subject prefix, `user:`
 * or `anon:`. Every table below `workspaces` keys on `workspace_id` and cannot
 * tell which of the two put the row there.
 *
 * That is what makes guest persistence not a second code path. A guest is not
 * a visitor whose data has nowhere to go — they have an account, it just has no
 * email attached and no way to reach it from another device.
 *
 * The find/ensure split mirrors app/api/account/session: reading must never
 * bring a workspace into existence, or every crawler that fetches a page
 * leaves a row behind. Only a deliberate write ensures.
 */

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { workspaceMembers } from "@/lib/db/schema";
import {
  DEVICE_COOKIE,
  anonymousSubject,
  mintDeviceId,
  readDeviceId,
} from "@/lib/identity/device-id";
import { resolveAnonymousWorkspace } from "@/lib/identity/anonymous-account";
import { SESSION_COOKIE, resolveSession } from "@/lib/identity/session";
import { userSubject } from "@/lib/identity/link-account";

export type WorkspaceKind = "account" | "device";

export type RequestWorkspace = {
  workspaceId: string;
  subject: string;
  kind: WorkspaceKind;
};

export type EnsuredWorkspace = {
  workspace: RequestWorkspace;
  /**
   * Present only when a device id had to be minted. The route must set it on
   * the response, or the next request arrives as a different device and writes
   * into a second workspace.
   */
  deviceCookieValue: string | null;
};

/** The subset of NextRequest.cookies this module needs. */
export type CookieReader = {
  get(name: string): { value: string } | undefined;
};

/** Any live membership for this subject. */
async function workspaceForSubject(subject: string): Promise<string | null> {
  const rows = await getDb()
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.authUserId, subject), isNull(workspaceMembers.removedAt)),
    )
    .limit(1);

  return rows[0]?.workspaceId ?? null;
}

/**
 * The workspace this request already has, or null. Creates nothing.
 *
 * A signed-in session wins over the device cookie: someone who signed in on
 * this browser has their account's charts, not the ones the browser collected
 * before they did. `signInWithProvider` has already claimed the device's
 * workspace where that was possible, so for most people these are the same row.
 */
export async function findRequestWorkspace(
  cookies: CookieReader,
): Promise<RequestWorkspace | null> {
  const session = await resolveSession(cookies.get(SESSION_COOKIE)?.value);

  if (session) {
    const subject = userSubject(session.userId);
    const workspaceId = await workspaceForSubject(subject);
    if (workspaceId) return { workspaceId, subject, kind: "account" };
    /* Signed in with no membership should not happen — sign-in always creates
       one. Fall through rather than fail: the device workspace is still a
       correct place to read from. */
  }

  const deviceId = readDeviceId(cookies.get(DEVICE_COOKIE)?.value);
  if (!deviceId) return null;

  const subject = anonymousSubject(deviceId);
  const workspaceId = await workspaceForSubject(subject);

  return workspaceId ? { workspaceId, subject, kind: "device" } : null;
}

/**
 * The workspace this request writes to, creating it if this is the first time.
 *
 * Falls back to minting a device id when the browser presents none, so a first
 * chart push does not need a separate round trip to /api/account/session to
 * bring an identity into existence.
 */
export async function ensureRequestWorkspace(
  cookies: CookieReader,
): Promise<EnsuredWorkspace> {
  const existing = await findRequestWorkspace(cookies);
  if (existing) return { workspace: existing, deviceCookieValue: null };

  const presented = cookies.get(DEVICE_COOKIE)?.value;
  const presentedId = readDeviceId(presented);

  /* One source of truth for the pair: reuse the cookie verbatim when it is
     valid, or mint one and read the id back out of it. Never assemble an id
     and a tag from separate mints. */
  const cookieValue = presentedId ? presented! : mintDeviceId();
  const deviceId = presentedId ?? readDeviceId(cookieValue)!;

  const account = await resolveAnonymousWorkspace(deviceId);

  return {
    workspace: {
      workspaceId: account.workspaceId,
      subject: account.subject,
      kind: "device",
    },
    deviceCookieValue: presentedId ? null : cookieValue,
  };
}
