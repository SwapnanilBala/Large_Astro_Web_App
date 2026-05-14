/**
 * /api/palm-readings/compare?ids=<id1>,<id2>
 *
 * Returns { a, b, diff } for two readings owned by the caller.
 * If either id is missing or doesn't belong to the user, responds 404
 * (without leaking ownership info).
 */

import { NextRequest, NextResponse } from "next/server";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import {
  authenticatePalmRequest,
  getBearerToken,
} from "@/lib/palm-readings/auth";
import { getServerSupabaseForUser } from "@/lib/palm-readings/supabase-server";
import { computeReadingDiff } from "@/lib/palm-readings/diff";
import type { PalmReadingRecord } from "@/lib/palm-readings/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function logApiError(
  route: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      route,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    }),
  );
}

function unauthorized(error: string, status: number) {
  return errorResponse(
    new ApiError(
      status === 403
        ? ErrorCode.FORBIDDEN
        : status === 503
          ? ErrorCode.EXTERNAL_SERVICE_ERROR
          : ErrorCode.UNAUTHORIZED,
      error,
      { statusCode: status },
    ),
    error,
  );
}

function notFound() {
  return errorResponse(
    new ApiError(ErrorCode.NOT_FOUND, "One or both readings were not found."),
    "Reading not found",
  );
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request.headers.get("authorization"));
    const auth = await authenticatePalmRequest(token);
    if (!auth.ok) return unauthorized(auth.error, auth.status);

    const idsParam = request.nextUrl.searchParams.get("ids") ?? "";
    const ids = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (ids.length !== 2) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Provide exactly two ids: ?ids=<id1>,<id2>.",
      );
    }
    if (!ids.every((id) => UUID_RE.test(id))) {
      // Treat malformed ids as not-found to avoid leaking which is invalid.
      return notFound();
    }
    const [idA, idB] = ids;
    if (idA === idB) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "The two ids must be different.",
      );
    }

    const supabase = getServerSupabaseForUser(token as string);
    if (!supabase) {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "Palm reading storage is temporarily unavailable.",
        { statusCode: 503 },
      );
    }

    const { data, error } = await supabase
      .from("palm_readings")
      .select("*")
      .in("id", [idA, idB])
      .eq("user_id", auth.userId)
      .is("deleted_at", null);

    if (error) {
      logApiError("/api/palm-readings/compare GET", error, {
        userId: auth.userId,
        ids,
      });
      throw new ApiError(ErrorCode.INTERNAL, "Failed to load readings.");
    }

    const rows = (data ?? []) as PalmReadingRecord[];
    if (rows.length !== 2) return notFound();

    const a = rows.find((r) => r.id === idA);
    const b = rows.find((r) => r.id === idB);
    if (!a || !b) return notFound();

    const diff = computeReadingDiff(a, b);

    return NextResponse.json({ a, b, diff });
  } catch (error) {
    logApiError("/api/palm-readings/compare GET", error);
    if (error instanceof ApiError) {
      return errorResponse(error, "Failed to compare readings");
    }
    return errorResponse(
      new ApiError(ErrorCode.INTERNAL, "Failed to compare readings."),
      "Failed to compare readings",
    );
  }
}
