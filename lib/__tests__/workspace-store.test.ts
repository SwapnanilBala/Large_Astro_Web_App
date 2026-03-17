import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the Supabase client to return null (forces local storage path)
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => null,
}));

// We need to import after the mock is set up
import {
  listSavedCharts,
  saveChart,
  updateSavedChartNotes,
  toggleSavedChartArchive,
  deleteSavedChart,
  listSavedComparisons,
  saveComparison,
  exportWorkspaceSnapshot,
} from "../workspace-store";

const TEST_USER = "test-user-123";

function makeChartInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Test Person",
    city: "New York",
    birth_date: "1990-01-15",
    birth_time: "14:30",
    timezone_offset_minutes: -300,
    country: "US",
    state: "NY",
    town: "",
    latitude: 40.7128,
    longitude: -74.006,
    time_zone_id: "America/New_York",
    ascendant_sign: "Aries",
    query_string: "name=Test+Person&birthDate=1990-01-15",
    ...overrides,
  };
}

function makeComparisonInput(overrides: Record<string, unknown> = {}) {
  return {
    primary_name: "Person A",
    partner_name: "Person B",
    compatibility_score: 78,
    summary: "Strong compatibility in emotional and creative areas.",
    query_string: "primary=A&partner=B",
    ...overrides,
  };
}

describe("workspace-store (local storage path)", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    window.localStorage.clear();
  });

  describe("charts", () => {
    it("should return empty list when no charts exist", async () => {
      const charts = await listSavedCharts(TEST_USER);
      expect(charts).toEqual([]);
    });

    it("should save and retrieve a chart", async () => {
      const input = makeChartInput();
      const saved = await saveChart(TEST_USER, input);

      expect(saved.name).toBe("Test Person");
      expect(saved.saved_chart_id).toBeTruthy();
      expect(saved.saved_at).toBeTruthy();
      expect(saved.notes).toBe("");

      const charts = await listSavedCharts(TEST_USER);
      expect(charts).toHaveLength(1);
      expect(charts[0].name).toBe("Test Person");
    });

    it("should upsert chart with matching name/date/time", async () => {
      const input = makeChartInput();
      await saveChart(TEST_USER, input);
      await saveChart(TEST_USER, { ...input, ascendant_sign: "Taurus" });

      const charts = await listSavedCharts(TEST_USER);
      expect(charts).toHaveLength(1);
      expect(charts[0].ascendant_sign).toBe("Taurus");
    });

    it("should save distinct charts for different names", async () => {
      await saveChart(TEST_USER, makeChartInput({ name: "Person A" }));
      await saveChart(TEST_USER, makeChartInput({ name: "Person B" }));

      const charts = await listSavedCharts(TEST_USER);
      expect(charts).toHaveLength(2);
    });

    it("should update chart notes", async () => {
      const saved = await saveChart(TEST_USER, makeChartInput());
      const updated = await updateSavedChartNotes(
        TEST_USER,
        saved.saved_chart_id,
        "Important chart"
      );

      expect(updated).not.toBeNull();
      expect(updated!.notes).toBe("Important chart");
    });

    it("should toggle chart archive status", async () => {
      const saved = await saveChart(TEST_USER, makeChartInput());

      const archived = await toggleSavedChartArchive(
        TEST_USER,
        saved.saved_chart_id,
        true
      );
      expect(archived).not.toBeNull();
      expect(archived!.archived_at).toBeTruthy();

      const unarchived = await toggleSavedChartArchive(
        TEST_USER,
        saved.saved_chart_id,
        false
      );
      expect(unarchived).not.toBeNull();
      expect(unarchived!.archived_at).toBeNull();
    });

    it("should delete a chart", async () => {
      const saved = await saveChart(TEST_USER, makeChartInput());
      const result = await deleteSavedChart(TEST_USER, saved.saved_chart_id);
      expect(result).toBe(true);

      const charts = await listSavedCharts(TEST_USER);
      expect(charts).toHaveLength(0);
    });

    it("should return false when deleting a non-existent chart", async () => {
      const result = await deleteSavedChart(TEST_USER, "nonexistent-id");
      expect(result).toBe(false);
    });

    it("should scope charts by user ID", async () => {
      await saveChart("user-a", makeChartInput({ name: "A's chart" }));
      await saveChart("user-b", makeChartInput({ name: "B's chart" }));

      const aCharts = await listSavedCharts("user-a");
      const bCharts = await listSavedCharts("user-b");
      expect(aCharts).toHaveLength(1);
      expect(aCharts[0].name).toBe("A's chart");
      expect(bCharts).toHaveLength(1);
      expect(bCharts[0].name).toBe("B's chart");
    });
  });

  describe("comparisons", () => {
    it("should return empty list when no comparisons exist", async () => {
      const comparisons = await listSavedComparisons(TEST_USER);
      expect(comparisons).toEqual([]);
    });

    it("should save and retrieve a comparison", async () => {
      const saved = await saveComparison(TEST_USER, makeComparisonInput());

      expect(saved.primary_name).toBe("Person A");
      expect(saved.partner_name).toBe("Person B");
      expect(saved.compatibility_score).toBe(78);
      expect(saved.saved_comparison_id).toBeTruthy();

      const comparisons = await listSavedComparisons(TEST_USER);
      expect(comparisons).toHaveLength(1);
    });
  });

  describe("exportWorkspaceSnapshot", () => {
    it("should export both charts and comparisons", async () => {
      await saveChart(TEST_USER, makeChartInput());
      await saveComparison(TEST_USER, makeComparisonInput());

      const snapshot = await exportWorkspaceSnapshot(TEST_USER);
      expect(snapshot.exported_at).toBeTruthy();
      expect(snapshot.charts).toHaveLength(1);
      expect(snapshot.comparisons).toHaveLength(1);
    });

    it("should export empty arrays when workspace is empty", async () => {
      const snapshot = await exportWorkspaceSnapshot(TEST_USER);
      expect(snapshot.charts).toEqual([]);
      expect(snapshot.comparisons).toEqual([]);
    });
  });
});
