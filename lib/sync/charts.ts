import "server-only";

/**
 * Writing a chart into the account it belongs to, and reading it back.
 *
 * Four rows per chart, in a fixed order, because each is the next one's
 * precondition:
 *
 *   clients             who the chart is for
 *   consent_records     permission to keep their birth details (FK -> clients)
 *   birth_profiles      the birth details (FK -> consent_records, NOT NULL)
 *   chart_calculations  the calculation over them
 *
 * Every step is idempotent, keyed on a deterministic fingerprint rather than a
 * generated id. Pushing the same chart on every page view is therefore free
 * after the first, which matters because that is exactly what the client does:
 * it pushes whatever chart is on screen and lets the server decide whether
 * anything is new.
 *
 * Corrections are not overwrites. A changed birth time archives the old
 * birth_profiles row and inserts a superseding one, so a calculation that ran
 * against the old facts still points at the facts it ran against.
 */

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { birthProfiles, chartCalculations, clients } from "@/lib/db/schema";
import { grantConsent, type ConsentEvidence } from "@/lib/sync/consent";
import { resolveBirthTimeColumns, timezoneSource } from "@/lib/sync/facts";
import {
  birthFingerprint,
  chartInputFingerprint,
  clientReference,
  type BirthFacts,
} from "@/lib/sync/fingerprint";

export type ChartSyncInput = {
  facts: BirthFacts;
  engineId: string;
  calculationVersion: string;
  /** Enough to rebuild the /insights URL this chart was viewed at. */
  queryString: string;
  ascendantSign: string | null;
  sunSign: string | null;
  moonSign: string | null;
  birthTimeAccuracy: string;
  birthTimeIsFallback: boolean;
};

export type SyncedChart = {
  chartId: string;
  name: string;
  city: string;
  birthDate: string;
  ascendantSign: string | null;
  queryString: string;
  savedAt: string;
};

export type SaveChartResult = {
  chartId: string;
  clientId: string;
  birthProfileId: string;
  /** False when this exact calculation was already stored. */
  created: boolean;
};

function trimTo(value: string, length: number): string | null {
  const trimmed = value.trim().slice(0, length);
  return trimmed || null;
}

async function findClientByReference(
  workspaceId: string,
  reference: string,
): Promise<string | null> {
  const rows = await getDb()
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.workspaceId, workspaceId),
        eq(clients.externalReference, reference),
        isNull(clients.deletedAt),
      ),
    )
    .limit(1);

  return rows[0]?.id ?? null;
}

/** Find, or create, the clients row for this person in this workspace. */
async function ensureClient(workspaceId: string, facts: BirthFacts): Promise<string> {
  const reference = clientReference(facts.name, facts.birthDate);

  const existing = await findClientByReference(workspaceId, reference);
  if (existing) return existing;

  try {
    const inserted = await getDb()
      .insert(clients)
      .values({
        workspaceId,
        displayName: facts.name.trim().slice(0, 120),
        externalReference: reference,
        timeZoneId: trimTo(facts.timeZoneId, 100),
        source: "chart_intake",
        /* "none" rather than null: there is no email or phone here, and
           clients_preferred_contact_value_check rejects any other method
           without one. */
        preferredContactMethod: "none",
      })
      .returning({ id: clients.id });

    return inserted[0].id;
  } catch (error) {
    /* clients_workspace_external_reference_unique. Two tabs pushing the same
       chart at once is ordinary, not exceptional. */
    const raced = await findClientByReference(workspaceId, reference);
    if (raced) return raced;
    throw error;
  }
}

/**
 * Find, or create, the birth profile matching these facts.
 *
 * The fingerprint is kept in `source_notes` because the table has no column
 * for it. That is a compromise worth naming: the alternative is comparing
 * eleven columns on every push, which is the same comparison written longhand
 * and silently wrong the first time somebody adds a twelfth.
 */
async function ensureBirthProfile(
  workspaceId: string,
  clientId: string,
  facts: BirthFacts,
  consentRecordId: string,
  accuracy: string,
  isFallback: boolean,
): Promise<string> {
  const marker = `fingerprint:${birthFingerprint(facts)}`;
  const db = getDb();

  const live = await db
    .select({ id: birthProfiles.id, sourceNotes: birthProfiles.sourceNotes })
    .from(birthProfiles)
    .where(
      and(
        eq(birthProfiles.workspaceId, workspaceId),
        eq(birthProfiles.clientId, clientId),
        isNull(birthProfiles.archivedAt),
      ),
    )
    .orderBy(desc(birthProfiles.updatedAt));

  const match = live.find((row) => row.sourceNotes === marker);
  if (match) return match.id;

  const supersedes = live[0]?.id ?? null;

  const values = {
    workspaceId,
    clientId,
    consentRecordId,
    label: "Primary",
    isPrimary: true,
    birthDate: facts.birthDate.trim(),
    ...resolveBirthTimeColumns(facts.birthTime, accuracy, isFallback),
    /* The visitor typed these in. None of the other vocabulary the check
       allows — certificate, hospital_record — would be true. */
    birthRecordSource: "self_report",
    country: trimTo(facts.country, 120),
    state: trimTo(facts.state, 120),
    city: trimTo(facts.city, 120),
    town: trimTo(facts.town, 120),
    latitude: facts.latitude,
    longitude: facts.longitude,
    timeZoneId: trimTo(facts.timeZoneId, 100),
    suppliedUtcOffsetMinutes: facts.timezoneOffsetMinutes,
    resolvedUtcOffsetMinutes: facts.timezoneOffsetMinutes,
    timezoneSource: timezoneSource(facts),
    sourceNotes: marker,
    supersedesBirthProfileId: supersedes,
  };

  /* birth_profiles_one_primary_per_client_unique is a partial unique index, so
     the standing primary has to stop being one in the same transaction that
     creates its replacement. */
  if (supersedes) {
    const [, insertedRows] = await db.batch([
      db
        .update(birthProfiles)
        .set({ isPrimary: false, archivedAt: new Date() })
        .where(eq(birthProfiles.id, supersedes)),
      db.insert(birthProfiles).values(values).returning({ id: birthProfiles.id }),
    ]);

    return insertedRows[0].id;
  }

  const inserted = await db
    .insert(birthProfiles)
    .values(values)
    .returning({ id: birthProfiles.id });

  return inserted[0].id;
}

