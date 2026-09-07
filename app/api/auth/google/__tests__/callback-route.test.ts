import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GOOGLE_NONCE_COOKIE,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
} from "@/lib/identity/google-oauth";

/* The handshake is proven in google-oauth.test.ts; what matters here is the
   tail of the callback, which needs a verified identity to reach at all. The
   network and the database are stubbed so the test is about the route's own
   control flow rather than either of those. */
vi.mock("@/lib/identity/google-oauth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/google-oauth")>()),
  exchangeCode: vi.fn(async () => ({
    subject: "google-subject-1",
    email: "someone@example.test",
    emailVerified: true,
    name: "Someone",
  })),
}));

/* Typed against the real signature so the assertions below are about what the
   route actually passes rather than about whatever an untyped mock recorded. */
type SignInWithProvider = typeof import("@/lib/identity/link-account").signInWithProvider;

const signInWithProvider = vi.fn<SignInWithProvider>(async () => ({
  userId: "user-1",
  createdUser: false,
}));

vi.mock("@/lib/identity/link-account", () => ({
  signInWithProvider: (...args: Parameters<SignInWithProvider>) =>
    signInWithProvider(...args),
}));

vi.mock("@/lib/identity/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/session")>()),
  createSession: vi.fn(async () => ({
    token: "session-token",
    expiresAt: new Date(Date.now() + 60_000),
  })),
}));

const { GET } = await import("../callback/route");

const ORIGINAL = { ...process.env };
const STATE = "a-state-value";

beforeEach(() => {
  process.env.AUTH_GOOGLE_ID = "test-client-id.apps.googleusercontent.com";
  process.env.AUTH_GOOGLE_SECRET = "test-client-secret";
  process.env.APP_ORIGIN = "http://localhost:7001";

  signInWithProvider.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

function callback() {
  const url = new URL("http://localhost:7001/api/auth/google/callback");
  url.searchParams.set("code", "an-authorization-code");
  url.searchParams.set("state", STATE);

  const cookies = [
    `${GOOGLE_STATE_COOKIE}=${STATE}`,
    `${GOOGLE_VERIFIER_COOKIE}=a-verifier`,
    `${GOOGLE_NONCE_COOKIE}=a-nonce`,
  ];

  return new NextRequest(url, { headers: { cookie: cookies.join("; ") } });
}

describe("/api/auth/google/callback", () => {
  it("signs in and redirects on a verified identity", async () => {
    const response = await GET(callback());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:7001/");
  });

  it("passes the verified provider identity through, and nothing else", async () => {
    await GET(callback());

    /* One argument. The second used to be the device id, so that sign-in could
       claim the browser's anonymous workspace; 0006 removed `workspaces` and
       with it any reason for the route to know which browser this is. */
    expect(signInWithProvider.mock.calls[0]).toHaveLength(1);
    expect(signInWithProvider.mock.calls[0]?.[0]).toEqual({
      provider: "google",
      subject: "google-subject-1",
      email: "someone@example.test",
      emailVerified: true,
      name: "Someone",
    });
  });

  it("does not depend on DEVICE_ID_SECRET being set", async () => {
    /* This was a real 500: a returning visitor carried `astro_did`, the
       callback read it outside the try block, and reading it throws without a
       usable secret — so one missing environment variable broke the last step
       of an otherwise successful sign-in. The route no longer touches the
       device cookie at all, which is what keeps that class of failure gone. */
    delete process.env.DEVICE_ID_SECRET;

    const response = await GET(callback());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:7001/");
  });
});
