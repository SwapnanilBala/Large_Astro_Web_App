import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAdvancedStory } from "./advanced-story";

/*
 * The hook's states are derived from which request they belong to, so these
 * pin the transitions a reader sees: loading from zero on every new request,
 * one silent retry, a manual retry after that, and one shared request for two
 * mounts of the same chart. Each test uses its own query string, because the
 * in-flight map is module-level.
 */

const STORY = { opening: "The opening.", passages: { dasha: "A dasha passage." } };

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("useAdvancedStory", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is off without a chart query, and asks for nothing", () => {
    const { result } = renderHook(() => useAdvancedStory(""));
    expect(result.current).toEqual({ status: "off" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts loading from zero, then lands the story", async () => {
    fetchMock.mockResolvedValueOnce(json(200, STORY));
    const { result } = renderHook(() => useAdvancedStory("name=ready"));

    expect(result.current).toEqual({ status: "loading", elapsedMs: 0, attempt: 1 });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current).toEqual({ status: "ready", story: STORY });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ticks the elapsed time while it waits", async () => {
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));
    const { result } = renderHook(() => useAdvancedStory("name=ticking"));

    await waitFor(() => {
      const state = result.current;
      expect(state.status === "loading" && state.elapsedMs >= 250).toBe(true);
    });
  });

  it("retries once by itself, then offers a retry that asks again", async () => {
    fetchMock
      .mockResolvedValueOnce(json(502))
      .mockResolvedValueOnce(json(502))
      .mockResolvedValueOnce(json(200, STORY));
    const { result } = renderHook(() => useAdvancedStory("name=retry"));

    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const failed = result.current;
    if (failed.status !== "failed") throw new Error("expected a failed state");
    expect(failed.reason).toBe("unavailable");

    act(() => failed.retry());
    expect(result.current).toEqual({ status: "loading", elapsedMs: 0, attempt: 1 });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports a spent allowance without asking again", async () => {
    fetchMock.mockResolvedValueOnce(json(429));
    const { result } = renderHook(() => useAdvancedStory("name=limit"));

    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current).toMatchObject({ status: "failed", reason: "limit" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("goes quiet when the deployment has no key", async () => {
    fetchMock.mockResolvedValueOnce(json(503));
    const { result } = renderHook(() => useAdvancedStory("name=no-key"));

    await waitFor(() => expect(result.current).toEqual({ status: "off" }));
  });

  it("shares one request between two mounts of the same chart", async () => {
    let answer!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (answer = resolve)));

    const first = renderHook(() => useAdvancedStory("name=shared"));
    const second = renderHook(() => useAdvancedStory("name=shared"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => answer(json(200, STORY)));
    await waitFor(() => expect(first.result.current.status).toBe("ready"));
    await waitFor(() => expect(second.result.current.status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
