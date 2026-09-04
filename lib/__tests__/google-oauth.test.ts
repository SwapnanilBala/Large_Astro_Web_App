import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.AUTH_GOOGLE_ID = "test-client-id.apps.googleusercontent.com";
  process.env.AUTH_GOOGLE_SECRET = "test-client-secret";
  process.env.APP_ORIGIN = "http://localhost:7001";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

const {
  readGoogleConfig,
  missingGoogleConfig,
  startHandshake,
  codeChallengeFor,
  handshakeCookieOptions,
} = await import("@/lib/identity/google-oauth");

describe("configuration", () => {
  it("builds the redirect uri from APP_ORIGIN, not the request", () => {
    expect(readGoogleConfig()?.redirectUri).toBe(
      "http://localhost:7001/api/auth/google/callback",
    );
  });

  it("tolerates a trailing slash on the origin", () => {
    process.env.APP_ORIGIN = "https://example.test/";
    expect(readGoogleConfig()?.redirectUri).toBe(
      "https://example.test/api/auth/google/callback",
    );
  });

  it("reports missing configuration instead of throwing", () => {
    delete process.env.AUTH_GOOGLE_SECRET;
    expect(readGoogleConfig()).toBeNull();
    expect(missingGoogleConfig()).toEqual(["AUTH_GOOGLE_SECRET"]);
  });
});

describe("authorize url", () => {
  const params = () =>
    new URL(startHandshake(readGoogleConfig()!).authorizeUrl).searchParams;

  it("points at Google with the code flow and openid scopes", () => {
    const url = new URL(startHandshake(readGoogleConfig()!).authorizeUrl);
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
  });

  it("carries PKCE with S256, never plain", () => {
    expect(params().get("code_challenge_method")).toBe("S256");
    expect(params().get("code_challenge")).toBeTruthy();
  });

  it("sends the challenge, never the verifier", () => {
    const handshake = startHandshake(readGoogleConfig()!);
    const sent = new URL(handshake.authorizeUrl).searchParams;
    expect(sent.get("code_challenge")).not.toBe(handshake.codeVerifier);
    expect(handshake.authorizeUrl).not.toContain(handshake.codeVerifier);
  });

  it("derives the challenge as base64url(sha256(verifier))", () => {
    const handshake = startHandshake(readGoogleConfig()!);
    const expected = createHash("sha256")
      .update(handshake.codeVerifier)
      .digest("base64url");
    expect(new URL(handshake.authorizeUrl).searchParams.get("code_challenge")).toBe(
      expected,
    );
    expect(codeChallengeFor(handshake.codeVerifier)).toBe(expected);
  });

  it("asks for no refresh token, since this is sign-in only", () => {
    expect(params().get("access_type")).toBe("online");
  });

  it("uses fresh state, verifier and nonce every time", () => {
    const runs = Array.from({ length: 20 }, () =>
      startHandshake(readGoogleConfig()!),
    );
    expect(new Set(runs.map((r) => r.state)).size).toBe(20);
    expect(new Set(runs.map((r) => r.codeVerifier)).size).toBe(20);
    expect(new Set(runs.map((r) => r.nonce)).size).toBe(20);
  });

  it("keeps state and nonce distinct within one handshake", () => {
    const handshake = startHandshake(readGoogleConfig()!);
    expect(handshake.state).not.toBe(handshake.nonce);
    expect(handshake.state).not.toBe(handshake.codeVerifier);
  });

  it("meets the RFC 7636 verifier length bounds", () => {
    const { codeVerifier } = startHandshake(readGoogleConfig()!);
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeVerifier.length).toBeLessThanOrEqual(128);
  });
});

describe("handshake cookies", () => {
  it("are httpOnly and lax so they survive the return from Google", () => {
    const options = handshakeCookieOptions();
    expect(options.httpOnly).toBe(true);
    /* strict would withhold these on the cross-site hop back, and every
       sign-in would fail state validation. */
    expect(options.sameSite).toBe("lax");
  });

  it("expire on their own so a stale tab cannot resume a handshake", () => {
    expect(handshakeCookieOptions().maxAge).toBeLessThanOrEqual(60 * 15);
  });
});
