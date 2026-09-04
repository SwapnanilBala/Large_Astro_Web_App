/**
 * Password hashing.
 *
 * scrypt from node:crypto rather than argon2 or bcrypt: it is memory-hard, it
 * is in the standard library, and it needs no native build step — which matters
 * on a serverless target where a compiled dependency is the thing that breaks
 * the deploy rather than the thing that secures it.
 *
 * The stored format carries its own parameters, so raising the cost later does
 * not invalidate existing hashes. `needsRehash` reports which ones are behind,
 * and the natural moment to upgrade one is the next successful sign-in, when
 * the plaintext is in hand anyway.
 */

import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/**
 * Hand-rolled rather than `promisify(scrypt)`: promisify collapses to the
 * three-argument overload, so the cost parameters were silently being passed
 * to a signature with nowhere to put them. Typecheck caught it; at runtime it
 * would have hashed at scrypt's defaults, which are far weaker than these.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

/**
 * Cost parameters. N=16384, r=8 puts each hash at roughly 16MB and tens of
 * milliseconds — enough to make offline cracking expensive, small enough that a
 * burst of sign-ins does not exhaust a small instance.
 */
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_BYTES = 64;
const SALT_BYTES = 16;
const ALGORITHM = "scrypt";

/**
 * scrypt's own guard: it refuses parameters whose working set exceeds maxmem,
 * and the default (32MB) sits below what N=16384, r=8 needs. Raising it here is
 * required for these parameters to run at all, not a loosening of anything.
 */
const MAX_MEM = 64 * 1024 * 1024;

/**
 * The shortest password accepted.
 *
 * Length is the only rule. Composition rules (a digit, a symbol, mixed case)
 * push people toward `Password1!` and away from long passphrases, which is the
 * opposite of what they are for.
 */
export const MIN_PASSWORD_LENGTH = 12;

/** bcrypt's 72-byte input cap has no analogue here, but an unbounded password is a denial-of-service vector. */
export const MAX_PASSWORD_LENGTH = 256;

export type PasswordProblem = "too_short" | "too_long" | "empty";

/** Check a candidate before spending ~40ms hashing something that cannot be stored. */
export function checkPasswordPolicy(password: string): PasswordProblem | null {
  if (!password) return "empty";
  if (password.length < MIN_PASSWORD_LENGTH) return "too_short";
  if (password.length > MAX_PASSWORD_LENGTH) return "too_long";
  return null;
}

/**
 * Hash a password into a self-describing string:
 * `scrypt$N$r$p$<salt base64url>$<hash base64url>`
 */
export async function hashPassword(password: string): Promise<string> {
  const problem = checkPasswordPolicy(password);
  if (problem) {
    throw new Error(`Password rejected by policy: ${problem}`);
  }

  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_BYTES, {
    ...PARAMS,
    maxmem: MAX_MEM,
  });

  return [
    ALGORITHM,
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

type ParsedHash = {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
};

function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split("$");
  if (parts.length !== 6) return null;

  const [algorithm, rawN, rawR, rawP, rawSalt, rawHash] = parts;
  if (algorithm !== ALGORITHM) return null;

  const N = Number.parseInt(rawN, 10);
  const r = Number.parseInt(rawR, 10);
  const p = Number.parseInt(rawP, 10);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (N < 2 || r < 1 || p < 1) return null;

  try {
    const salt = Buffer.from(rawSalt, "base64url");
    const hash = Buffer.from(rawHash, "base64url");
    if (salt.length === 0 || hash.length === 0) return null;
    return { N, r, p, salt, hash };
  } catch {
    return null;
  }
}

/**
 * Is this password the one behind the stored hash?
 *
 * Returns false rather than throwing for a malformed stored value: a corrupted
 * row should fail the sign-in, not the request.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed || !password) return false;

  try {
    const derived = await scrypt(
      password.normalize("NFKC"),
      parsed.salt,
      parsed.hash.length,
      { N: parsed.N, r: parsed.r, p: parsed.p, maxmem: MAX_MEM },
    );

    if (derived.length !== parsed.hash.length) return false;
    return timingSafeEqual(derived, parsed.hash);
  } catch {
    return false;
  }
}

/** True when a stored hash predates the current cost parameters. */
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  if (!parsed) return true;
  return parsed.N !== PARAMS.N || parsed.r !== PARAMS.r || parsed.p !== PARAMS.p;
}

/**
 * Spend roughly what a real verification spends, and return false.
 *
 * Sign-in must take the same time whether or not the email exists, or the
 * response time answers "is this person registered here?" for anyone who asks.
 * Call this on the no-such-user branch.
 */
export async function fakeVerify(password: string): Promise<false> {
  const salt = randomBytes(SALT_BYTES);
  try {
    await scrypt(password.normalize("NFKC"), salt, KEY_BYTES, {
      ...PARAMS,
      maxmem: MAX_MEM,
    });
  } catch {
    /* Timing padding only; nothing depends on the result. */
  }
  return false;
}
