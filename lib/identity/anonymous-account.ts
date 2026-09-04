import "server-only";

/**
 * Turning a device id into the workspace its rows hang off.
 *
 * `workspaces` is the tenant root every other table keys on, so a visitor with
 * no login still needs exactly one. The obvious shape — look it up, insert if
 * absent — has a race: two requests from the same device that both miss the
 * lookup both insert, and the device ends up owning two workspaces with its
 * data split across them. A unique index would catch the second insert but
 * leaves the losing workspace row behind as an orphan.
 *
 * So the workspace id is *derived* from the device id instead of generated.
 * Both statements become idempotent upserts, concurrent calls converge on the
 * same row, and there is nothing to clean up afterwards. Deriving it leaks
 * nothing: a workspace id opens no door without the signed cookie that proves
 * which device is asking.
 */

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { workspaceMembers, workspaces } from "@/lib/db/schema";
import { anonymousSubject, workspaceIdForDevice } from "@/lib/identity/device-id";

/** Shown nowhere yet; `workspaces.name` is not-null with a not-blank check. */
const DEFAULT_WORKSPACE_NAME = "Personal";

export type AnonymousAccount = {
  workspaceId: string;
  subject: string;
};

/**
 * Get, or create, the workspace belonging to this device.
 *
 * Safe to call on every request that needs somewhere to write. It costs one
 * round trip and does nothing on the second and later calls.
 */
export async function resolveAnonymousWorkspace(
  deviceId: string,
): Promise<AnonymousAccount> {
  const workspaceId = workspaceIdForDevice(deviceId);
  const subject = anonymousSubject(deviceId);
  const db = getDb();

  /* One round trip, and neon-http wraps a batch in a transaction, so the
     member row cannot survive a failed workspace insert. */
  await db.batch([
    db
      .insert(workspaces)
      .values({ id: workspaceId, name: DEFAULT_WORKSPACE_NAME })
      .onConflictDoNothing({ target: workspaces.id }),
    db
      .insert(workspaceMembers)
      .values({ workspaceId, authUserId: subject, role: "owner" })
      .onConflictDoNothing({
        target: [workspaceMembers.workspaceId, workspaceMembers.authUserId],
      }),
  ]);

  return { workspaceId, subject };
}

/**
 * The workspace this device already owns, without creating one.
 *
 * For read paths, which must not bring an account into existence just because
 * someone loaded a page.
 */
export async function findAnonymousWorkspace(
  deviceId: string,
): Promise<AnonymousAccount | null> {
  const subject = anonymousSubject(deviceId);

  const rows = await getDb()
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.authUserId, subject),
        isNull(workspaceMembers.removedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  return row ? { workspaceId: row.workspaceId, subject } : null;
}
