import "server-only";

/**
 * Turning a verified provider identity into a signed-in account, and deciding
 * which workspace that account lands in.
 *
 * Two questions, and both have a wrong answer that looks reasonable.
 *
 * *Which account?* Keyed on the provider's subject, never the email. Google
 * addresses get renamed and, on Workspace domains, reassigned to a new person
 * entirely; `sub` is stable across both. Email is used only to attach a Google
 * login to an account that already exists at that address, and only when
 * Google says the address is verified — without that check, anyone able to make
 * a provider assert an address could take over the account holding it.
 *
 * *Which workspace?* An existing membership always wins, so signing in on a
 * second device does not strand you in that device's empty workspace. Only when
 * the person has no workspace at all does the anonymous one get claimed, and
 * only if no other account already owns it — otherwise two people sharing a
 * browser would merge their charts.
 */

import { and, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { authIdentities, authUsers, workspaceMembers, workspaces } from "@/lib/db/schema";
import { workspaceIdForDevice } from "@/lib/identity/device-id";

export type ProviderIdentity = {
  provider: "google";
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

export type SignInResult = {
  userId: string;
  workspaceId: string;
  /** True when this call created the account rather than finding it. */
  createdUser: boolean;
  /** True when the anonymous workspace became this account's. */
  claimedAnonymousWorkspace: boolean;
};

/** The member subject for a signed-in person, mirroring `anon:` for devices. */
export function userSubject(userId: string): string {
  return `user:${userId}`;
}

async function findUserByProvider(identity: ProviderIdentity): Promise<string | null> {
  const rows = await getDb()
    .select({ userId: authIdentities.userId })
    .from(authIdentities)
    .where(
      and(
        eq(authIdentities.provider, identity.provider),
        eq(authIdentities.providerAccountId, identity.subject),
      ),
    )
    .limit(1);

  return rows[0]?.userId ?? null;
}

async function findUserByEmail(email: string): Promise<string | null> {
  const rows = await getDb()
    .select({ userId: authUsers.id })
    .from(authUsers)
    .where(sql`lower(${authUsers.email}) = lower(${email})`)
    .limit(1);

  return rows[0]?.userId ?? null;
}

/** Any workspace this account is already a member of. */
async function findWorkspaceForUser(userId: string): Promise<string | null> {
  const rows = await getDb()
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.authUserId, userSubject(userId)),
        isNull(workspaceMembers.removedAt),
      ),
    )
    .limit(1);

  return rows[0]?.workspaceId ?? null;
}

/**
 * Is this workspace already owned by some *other* signed-in account?
 *
 * An anonymous `anon:` member does not count as an owner for this purpose —
 * that is precisely the membership being upgraded.
 */
async function isClaimedByAnotherUser(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const rows = await getDb()
    .select({ subject: workspaceMembers.authUserId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        isNull(workspaceMembers.removedAt),
        sql`${workspaceMembers.authUserId} like 'user:%'`,
        sql`${workspaceMembers.authUserId} <> ${userSubject(userId)}`,
      ),
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Sign in, creating the account and/or the workspace membership as needed.
 *
 * `deviceId` is optional: without it there is simply no anonymous workspace to
 * claim and the account gets a fresh one.
 */
export async function signInWithProvider(
  identity: ProviderIdentity,
  deviceId: string | null,
): Promise<SignInResult> {
  const db = getDb();

  let userId = await findUserByProvider(identity);
  let createdUser = false;

  if (!userId && identity.emailVerified) {
    /* Attaching a Google login to an existing account at the same address.
       Gated on emailVerified above: an unverified address is a claim, not a
       fact, and treating it as one is an account-takeover path. */
    const existing = await findUserByEmail(identity.email);
    if (existing) {
      userId = existing;
      await db
        .insert(authIdentities)
        .values({
          userId,
          provider: identity.provider,
          providerAccountId: identity.subject,
          email: identity.email,
        })
        .onConflictDoNothing();
    }
  }

  if (!userId) {
    const inserted = await db
      .insert(authUsers)
      .values({
        email: identity.email,
        displayName: identity.name,
        /* Google verified it; making the visitor confirm the same address by
           email again would be theatre. */
        emailVerifiedAt: identity.emailVerified ? new Date() : null,
      })
      .returning({ id: authUsers.id });

    userId = inserted[0].id;
    createdUser = true;

    await db.insert(authIdentities).values({
      userId,
      provider: identity.provider,
      providerAccountId: identity.subject,
      email: identity.email,
    });
  }

  const subject = userSubject(userId);

  const existingWorkspace = await findWorkspaceForUser(userId);
  if (existingWorkspace) {
    return {
      userId,
      workspaceId: existingWorkspace,
      createdUser,
      claimedAnonymousWorkspace: false,
    };
  }

  if (deviceId) {
    const candidate = workspaceIdForDevice(deviceId);
    const taken = await isClaimedByAnotherUser(candidate, userId);

    if (!taken) {
      /* The workspace may not exist yet — this device may never have written
         anything — so ensure it, then join it. Both are idempotent. */
      await db.batch([
        db
          .insert(workspaces)
          .values({ id: candidate, name: "Personal" })
          .onConflictDoNothing({ target: workspaces.id }),
        db
          .insert(workspaceMembers)
          .values({ workspaceId: candidate, authUserId: subject, role: "owner" })
          .onConflictDoNothing({
            target: [workspaceMembers.workspaceId, workspaceMembers.authUserId],
          }),
      ]);

      return {
        userId,
        workspaceId: candidate,
        createdUser,
        claimedAnonymousWorkspace: true,
      };
    }
  }

  /* No workspace of their own and none to claim: a fresh one. */
  const created = await db
    .insert(workspaces)
    .values({ name: "Personal" })
    .returning({ id: workspaces.id });

  const workspaceId = created[0].id;

  await db
    .insert(workspaceMembers)
    .values({ workspaceId, authUserId: subject, role: "owner" })
    .onConflictDoNothing({
      target: [workspaceMembers.workspaceId, workspaceMembers.authUserId],
    });

  return { userId, workspaceId, createdUser, claimedAnonymousWorkspace: false };
}
