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
// Plain messages
// ---------------------------------------------------------------------------

/**
 * What a reader is told when something fails that nobody wrote a message for.
 *
 * An unexpected error's own text is never sent: an SDK error carries the
 * provider's raw JSON body and request id (a rejected key once reached the
 * page as `401 {"type":"error",...,"request_id":"req_..."}`), a database
 * error names tables and hosts, and none of it helps the reader. The detail
 * goes to the server log instead (see `logUnexpectedError`).
 */
export const PLAIN_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.UNAUTHORIZED]: "Please sign in and try again.",
  [ErrorCode.FORBIDDEN]: "This is not available to your account.",
  [ErrorCode.VALIDATION_FAILED]: "Some of the details sent were not valid. Please check them and try again.",
  [ErrorCode.RATE_LIMITED]: "Too many requests just now. Please wait a moment and try again.",
  [ErrorCode.COMPUTATION_FAILED]: "The calculation could not be finished. Please try again.",
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: "The reading service did not answer. Please try again.",
  [ErrorCode.NOT_FOUND]: "That could not be found.",
  [ErrorCode.INTERNAL]: "Something went wrong on our side. Please try again.",
};

// ---------------------------------------------------------------------------
// Server-side detail
// ---------------------------------------------------------------------------

/** The parts of a thrown value worth keeping in a log line. */
export interface ErrorDetail {
  name?: string;
  message: string;
  status?: number;
  requestId?: string;
  stack?: string;
}

const REQUEST_ID_IN_TEXT = /req_[A-Za-z0-9]+/;
const STACK_LIMIT = 4000;

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function headerValue(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== "object") return undefined;
  if (typeof (headers as Headers).get === "function") {
    return stringField((headers as Headers).get(name));
  }
  return stringField((headers as Record<string, unknown>)[name]);
}

/**
 * The provider's request id, wherever the SDK put it: `requestID` (the
 * Anthropic and OpenAI SDKs), `request_id`, the response headers, the parsed
 * error body, or failing all of those, the message text itself.
 */
function providerRequestId(error: object, message: string): string | undefined {
  const record = error as Record<string, unknown>;
  const body =
    record.error && typeof record.error === "object" ? (record.error as Record<string, unknown>) : undefined;
  return (
    stringField(record.requestID) ??
    stringField(record.request_id) ??
    headerValue(record.headers, "request-id") ??
    headerValue(record.headers, "x-request-id") ??
    stringField(body?.request_id) ??
    message.match(REQUEST_ID_IN_TEXT)?.[0]
  );
}

/** Describe any thrown value for a log line (never for a response body). */
export function describeError(error: unknown): ErrorDetail {
  if (error instanceof Error) {
    const status = (error as { status?: unknown }).status;
    const requestId = providerRequestId(error, error.message);
    /* The SDK errors leave `name` at "Error"; their class says which one. */
    const name = error.name === "Error" && error.constructor?.name ? error.constructor.name : error.name;
    return {
      name,
      message: error.message,
      ...(typeof status === "number" ? { status } : {}),
      ...(requestId ? { requestId } : {}),
      ...(error.stack ? { stack: error.stack.slice(0, STACK_LIMIT) } : {}),
    };
  }
  if (error !== null && typeof error === "object") {
    let message: string;
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
    const requestId = providerRequestId(error, message);
    return { message, ...(requestId ? { requestId } : {}) };
  }
  return { message: String(error) };
}

export interface ErrorContext {
  /** The route that failed, e.g. "/api/chart/area-classics". */
  route?: string;
  /** What was being attempted, in the route's own words. */
  operation?: string;
}

/** Write an unexpected error to the server log as one line of JSON. */
export function logUnexpectedError(error: unknown, context: ErrorContext & { code: ErrorCode }) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "unexpected_error",
      ...(context.route ? { route: context.route } : {}),
      ...(context.operation ? { operation: context.operation } : {}),
      code: context.code,
      error: describeError(error),
    }),
  );
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
 * - `ApiError` instances use their own code / status / message / details:
 *   those were written on purpose, for the reader or the app.
 * - Anything else is unexpected. The reader gets `INTERNAL`, a 500 and the
 *   plain message; the error itself, with any provider request id, goes to
 *   the server log. `operation` (the route's own phrase for what failed) and
 *   `context.route` label that log line; neither is sent.
 */
export function errorResponse(
  error: unknown,
  operation?: string,
  context?: ErrorContext,
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

  logUnexpectedError(error, {
    route: context?.route,
    operation: context?.operation ?? operation,
    code: ErrorCode.INTERNAL,
  });

  return NextResponse.json(
    {
      error: {
        code: ErrorCode.INTERNAL,
        message: PLAIN_MESSAGES[ErrorCode.INTERNAL],
      },
    },
    { status: DEFAULT_STATUS[ErrorCode.INTERNAL] },
  );
}
