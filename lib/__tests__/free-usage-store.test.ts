import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let store: typeof import("@/lib/free-usage-store");

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 3, 12));
  vi.resetModules();
  store = await import("@/lib/free-usage-store");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("free-usage prompt dismissal", () => {
  it("does not repeat when navigation or reload recreates the component's module", async () => {
    expect(store.claimFreeUsagePrompt()).toBe(true);
    expect(store.claimFreeUsagePrompt()).toBe(false);
    vi.resetModules();
    const reloaded = await import("@/lib/free-usage-store");
    expect(reloaded.claimFreeUsagePrompt()).toBe(false);
  });

  it("remembers a daily mute in a new tab and expires on the next local day", async () => {
    store.setFreeUsagePromptMutedForToday(true);
    sessionStorage.clear();
    vi.resetModules();
    const newTab = await import("@/lib/free-usage-store");
    expect(newTab.claimFreeUsagePrompt()).toBe(false);
    vi.setSystemTime(new Date(2026, 9, 4, 0, 1));
    expect(newTab.claimFreeUsagePrompt()).toBe(true);
  });

  it("offers a new session's prompt unless the daily mute was selected", async () => {
    expect(store.claimFreeUsagePrompt()).toBe(true);
    sessionStorage.clear();
    vi.resetModules();
    const newSession = await import("@/lib/free-usage-store");
    expect(newSession.claimFreeUsagePrompt()).toBe(true);
  });

  it("lets the visitor undo the daily mute before closing the popup", async () => {
    store.setFreeUsagePromptMutedForToday(true);
    store.setFreeUsagePromptMutedForToday(false);
    vi.resetModules();
    const newSession = await import("@/lib/free-usage-store");
    expect(newSession.claimFreeUsagePrompt()).toBe(true);
  });

  it("resets the once-per-session prompt at local midnight", () => {
    vi.setSystemTime(new Date(2026, 9, 3, 23, 59));
    expect(store.claimFreeUsagePrompt()).toBe(true);
    vi.setSystemTime(new Date(2026, 9, 4, 0, 1));
    expect(store.claimFreeUsagePrompt()).toBe(true);
    expect(store.claimFreeUsagePrompt()).toBe(false);
  });

  it("still prevents repeated prompts when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
    expect(store.claimFreeUsagePrompt()).toBe(true);
    expect(store.claimFreeUsagePrompt()).toBe(false);
    store.setFreeUsagePromptMutedForToday(true);
    expect(store.claimFreeUsagePrompt()).toBe(false);
    vi.setSystemTime(new Date(2026, 9, 4, 0, 1));
    expect(store.claimFreeUsagePrompt()).toBe(true);
  });
});

describe("budget refusal notifications", () => {
  it("only announces an anonymous allowance refusal and leaves its body readable", async () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribeToFreeUsage(listener);
    try {
      const response = new Response(JSON.stringify({ error: { details: { scope: "anonymous" } } }), { status: 429 });
      expect(await store.announceIfFreeUsageExhausted(response, "domainBrief")).toBe(true);
      expect(listener).toHaveBeenCalledWith("domainBrief");
      expect(await response.json()).toEqual({ error: { details: { scope: "anonymous" } } });
    } finally { unsubscribe(); }
  });

  it.each(["account", "global"])("does not offer sign-in for a %s ceiling", async (scope) => {
    const listener = vi.fn();
    const unsubscribe = store.subscribeToFreeUsage(listener);
    try {
      const response = new Response(JSON.stringify({ error: { details: { scope } } }), { status: 429 });
      expect(await store.announceIfFreeUsageExhausted(response, "domainBrief")).toBe(false);
      expect(listener).not.toHaveBeenCalled();
    } finally { unsubscribe(); }
  });
});
