import "server-only";

/**
 * Google sign-in, authorization-code flow with PKCE.
 *
 * Hand-rolled apart from the JWT check, which uses `jose`. The split is
 * deliberate: building an authorize URL and posting a form to a token endpoint
 * is ordinary code, whereas verifying a signed token is where hand-rolling goes
 * wrong — algorithm confusion, `alg: none`, unchecked `iss`/`aud`, key
 * substitution. `jose` pins the algorithm and validates the claims, and
 * `createRemoteJWKSet` caches Google's keys and refetches them on rotation.
 *
 * Three separate defences travel through the flow, and each stops a different
 * attack:
 *   state    — the response belongs to a request this browser started (CSRF)
 *   verifier — the code was issued to whoever is redeeming it (PKCE)
 *   nonce    — the id_token was minted for this sign-in, not replayed
 */

import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";

/** Google issues id_tokens under both spellings; either is legitimate. */
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export const GOOGLE_STATE_COOKIE = "astro_oauth_state";
export const GOOGLE_VERIFIER_COOKIE = "astro_oauth_verifier";
export const GOOGLE_NONCE_COOKIE = "astro_oauth_nonce";
export const GOOGLE_RETURN_COOKIE = "astro_oauth_return";

/** Long enough for a slow sign-in, short enough that a stale tab cannot resume. */
export const OAUTH_HANDSHAKE_MAX_AGE = 60 * 10;

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/**
 * Read configuration, or explain precisely what is missing.
 *
 * Returns null rather than throwing so a route can answer "Google sign-in is
 * not configured" instead of a 500 — this is a deployment state, not a bug.
 */
export function readGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  const origin = process.env.APP_ORIGIN;

  if (!clientId || !clientSecret || !origin) return null;

  return {
    clientId,
    clientSecret,
    /* Built from configuration, never from the request's Host header, which is
       attacker-controlled. It must also match Google's registered value
       exactly, so the trailing slash is stripped rather than trusted. */
    redirectUri: `${origin.replace(/\/+$/, "")}/api/auth/google/callback`,
  };
}

export function missingGoogleConfig(): string[] {
  return (["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "APP_ORIGIN"] as const).filter(
    (key) => !process.env[key],
  );
}

export type Handshake = {
  authorizeUrl: string;
  state: string;
  codeVerifier: string;
  nonce: string;
};

function base64UrlRandom(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** S256 challenge for a verifier, per RFC 7636. */
export function codeChallengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Everything needed to send someone to Google, plus the secrets to stash. */
export function startHandshake(config: GoogleConfig): Handshake {
  const state = base64UrlRandom();
  const codeVerifier = base64UrlRandom(64);
  const nonce = base64UrlRandom();

  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", codeChallengeFor(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  /* No offline access and no consent prompt: this is sign-in, not delegated
     API access. Asking for a refresh token we would never use means holding a
     long-lived credential for no reason. */
  url.searchParams.set("access_type", "online");

  return { authorizeUrl: url.toString(), state, codeVerifier, nonce };
}

export type GoogleIdentity = {
  /** Google's stable subject. The account key — never the email. */
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

const jwks = createRemoteJWKSet(new URL(JWKS_URI));

type TokenResponse = { id_token?: string };

/**
 * Exchange the code for an id_token and return the verified identity.
 *
 * Throws on any failure. Callers should treat every throw the same way — a
 * generic "sign-in failed" — since distinguishing them for the visitor tells an
 * attacker which step they reached.
 */
export async function exchangeCode(
  config: GoogleConfig,
  code: string,
  codeVerifier: string,
  expectedNonce: string,
): Promise<GoogleIdentity> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed with ${response.status}`);
  }

  const payload = (await response.json()) as TokenResponse;
  if (!payload.id_token) {
    throw new Error("Google token response carried no id_token");
  }

  const { payload: claims } = await jwtVerify(payload.id_token, jwks, {
    issuer: ISSUERS,
    audience: config.clientId,
    algorithms: ["RS256"],
    /* Google's own leeway guidance; without a bound, a clock skew of hours
       would be accepted. */
    clockTolerance: 60,
  });

  if (typeof claims.nonce !== "string" || claims.nonce !== expectedNonce) {
    throw new Error("Google id_token nonce did not match this sign-in");
  }

  const subject = typeof claims.sub === "string" ? claims.sub : "";
  const email = typeof claims.email === "string" ? claims.email : "";
  if (!subject || !email) {
    throw new Error("Google id_token was missing sub or email");
  }

  /* Google will hand over unverified addresses for some account types. Taking
     one would let somebody claim an address they do not control and, through
     account linking, an existing account with it. */
  const emailVerified = claims.email_verified === true;

  return {
    subject,
    email,
    emailVerified,
    name: typeof claims.name === "string" ? claims.name : null,
  };
}

/** Cookie attributes for the three short-lived handshake values. */
export function handshakeCookieOptions() {
  return {
    httpOnly: true,
    /* `lax` so the cookies survive the cross-site navigation back from Google.
       `strict` withholds them on exactly that hop and every sign-in fails. */
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_HANDSHAKE_MAX_AGE,
  };
}
