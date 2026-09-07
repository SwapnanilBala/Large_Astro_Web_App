import "server-only";

/**
 * Turning a verified provider identity into a signed-in account.
 *
 * *Which account?* Keyed on the provider's subject, never the email. Google
 * addresses get renamed and, on Workspace domains, reassigned to a new person
 * entirely; `sub` is stable across both. Email is used only to attach a Google
 * login to an account that already exists at that address, and only when
 * Google says the address is verified — without that check, anyone able to make
 * a provider assert an address could take over the account holding it.
 *
 * There used to be a second question here — *which workspace?* — and the
 * answer was intricate: an existing membership won, otherwise the signing-in
 * account claimed the workspace this device had been writing to as `anon:`,
 * unless another account already owned it. Migration 0006 removed the
 * `workspaces` layer, so `auth_users.id` is now the only tenant key and there
 * is nothing left to claim or collide over. A device that was never signed in
 * has no server-side data to carry across.
 */

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { authIdentities, authUsers } from "@/lib/db/schema";

export type ProviderIdentity = {
  provider: "google";
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

export type SignInResult = {
  userId: string;
  /** True when this call created the account rather than finding it. */
  createdUser: boolean;
};

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

/** Sign in, creating the account if this provider subject is new. */
export async function signInWithProvider(
  identity: ProviderIdentity,
): Promise<SignInResult> {
  const db = getDb();

  const existingBySubject = await findUserByProvider(identity);
  if (existingBySubject) {
    return { userId: existingBySubject, createdUser: false };
  }

  if (identity.emailVerified) {
    /* Attaching a Google login to an existing account at the same address.
       Gated on emailVerified: an unverified address is a claim, not a fact,
       and treating it as one is an account-takeover path. */
    const existingByEmail = await findUserByEmail(identity.email);
    if (existingByEmail) {
      await db
        .insert(authIdentities)
        .values({
          userId: existingByEmail,
          provider: identity.provider,
          providerAccountId: identity.subject,
          email: identity.email,
        })
        .onConflictDoNothing();

      return { userId: existingByEmail, createdUser: false };
    }
  }

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

  const userId = inserted[0].id;

  await db.insert(authIdentities).values({
    userId,
    provider: identity.provider,
    providerAccountId: identity.subject,
    email: identity.email,
  });

  return { userId, createdUser: true };
}
