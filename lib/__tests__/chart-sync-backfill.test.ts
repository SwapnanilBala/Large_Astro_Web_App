import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { backfillCharts } from "@/lib/chart-sync-backfill";
import { chartHistoryKey } from "@/lib/chart-history-store";

const PROFILE = "profile-1";
const OTHER_PROFILE = "profile-2";

const CONSENT = { prompt: "Save your charts?", captureSource: "intake" as const };

function seedHistory(profileId: string, count: number, prefix = "chart") {
  localStorage.setItem(
    chartHistoryKey(profileId),
    JSON.stringify(
      Array.from({ length: count }, (_, index) => ({
        name: `${prefix}-${index}`,
        city: "Kolkata",
        birthDate: "1992-05-12",
        ascendantSign: "Leo",
        queryString: `name=${prefix}-${index}&birthDate=1992-05-12`,
        savedAt: new Date(Date.now() - index * 1000).toISOString(),
      })),
    ),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("backfilling a profile's charts", () => {
  it("pushes everything already in this browser, not just the newest", async () => {
    seedHistory(PROFILE, 3);

    const result = await backfillCharts(PROFILE, CONSENT);

    expect(result).toEqual({ attempted: 3, stored: 3, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("carries the consent that covered them", async () => {
    seedHistory(PROFILE, 1);
    await backfillCharts(PROFILE, CONSENT);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.consent).toEqual({
      granted: true,
      prompt: "Save your charts?",
      captureSource: "intake",
    });
  });

  it("does not resend the chart the caller already pushed", async () => {
    seedHistory(PROFILE, 3);

    const result = await backfillCharts(PROFILE, CONSENT, {
      alreadyPushed: new Set(["name=chart-0&birthDate=1992-05-12"]),
    });

    expect(result.attempted).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends only the profile it was asked for", async () => {
    seedHistory(PROFILE, 2, "mine");
    seedHistory(OTHER_PROFILE, 4, "theirs");

    await backfillCharts(PROFILE, CONSENT);

    /* The other profile's birth details are somebody else's, and this grant
       was not theirs to give. */
    const sent = fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).queryString);
    expect(sent).toHaveLength(2);
    expect(sent.every((query: string) => query.includes("mine"))).toBe(true);
  });

  it("does nothing without a profile", async () => {
    seedHistory(PROFILE, 3);
    const result = await backfillCharts(null, CONSENT);

    expect(result).toEqual({ attempted: 0, stored: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when there is no history to send", async () => {
    const result = await backfillCharts(PROFILE, CONSENT);
    expect(result.attempted).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("when some of them will not store", () => {
  it("steps over one the server refuses and keeps going", async () => {
    seedHistory(PROFILE, 3);
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await backfillCharts(PROFILE, CONSENT);

    /* One bad entry — an old history row with half a query string — must not
       strand the ones behind it. */
    expect(result).toEqual({ attempted: 3, stored: 2, failed: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("stops once the server has failed twice running", async () => {
    seedHistory(PROFILE, 10);
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    const result = await backfillCharts(PROFILE, CONSENT);

    /* The server is down; the remaining eight are safe in localStorage and
       there is nothing to gain from asking eight more times. */
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ attempted: 10, stored: 0, failed: 2 });
  });

  it("counts a dropped connection as a failure, not a success", async () => {
    seedHistory(PROFILE, 4);
    fetchMock.mockRejectedValue(new Error("offline"));

    const result = await backfillCharts(PROFILE, CONSENT);

    expect(result.stored).toBe(0);
    expect(result.failed).toBe(2);
  });

  it("recovers its patience after a success", async () => {
    seedHistory(PROFILE, 4);
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await backfillCharts(PROFILE, CONSENT);

    /* Failures have to be consecutive to stop the run. */
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result).toEqual({ attempted: 4, stored: 2, failed: 2 });
  });

  it("stops when the caller cancels", async () => {
    seedHistory(PROFILE, 5);
    let done = 0;
    fetchMock.mockImplementation(async () => {
      done += 1;
      return { ok: true, status: 200 };
    });

    const result = await backfillCharts(PROFILE, CONSENT, {
      isCancelled: () => done >= 2,
    });

    expect(result.stored).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
