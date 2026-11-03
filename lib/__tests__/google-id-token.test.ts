import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { googleTokenFixture, type GoogleTokenFixture } from "./stubs/google-id-token-fixture";

/*
 * verifyGoogleIdToken against a key set made here, so every way a token can be
 * wrong is tested without the network. Each failing case changes exactly one
 * thing about an otherwise valid token, so a case that passes for the wrong
 * reason (an unrelated claim being off) cannot hide.
 */

const { readGoogleAndroidConfig, verifyGoogleIdToken } = await import(
  "@/lib/identity/google-oauth"
);

const ORIGINAL = { ...process.env };
let google: GoogleTokenFixture;

beforeAll(async () => {
  google = await googleTokenFixture();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

function verify(token: string, overrides: { nonce?: string; parties?: string[] } = {}) {
  return verifyGoogleIdToken(token, {
    audience: google.webClientId,
    expectedNonce: overrides.nonce ?? google.nonce,
    authorizedParties: overrides.parties ?? [google.androidClientId],
    keys: google.keys,
  });
}

describe("verifyGoogleIdToken", () => {
  it("accepts a valid token and returns the identity", async () => {
    await expect(verify(await google.sign())).resolves.toEqual({
      subject: "google-subject-1",
      email: "someone@example.test",
      emailVerified: true,
      name: "Someone",
    });
  });

  it("accepts the issuer without its scheme, which Google also uses", async () => {
    await expect(verify(await google.sign({ iss: "accounts.google.com" }))).resolves.toBeTruthy();
  });

  it("refuses a token signed by a key that is not Google's", async () => {
    await expect(verify(await google.sign({}, { signWithStranger: true }))).rejects.toThrow();
  });

  it("refuses a token whose signature was tampered with", async () => {
    const [header, payload] = (await google.sign()).split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...google.claims(), email: "victim@example.test" }),
    ).toString("base64url");
    const [, , signature] = (await google.sign()).split(".");
    expect(forgedPayload).not.toBe(payload);
    await expect(verify(`${header}.${forgedPayload}.${signature}`)).rejects.toThrow();
  });

  it("refuses a token minted for another app's client (wrong audience)", async () => {
    await expect(
      verify(await google.sign({ aud: "someone-elses-app.apps.googleusercontent.com" })),
    ).rejects.toThrow();
  });

  it("refuses a token handed to an Android client this app does not list (wrong azp)", async () => {
    await expect(
      verify(await google.sign({ azp: "another-android-client.apps.googleusercontent.com" })),
    ).rejects.toThrow(/client/);
  });

  it("refuses a token with no azp when Android clients are required", async () => {
    const claims = google.claims();
    delete (claims as Record<string, unknown>).azp;
    await expect(verify(await google.signClaims(claims))).rejects.toThrow(/client/);
  });

  it("refuses an issuer that is not Google", async () => {
    await expect(verify(await google.sign({ iss: "https://evil.example" }))).rejects.toThrow();
  });

  it("refuses an expired token, beyond the minute of leeway", async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    await expect(verify(await google.sign({ iat: past - 3600, exp: past }))).rejects.toThrow();
  });

  it("refuses a token with no expiry at all", async () => {
    const claims = google.claims();
    delete (claims as Record<string, unknown>).exp;
    await expect(verify(await google.signClaims(claims))).rejects.toThrow();
  });

  it("refuses an algorithm other than RS256", async () => {
    await expect(verify(google.signHs256())).rejects.toThrow();
    await expect(verify(google.unsigned())).rejects.toThrow();
  });

  it("refuses a token without the nonce, or with another one", async () => {
    const claims = google.claims();
    delete (claims as Record<string, unknown>).nonce;
    await expect(verify(await google.signClaims(claims))).rejects.toThrow(/nonce/);
    await expect(verify(await google.sign({ nonce: "x".repeat(43) }))).rejects.toThrow(/nonce/);
    await expect(verify(await google.sign(), { nonce: "y".repeat(43) })).rejects.toThrow(/nonce/);
  });

  it("refuses a token with no email", async () => {
    const claims = google.claims();
    delete (claims as Record<string, unknown>).email;
    await expect(verify(await google.signClaims(claims))).rejects.toThrow(/email/);
  });

  it("reports an unverified email rather than treating it as verified", async () => {
    /* The refusal is the caller's: it decides what to say, and the web and the
       app both refuse it. What matters here is that anything but `true` is
       false. */
    await expect(verify(await google.sign({ email_verified: false }))).resolves.toMatchObject({
      emailVerified: false,
    });
    await expect(verify(await google.sign({ email_verified: "true" }))).resolves.toMatchObject({
      emailVerified: false,
    });
  });

  it("checks no azp when none is asked for, as the web callback does", async () => {
    const token = await google.sign({ azp: "the-web-client-itself" });
    await expect(
      verifyGoogleIdToken(token, {
        audience: google.webClientId,
        expectedNonce: google.nonce,
        keys: google.keys,
      }),
    ).resolves.toBeTruthy();
  });
});

describe("readGoogleAndroidConfig", () => {
  it("is null until both the web client and an Android client are set", () => {
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_ANDROID_IDS;
    expect(readGoogleAndroidConfig()).toBeNull();

    process.env.AUTH_GOOGLE_ID = "web.apps.googleusercontent.com";
    expect(readGoogleAndroidConfig()).toBeNull();

    process.env.AUTH_GOOGLE_ANDROID_IDS = " , ";
    expect(readGoogleAndroidConfig()).toBeNull();
  });

  it("splits the Android client list and trims it", () => {
    process.env.AUTH_GOOGLE_ID = "web.apps.googleusercontent.com";
    process.env.AUTH_GOOGLE_ANDROID_IDS = " debug.apps.googleusercontent.com,release.apps.googleusercontent.com ,";
    expect(readGoogleAndroidConfig()).toEqual({
      audience: "web.apps.googleusercontent.com",
      authorizedParties: [
        "debug.apps.googleusercontent.com",
        "release.apps.googleusercontent.com",
      ],
    });
  });
});
