import { NextRequest, NextResponse } from "next/server";

import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { ChartSyncFactsSchema, ChartSyncRequestSchema, firstZodError } from "@/lib/schemas";
import { DEVICE_COOKIE, deviceCookieOptions } from "@/lib/identity/device-id";
import { CALCULATION_VERSION, chartFactsFromQueryString } from "@/lib/sync/facts";
import { countCharts, listCharts, saveChart } from "@/lib/sync/charts";
import { revokeAllConsent } from "@/lib/sync/consent";
import { ensureRequestWorkspace, findRequestWorkspace } from "@/lib/sync/workspace";

/**
 * Charts that belong to an account rather than to a browser.
 *
 * The same three verbs serve a signed-in visitor and a guest, because
 * lib/sync/workspace resolves both to a workspace and nothing below that layer
 * can tell them apart. A guest's charts are as stored as anyone's; what they
 * lack is a way to reach them from a second device.
 *
 *   GET     what is stored, for hydrating an empty browser
 *   POST    store this chart — requires consent in the body
 *   DELETE  withdraw consent and delete what it was permitting
 *
 * GET never creates a workspace, POST does. That split is the reason a crawler
 * fetching pages does not leave rows behind.
 */

/** node, not edge: device ids and session tokens are signed with node:crypto. */
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
    const workspace = await findRequestWorkspace(request.cookies);

    /* No workspace is a normal state, not an error: it is what every first
       visit looks like. An empty list is the honest answer. */
    if (!workspace) {
      return noStore(NextResponse.json({ charts: [], stored: 0, workspace: null }));
    }

    const charts = await listCharts(workspace.workspaceId);

    return noStore(
      NextResponse.json({
        charts,
        stored: charts.length,
        workspace: workspace.kind,
      }),
    );
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

    const { workspace, deviceCookieValue } = await ensureRequestWorkspace(request.cookies);

    const result = await saveChart(
      workspace.workspaceId,
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

    const response = noStore(
      NextResponse.json({
        chartId: result.chartId,
        created: result.created,
        workspace: workspace.kind,
      }),
    );

    if (deviceCookieValue) {
      response.cookies.set(DEVICE_COOKIE, deviceCookieValue, deviceCookieOptions());
    }

    return response;
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    return storeUnavailable();
  }
}

/**
 * Withdraw consent for everything in this workspace.
 *
 * Deletes the birth profiles and, by cascade, the calculations over them; the
 * consent rows stay, marked revoked, because "permission was given and then
 * withdrawn" is the fact an audit needs and a delete would destroy.
 */
export async function DELETE(request: NextRequest) {
  try {
    const workspace = await findRequestWorkspace(request.cookies);

    /* Nothing stored is the desired end state, so saying so is not a lie and
       a 404 would make the client handle a case that does not matter. */
    if (!workspace) {
      return noStore(NextResponse.json({ revoked: 0, remaining: 0 }));
    }

    const revoked = await revokeAllConsent(workspace.workspaceId);
    const remaining = await countCharts(workspace.workspaceId);

    return noStore(NextResponse.json({ revoked, remaining }));
  } catch {
    return storeUnavailable();
  }
}
