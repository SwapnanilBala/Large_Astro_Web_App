import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOMAIN_BRIEF_KEYS } from "@/lib/domain-briefs";
import { useDomainBriefs } from "@/lib/use-domain-briefs";
import type { AccountStatus } from "@/lib/use-account";
import type { LifeDomainKey } from "@/lib/astro-types";

const mocks = vi.hoisted(() => ({
  account: { status: "signed-out" as AccountStatus, account: null as { email: string } | null },
  announce: vi.fn(),
}));
vi.mock("@/lib/use-account", () => ({ useAccount: () => mocks.account }));
vi.mock("@/lib/free-usage-store", () => ({ announceIfFreeUsageExhausted: mocks.announce }));

function result(prefix = "Guest") {
  return {
    brief: `${prefix} love_life`,
    briefs: Object.fromEntries(DOMAIN_BRIEF_KEYS.map((key) => [key, `${prefix} ${key}`])),
  };
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  mocks.account.status = "signed-out";
  mocks.account.account = null;
  mocks.announce.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("Ultimate life-area brief loading", () => {
  it("loads all seven tabs in one request and never uses the browser HTTP cache", async () => {
    const fetchMock = vi.fn(async () => response(result()));
    vi.stubGlobal("fetch", fetchMock);
    const { result: hook, rerender } = renderHook(
      ({ domain }) => useDomainBriefs("chart=one", domain),
      { initialProps: { domain: "love_life" as LifeDomainKey } },
    );
    await waitFor(() => expect(Object.keys(hook.current.briefs)).toHaveLength(7));
    for (const domain of DOMAIN_BRIEF_KEYS) {
      rerender({ domain });
      expect(hook.current.briefs[domain]).toBe(`Guest ${domain}`);
      expect(hook.current.pending).toBe(false);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chart/domain-brief?chart=one&domain=love_life",
      expect.objectContaining({ cache: "no-store", credentials: "same-origin" }),
    );
  });

  it("waits for the account check and does not send client-supplied effort", async () => {
    mocks.account.status = "loading";
    const fetchMock = vi.fn<typeof fetch>(async () => response(result("Account")));
    vi.stubGlobal("fetch", fetchMock);
    const { result: hook, rerender } = renderHook(() => useDomainBriefs("chart=one", "career"));
    expect(fetchMock).not.toHaveBeenCalled();
    mocks.account.status = "signed-in";
    mocks.account.account = { email: "reader@gmail.com" };
    rerender();
    await waitFor(() => expect(hook.current.briefs.career).toBe("Account career"));
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("effort");
  });

  it("discards old briefs immediately when the chart or sign-in state changes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(result()))
      .mockResolvedValueOnce(response(result("Account")))
      .mockResolvedValueOnce(response(result("New chart")))
      .mockResolvedValueOnce(response(result("Signed out")));
    vi.stubGlobal("fetch", fetchMock);
    const { result: hook, rerender } = renderHook(
      ({ qs }) => useDomainBriefs(qs, "career"), { initialProps: { qs: "chart=one" } },
    );
    await waitFor(() => expect(hook.current.briefs.career).toBe("Guest career"));
    mocks.account.status = "signed-in";
    mocks.account.account = { email: "reader@gmail.com" };
    rerender({ qs: "chart=one" });
    expect(hook.current.briefs).toEqual({});
    await waitFor(() => expect(hook.current.briefs.career).toBe("Account career"));
    rerender({ qs: "chart=two" });
    expect(hook.current.briefs).toEqual({});
    await waitFor(() => expect(hook.current.briefs.career).toBe("New chart career"));
    mocks.account.status = "signed-out";
    mocks.account.account = null;
    rerender({ qs: "chart=two" });
    expect(hook.current.briefs).toEqual({});
    await waitFor(() => expect(hook.current.briefs.career).toBe("Signed out career"));
  });

  it("does not attach a late result to a different chart", async () => {
    let finish!: (value: Response) => void;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce(response(result("New chart")));
    vi.stubGlobal("fetch", fetchMock);
    const { result: hook, rerender } = renderHook(
      ({ qs }) => useDomainBriefs(qs, "career"), { initialProps: { qs: "chart=one" } },
    );
    rerender({ qs: "chart=two" });
    await waitFor(() => expect(hook.current.briefs.career).toBe("New chart career"));
    await act(async () => { finish(response(result("Old chart"))); });
    expect(hook.current.briefs.career).toBe("New chart career");
  });

  it("keeps the deterministic fallback and prompts when the guest budget is spent", async () => {
    const refused = response({ error: { details: { scope: "anonymous" } } }, 429);
    vi.stubGlobal("fetch", vi.fn(async () => refused));
    const { result: hook } = renderHook(() => useDomainBriefs("chart=one", "career"));
    await waitFor(() => expect(hook.current.pending).toBe(false));
    expect(hook.current.briefs).toEqual({});
    expect(mocks.announce).toHaveBeenCalledWith(refused, "domainBrief");
  });

  it("does not retry every tab when the provider key is missing", async () => {
    const fetchMock = vi.fn(async () => response({}, 503));
    vi.stubGlobal("fetch", fetchMock);
    const { result: hook, rerender } = renderHook(
      ({ domain }) => useDomainBriefs("chart=one", domain),
      { initialProps: { domain: "career" as LifeDomainKey } },
    );
    await waitFor(() => expect(hook.current.pending).toBe(false));
    rerender({ domain: "family" });
    expect(hook.current.pending).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not load before the Ultimate Module's domain data is ready", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result: hook } = renderHook(() => useDomainBriefs("chart=one", "career", false));
    expect(hook.current.pending).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
