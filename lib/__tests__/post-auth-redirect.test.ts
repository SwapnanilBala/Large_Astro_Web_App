import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAuthCallbackUrl, resolvePostAuthDestination } from "@/lib/post-auth-redirect";
import { listSavedCharts } from "@/lib/workspace-store";

vi.mock("@/lib/workspace-store", () => ({
  listSavedCharts: vi.fn(),
}));

const mockedListSavedCharts = vi.mocked(listSavedCharts);

const completeQuery =
  "name=Asha&birthDate=1992-05-12&birthTime=08%3A30&timezoneOffsetMinutes=330&latitude=22.57&longitude=88.36&country=India&state=West+Bengal&city=Kolkata&engineId=lahiri_classic";

describe("post-auth redirects", () => {
  beforeEach(() => {
    localStorage.clear();
    mockedListSavedCharts.mockReset();
    mockedListSavedCharts.mockResolvedValue([]);
  });

  it("routes returning local chart users to engine selection", async () => {
    localStorage.setItem(
      "astro_chart_history",
      JSON.stringify([
        {
          queryString: completeQuery,
          savedAt: "2026-04-27T10:00:00.000Z",
        },
      ])
    );

    await expect(resolvePostAuthDestination("user-1", "/")).resolves.toBe(
      `/engine-select?${completeQuery}`
    );
  });

  it("routes returning remote chart users to engine selection", async () => {
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

    await expect(resolvePostAuthDestination("user-1", "/")).resolves.toBe(
      `/engine-select?${completeQuery}`
    );
  });

  it("keeps new users on a safe internal fallback", async () => {
    await expect(resolvePostAuthDestination("user-1", "https://example.com")).resolves.toBe("/");
  });

  it("builds a same-origin auth callback URL", () => {
    expect(buildAuthCallbackUrl("/pricing")).toBe("http://localhost:3000/auth/callback?next=%2Fpricing");
  });
});
