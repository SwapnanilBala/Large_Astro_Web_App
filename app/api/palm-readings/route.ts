/**
 * /api/palm-readings  — list + create persisted palm readings.
 *
 * --------------------------------------------------------------------------
 * REQUIRED MIGRATION (apply via supabase/migrations/0001_palm_readings.sql):
 * --------------------------------------------------------------------------
 *
 *   create extension if not exists pgcrypto;
 *
 *   create table if not exists public.palm_readings (
 *     id uuid primary key default gen_random_uuid(),
 *     user_id uuid not null references auth.users(id) on delete cascade,
 *     created_at timestamptz not null default now(),
 *     title text,
 *     image_data_url text not null,
 *     reading jsonb not null,
 *     jyotish_context jsonb,
 *     classical_mode boolean not null default false,
 *     notes text,
 *     deleted_at timestamptz
 *   );
 *
 *   create index if not exists idx_palm_readings_user_created
 *     on public.palm_readings (user_id, created_at desc)
 *     where deleted_at is null;
 *
 *   alter table public.palm_readings enable row level security;
 *
 *   create policy "Users can read own palm readings" on public.palm_readings
 *     for select using (auth.uid() = user_id);
 *   create policy "Users can insert own palm readings" on public.palm_readings
 *     for insert with check (auth.uid() = user_id);
 *   create policy "Users can update own palm readings" on public.palm_readings
 *     for update using (auth.uid() = user_id);
 *   create policy "Users can delete own palm readings" on public.palm_readings
 *     for delete using (auth.uid() = user_id);
 *
 * --------------------------------------------------------------------------
 */

import { NextRequest, NextResponse } from "next/server";
import { ApiError, ErrorCode, errorResponse } from "@/lib/api-errors";
import {
  authenticatePalmRequest,
  getBearerToken,
} from "@/lib/palm-readings/auth";
import { getServerSupabaseForUser } from "@/lib/palm-readings/supabase-server";
import type {
  PalmReadingJSON,
  PalmReadingSummary,
} from "@/lib/palm-readings/types";

const MAX_IMAGE_DATA_URL_CHARS = 9_500_000; // ≈ 7MB after base64 overhead

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

// ---------------------------------------------------------------------------
// GET — list
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
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
      .select("id, created_at, title, classical_mode, reading")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      logApiError("/api/palm-readings GET", error, { userId: auth.userId });
      throw new ApiError(
        ErrorCode.INTERNAL,
        "Failed to load saved readings.",
      );
    }

    const rows = (data ?? []) as Array<{
      id: string;
      created_at: string;
      title: string | null;
      classical_mode: boolean;
      reading: PalmReadingJSON | null;
    }>;

    const summaries: PalmReadingSummary[] = rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      title: row.title,
      classical_mode: Boolean(row.classical_mode),
      reading_summary: {
        overall_summary:
          (row.reading && typeof row.reading.overall_summary === "string"
            ? row.reading.overall_summary
            : "") ?? "",
        dominant_hand_note:
          (row.reading && typeof row.reading.dominant_hand_note === "string"
            ? row.reading.dominant_hand_note
            : "") ?? "",
      },
    }));

    return NextResponse.json({ readings: summaries });
  } catch (error) {
    logApiError("/api/palm-readings GET", error);
    if (error instanceof ApiError) {
      return errorResponse(error, "Failed to load saved readings");
    }
    return errorResponse(
      new ApiError(ErrorCode.INTERNAL, "Failed to load saved readings."),
      "Failed to load saved readings",
    );
  }
}

// ---------------------------------------------------------------------------
// POST — create
// ---------------------------------------------------------------------------

type CreateBody = {
  title?: unknown;
  image_data_url?: unknown;
  reading?: unknown;
  jyotish_context?: unknown;
  classical_mode?: unknown;
  notes?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request.headers.get("authorization"));
    const auth = await authenticatePalmRequest(token);
    if (!auth.ok) return unauthorized(auth.error, auth.status);

    let body: CreateBody;
    try {
      body = (await request.json()) as CreateBody;
    } catch {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Request body must be valid JSON.",
      );
    }

    if (!body || typeof body !== "object") {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Request body must be an object.",
      );
    }

    // -- image_data_url --
    if (
      typeof body.image_data_url !== "string" ||
      body.image_data_url.length === 0
    ) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "image_data_url is required.",
      );
    }
    if (!body.image_data_url.startsWith("data:image/")) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "image_data_url must be a data:image/* URL.",
      );
    }
    if (body.image_data_url.length > MAX_IMAGE_DATA_URL_CHARS) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Palm image is too large. Please upload an image under 5MB.",
        { statusCode: 413 },
      );
    }

    // -- reading --
    if (
      !body.reading ||
      typeof body.reading !== "object" ||
      Array.isArray(body.reading)
    ) {
      throw new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "reading must be an object.",
      );
    }

    // -- optional fields --
    const title =
      typeof body.title === "string" && body.title.trim().length > 0
        ? body.title.trim().slice(0, 200)
        : null;

    const notes =
      typeof body.notes === "string" && body.notes.trim().length > 0
        ? body.notes.trim()
        : null;

    const classical_mode = body.classical_mode === true;

    let jyotish_context: Record<string, unknown> | null = null;
    if (body.jyotish_context !== undefined && body.jyotish_context !== null) {
      if (
        typeof body.jyotish_context !== "object" ||
        Array.isArray(body.jyotish_context)
      ) {
        throw new ApiError(
          ErrorCode.VALIDATION_FAILED,
          "jyotish_context must be an object when provided.",
        );
      }
      jyotish_context = body.jyotish_context as Record<string, unknown>;
    }

    const supabase = getServerSupabaseForUser(token as string);
    if (!supabase) {
      throw new ApiError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "Palm reading storage is temporarily unavailable.",
        { statusCode: 503 },
      );
    }

    const insertRow = {
      user_id: auth.userId,
      title,
      image_data_url: body.image_data_url,
      reading: body.reading as Record<string, unknown>,
      jyotish_context,
      classical_mode,
      notes,
    };

    const { data, error } = await supabase
      .from("palm_readings")
      .insert(insertRow)
      .select("id, created_at")
      .single();

    if (error || !data) {
      logApiError("/api/palm-readings POST", error, { userId: auth.userId });
      throw new ApiError(
        ErrorCode.INTERNAL,
        "Failed to save reading.",
      );
    }

    return NextResponse.json(
      { id: data.id as string, created_at: data.created_at as string },
      { status: 201 },
    );
  } catch (error) {
    logApiError("/api/palm-readings POST", error);
    if (error instanceof ApiError) {
      return errorResponse(error, "Failed to save reading");
    }
    return errorResponse(
      new ApiError(ErrorCode.INTERNAL, "Failed to save reading."),
      "Failed to save reading",
    );
  }
}
