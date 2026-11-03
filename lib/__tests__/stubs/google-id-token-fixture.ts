import { createHmac } from "node:crypto";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload } from "jose";

/**
 * A stand-in for Google's signing keys, for the id_token tests.
 *
 * `keys` is a local JWKS with one RS256 key; `sign` makes a token Google
 * could have issued with it, and the options make one that is wrong in a
 * single way. The stranger key is a second RS256 key that is not in the set,
 * so a token signed with it has a valid shape and a signature nobody trusts.
 */

const KID = "test-google-key";

export type GoogleTokenFixture = Awaited<ReturnType<typeof googleTokenFixture>>;

export async function googleTokenFixture() {
  const google = await generateKeyPair("RS256");
  const stranger = await generateKeyPair("RS256");
  const publicJwk = { ...(await exportJWK(google.publicKey)), kid: KID, alg: "RS256", use: "sig" };
  const keys = createLocalJWKSet({ keys: [publicJwk] });

  const webClientId = "web-client.apps.googleusercontent.com";
  const androidClientId = "android-debug.apps.googleusercontent.com";
  const nonce = "n".repeat(43);

  function claims(overrides: Record<string, unknown> = {}): JWTPayload {
    const now = Math.floor(Date.now() / 1000);
    return {
      iss: "https://accounts.google.com",
      aud: webClientId,
      azp: androidClientId,
      sub: "google-subject-1",
      email: "someone@example.test",
      email_verified: true,
      name: "Someone",
      nonce,
      iat: now,
      exp: now + 3600,
      ...overrides,
    };
  }

  async function signClaims(payload: JWTPayload, options: { signWithStranger?: boolean } = {}) {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", kid: KID, typ: "JWT" })
      .sign(options.signWithStranger ? stranger.privateKey : google.privateKey);
  }

  return {
    keys,
    webClientId,
    androidClientId,
    nonce,
    claims,
    signClaims,
    sign: (overrides: Record<string, unknown> = {}, options: { signWithStranger?: boolean } = {}) =>
      signClaims(claims(overrides), options),
    /** Same claims, HMAC-signed: the algorithm-confusion attempt. */
    signHs256: () => {
      const header = Buffer.from(JSON.stringify({ alg: "HS256", kid: KID })).toString("base64url");
      const body = Buffer.from(JSON.stringify(claims())).toString("base64url");
      const mac = createHmac("sha256", "a-shared-secret").update(`${header}.${body}`).digest("base64url");
      return `${header}.${body}.${mac}`;
    },
    /** `alg: none`, with an empty signature. */
    unsigned: () => {
      const header = Buffer.from(JSON.stringify({ alg: "none", kid: KID })).toString("base64url");
      const body = Buffer.from(JSON.stringify(claims())).toString("base64url");
      return `${header}.${body}.`;
    },
  };
}
