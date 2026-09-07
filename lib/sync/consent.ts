import "server-only";

/**
 * Permission to keep somebody's birth details on the server.
 *
 * `birth_profiles.consent_record_id` is NOT NULL with a foreign key to
 * `consent_records`, which means this is not a policy the application enforces
 * — it is the database refusing the insert. Nothing in this file makes that
 * guarantee; it exists to produce the row the guarantee demands.
 *
 * The purpose string matches the one scripts/verify-neon-schema.mjs has been
 * inserting since the table existed. One permission, one name.
 */

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { birthProfiles, consentRecords } from "@/lib/db/schema";

/** The single purpose this app records. */
export const CONSENT_PURPOSE = "store_birth_details";

/**
 * Bump this when the wording of the ask changes materially.
 *
 * A consent record is evidence, and evidence of agreeing to *something* is
 * worth little without knowing what was on screen. `evidence_json` holds the
 * copy itself; this is the short handle for it.
 */
export const CONSENT_POLICY_VERSION = "2026-09-05.chart-storage";

export type ConsentEvidence = {
  /** The exact question the visitor answered. */
  prompt: string;
  /** Where they answered it: "intake", "nudge", "settings". */
  captureSource: string;
};

/** The live grant for this client, or null. */
export async function findActiveConsentId(
  userId: string,
  clientId: string,
): Promise<string | null> {
  const rows = await getDb()
    .select({ id: consentRecords.id })
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.userId, userId),
        eq(consentRecords.clientId, clientId),
        eq(consentRecords.purpose, CONSENT_PURPOSE),
        isNull(consentRecords.revokedAt),
      ),
    )
    .limit(1);

  return rows[0]?.id ?? null;
}

/**
 * Record a grant, or return the one already standing.
 *
 * `consent_records_one_active_purpose_unique` is a partial unique index over
 * (client_id, purpose) where revoked_at is null, so two concurrent grants
 * cannot both land. The insert is attempted and a conflict re-reads rather than
 * being treated as an error: losing that race means somebody else recorded the
 * same permission a millisecond earlier, which is the outcome we wanted.
 */
export async function grantConsent(
  userId: string,
  clientId: string,
  evidence: ConsentEvidence,
): Promise<string> {
  const existing = await findActiveConsentId(userId, clientId);
  if (existing) return existing;

  try {
    const inserted = await getDb()
      .insert(consentRecords)
      .values({
        userId,
        clientId,
        purpose: CONSENT_PURPOSE,
        policyVersion: CONSENT_POLICY_VERSION,
        grantedAt: new Date(),
        captureSource: evidence.captureSource.slice(0, 60),
        evidenceJson: { prompt: evidence.prompt },
      })
      .returning({ id: consentRecords.id });

    return inserted[0].id;
  } catch (error) {
    const raced = await findActiveConsentId(userId, clientId);
    if (raced) return raced;
    throw error;
  }
}

/**
 * Withdraw permission, and delete what it was permitting.
 *
 * Both halves, in one transaction. A `revoked_at` write on its own would leave
 * the birth details sitting in the table with a revoked grant pointing at
 * them, which is the letter of consent without the substance of it.
 *
 * Deleting the birth profile cascades to `chart_calculations` and everything
 * under it. The `clients` row stays: it holds a name, which the grant was
 * never what permitted, and it is the anchor a later re-grant attaches to.
 * The consent row itself is kept and marked revoked — it is the record that
 * permission once existed and was withdrawn, which is exactly what an audit
 * needs and what a delete would destroy.
 */
export async function revokeConsent(
  userId: string,
  clientId: string,
): Promise<boolean> {
  const consentId = await findActiveConsentId(userId, clientId);
  if (!consentId) return false;

  const db = getDb();

  await db.batch([
    db
      .delete(birthProfiles)
      .where(
        and(
          eq(birthProfiles.userId, userId),
          eq(birthProfiles.clientId, clientId),
        ),
      ),
    db
      .update(consentRecords)
      .set({ revokedAt: new Date() })
      .where(eq(consentRecords.id, consentId)),
  ]);

  return true;
}

/** Withdraw permission for every client on an account. Used by "stop syncing". */
export async function revokeAllConsent(userId: string): Promise<number> {
  const rows = await getDb()
    .select({ clientId: consentRecords.clientId })
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.userId, userId),
        eq(consentRecords.purpose, CONSENT_PURPOSE),
        isNull(consentRecords.revokedAt),
      ),
    );

  let revoked = 0;
  for (const row of rows) {
    if (await revokeConsent(userId, row.clientId)) revoked += 1;
  }

  return revoked;
}
