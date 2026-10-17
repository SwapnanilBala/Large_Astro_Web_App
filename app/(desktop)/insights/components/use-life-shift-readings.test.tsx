import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { MajorLifeShift } from "@/lib/engines/major-shifts-engine";
import { lifeShiftId } from "@/lib/life-shift-reading";
import { useLifeShiftReadings } from "./use-life-shift-readings";

/*
 * What the life-shifts panel asks its route for: the chart's query string and
 * the ids of the chapters it draws. The chapters' words are not sent; the
 * route rebuilds them, which is what keeps typed text out of the prompt.
 */

const CHART_QS = "name=Asha&birthDate=1990-01-01&birthTime=10%3A00";

const SHIFT: MajorLifeShift = {
  index: 1,
  kind: "saturn-return",
  label: "Saturn return (first)",
  planet: "Saturn",
  pivotIso: "2019-06-18T00:00:00.000Z",
  windowStartIso: "2018-06-18T00:00:00.000Z",
  windowEndIso: "2020-06-18T00:00:00.000Z",
  status: "past",
  ageAtPivot: 29,
  theme: "structure, responsibility, and the cost of choices",
  narrative: "the engine's own sentence",
  evidence: "Cycle: ~29.5 years | Natal Saturn: Capricorn / H9",
};

const READING = { segments: [{ text: "Written for you.", sources: [1] }], sources: [{ number: 1, book: "brihat-jataka-1885", ref: "18.19", kind: "verse", text: "The verse." }] };

function respond(body: unknown, ok = true) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok, status: ok ? 200 : 429, json: async () => body } as Response);
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the life shift readings hook", () => {
  it("sends the chart's query, the chapter ids and the language, and none of the chapters' words", async () => {
    const fetchSpy = respond({ readings: [{ id: lifeShiftId(SHIFT), reading: READING }], cached: false });
    const { result } = renderHook(() => useLifeShiftReadings([SHIFT], "headline", CHART_QS, "hi"));
    await waitFor(() => expect(result.current.state).toBe("ready"));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`/api/chart/life-shifts?${CHART_QS}`);
    expect(JSON.parse(String(init?.body))).toEqual({ ids: [lifeShiftId(SHIFT)], depth: "headline", language: "hi" });
    expect(String(init?.body)).not.toContain(SHIFT.label);
    expect(result.current.readings.get(lifeShiftId(SHIFT))).toEqual(READING);
  });

  it("asks again when the page's language changes, showing nothing from the old language meanwhile", async () => {
    const fetchSpy = respond({ readings: [{ id: lifeShiftId(SHIFT), reading: READING }], cached: false });
    const { result, rerender } = renderHook(({ language }) => useLifeShiftReadings([SHIFT], "compact", CHART_QS, language), {
      initialProps: { language: "en" },
    });
    await waitFor(() => expect(result.current.state).toBe("ready"));
    rerender({ language: "de" });
    expect(result.current.state).toBe("pending");
    expect(result.current.readings.size).toBe(0);
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body)).language).toBe("de");
  });

  it("ignores a reading that is not a cited reading", async () => {
    respond({ readings: [{ id: lifeShiftId(SHIFT), reading: "plain text" }], cached: false });
    const { result } = renderHook(() => useLifeShiftReadings([SHIFT], "compact", CHART_QS));
    await waitFor(() => expect(result.current.state).toBe("failed"));
  });

  it("asks for nothing, and reads as failed, when there is no chapter", () => {
    const fetchSpy = respond({ readings: [] });
    const { result } = renderHook(() => useLifeShiftReadings([], "compact", CHART_QS));
    expect(result.current.state).toBe("failed");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps the template wording when the route refuses", async () => {
    respond({ error: { code: "VALIDATION_FAILED" } }, false);
    const { result } = renderHook(() => useLifeShiftReadings([SHIFT], "compact", CHART_QS));
    await waitFor(() => expect(result.current.state).toBe("failed"));
    expect(result.current.readings.size).toBe(0);
  });
});
