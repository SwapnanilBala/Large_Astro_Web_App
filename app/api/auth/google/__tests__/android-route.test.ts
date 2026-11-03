import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  googleTokenFixture,
  type GoogleTokenFixture,
} from "@/lib/__tests__/stubs/google-id-token-fixture";

/*
 * The Android sign-in routes, with the real token check running against a
 * local key set (the route is handed it in place of Google's), and the
 * database stubbed: the nonce store, the account linking and the session.
 */

let google: GoogleTokenFixture;

vi.mock("@/lib/identity/google-oauth", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/identity/google-oauth")>();
  return {
    ...real,
    verifyGoogleIdToken: (
      token: string,
      options: Parameters<typeof real.verifyGoogleIdToken>[1],
    ) => real.verifyGoogleIdToken(token, { ...options, keys: google.keys }),
  };
});

const consumeAndroidNonce = vi.fn<(nonce: string) => Promise<boolean>>();
const issueAndroidNonce = vi.fn<() => Promise<string>>();

vi.mock("@/lib/identity/android-nonce", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/android-nonce")>()),
  consumeAndroidNonce: (nonce: string) => consumeAndroidNonce(nonce),
  issueAndroidNonce: () => issueAndroidNonce(),
}));

type SignInWithProvider = typeof import("@/lib/identity/link-account").signInWithProvider;
const signInWithProvider = vi.fn<SignInWithProvider>();

vi.mock("@/lib/identity/link-account", () => ({
  signInWithProvider: (...args: Parameters<SignInWithProvider>) => signInWithProvider(...args),
}));

const createSession = vi.fn();
const resolveSession = vi.fn();

vi.mock("@/lib/identity/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/session")>()),
  createSession: (...args: unknown[]) => createSession(...args),
  resolveSession: (...args: unknown[]) => resolveSession(...args),
}));

const { POST } = await import("../android/route");
const { POST: NONCE } = await import("../android/nonce/route");

const ORIGINAL = { ...process.env };
const SESSION_TOKEN = "c2Vzc2lvbi10b2tlbi1mb3ItdGhlLWFwcC0xMjM0NTY3";
const EXPIRES = new Date("2026-12-03T00:00:00Z");

beforeAll(async () => {
  google = await googleTokenFixture();
});