/**
 * Store a chart, creating the person, the permission and the birth details on
 * the way if this is the first time.
 */
export async function saveChart(
  workspaceId: string,
  input: ChartSyncInput,
  consent: ConsentEvidence,
): Promise<SaveChartResult> {
  const clientId = await ensureClient(workspaceId, input.facts);
  const consentRecordId = await grantConsent(workspaceId, clientId, consent);
  const birthProfileId = await ensureBirthProfile(
    workspaceId,
    clientId,
    input.facts,
    consentRecordId,
    input.birthTimeAccuracy,
    input.birthTimeIsFallback,
  );

  const fingerprint = chartInputFingerprint(input.facts, input.engineId);
  const db = getDb();

  const reproducible = and(
    eq(chartCalculations.workspaceId, workspaceId),
    eq(chartCalculations.birthProfileId, birthProfileId),
    eq(chartCalculations.chartType, "natal"),
    eq(chartCalculations.inputFingerprint, fingerprint),
    eq(chartCalculations.engineId, input.engineId),
    eq(chartCalculations.calculationVersion, input.calculationVersion),
  );

  const existing = await db
    .select({ id: chartCalculations.id })
    .from(chartCalculations)
    .where(reproducible)
    .limit(1);

  if (existing[0]) {
    return { chartId: existing[0].id, clientId, birthProfileId, created: false };
  }

  const inserted = await db
    .insert(chartCalculations)
    .values({
      workspaceId,
      birthProfileId,
      chartType: "natal",
      inputFingerprint: fingerprint,
      /* The query string, so /insights can be rebuilt exactly. The placements
         themselves are recomputed from the birth facts on demand — they are
         deterministic, and storing them is a later step in the plan. */
      inputSnapshotJson: { query_string: input.queryString },
      engineId: input.engineId,
      calculationVersion: input.calculationVersion,
      ascendantSign: input.ascendantSign?.slice(0, 20) ?? null,
      sunSign: input.sunSign?.slice(0, 20) ?? null,
      moonSign: input.moonSign?.slice(0, 20) ?? null,
    })
    .returning({ id: chartCalculations.id });

  return { chartId: inserted[0].id, clientId, birthProfileId, created: true };
}

/**
 * Every stored chart in this workspace, newest first.
 *
 * Shaped to match ChartHistoryEntry in lib/chart-history-store, so hydration
 * is an assignment rather than a translation layer.
 */
export async function listCharts(workspaceId: string): Promise<SyncedChart[]> {
  const rows = await getDb()
    .select({
      chartId: chartCalculations.id,
      name: clients.displayName,
      city: birthProfiles.city,
      birthDate: birthProfiles.birthDate,
      ascendantSign: chartCalculations.ascendantSign,
      snapshot: chartCalculations.inputSnapshotJson,
      computedAt: chartCalculations.computedAt,
    })
    .from(chartCalculations)
    .innerJoin(
      birthProfiles,
      and(
        eq(birthProfiles.id, chartCalculations.birthProfileId),
        eq(birthProfiles.workspaceId, chartCalculations.workspaceId),
      ),
    )
    .innerJoin(
      clients,
      and(
        eq(clients.id, birthProfiles.clientId),
        eq(clients.workspaceId, birthProfiles.workspaceId),
      ),
    )
    .where(
      and(
        eq(chartCalculations.workspaceId, workspaceId),
        isNull(chartCalculations.archivedAt),
        isNull(clients.deletedAt),
      ),
    )
    .orderBy(desc(chartCalculations.computedAt))
    .limit(50);

  return rows.flatMap((row) => {
    const queryString = row.snapshot?.query_string;

    /* A row with no query string cannot be reopened, so it is not a chart from
       the visitor's point of view. Skip it rather than render a dead link. */
    if (typeof queryString !== "string" || !queryString) return [];

    return [
      {
        chartId: row.chartId,
        name: row.name,
        city: row.city ?? "",
        birthDate: row.birthDate,
        ascendantSign: row.ascendantSign,
        queryString,
        savedAt: row.computedAt.toISOString(),
      },
    ];
  });
}

/** How many charts are stored, for deciding whether hydration has work to do. */
export async function countCharts(workspaceId: string): Promise<number> {
  const rows = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(chartCalculations)
    .where(
      and(
        eq(chartCalculations.workspaceId, workspaceId),
        isNull(chartCalculations.archivedAt),
      ),
    );

  return rows[0]?.n ?? 0;
}
