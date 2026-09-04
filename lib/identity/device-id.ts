/**
 * Opaque, signed device identifiers.
 *
 * This app has no login. A visitor who saves a chart still needs something
 * durable to hang that row off, so the server mints a random id, signs it, and
 * keeps it in an httpOnly cookie. `workspace_members.auth_user_id` is a plain
 * varchar precisely so an identity like this is a legal value there — a later
 * Google or password account is a second row against the same workspace, not a
 * migration of this one.
 *
 * Why the signature, when 32 random bytes are already unguessable: an unsigned
 * cookie means any string a visitor types becomes a new identity, so a typo, a
 * truncating proxy, or a curious person editing devtools silently creates
 * orphan workspaces that look like real ones. Verifying rejects those before
 * they reach the database. It is integrity, not secrecy — a stolen cookie is
 * still a stolen cookie, which is why this only ever guards anonymous data and
 * why signing in has to issue a different credential.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Cookie the signed device id travels in. */
export const DEVICE_COOKIE = "astro_did";

/** A year. Long enough to be useful, short enough to expire an abandoned device. */
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Raw id length in bytes before encoding. 32 bytes is 256 bits of entropy. */
const ID_BYTES = 32;

/** Truncated HMAC. 16 bytes is far past what forging a tag would need. */
const TAG_BYTES = 16;

const SEPARATOR = ".";

/**
 * Read the signing secret.
 *
 * Deliberately throws rather than falling back to a constant. A default secret
 * committed to a repository is the same as no signature at all, and the failure
 * it causes is silent — every deployment sharing that default would accept
 * every other deployment's cookies.
 */
function getSecret(): string {
  const secret = process.env.DEVICE_ID_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "DEVICE_ID_SECRET must be set to at least 32 characters. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }

  return secret;
}

function sign(id: string, secret: string): string {
  return createHmac("sha256", secret).update(id).digest("base64url").slice(0, TAG_BYTES * 2);
}

/** A fresh signed device id, suitable for a cookie value. */
export function mintDeviceId(): string {
  const id = randomBytes(ID_BYTES).toString("base64url");
  return `${id}${SEPARATOR}${sign(id, getSecret())}`;
}

/**
 * Recover the id from a cookie value, or null if it is missing, malformed, or
 * carries a signature this server did not produce.
 *
 * Callers must treat null as "no identity yet" and mint a new one — never as an
 * error worth surfacing, since an expired or rotated secret lands here too.
 */
export function readDeviceId(cookieValue: string | undefined | null): string | null {
  if (!cookieValue) return null;

  const separatorAt = cookieValue.lastIndexOf(SEPARATOR);
  if (separatorAt <= 0) return null;

  const id = cookieValue.slice(0, separatorAt);
  const tag = cookieValue.slice(separatorAt + 1);
  if (!id || !tag) return null;

  const expected = sign(id, getSecret());

  /* Compare in constant time. Both sides are the same length by construction,
     but a caller-supplied tag is not, and timingSafeEqual throws on a length
     mismatch rather than returning false. */
  const tagBuffer = Buffer.from(tag);
  const expectedBuffer = Buffer.from(expected);
  if (tagBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(tagBuffer, expectedBuffer)) return null;

  return id;
}

/**
 * The `auth_user_id` written to `workspace_members`.
 *
 * Namespaced so an anonymous device can never collide with a real provider
 * subject once Google or password accounts exist alongside it.
 */
export function anonymousSubject(deviceId: string): string {
  return `anon:${deviceId}`;
}

/**
 * A stable, well-formed UUID for a device id.
 *
 * `workspaces.id` is derived rather than generated so that creating the row is
 * an idempotent upsert — see `resolveAnonymousWorkspace` for why that matters.
 * The version and variant nibbles are forced so the value is a real RFC 4122
 * UUID rather than 16 arbitrary bytes wearing the format; Postgres accepts
 * either, but tooling that parses the version does not.
 */
export function workspaceIdForDevice(deviceId: string): string {
  const digest = createHmac("sha256", getSecret())
    .update(`workspace:${deviceId}`)
    .digest();

  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** Cookie attributes. Secure is dropped in development so plain http still works. */
export function deviceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  };
}
