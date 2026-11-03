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

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

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

  return verifyGoogleIdToken(payload.id_token, {
    audience: config.clientId,
    expectedNonce,
  });
}

/** Where the signing keys come from; a local key set in the tests. */
export type GoogleKeySource = JWTVerifyGetKey;

export type VerifyGoogleIdTokenOptions = {
  /** The client the token must be minted for: AUTH_GOOGLE_ID, and only it. */
  audience: string;
  /** The nonce this sign-in sent; the token must carry exactly it. */
  expectedNonce: string;
  /**
   * When given, `azp` must be one of these. The Android flow passes the
   * Android client ids: Google mints a phone's token with `aud` set to the web
   * client (the app's serverClientId) and `azp` set to the Android client that
   * asked, and it only hands that one to this package with this signature.
   */
  authorizedParties?: readonly string[];
  /** Defaults to Google's published keys, cached and refetched on rotation. */
  keys?: GoogleKeySource;
};

/**
 * Verify a Google id_token and return the identity in it.
 *
 * One check for both ways in: the web callback, which gets its token from the
 * token endpoint, and the Android app, which gets its token on the phone and
 * posts it. Throws on any failure; callers answer every throw the same coarse
 * way.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  options: VerifyGoogleIdTokenOptions,
): Promise<GoogleIdentity> {
  const { payload: claims } = await jwtVerify(idToken, options.keys ?? jwks, {
    issuer: ISSUERS,
    audience: options.audience,
    algorithms: ["RS256"],
    /* Google's own leeway guidance; without a bound, a clock skew of hours
       would be accepted. */
    clockTolerance: 60,
    /* jose checks `exp` only when it is present. A token without one would
       never expire, so it is required rather than trusted to be there. */
    requiredClaims: ["exp", "iat", "sub"],
  });

  if (
    typeof claims.nonce !== "string" ||
    !constantTimeEquals(claims.nonce, options.expectedNonce)
  ) {
    throw new Error("Google id_token nonce did not match this sign-in");
  }

  if (options.authorizedParties) {
    const azp = typeof claims.azp === "string" ? claims.azp : "";
    if (!azp || !options.authorizedParties.includes(azp)) {
      throw new Error("Google id_token was issued to a client this app does not list");
    }
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

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type GoogleAndroidConfig = {
  /** The web client id. The phone asks Google for tokens minted for it. */
  audience: string;
  /** The Android client ids (debug, release, Play signing). */
  authorizedParties: string[];
};

/**
 * What the Android sign-in needs, or null when it is not set up.
 *
 * No secret: an id_token is checked against Google's public keys. The web
 * client id is the audience, and AUTH_GOOGLE_ANDROID_IDS lists the Android
 * clients a token may have been handed to. Null rather than a throw, so the
 * route can say "not set up yet" instead of a 500.
 */
export function readGoogleAndroidConfig(): GoogleAndroidConfig | null {
  const audience = process.env.AUTH_GOOGLE_ID?.trim();
  const authorizedParties = (process.env.AUTH_GOOGLE_ANDROID_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!audience || authorizedParties.length === 0) return null;
  return { audience, authorizedParties };
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
