import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The nonce store against a fake table. The SQL itself is drizzle's; what is
 * pinned here is the contract the sign-in route relies on: only a hash is
 * written, a nonce works once, and a malformed one never reaches the store.
 */

type Row = { nonceHash: string; expiresAt: Date };
const table = new Map<string, Row>();
let expired = new Set<string>();
const inserted: Row[] = [];

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    insert: () => ({
      values: (row: Row) => {
        inserted.push(row);
        return { kind: "insert", row };
      },
    }),
    delete: () => ({
      where: () => ({
        kind: "prune",
        /* consumeAndroidNonce's shape: delete one row by hash, if live. The
           fake reads the hash the module is about to look for from `pending`. */
        returning: async () => {
          const hash = pending;
          const row = hash ? table.get(hash) : undefined;
          if (!row || expired.has(hash!)) return [];
          table.delete(hash!);
          return [{ nonceHash: hash }];
        },
      }),
    }),
    batch: async (statements: { kind: string; row?: Row }[]) => {
      for (const statement of statements) {
        if (statement.kind === "insert" && statement.row) {
          table.set(statement.row.nonceHash, statement.row);
        }
      }
      return [];
    },
  }),
}));

let pending: string | null = null;

const { ANDROID_NONCE_PATTERN, consumeAndroidNonce, hashNonce, issueAndroidNonce } =
  await import("@/lib/identity/android-nonce");

async function consume(nonce: string) {
  pending = hashNonce(nonce);
  return consumeAndroidNonce(nonce);
}

beforeEach(() => {
  table.clear();
  expired = new Set();
  inserted.length = 0;
  pending = null;
});

describe("android nonces", () => {
  it("issues 43-character base64url nonces and stores only their hash", async () => {
    const nonce = await issueAndroidNonce(new Date("2026-11-03T10:00:00Z"));

    expect(nonce).toMatch(ANDROID_NONCE_PATTERN);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].nonceHash).toBe(hashNonce(nonce));
    expect(inserted[0].nonceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(inserted)).not.toContain(nonce);
    /* Ten minutes, the web handshake's window. */
    expect(inserted[0].expiresAt.toISOString()).toBe("2026-11-03T10:10:00.000Z");
  });

  it("works once, and a second use is refused", async () => {
    const nonce = await issueAndroidNonce();

    await expect(consume(nonce)).resolves.toBe(true);
    await expect(consume(nonce)).resolves.toBe(false);
  });

  it("refuses a nonce it never issued, and one that has expired", async () => {
    await expect(consume("u".repeat(43))).resolves.toBe(false);

    const nonce = await issueAndroidNonce();
    expired.add(hashNonce(nonce));
    await expect(consume(nonce)).resolves.toBe(false);
  });

  it("refuses a malformed nonce without asking the store", async () => {
    pending = null;
    await expect(consumeAndroidNonce("short")).resolves.toBe(false);
    await expect(consumeAndroidNonce("x".repeat(43) + "; drop table")).resolves.toBe(false);
  });

  it("makes a different nonce every time", async () => {
    const nonces = await Promise.all(Array.from({ length: 20 }, () => issueAndroidNonce()));
    expect(new Set(nonces).size).toBe(20);
  });
});
