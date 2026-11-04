// @vitest-environment node
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, describeError, ErrorCode, errorResponse, PLAIN_MESSAGES } from "@/lib/api-errors";

/*
 * The incident this pins: a rejected key made /api/chart/area-classics answer
 * `{"error":{"code":"INTERNAL","message":"401 {\"type\":\"error\",...,
 * \"request_id\":\"req_...\"}"}}`, the provider's raw body and request id on
 * the reader's page.
 */

const REQUEST_ID = "req_011CTestLeakCheck";
const UPSTREAM = {
  type: "error",
  error: { type: "authentication_error", message: "invalid x-api-key" },
  request_id: REQUEST_ID,
};

function anthropicKeyRejected() {
  return new Anthropic.AuthenticationError(401, UPSTREAM, undefined, new Headers({ "request-id": REQUEST_ID }));
}

/** Every console.error line that parsed as JSON. */
function loggedLines(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown>[] {
  return spy.mock.calls.flatMap((call: unknown[]) => {
    try {
      return [JSON.parse(String(call[0])) as Record<string, unknown>];
    } catch {
      return [];
    }
  });
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errorResponse on an unexpected error", () => {
  it("answers the plain INTERNAL message, with none of the provider's text", async () => {
    const error = anthropicKeyRejected();
    // The SDK really does put the raw body in the message; that is the leak.
    expect(error.message).toContain("invalid x-api-key");

    const response = errorResponse(error, "The classical notes could not be prepared.", {
      route: "/api/chart/area-classics",
    });
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      error: { code: "INTERNAL", message: PLAIN_MESSAGES[ErrorCode.INTERNAL] },
    });
    for (const leak of ["invalid x-api-key", "authentication_error", REQUEST_ID, "req_", "401"]) {
      expect(text).not.toContain(leak);
    }
  });

  it("puts the detail in one JSON log line: route, code, name, message, status and request id", () => {
    errorResponse(anthropicKeyRejected(), "The classical notes could not be prepared.", {
      route: "/api/chart/area-classics",
    });
    const [line] = loggedLines(errorSpy).filter((entry) => entry.event === "unexpected_error");
    expect(line).toMatchObject({
      route: "/api/chart/area-classics",
      operation: "The classical notes could not be prepared.",
      code: "INTERNAL",
      error: {
        name: "AuthenticationError",
        status: 401,
        requestId: REQUEST_ID,
      },
    });
    expect((line.error as { message: string }).message).toContain("invalid x-api-key");
  });

  it("does not send a database error's text or a stack", async () => {
    const error = new Error('relation "auth_users" does not exist (connect ECONNREFUSED 10.0.0.5:5432)');
    const text = await errorResponse(error, "Chart calculation failed").text();
    expect(text).not.toContain("auth_users");
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).not.toContain("at ");
    expect(JSON.parse(text).error.message).toBe(PLAIN_MESSAGES[ErrorCode.INTERNAL]);
  });

  it("answers a thrown string or object the same way", async () => {
    for (const thrown of ["boom: secret", { message: "secret", request_id: REQUEST_ID }, undefined]) {
      const response = errorResponse(thrown);
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).not.toContain("secret");
      expect(JSON.parse(text).error.code).toBe("INTERNAL");
    }
  });
});

describe("errorResponse on an ApiError", () => {
  it("keeps the message, status and details written for the reader and the app", async () => {
    const error = new ApiError(ErrorCode.RATE_LIMITED, "Sign in to keep reading classical notes today.", {
      details: { retryAfterSeconds: 3600, scope: "anonymous" },
    });
    const response = errorResponse(error, "The classical notes could not be prepared.", {
      route: "/api/chart/area-classics",
    });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Sign in to keep reading classical notes today.",
        details: { retryAfterSeconds: 3600, scope: "anonymous" },
      },
    });
    expect(loggedLines(errorSpy).filter((entry) => entry.event === "unexpected_error")).toEqual([]);
  });

  it("keeps a validation message and a custom status", async () => {
    const response = errorResponse(
      new ApiError(ErrorCode.VALIDATION_FAILED, "Palm image is too large. Please upload an image under 5MB.", {
        statusCode: 413,
      }),
    );
    expect(response.status).toBe(413);
    expect((await response.json()).error.message).toBe("Palm image is too large. Please upload an image under 5MB.");
  });
});

describe("describeError", () => {
  it("finds an OpenAI request id", () => {
    const error = new OpenAI.AuthenticationError(
      401,
      { message: "Incorrect API key provided: sk-test", type: "invalid_request_error" },
      undefined,
      new Headers({ "x-request-id": "req_openai123" }),
    );
    expect(describeError(error)).toMatchObject({ name: "AuthenticationError", status: 401, requestId: "req_openai123" });
  });

  it("falls back to a request id in the message text", () => {
    const error = new Error('401 {"request_id":"req_fromtext42"}');
    expect(describeError(error).requestId).toBe("req_fromtext42");
  });
});
