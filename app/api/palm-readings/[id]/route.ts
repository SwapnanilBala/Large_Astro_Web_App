/**
 * /api/palm-readings/[id] — fetch, edit metadata, soft-delete a single reading.
 */

import { NextRequest, NextResponse } from "next/server";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import {
  authenticatePalmRequest,
  getBearerToken,
} from "@/lib/palm-readings/auth";
import { getServerSupabaseForUser } from "@/lib/palm-readings/supabase-server";
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
    new ApiError(ErrorCode.NOT_FOUND, "Reading not found."),
    "Reading not found",
  );
}

type RouteContext = { params: Promise<{ id: string }> } | { params: { id: string } };

async function resolveId(context: RouteContext): Promise<string | null> {
  // Next.js 15 may pass params as a Promise; handle both shapes safely.
  const raw = (context as { params: unknown }).params;
  const params =
    raw && typeof (raw as Promise<unknown>).then === "function"
      ? ((await (raw as Promise<{ id: string }>)) as { id: string })
      : (raw as { id: string });
  const id = params?.id;
  if (typeof id !== "string" || !UUID_RE.test(id)) return null;
  return id;
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const id = await resolveId(context);
    if (!id) return notFound();

    const token = getBearerToken(request.headers.get("authorization"));
    const auth = await authenticatePalmRequest(token);
    if (!auth.ok) return unauthorized(auth.error, auth.status);

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
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      logApiError("/api/palm-readings/[id] GET", error, {
        userId: auth.userId,
        id,
      });
      throw new ApiError(ErrorCode.INTERNAL, "Failed to load reading.");
    }
    if (!data) return notFound();

    return NextResponse.json({ reading: data as PalmReadingRecord });
  } catch (error) {
    logApiError("/api/palm-readings/[id] GET", error);
    if (error instanceof ApiError) {
      return errorResponse(error, "Failed to load reading");
    }
    return errorResponse(
      new ApiError(ErrorCode.INTERNAL, "Failed to load reading."),
      "Failed to load reading",
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — title and/or notes only
// ---------------------------------------------------------------------------

type PatchBody = {
  title?: unknown;
  notes?: unknown;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const id = await resolveId(context);
    if (!id) return notFound();

    const token = getBearerToken(request.headers.get("authorization"));
    const auth = await authenticatePalmRequest(token);
    if (!auth.ok) return unauthorized(auth.error, auth.status);

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Request body must be valid JSON.",
      );
    }

    const updates: Record<string, string | null> = {};

    if (body.title !== undefined) {
      if (body.title === null) {
        updates.title = null;
      } else if (typeof body.title === "string") {
        const trimmed = body.title.trim();
        updates.title = trimmed.length > 0 ? trimmed.slice(0, 200) : null;
      } else {
        throw new ApiError(
          ErrorCode.VALIDATION_FAILED,
          "title must be a string or null.",
        );
      }
    }

    if (body.notes !== undefined) {
      if (body.notes === null) {
        updates.notes = null;
      } else if (typeof body.notes === "string") {
        const trimmed = body.notes.trim();
        updates.notes = trimmed.length > 0 ? trimmed : null;
      } else {
        throw new ApiError(
          ErrorCode.VALIDATION_FAILED,
          "notes must be a string or null.",
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Provide at least one of: title, notes.",
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
      .update(updates)
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("id, title, notes, created_at")
      .maybeSingle();

    if (error) {
      logApiError("/api/palm-readings/[id] PATCH", error, {
        userId: auth.userId,
        id,
      });
      throw new ApiError(ErrorCode.INTERNAL, "Failed to update reading.");
    }
    if (!data) return notFound();

    return NextResponse.json({ reading: data });
  } catch (error) {
    logApiError("/api/palm-readings/[id] PATCH", error);
    if (error instanceof ApiError) {
      return errorResponse(error, "Failed to update reading");
    }
    return errorResponse(
      new ApiError(ErrorCode.INTERNAL, "Failed to update reading."),
      "Failed to update reading",
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — soft-delete
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const id = await resolveId(context);
    if (!id) return notFound();

    const token = getBearerToken(request.headers.get("authorization"));
    const auth = await authenticatePalmRequest(token);
    if (!auth.ok) return unauthorized(auth.error, auth.status);

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
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      logApiError("/api/palm-readings/[id] DELETE", error, {
        userId: auth.userId,
        id,
      });
      throw new ApiError(ErrorCode.INTERNAL, "Failed to delete reading.");
    }
    if (!data) return notFound();

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    logApiError("/api/palm-readings/[id] DELETE", error);
    if (error instanceof ApiError) {
      return errorResponse(error, "Failed to delete reading");
    }
    return errorResponse(
      new ApiError(ErrorCode.INTERNAL, "Failed to delete reading."),
      "Failed to delete reading",
    );
  }
}
