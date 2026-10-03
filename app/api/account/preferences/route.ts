import { NextRequest, NextResponse } from "next/server";

import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import { AccountPreferencesSchema, firstZodError } from "@/lib/schemas";
import { findRequestAccount } from "@/lib/sync/account";
import { readPreferences, saveChartStyle } from "@/lib/sync/preferences";

/**
 * A signed-in person's display preferences: read on page load, written when
 * they change one. Today that is only the results page's chart style
 * (constellation or North Indian), so the choice follows them across devices.
 *
 * Signed out is a normal state, not an error -- the browser keeps the choice
 * on its own -- so GET answers it with `signedIn: false` rather than 401. A
 * write needs an account to write to, so PUT does refuse it.
 *
 * 503 when the account store cannot be reached, including before migration
 * 0009 has been applied. The page treats any failure as "keep the choice on
 * this device", which is exactly the behaviour before this route existed.
 */

/** node, not edge: session tokens are hashed with node:crypto. */
export const runtime = "nodejs";

/** A cached response here would be somebody else's preferences. */
export const dynamic = "force-dynamic";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

function storeUnavailable() {
  return noStore(
    NextResponse.json({ detail: "Could not reach the account store." }, { status: 503 }),
  );
}

export async function GET(request: NextRequest) {
  try {
    const account = await findRequestAccount(request.cookies);
    if (!account) {
      return noStore(NextResponse.json({ signedIn: false, preferences: null }));
    }
    const preferences = await readPreferences(account.userId);
    return noStore(NextResponse.json({ signedIn: true, preferences }));
  } catch {
    return storeUnavailable();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = AccountPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, firstZodError(parsed.error));
    }

    const account = await findRequestAccount(request.cookies);
    if (!account) {
      throw new ApiError(ErrorCode.UNAUTHORIZED, "Sign in to keep preferences on your account.");
    }

    await saveChartStyle(account.userId, parsed.data.chartStyle);
    return noStore(NextResponse.json({ preferences: { chartStyle: parsed.data.chartStyle } }));
  } catch (error) {
    if (error instanceof ApiError) return noStore(errorResponse(error));
    return storeUnavailable();
  }
}
