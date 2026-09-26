import { describe, expect, it } from "vitest";
import { ACCOUNT_LABEL_MAX_AGE_MS, accountLabel } from "../account-label";
import { SESSION_MAX_AGE_SECONDS } from "../identity/session";

/*
 * The navbar and the intake page hold signed-in room before first paint off a
 * label this device stored at its last signed-in check. That is only right
 * while the session could still be alive: trusted any longer, a lapsed reader
 * gets a signed-in stand-in that collapses (a layout shift, 0.11 on the intake
 * page). The window lives in account-label.ts rather than being imported from
 * session.ts, which pulls in the database, so this keeps the two in step.
 */
describe("the stored account label", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("is trusted for less time than a session can last", () => {
    expect(ACCOUNT_LABEL_MAX_AGE_MS).toBeLessThan(SESSION_MAX_AGE_SECONDS * 1000);
  });

  it("allows for the session refreshing its expiry at most once a day", () => {
    expect(SESSION_MAX_AGE_SECONDS * 1000 - ACCOUNT_LABEL_MAX_AGE_MS).toBeGreaterThanOrEqual(DAY_MS);
  });

  it("is the name the navbar shows, or the address when there is no name", () => {
    expect(accountLabel({ email: "a@example.com", displayName: "Asha" })).toBe("Asha");
    expect(accountLabel({ email: "a@example.com", displayName: null })).toBe("a@example.com");
  });
});
