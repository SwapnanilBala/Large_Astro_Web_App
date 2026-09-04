import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE, mintDeviceId } from "@/lib/identity/device-id";
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

/* Typed against the real signature so the assertions below are about the
   second argument the route actually passes — the device id — rather than
   about whatever an untyped mock happened to record. */
type SignInWithProvider = typeof import("@/lib/identity/link-account").signInWithProvider;

const signInWithProvider = vi.fn<SignInWithProvider>(async () => ({
  userId: "user-1",
  workspaceId: "workspace-1",
  createdUser: false,
  claimedAnonymousWorkspace: false,
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

/** A device cookie minted under a secret this server will no longer accept. */
let deviceCookie: string;

beforeEach(() => {
  process.env.AUTH_GOOGLE_ID = "test-client-id.apps.googleusercontent.com";
  process.env.AUTH_GOOGLE_SECRET = "test-client-secret";
  process.env.APP_ORIGIN = "http://localhost:7001";
  process.env.DEVICE_ID_SECRET = "a-perfectly-adequate-secret-of-32-chars";

  deviceCookie = mintDeviceId();
  signInWithProvider.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

function callback({ withDeviceCookie = true }: { withDeviceCookie?: boolean } = {}) {
  const url = new URL("http://localhost:7001/api/auth/google/callback");
  url.searchParams.set("code", "an-authorization-code");
  url.searchParams.set("state", STATE);

  const cookies = [
    `${GOOGLE_STATE_COOKIE}=${STATE}`,
    `${GOOGLE_VERIFIER_COOKIE}=a-verifier`,
    `${GOOGLE_NONCE_COOKIE}=a-nonce`,
    ...(withDeviceCookie ? [`${DEVICE_COOKIE}=${deviceCookie}`] : []),
  ];

  return new NextRequest(url, { headers: { cookie: cookies.join("; ") } });
}

describe("/api/auth/google/callback", () => {
  it("signs in and attributes the device when the secret is intact", async () => {
    const response = await GET(callback());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:7001/");
    /* The device id reached the sign-in, so the anonymous workspace is
       claimable rather than silently abandoned. */
    expect(signInWithProvider.mock.calls[0]?.[1]).toEqual(expect.any(String));
  });

  it("still signs in when DEVICE_ID_SECRET is missing, rather than throwing a 500", async () => {
    /* A returning visitor carries `astro_did`, so the callback reads it — and
       reading it throws without a usable secret. That used to happen outside
       the try block, which turned one missing environment variable into an
       unhandled 500 at the last step of an otherwise successful sign-in. */
    delete process.env.DEVICE_ID_SECRET;

    const response = await GET(callback());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:7001/");
    /* Degrades to "no device to attribute" — the safe direction, since it
       declines to claim a workspace rather than claiming the wrong one. */
    expect(signInWithProvider.mock.calls[0]?.[1]).toBeNull();
  });

  it("does not fail a first-time visitor who has no device cookie at all", async () => {
    delete process.env.DEVICE_ID_SECRET;

    const response = await GET(callback({ withDeviceCookie: false }));

    expect(response.status).toBe(303);
    expect(signInWithProvider.mock.calls[0]?.[1]).toBeNull();
  });
});
