import { beforeEach, describe, expect, it } from "vitest";
import { resolveProfileDestination } from "@/lib/profile-redirect";
import { chartHistoryKey } from "@/lib/chart-history-store";

const PROFILE = "profile-1";

const completeQuery =
  "name=Asha&birthDate=1992-05-12&birthTime=08%3A30&timezoneOffsetMinutes=330&latitude=22.57&longitude=88.36&country=India&state=West+Bengal&city=Kolkata&engineId=lahiri_classic";

describe("profile redirects", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("routes a profile with chart history to engine selection", () => {
    localStorage.setItem(
      chartHistoryKey(PROFILE),
      JSON.stringify([
        {
          name: "Asha",
          city: "Kolkata",
          birthDate: "1992-05-12",
          ascendantSign: "Leo",
          queryString: completeQuery,
          savedAt: "2026-04-27T10:00:00.000Z",
        },
      ])
    );

    expect(resolveProfileDestination(PROFILE, "/")).toBe(`/engine-select?${completeQuery}`);
  });

  it("ignores a history entry that is missing birth details", () => {
    localStorage.setItem(
      chartHistoryKey(PROFILE),
      JSON.stringify([
        {
          name: "Asha",
          city: "Kolkata",
          birthDate: "1992-05-12",
          ascendantSign: "Leo",
          queryString: "name=Asha&birthDate=1992-05-12",
          savedAt: "2026-04-27T10:00:00.000Z",
        },
      ])
    );

    expect(resolveProfileDestination(PROFILE, "/")).toBe("/");
  });

  it("does not leak another profile's chart history", () => {
    localStorage.setItem(
      chartHistoryKey("someone-else"),
      JSON.stringify([{ name: "Asha", queryString: completeQuery, savedAt: "2026-04-27T10:00:00.000Z" }])
    );

    expect(resolveProfileDestination(PROFILE, "/")).toBe("/");
  });

  it("keeps new profiles on a safe internal fallback", () => {
    expect(resolveProfileDestination(PROFILE, "https://example.com")).toBe("/");
  });
});
