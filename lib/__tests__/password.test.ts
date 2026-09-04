import { describe, expect, it } from "vitest";

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  checkPasswordPolicy,
  fakeVerify,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "@/lib/identity/password";

const GOOD = "correct horse battery staple";

describe("password policy", () => {
  it("accepts a long passphrase", () => {
    expect(checkPasswordPolicy(GOOD)).toBeNull();
  });

  it("rejects empty, short and absurdly long", () => {
    expect(checkPasswordPolicy("")).toBe("empty");
    expect(checkPasswordPolicy("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe("too_short");
    expect(checkPasswordPolicy("a".repeat(MAX_PASSWORD_LENGTH + 1))).toBe("too_long");
  });

  it("accepts exactly the minimum", () => {
    expect(checkPasswordPolicy("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });
});

describe("hashing", () => {
  it("verifies the password it was made from", async () => {
    const stored = await hashPassword(GOOD);
    await expect(verifyPassword(GOOD, stored)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const stored = await hashPassword(GOOD);
    await expect(verifyPassword(`${GOOD}x`, stored)).resolves.toBe(false);
    await expect(verifyPassword("", stored)).resolves.toBe(false);
  });

  it("salts, so the same password hashes differently every time", async () => {
    const [a, b] = await Promise.all([hashPassword(GOOD), hashPassword(GOOD)]);
    expect(a).not.toBe(b);
    await expect(verifyPassword(GOOD, a)).resolves.toBe(true);
    await expect(verifyPassword(GOOD, b)).resolves.toBe(true);
  });

  it("stores its own parameters", async () => {
    const stored = await hashPassword(GOOD);
    expect(stored.split("$").slice(0, 4)).toEqual(["scrypt", "16384", "8", "1"]);
  });

  it("refuses to hash something the policy would reject", async () => {
    await expect(hashPassword("short")).rejects.toThrow(/policy/);
  });

  it("treats equivalent unicode forms as the same password", async () => {
    /* "café" composed vs decomposed. A password typed on two keyboards must
       still sign in, which is what the NFKC normalisation is for. */
    const composed = `café ${GOOD}`.normalize("NFC");
    const decomposed = `café ${GOOD}`.normalize("NFD");
    const stored = await hashPassword(composed);
    await expect(verifyPassword(decomposed, stored)).resolves.toBe(true);
  });
});

describe("malformed stored hashes", () => {
  it("fails closed rather than throwing", async () => {
    for (const bad of [
      "",
      "not-a-hash",
      "scrypt$16384$8",
      "scrypt$16384$8$1$onlyfivefields",
      "bcrypt$16384$8$1$c2FsdA$aGFzaA",
      "scrypt$0$8$1$c2FsdA$aGFzaA",
      "scrypt$16384$8$1$$aGFzaA",
      "scrypt$abc$8$1$c2FsdA$aGFzaA",
    ]) {
      await expect(verifyPassword(GOOD, bad)).resolves.toBe(false);
    }
  });

  it("reports a malformed hash as needing a rehash", () => {
    expect(needsRehash("garbage")).toBe(true);
  });
});

describe("rehash detection", () => {
  it("leaves a current hash alone", async () => {
    expect(needsRehash(await hashPassword(GOOD))).toBe(false);
  });

  it("flags a hash made with weaker parameters", () => {
    expect(needsRehash("scrypt$1024$8$1$c2FsdA$aGFzaA")).toBe(true);
  });
});

describe("fakeVerify", () => {
  it("always returns false", async () => {
    await expect(fakeVerify(GOOD)).resolves.toBe(false);
  });

  it("costs roughly what a real verification costs", async () => {
    const stored = await hashPassword(GOOD);

    const realStart = performance.now();
    await verifyPassword(GOOD, stored);
    const real = performance.now() - realStart;

    const fakeStart = performance.now();
    await fakeVerify(GOOD);
    const fake = performance.now() - fakeStart;

    /* Generous bounds: the point is that the no-such-user branch does the same
       order of work, not that it matches to the millisecond on a shared CI box.
       A fake path that skipped hashing would come back ~1000x faster. */
    expect(fake).toBeGreaterThan(real / 10);
    expect(fake).toBeLessThan(real * 10 + 50);
  });
});
