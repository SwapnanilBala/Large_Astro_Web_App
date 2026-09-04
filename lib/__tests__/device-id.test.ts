import { beforeEach, describe, expect, it } from "vitest";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

/* device-id reads the secret at call time, not import time, so setting it here
   is enough and each test can change it. */
process.env.DEVICE_ID_SECRET = SECRET;

const {
  mintDeviceId,
  readDeviceId,
  anonymousSubject,
  deviceCookieOptions,
  workspaceIdForDevice,
} = await import("@/lib/identity/device-id");

describe("device id signing", () => {
  beforeEach(() => {
    process.env.DEVICE_ID_SECRET = SECRET;
  });

  it("round-trips a minted id", () => {
    const cookie = mintDeviceId();
    expect(readDeviceId(cookie)).toBe(cookie.slice(0, cookie.lastIndexOf(".")));
  });

  it("mints a different id every time", () => {
    const ids = new Set(Array.from({ length: 50 }, () => mintDeviceId()));
    expect(ids.size).toBe(50);
  });

  it("rejects a missing or empty cookie", () => {
    expect(readDeviceId(undefined)).toBeNull();
    expect(readDeviceId(null)).toBeNull();
    expect(readDeviceId("")).toBeNull();
  });

  it("rejects a value with no signature", () => {
    expect(readDeviceId("just-an-id")).toBeNull();
    expect(readDeviceId("just-an-id.")).toBeNull();
    expect(readDeviceId(".onlyatag")).toBeNull();
  });

  it("rejects a tampered id", () => {
    const cookie = mintDeviceId();
    const at = cookie.lastIndexOf(".");
    const tampered = `${cookie.slice(0, at - 1)}X${cookie.slice(at)}`;
    expect(readDeviceId(tampered)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const cookie = mintDeviceId();
    expect(readDeviceId(`${cookie}X`)).toBeNull();
    expect(readDeviceId(cookie.slice(0, -1))).toBeNull();
  });

  it("rejects a cookie signed with a different secret", () => {
    const cookie = mintDeviceId();
    process.env.DEVICE_ID_SECRET = "a-completely-different-secret-32-chars!!";
    expect(readDeviceId(cookie)).toBeNull();
  });

  it("refuses to run without a usable secret", () => {
    process.env.DEVICE_ID_SECRET = "";
    expect(() => mintDeviceId()).toThrow(/DEVICE_ID_SECRET/);

    process.env.DEVICE_ID_SECRET = "too-short";
    expect(() => mintDeviceId()).toThrow(/32 characters/);
  });

  it("namespaces the subject so it cannot collide with a provider id", () => {
    expect(anonymousSubject("abc")).toBe("anon:abc");
  });

  it("keeps the cookie unreadable to scripts and same-site", () => {
    const options = deviceCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("fits inside the 255-char auth_user_id column", () => {
    const cookie = mintDeviceId();
    const id = readDeviceId(cookie)!;
    expect(anonymousSubject(id).length).toBeLessThanOrEqual(255);
  });
});

describe("derived workspace id", () => {
  beforeEach(() => {
    process.env.DEVICE_ID_SECRET = SECRET;
  });

  it("is stable for one device", () => {
    expect(workspaceIdForDevice("device-a")).toBe(workspaceIdForDevice("device-a"));
  });

  it("differs between devices", () => {
    expect(workspaceIdForDevice("device-a")).not.toBe(workspaceIdForDevice("device-b"));
  });

  it("is a well-formed v5 UUID Postgres will accept", () => {
    expect(workspaceIdForDevice("device-a")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("is not derivable without the secret", () => {
    const withSecret = workspaceIdForDevice("device-a");
    process.env.DEVICE_ID_SECRET = "a-completely-different-secret-32-chars!!";
    expect(workspaceIdForDevice("device-a")).not.toBe(withSecret);
  });
});
