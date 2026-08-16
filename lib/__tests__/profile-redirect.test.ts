import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveProfileDestination } from "@/lib/profile-redirect";
import { chartHistoryKey } from "@/lib/chart-history-store";
import { listSavedCharts } from "@/lib/workspace-store";

vi.mock("@/lib/workspace-store", () => ({
  listSavedCharts: vi.fn(),
}));

const mockedListSavedCharts = vi.mocked(listSavedCharts);

const PROFILE = "profile-1";

const completeQuery =
  "name=Asha&birthDate=1992-05-12&birthTime=08%3A30&timezoneOffsetMinutes=330&latitude=22.57&longitude=88.36&country=India&state=West+Bengal&city=Kolkata&engineId=lahiri_classic";

describe("profile redirects", () => {
  beforeEach(() => {
    localStorage.clear();
    mockedListSavedCharts.mockReset();
    mockedListSavedCharts.mockResolvedValue([]);
  });

  it("routes a profile with chart history to engine selection", async () => {
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

    await expect(resolveProfileDestination(PROFILE, "/")).resolves.toBe(
      `/engine-select?${completeQuery}`
    );
  });

  it("routes a profile with a saved chart to engine selection", async () => {
    mockedListSavedCharts.mockResolvedValue([
      {
        saved_chart_id: "chart-1",
        name: "Asha",
        city: "Kolkata",
        birth_date: "1992-05-12",
        birth_time: "08:30",
        timezone_offset_minutes: 330,
        country: "India",
        state: "West Bengal",
        town: "",
        latitude: 22.57,
        longitude: 88.36,
        time_zone_id: "Asia/Kolkata",
        ascendant_sign: "Leo",
        query_string: completeQuery,
        notes: "",
        saved_at: "2026-04-27T10:00:00.000Z",
        updated_at: "2026-04-27T10:00:00.000Z",
        archived_at: null,
      },
    ]);

    await expect(resolveProfileDestination(PROFILE, "/")).resolves.toBe(
      `/engine-select?${completeQuery}`
    );
  });

  it("does not leak another profile's chart history", async () => {
    localStorage.setItem(
      chartHistoryKey("someone-else"),
      JSON.stringify([{ name: "Asha", queryString: completeQuery, savedAt: "2026-04-27T10:00:00.000Z" }])
    );

    await expect(resolveProfileDestination(PROFILE, "/")).resolves.toBe("/");
  });

  it("keeps new profiles on a safe internal fallback", async () => {
    await expect(
      resolveProfileDestination(PROFILE, "https://example.com")
    ).resolves.toBe("/");
  });
});
