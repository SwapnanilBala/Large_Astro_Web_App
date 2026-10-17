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
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    status: ok ? 200 : 429,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  } as Response);
}

/* The route's NDJSON stream, one line released at a time by `release`. */
function streaming(lines: unknown[]) {
  const encoder = new TextEncoder();
  let push: (() => void) | null = null;
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      return new Promise<void>((resolve) => {
        push = () => {
          if (sent < lines.length) controller.enqueue(encoder.encode(`${JSON.stringify(lines[sent++])}\n`));
          if (sent >= lines.length) controller.close();
          resolve();
        };
      });
    },
  });
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/x-ndjson; charset=utf-8" }),
    body,
  } as Response);
  return { fetchSpy, release: () => push?.() };
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

  it("asks for the stream, and shows each batch as it lands", async () => {
    const PAST = { ...SHIFT, pivotIso: "2007-06-18T00:00:00.000Z" };
    const { fetchSpy, release } = streaming([
      { type: "readings", readings: [{ id: lifeShiftId(SHIFT), reading: READING }] },
      { type: "readings", readings: [{ id: lifeShiftId(PAST), reading: READING }] },
      { type: "done", cached: false },
    ]);
    const { result } = renderHook(() => useLifeShiftReadings([SHIFT, PAST], "compact", CHART_QS));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).get("accept")).toContain("application/x-ndjson");

    release();
    await waitFor(() => expect(result.current.readings.size).toBe(1));
    /* The first batch is on the page; the other chapter is still being written. */
    expect(result.current.state).toBe("pending");
    expect(result.current.readings.has(lifeShiftId(SHIFT))).toBe(true);

    release();
    release();
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.readings.size).toBe(2);
  });

  it("keeps the template wording when the route refuses", async () => {
    respond({ error: { code: "VALIDATION_FAILED" } }, false);
    const { result } = renderHook(() => useLifeShiftReadings([SHIFT], "compact", CHART_QS));
    await waitFor(() => expect(result.current.state).toBe("failed"));
    expect(result.current.readings.size).toBe(0);
  });
});
