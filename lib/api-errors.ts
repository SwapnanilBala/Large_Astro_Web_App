/**
 * Structured error handling for API routes.
 *
 * Provides a typed ApiError class, an error-code enum, and a helper
 * that converts any thrown value into a consistent JSON response.
 */

import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export enum ErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  RATE_LIMITED = "RATE_LIMITED",
  COMPUTATION_FAILED = "COMPUTATION_FAILED",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  NOT_FOUND = "NOT_FOUND",
  INTERNAL = "INTERNAL",
}

/** Map error codes to default HTTP status codes. */
const DEFAULT_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.COMPUTATION_FAILED]: 503,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.INTERNAL]: 500,
};

// ---------------------------------------------------------------------------
// ApiError class
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    opts?: { statusCode?: number; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = opts?.statusCode ?? DEFAULT_STATUS[code];
    this.details = opts?.details;
  }
}

// ---------------------------------------------------------------------------
// Response helper
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Convert any thrown value into a structured JSON error response.
 *
 * - `ApiError` instances use their own code / status / details.
 * - Plain `Error` objects become `INTERNAL` errors.
 * - Everything else becomes a generic 500.
 */
export function errorResponse(
  error: unknown,
  fallbackMessage = "An unexpected error occurred",
): NextResponse<ApiErrorBody> {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.statusCode },
    );
  }

  const message =
    error instanceof Error ? error.message : fallbackMessage;

  return NextResponse.json(
    {
      error: {
        code: ErrorCode.INTERNAL,
        message,
      },
    },
    { status: 500 },
  );
}
