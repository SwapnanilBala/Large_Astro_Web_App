import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  markNudgeShown,
  readChartSyncState,
  recordDecision,
  recordWithdrawal,
} from "@/lib/chart-sync-store";
import { useChartSync, type ChartToSync } from "@/lib/use-chart-sync";

const CHART: ChartToSync = {
  queryString: "name=Asha&birthDate=1992-05-12&birthTime=08%3A30",
  ascendantSign: "Gemini",
  sunSign: "Aries",
  moonSign: "Virgo",
};

/** Pretend the answer was given before this page view began. */
function declinedEarlier() {
  localStorage.setItem(
    "astro_chart_sync_consent",
    JSON.stringify({
      decision: "declined",
      decidedAt: new Date(Date.now() - 60_000).toISOString(),
      nudgeShownAt: null,
    }),
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

describe("the decision this browser remembers", () => {
  it("starts with no answer on file", () => {
    expect(readChartSyncState()).toEqual({
      decision: null,
      decidedAt: null,
      nudgeShownAt: null,
    });
  });

  it("records an answer with the time it was given", () => {
    recordDecision("granted");
    const state = readChartSyncState();
    expect(state.decision).toBe("granted");
    expect(Date.parse(state.decidedAt!)).toBeLessThanOrEqual(Date.now());
  });

  it("re-opens the case for a nudge if a grant is later withdrawn", () => {
    recordDecision("declined");
    markNudgeShown();
    expect(readChartSyncState().nudgeShownAt).not.toBeNull();

    /* Granting clears it: by the time somebody who said yes says no again,
       the reason will have changed and is worth answering once more. */
    recordDecision("granted");
    expect(readChartSyncState().nudgeShownAt).toBeNull();
  });

  it("spends the nudge when consent is withdrawn on purpose", () => {
    recordDecision("granted");
    recordWithdrawal();

    const state = readChartSyncState();
    expect(state.decision).toBe("declined");
    /* Somebody who pressed a delete button has decided. Meeting them on the
       next chart with the case for saving would be arguing with an informed
       choice, which is what the one-shot rule exists to rule out. */
    expect(state.nudgeShownAt).not.toBeNull();
  });

  it("survives a corrupted stored value rather than throwing", () => {
    localStorage.setItem("astro_chart_sync_consent", "{not json");
    expect(readChartSyncState().decision).toBeNull();
  });

  it("ignores a decision value it does not recognise", () => {
    localStorage.setItem(
      "astro_chart_sync_consent",
      JSON.stringify({ decision: "definitely", decidedAt: null, nudgeShownAt: null }),
    );
    expect(readChartSyncState().decision).toBeNull();
  });
});

describe("asking", () => {
  it("asks when there is no answer on file", () => {
    const { result } = renderHook(() => useChartSync(CHART));
    expect(result.current.phase).toBe("asking");
  });

  it("asks nothing when there is no chart to store", () => {
    const { result } = renderHook(() => useChartSync(null));
    expect(result.current.phase).toBe("idle");
  });

  it("stores nothing until the answer is yes", () => {
    renderHook(() => useChartSync(CHART));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("granting", () => {
  it("pushes the chart with the wording that was on screen", async () => {
    const { result } = renderHook(() => useChartSync(CHART));

    act(() => result.current.grant("Save your charts to your account?", "intake"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sync/charts");
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body);
    expect(body.queryString).toBe(CHART.queryString);
    expect(body.ascendantSign).toBe("Gemini");
    expect(body.consent).toEqual({
      granted: true,
      prompt: "Save your charts to your account?",
      captureSource: "intake",
    });
  });

  it("stops asking once the answer is yes", async () => {
    const { result } = renderHook(() => useChartSync(CHART));
    act(() => result.current.grant("Save your charts?", "intake"));
    await waitFor(() => expect(result.current.phase).toBe("idle"));
  });

  it("does not push the same chart twice", async () => {
    const { result, rerender } = renderHook(() => useChartSync(CHART));

    act(() => result.current.grant("Save your charts?", "intake"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender();
    rerender();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("marks a chart granted earlier as riding on the stored record", async () => {
    recordDecision("granted");

    renderHook(() => useChartSync(CHART));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const { consent } = JSON.parse(fetchMock.mock.calls[0][1].body);
    /* No prompt was shown this visit, so the evidence must not claim one was. */
    expect(consent.captureSource).toBe("settings");
    expect(consent.prompt).toContain("previously granted");
  });

  it("retries once when the server is briefly unavailable", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const { result } = renderHook(() => useChartSync(CHART));
    act(() => result.current.grant("Save your charts?", "intake"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 5000 });
    await waitFor(() => expect(result.current.stored).toBe(true));
  });

  it("retries a thrown request too", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const { result } = renderHook(() => useChartSync(CHART));
    act(() => result.current.grant("Save your charts?", "intake"));

    await waitFor(() => expect(result.current.stored).toBe(true), { timeout: 5000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a chart the server refuses", async () => {
    /* A 400 means this chart cannot be stored at all — a birth date outside
       what the table accepts, say. Retrying is a loop against a wall. */
    fetchMock.mockResolvedValue({ ok: false, status: 400 });

    const { result, rerender } = renderHook(() => useChartSync(CHART));
    act(() => result.current.grant("Save your charts?", "intake"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender();
    rerender();
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.stored).toBe(false);
  });

  it("gives up after two attempts and leaves it for the next visit", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    const first = renderHook(() => useChartSync(CHART));
    act(() => first.result.current.grant("Save your charts?", "intake"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 5000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    /* A fresh view starts a fresh pair of attempts, because the chart is
       still in localStorage and nothing was lost. */
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const later = renderHook(() => useChartSync(CHART));
    await waitFor(() => expect(later.result.current.stored).toBe(true));
  });
});

describe("the one nudge after a decline", () => {
  it("says nothing more in the view the decline happened in", async () => {
    const { result, rerender } = renderHook(() => useChartSync(CHART));

    act(() => result.current.decline());
    rerender();

    /* This is the guarantee that keeps a consent record evidence of agreement
       rather than of pestering. */
    expect(result.current.phase).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays quiet after a withdrawal, however long ago it was", () => {
    recordWithdrawal();

    /* Backdate it so the "not in the same view" rule is not what is being
       measured — this has to be the withdrawal itself that silences it. */
    const state = JSON.parse(localStorage.getItem("astro_chart_sync_consent")!);
    localStorage.setItem(
      "astro_chart_sync_consent",
      JSON.stringify({ ...state, decidedAt: new Date(Date.now() - 86_400_000).toISOString() }),
    );

    const { result } = renderHook(() => useChartSync(CHART));
    expect(result.current.phase).toBe("idle");
  });

  it("makes the case once on a later visit", () => {
    declinedEarlier();
    const { result } = renderHook(() => useChartSync(CHART));
    expect(result.current.phase).toBe("nudging");
  });

  it("never returns after being dismissed", () => {
    declinedEarlier();

    const first = renderHook(() => useChartSync(CHART));
    expect(first.result.current.phase).toBe("nudging");

    act(() => first.result.current.dismissNudge());
    expect(first.result.current.phase).toBe("idle");

    /* A whole new visit, and still nothing. */
    const later = renderHook(() => useChartSync(CHART));
    expect(later.result.current.phase).toBe("idle");
  });

  it("can be accepted, and records where the answer came from", async () => {
    declinedEarlier();
    const { result } = renderHook(() => useChartSync(CHART));

    act(() => result.current.grant("This chart lives only in this browser", "nudge"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const { consent } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(consent.captureSource).toBe("nudge");
    expect(readChartSyncState().decision).toBe("granted");
  });

  it("gates nothing — the chart is never withheld to make the point", () => {
    declinedEarlier();
    const { result } = renderHook(() => useChartSync(CHART));

    /* The controller exposes no way to hide or block the chart; the only
       thing it can do is show a card beside it. */
    expect(Object.keys(result.current).sort()).toEqual([
      "decline",
      "dismissNudge",
      "grant",
      "phase",
      "stored",
    ]);
  });
});

describe("the first render, which has to match the server's", () => {
  /*
   * The prompt is server-rendered, and the server cannot read localStorage, so
   * the first client render has to be the silent one the server produced —
   * whatever this browser remembers. Resolving the phase during render broke
   * exactly this: the server sent the ask, a visitor who had declined earlier
   * hydrated into the nudge, and React failed hydration on a text mismatch.
   *
   * `renderToStaticMarkup` runs no effects, so what it returns is that first
   * render and nothing after it. jsdom leaves localStorage readable throughout,
   * which is the point — the phase has to be "idle" despite an answer being
   * right there to read.
   */
  function firstRenderPhase(): string {
    function Probe() {
      return useChartSync(CHART).phase;
    }
    return renderToStaticMarkup(createElement(Probe));
  }

  it("is silent when the answer on file would ask for a nudge", () => {
    declinedEarlier();
    expect(firstRenderPhase()).toBe("idle");
  });

  it("is silent when the answer on file was yes", () => {
    recordDecision("granted");
    expect(firstRenderPhase()).toBe("idle");
  });

  it("is silent even with no answer on file, so the ask is never in the HTML", () => {
    expect(firstRenderPhase()).toBe("idle");
  });
});
