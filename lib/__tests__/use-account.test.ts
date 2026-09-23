import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAccount } from "../use-account";

/*
 * The navbar and the page each call useAccount on the home and sign-in pages;
 * they used to make two identical /api/auth/session requests per load.
 */

function sessionReturns(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("useAccount", () => {
  it("shares one session request between components mounting together", async () => {
    const fetchMock = sessionReturns({ user: { email: "a@example.test", displayName: "A" } });
    const navbar = renderHook(() => useAccount());
    const page = renderHook(() => useAccount());

    await waitFor(() => expect(navbar.result.current.status).toBe("signed-in"));
    await waitFor(() => expect(page.result.current.status).toBe("signed-in"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(page.result.current.account?.email).toBe("a@example.test");
  });

  it("asks again for a component that mounts after the first answer", async () => {
    const fetchMock = sessionReturns({ user: null });
    const first = renderHook(() => useAccount());
    await waitFor(() => expect(first.result.current.status).toBe("signed-out"));

    const later = renderHook(() => useAccount());
    await waitFor(() => expect(later.result.current.status).toBe("signed-out"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports an unavailable account store as unavailable, not signed out", async () => {
    sessionReturns({ detail: "down" }, 503);
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current.account).toBeNull();
  });
});