beforeEach(() => {
  process.env.AUTH_GOOGLE_ID = google.webClientId;
  process.env.AUTH_GOOGLE_ANDROID_IDS = `${google.androidClientId},release.apps.googleusercontent.com`;

  consumeAndroidNonce.mockResolvedValue(true);
  issueAndroidNonce.mockResolvedValue("i".repeat(43));
  signInWithProvider.mockResolvedValue({ userId: "user-1", createdUser: false });
  createSession.mockResolvedValue({ token: SESSION_TOKEN, expiresAt: EXPIRES });
  resolveSession.mockResolvedValue({
    sessionId: "session-1",
    userId: "user-1",
    email: "someone@example.test",
    displayName: "Someone Kept",
    emailVerifiedAt: new Date(),
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function post(body: unknown) {
  return new NextRequest("http://localhost:7001/api/auth/google/android", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "LagnaAtelier-Android" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function signIn(overrides: Record<string, unknown> = {}, nonce?: string) {
  return POST(post({ idToken: await google.sign(overrides), nonce: nonce ?? google.nonce }));
}

async function errorCode(response: Response) {
  return ((await response.json()) as { error?: { code?: string } }).error?.code;
}

describe("POST /api/auth/google/android", () => {
  it("signs in with a valid token and returns a session token, not a cookie", async () => {
    const response = await signIn();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.getSetCookie()).toEqual([]);
    await expect(response.json()).resolves.toEqual({
      token: SESSION_TOKEN,
      expiresAt: EXPIRES.toISOString(),
      user: { email: "someone@example.test", displayName: "Someone Kept" },
    });

    expect(consumeAndroidNonce).toHaveBeenCalledWith(google.nonce);
    expect(signInWithProvider).toHaveBeenCalledWith({
      provider: "google",
      subject: "google-subject-1",
      email: "someone@example.test",
      emailVerified: true,
      name: "Someone",
    });
    expect(createSession).toHaveBeenCalledWith("user-1", expect.objectContaining({
      userAgent: "LagnaAtelier-Android",
    }));
  });

  it("accepts a token handed to any listed Android client", async () => {
    const response = await signIn({ azp: "release.apps.googleusercontent.com" });
    expect(response.status).toBe(200);
  });

  it("logs a new account the way the web callback does", async () => {
    signInWithProvider.mockResolvedValue({ userId: "user-9", createdUser: true });
    await signIn();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("account_created"));
  });

  it.each([
    ["a bad signature", async () => google.sign({}, { signWithStranger: true })],
    ["the wrong audience", async () => google.sign({ aud: "other-app.apps.googleusercontent.com" })],
    ["an Android client not listed", async () => google.sign({ azp: "stranger.apps.googleusercontent.com" })],
    ["an expired token", async () => {
      const past = Math.floor(Date.now() / 1000) - 7200;
      return google.sign({ iat: past - 3600, exp: past });
    }],
    ["the wrong issuer", async () => google.sign({ iss: "https://evil.example" })],
    ["another nonce in the token", async () => google.sign({ nonce: "z".repeat(43) })],
  ])("refuses %s with a coarse invalid_token and starts no session", async (_, token) => {
    const response = await POST(post({ idToken: await token(), nonce: google.nonce }));

    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("invalid_token");
    expect(consumeAndroidNonce).not.toHaveBeenCalled();
    expect(signInWithProvider).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("refuses a nonce that was never issued, has expired or was already used", async () => {
    consumeAndroidNonce.mockResolvedValue(false);

    const response = await signIn();

    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("invalid_token");
    expect(signInWithProvider).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("refuses an unverified email after using up the nonce", async () => {
    const response = await signIn({ email_verified: false });

    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("email_unverified");
    expect(signInWithProvider).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("refuses a malformed body before checking anything", async () => {
    for (const body of [
      "not json",
      {},
      { idToken: "not-a-jwt", nonce: google.nonce },
      { idToken: await google.sign(), nonce: "short" },
    ]) {
      const response = await POST(post(body));
      expect(response.status).toBe(400);
      expect(await errorCode(response)).toBe("invalid_request");
    }
    expect(consumeAndroidNonce).not.toHaveBeenCalled();
  });

  it("refuses an oversized body", async () => {
    const response = await POST(post({ idToken: "a".repeat(20_000), nonce: google.nonce }));
    expect(response.status).toBe(413);
  });

  it("says it is not set up when no Android client is configured", async () => {
    delete process.env.AUTH_GOOGLE_ANDROID_IDS;

    const response = await signIn();

    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe("not_configured");
  });

  it("answers signin_failed when the account store fails, with nothing about why", async () => {
    signInWithProvider.mockRejectedValue(new Error("relation auth_users does not exist"));

    const response = await signIn();
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).toContain("signin_failed");
    expect(text).not.toContain("auth_users");
  });
});

describe("POST /api/auth/google/android/nonce", () => {
  it("issues a nonce, uncached", async () => {
    const response = await NONCE();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ nonce: "i".repeat(43) });
  });

  it("says it is not set up when no Android client is configured", async () => {
    delete process.env.AUTH_GOOGLE_ANDROID_IDS;

    const response = await NONCE();

    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe("not_configured");
    expect(issueAndroidNonce).not.toHaveBeenCalled();
  });

  it("answers 503 when the nonce cannot be stored", async () => {
    issueAndroidNonce.mockRejectedValue(new Error("connection refused"));

    const response = await NONCE();

    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe("unavailable");
  });
});
