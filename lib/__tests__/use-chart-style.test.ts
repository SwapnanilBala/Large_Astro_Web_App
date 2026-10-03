/**
 * The chart-style choice: device first, account when signed in.
 *
 * fetch is stubbed per test with a small router over the two endpoints the
 * hook touches -- /api/auth/session (through useAccount) and
 * /api/account/preferences.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHART_STYLE_STORAGE_KEY, useChartStyle } from "@/lib/use-chart-style";

type Route = { status?: number; body: unknown };

function stubFetch(routes: { session: Route; preferences?: Route }) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const route = url.includes("/api/auth/session")
      ? routes.session
      : method === "GET"
        ? (routes.preferences ?? { status: 500, body: {} })
        : { status: 200, body: {} };
    const status = route.status ?? 200;
    return { ok: status < 400, status, json: async () => route.body } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const SIGNED_IN: Route = { body: { user: { email: "someone@example.test", displayName: null } } };
const SIGNED_OUT: Route = { body: { user: null } };
const puts = (calls: ReturnType<typeof stubFetch>) =>
  calls.filter((call) => call.method === "PUT").map((call) => call.body);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChartStyle", () => {
  it("starts on the constellation with nothing stored", () => {
    stubFetch({ session: SIGNED_OUT });
    const { result } = renderHook(() => useChartStyle());
    expect(result.current[0]).toBe("constellation");
  });

  it("keeps a signed-out visitor's choice on the device only", async () => {
    const calls = stubFetch({ session: SIGNED_OUT });
    localStorage.setItem(CHART_STYLE_STORAGE_KEY, "north-indian");
    const { result } = renderHook(() => useChartStyle());

    await waitFor(() => expect(calls.some((call) => call.url.includes("/api/auth/session"))).toBe(true));
    expect(result.current[0]).toBe("north-indian");

    act(() => result.current[1]("constellation"));
    expect(localStorage.getItem(CHART_STYLE_STORAGE_KEY)).toBe("constellation");
    expect(calls.some((call) => call.url.includes("/api/account/preferences"))).toBe(false);
  });

  it("adopts the account's style on a new device, and remembers it there", async () => {
    stubFetch({
      session: SIGNED_IN,
      preferences: { body: { signedIn: true, preferences: { chartStyle: "north-indian" } } },
    });
    const { result } = renderHook(() => useChartStyle());

    await waitFor(() => expect(result.current[0]).toBe("north-indian"));
    expect(localStorage.getItem(CHART_STYLE_STORAGE_KEY)).toBe("north-indian");
  });

  it("lets the account win over a different device choice", async () => {
    localStorage.setItem(CHART_STYLE_STORAGE_KEY, "north-indian");
    stubFetch({
      session: SIGNED_IN,
      preferences: { body: { signedIn: true, preferences: { chartStyle: "constellation" } } },
    });
    const { result } = renderHook(() => useChartStyle());

    await waitFor(() => expect(localStorage.getItem(CHART_STYLE_STORAGE_KEY)).toBe("constellation"));
    expect(result.current[0]).toBe("constellation");
  });

  it("copies the device's choice up when the account has never chosen", async () => {
    localStorage.setItem(CHART_STYLE_STORAGE_KEY, "north-indian");
    const calls = stubFetch({
      session: SIGNED_IN,
      preferences: { body: { signedIn: true, preferences: { chartStyle: null } } },
    });
    const { result } = renderHook(() => useChartStyle());

    await waitFor(() => expect(puts(calls)).toEqual([{ chartStyle: "north-indian" }]));
    expect(result.current[0]).toBe("north-indian");
  });

  it("does not write anything up when neither has chosen", async () => {
    const calls = stubFetch({
      session: SIGNED_IN,
      preferences: { body: { signedIn: true, preferences: { chartStyle: null } } },
    });
    renderHook(() => useChartStyle());

    await waitFor(() => expect(calls.some((call) => call.url.includes("/api/account/preferences"))).toBe(true));
    expect(puts(calls)).toEqual([]);
  });

  it("saves a choice to both the device and the account when signed in", async () => {
    const calls = stubFetch({
      session: SIGNED_IN,
      preferences: { body: { signedIn: true, preferences: { chartStyle: null } } },
    });
    const { result } = renderHook(() => useChartStyle());
    await waitFor(() => expect(calls.some((call) => call.url.includes("/api/account/preferences"))).toBe(true));

    act(() => result.current[1]("north-indian"));

    expect(result.current[0]).toBe("north-indian");
    expect(localStorage.getItem(CHART_STYLE_STORAGE_KEY)).toBe("north-indian");
    await waitFor(() => expect(puts(calls)).toEqual([{ chartStyle: "north-indian" }]));
  });

  it("falls back to the device when the account store is down", async () => {
    localStorage.setItem(CHART_STYLE_STORAGE_KEY, "north-indian");
    const calls = stubFetch({ session: SIGNED_IN, preferences: { status: 503, body: {} } });
    const { result } = renderHook(() => useChartStyle());

    await waitFor(() => expect(calls.some((call) => call.url.includes("/api/account/preferences"))).toBe(true));
    expect(result.current[0]).toBe("north-indian");
    expect(puts(calls)).toEqual([]);
  });

  it("ignores a stored value it cannot draw", () => {
    stubFetch({ session: SIGNED_OUT });
    localStorage.setItem(CHART_STYLE_STORAGE_KEY, "south-indian");
    const { result } = renderHook(() => useChartStyle());
    expect(result.current[0]).toBe("constellation");
  });
});
