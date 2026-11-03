import { NextRequest, NextResponse } from "next/server";

import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { ChartSyncFactsSchema, ChartSyncRequestSchema, firstZodError } from "@/lib/schemas";
import { CALCULATION_VERSION, chartFactsFromQueryString } from "@/lib/sync/facts";
import { countCharts, findChartClient, listCharts, saveChart } from "@/lib/sync/charts";
import { revokeAllConsent, revokeConsent } from "@/lib/sync/consent";
import { findRequestAccount } from "@/lib/sync/account";

/**
 * Charts that belong to a Google account rather than to a browser.
 *
 *   GET     what is stored, for hydrating an empty browser
 *   POST    store this chart — requires consent in the body
 *   DELETE  withdraw consent and delete what it was permitting, for the
 *           whole account or (?chartId=) for one person
 *
 * The browser is signed in by its cookie, the Android app by a bearer header;
 * findRequestAccount reads either.
 *
 * All three used to serve a guest as well as a signed-in visitor:
 * `lib/sync/workspace` resolved a browser to an `anon:<device>` workspace and
 * nothing below that layer could tell the two apart. Migration 0006 removed
 * `workspaces`, so `auth_users.id` is the only tenant key and **there is
 * nowhere to put a signed-out visitor's chart.** Their charts stay in the
 * browser (`lib/local-scope.ts`) and POST answers 401 until they sign in.
 *
 * 401 rather than a silent 200 is deliberate: `use-chart-sync` treats any 4xx
 * as "this chart cannot be stored" and stops, where a 5xx makes it retry. A
 * signed-out push is permanently un-storable, not a transient failure, so it
 * should cost one request and no retries.
 *
 * The read verbs answer 200 with nothing instead, because "you have no stored
 * charts" is the true and unremarkable state of every visitor who has not
 * signed in, and the callers already treat an empty list as normal.
 */

/** node, not edge: session tokens are hashed with node:crypto. */
export const runtime = "nodejs";

/** A cached response here would be somebody else's charts. */
export const dynamic = "force-dynamic";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

/**
 * The database being unreachable is not the visitor's problem to solve, and it
 * is not a reason to tell them their charts are gone. 503 and a quiet client.
 */
function storeUnavailable() {
  return noStore(
    NextResponse.json({ detail: "Could not reach the account store." }, { status: 503 }),
  );
}

export async function GET(request: NextRequest) {
  try {
    const account = await findRequestAccount(request);

    /* Signed out is a normal state, not an error: it is what every first visit
       looks like. An empty list is the honest answer. */
    if (!account) {
      return noStore(NextResponse.json({ charts: [], stored: 0 }));
    }

    const charts = await listCharts(account.userId);

    return noStore(NextResponse.json({ charts, stored: charts.length }));
  } catch {
    return storeUnavailable();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = ChartSyncRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, firstZodError(parsed.error));
    }

    const candidate = chartFactsFromQueryString(parsed.data.queryString);
    const facts = ChartSyncFactsSchema.safeParse(candidate.facts);

    if (!facts.success) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, firstZodError(facts.error));
    }

    const account = await findRequestAccount(request);

    if (!account) {
      throw new ApiError(
        ErrorCode.UNAUTHORIZED,
        "Sign in with Google to keep charts on your account.",
      );
    }

    const result = await saveChart(
      account.userId,
      {
        facts: facts.data,
        engineId: candidate.engineId,
        /* Server-decided. What computed a chart is not something the browser
           gets to assert. */
        calculationVersion: CALCULATION_VERSION,
        queryString: parsed.data.queryString,
        ascendantSign: parsed.data.ascendantSign ?? null,
        sunSign: parsed.data.sunSign ?? null,
        moonSign: parsed.data.moonSign ?? null,
        birthTimeAccuracy: candidate.birthTimeAccuracy,
        birthTimeIsFallback: candidate.birthTimeIsFallback,
      },
      {
        prompt: parsed.data.consent.prompt,
        captureSource: parsed.data.consent.captureSource,
      },
    );

    return noStore(
      NextResponse.json({ chartId: result.chartId, created: result.created }),
    );
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    return storeUnavailable();
  }
}

const CHART_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Withdraw consent: for everything on this account, or for one person.
 *
 *   DELETE /api/sync/charts                 everything ("stop syncing")
 *   DELETE /api/sync/charts?chartId=<uuid>  the person that chart is about
 *
 * Deletes the birth profiles and, by cascade, the calculations over them; the
 * consent rows stay, marked revoked, because "permission was given and then
 * withdrawn" is the fact an audit needs and a delete would destroy.
 *
 * The one-chart form is how the Android app deletes a synced chart. Consent
 * and birth details are kept per person, so it removes that person's birth
 * details and every chart over them, not one calculation: a delete that left
 * the birth date on the server would be the letter of a delete without the
 * substance. A chart id that is not this account's answers like one that is
 * already gone, so nothing is learned about other accounts.
 */
export async function DELETE(request: NextRequest) {
  try {
    const chartId = request.nextUrl.searchParams.get("chartId");
    if (chartId !== null && !CHART_ID.test(chartId)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, "chartId must be a chart id.");
    }

    const account = await findRequestAccount(request);

    /* Nothing stored is the desired end state, so saying so is not a lie and
       a 404 would make the client handle a case that does not matter. */
    if (!account) {
      return noStore(NextResponse.json({ revoked: 0, remaining: 0 }));
    }

    let revoked: number;
    if (chartId === null) {
      revoked = await revokeAllConsent(account.userId);
    } else {
      const clientId = await findChartClient(account.userId, chartId);
      revoked = clientId && (await revokeConsent(account.userId, clientId)) ? 1 : 0;
    }
    const remaining = await countCharts(account.userId);

    return noStore(NextResponse.json({ revoked, remaining }));
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    return storeUnavailable();
  }
}
