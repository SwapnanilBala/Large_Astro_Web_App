import { beforeEach, describe, expect, it } from "vitest";
import {
  readChartHistorySnapshot,
  recordChartVisit,
} from "@/lib/chart-history-store";
import { localScopedKey } from "@/lib/local-scope";
import {
  deletePalmReading,
  readPalmReadingsSnapshot,
} from "@/lib/palm-readings/local-store";

/*
 * Both snapshots feed useSyncExternalStore, which compares what it gets back
 * by identity on every render. A fresh array from each read looks like a
 * change every time and re-renders forever, so the contract under test is
 * the caching: one array until storage actually changes, then a new one.
 */

const PALM_KEY = localScopedKey("astro_palm_readings");

function seedPalmReadings(ids: string[]) {
  window.localStorage.setItem(
    PALM_KEY,
    JSON.stringify(
      ids.map((id, index) => ({
        id,
        created_at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
        title: `Reading ${id}`,
        image_data_url: "",
        reading: { overall_summary: `Summary ${id}`, dominant_hand_note: "" },
      })),
    ),
  );
}

describe("readChartHistorySnapshot", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns the same array while storage is unchanged", () => {
    const first = readChartHistorySnapshot();
    expect(first).toEqual([]);
    expect(readChartHistorySnapshot()).toBe(first);
  });

  it("returns a new array once a chart is recorded, and holds that one", () => {
    const before = readChartHistorySnapshot();
    recordChartVisit({
      name: "Test Reader",
      city: "Mumbai",
      birthDate: "1990-04-15",
      ascendantSign: "Cancer",
      queryString: "name=Test%20Reader",
    });

    const after = readChartHistorySnapshot();
    expect(after).not.toBe(before);
    expect(after.map((entry) => entry.name)).toEqual(["Test Reader"]);
    expect(readChartHistorySnapshot()).toBe(after);
  });
});

describe("readPalmReadingsSnapshot", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns the same array while storage is unchanged", () => {
    seedPalmReadings(["a", "b"]);
    const first = readPalmReadingsSnapshot();
    expect(first.map((reading) => reading.id)).toEqual(["b", "a"]);
    expect(readPalmReadingsSnapshot()).toBe(first);
  });

  it("returns a new array after a delete, without the deleted reading", () => {
    seedPalmReadings(["a", "b"]);
    const before = readPalmReadingsSnapshot();

    expect(deletePalmReading("a")).toBe(true);

    const after = readPalmReadingsSnapshot();
    expect(after).not.toBe(before);
    expect(after.map((reading) => reading.id)).toEqual(["b"]);
    expect(readPalmReadingsSnapshot()).toBe(after);
  });
});
