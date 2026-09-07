import { beforeEach, describe, expect, it } from "vitest";
import { resolveLandingDestination } from "@/lib/landing-redirect";
import { chartHistoryKey } from "@/lib/chart-history-store";
import { resetLocalScopeForTests } from "@/lib/local-scope";

const completeQuery =
  "name=Asha&birthDate=1992-05-12&birthTime=08%3A30&timezoneOffsetMinutes=330&latitude=22.57&longitude=88.36&country=India&state=West+Bengal&city=Kolkata&engineId=lahiri_classic";

function seed(queryString: string) {
  localStorage.setItem(
    chartHistoryKey(),
    JSON.stringify([
      {
        name: "Asha",
        city: "Kolkata",
        birthDate: "1992-05-12",
        ascendantSign: "Leo",
        queryString,
        savedAt: "2026-04-27T10:00:00.000Z",
      },
    ]),
  );
}

describe("landing redirects", () => {
  beforeEach(() => {
    localStorage.clear();
    resetLocalScopeForTests();
  });

  it("routes a browser with chart history to engine selection", () => {
    seed(completeQuery);
    expect(resolveLandingDestination("/")).toBe(`/engine-select?${completeQuery}`);
  });

  it("ignores a history entry that is missing birth details", () => {
    seed("name=Asha&birthDate=1992-05-12");
    expect(resolveLandingDestination("/")).toBe("/");
  });

  it("does not read history left under a retired profile key", () => {
    localStorage.setItem(
      "astro_chart_history:someone-else",
      JSON.stringify([
        { name: "Asha", queryString: completeQuery, savedAt: "2026-04-27T10:00:00.000Z" },
      ]),
    );

    /* Nothing points at that profile any more, so the migration does not adopt
       it and neither does this. */
    expect(resolveLandingDestination("/")).toBe("/");
  });

  it("keeps a fresh browser on a safe internal fallback", () => {
    expect(resolveLandingDestination("https://example.com")).toBe("/");
  });
});
