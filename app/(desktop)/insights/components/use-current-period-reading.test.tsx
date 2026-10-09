import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { DashaInfo, NakshatraInfo, PlanetPosition } from "@/lib/astro-types";
import { useCurrentPeriodReading } from "./use-current-period-reading";

/*
 * The current-period reading is bought on mount, once, for every visitor who
 * opens the timing section. It is written in the language the page had when
 * the panel mounted, and a language switch afterwards must not buy it again.
 */

const page = vi.hoisted(() => ({ language: "hi" }));
vi.mock("@/lib/i18n-context", () => ({
  useTranslation: () => ({ language: page.language, setLanguage: () => {}, t: (key: string) => key }),
}));

const DASHA: DashaInfo = {
  current_dasha: "Saturn",
  current_dasha_start: "2019-03-01",
  current_dasha_end: "2038-03-01",
  current_antardasha: "Mercury",
  current_antardasha_start: "2025-01-10",
  current_antardasha_end: "2027-09-20",
  periods: [],
};

const NAKSHATRA: NakshatraInfo = { name: "Rohini", index: 3, lord: "Moon", pada: 2, degree_in_nakshatra: 5 };

const PLANETS: PlanetPosition[] = [
  { name: "Saturn", longitude: 285, sign: "Capricorn", degree_in_sign: 15, house: 10 },
  { name: "Mercury", longitude: 165, sign: "Virgo", degree_in_sign: 15, house: 6 },
];

function respond(reading: string, ok = true) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue({ ok, status: ok ? 200 : 429, json: async () => ({ reading, cached: false }) } as Response);
}

const mount = () => renderHook(() => useCurrentPeriodReading(DASHA, NAKSHATRA, PLANETS, 40));

beforeEach(() => {
  page.language = "hi";
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the current-period reading hook", () => {
  it("asks once, in the language the page has at mount, with the facts beside it", async () => {
    const fetchSpy = respond("आपकी शनि महादशा…");
    const { result } = mount();
    await waitFor(() => expect(result.current.state).toBe("ready"));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/chart/current-period");
    const body = JSON.parse(String(init?.body));
    expect(body.language).toBe("hi");
    expect(body.stack.map((step: { lord: string }) => step.lord)).toEqual(["Saturn", "Mercury"]);
    expect(body.stack[0]).toMatchObject({ sign: "Capricorn", house: 10 });
    expect(body.nakshatra).toEqual({ name: "Rohini", lord: "Moon", pada: 2 });
    expect(result.current.reading).toBe("आपकी शनि महादशा…");
  });

  it("does not ask again when the language changes after mount, and shows no reading in the other one", async () => {
    const fetchSpy = respond("आपकी शनि महादशा…");
    const { result, rerender } = mount();
    await waitFor(() => expect(result.current.state).toBe("ready"));

    page.language = "en";
    rerender();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ state: "failed", reading: null });

    page.language = "hi";
    rerender();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ state: "ready", reading: "आपकी शनि महादशा…" });
  });

  it("does not ask again when the language changes while the reading is on its way", async () => {
    let answer: (value: Response) => void = () => {};
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValue(new Promise<Response>((resolve) => (answer = resolve)));
    const { result, rerender } = mount();
    expect(result.current.state).toBe("pending");

    page.language = "de";
    rerender();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("failed");

    await act(async () => {
      answer({ ok: true, status: 200, json: async () => ({ reading: "आपकी शनि महादशा…", cached: false }) } as Response);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).language).toBe("hi");
    expect(result.current).toEqual({ state: "failed", reading: null });
  });

  it("keeps the template when the route refuses", async () => {
    respond("", false);
    const { result } = mount();
    await waitFor(() => expect(result.current.state).toBe("failed"));
    expect(result.current.reading).toBeNull();
  });

  it("asks for nothing without a stack to read", () => {
    const fetchSpy = respond("unused");
    const { result } = renderHook(() =>
      useCurrentPeriodReading({ ...DASHA, current_antardasha: "" }, NAKSHATRA, PLANETS, 40),
    );
    expect(result.current.state).toBe("failed");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
