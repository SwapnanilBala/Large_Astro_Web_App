import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE } from "@/lib/identity/session";

const resolveSession = vi.fn();
const revokeSession = vi.fn();

vi.mock("@/lib/identity/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/session")>()),
  resolveSession: (...args: unknown[]) => resolveSession(...args),
  revokeSession: (...args: unknown[]) => revokeSession(...args),
}));

const { GET } = await import("../session/route");
const { POST } = await import("../signout/route");

const SIGNED_IN = {
  sessionId: "session-1",
  userId: "user-1",
  email: "someone@example.test",
  displayName: "Someone",
  emailVerifiedAt: new Date(),
};

function request(cookie?: string) {
  return new NextRequest("http://localhost:7001/api/auth/session", {
    headers: cookie ? { cookie } : {},
  });
}

/** The `Set-Cookie` header for a given name, if the response writes one. */
function setCookie(response: Response, name: string) {
  return response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${name}=`));
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("GET /api/auth/session", () => {
  it("reports nobody signed in when there is no cookie", async () => {
    resolveSession.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user: null });
  });

  it("returns the account when the session resolves", async () => {
    resolveSession.mockResolvedValue(SIGNED_IN);

    const response = await GET(request(`${SESSION_COOKIE}=a-token`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: { email: "someone@example.test", displayName: "Someone" },
    });
  });

  it("never returns the session id, user id or token to the browser", async () => {
    resolveSession.mockResolvedValue(SIGNED_IN);

    const body = await (await GET(request(`${SESSION_COOKIE}=a-token`))).text();

    expect(body).not.toContain("session-1");
    expect(body).not.toContain("user-1");
    expect(body).not.toContain("a-token");
  });

  it("answers 503, not `null`, when the account store is unreachable", async () => {
    /* Answering null here would render as "signed out" — a signed-in visitor
       watching their own name disappear will conclude they were logged out. */
    resolveSession.mockRejectedValue(new Error("connection refused"));

    const response = await GET(request(`${SESSION_COOKIE}=a-token`));

    expect(response.status).toBe(503);
  });

  it("is never cached", async () => {
    resolveSession.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

describe("POST /api/auth/signout", () => {
  it("revokes the session and clears the cookie", async () => {
    revokeSession.mockResolvedValue(undefined);

    const response = await POST(request(`${SESSION_COOKIE}=a-token`));

    expect(response.status).toBe(200);
    expect(revokeSession).toHaveBeenCalledWith("a-token");

    const cleared = setCookie(response, SESSION_COOKIE);
    expect(cleared).toContain("Max-Age=0");
  });

  it("still clears the cookie when revocation fails", async () => {
    /* Leaving the cookie in place would keep the visitor signed in on a screen
       that just told them they were signed out. A row that expires on its own
       is the better failure. */
    vi.spyOn(console, "error").mockImplementation(() => {});
    revokeSession.mockRejectedValue(new Error("database is down"));

    const response = await POST(request(`${SESSION_COOKIE}=a-token`));

    expect(response.status).toBe(200);
    expect(setCookie(response, SESSION_COOKIE)).toContain("Max-Age=0");
  });

  it("is harmless when nobody is signed in", async () => {
    revokeSession.mockResolvedValue(undefined);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(revokeSession).toHaveBeenCalledWith(undefined);
  });
});
