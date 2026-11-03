import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Who the chart routes act for, by cookie and by the Android app's bearer
 * header, and the one-person delete the app uses. The account lookup is the
 * real findRequestAccount; only the session row and the chart store are
 * stubbed.
 */

const resolveSession = vi.fn();

vi.mock("@/lib/identity/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/session")>()),
  resolveSession: (...args: unknown[]) => resolveSession(...args),
}));

const listCharts = vi.fn();
const countCharts = vi.fn();
const findChartClient = vi.fn();

vi.mock("@/lib/sync/charts", () => ({
  listCharts: (...args: unknown[]) => listCharts(...args),
  countCharts: (...args: unknown[]) => countCharts(...args),
  findChartClient: (...args: unknown[]) => findChartClient(...args),
  saveChart: vi.fn(),
}));

const revokeConsent = vi.fn();
const revokeAllConsent = vi.fn();

vi.mock("@/lib/sync/consent", () => ({
  revokeConsent: (...args: unknown[]) => revokeConsent(...args),
  revokeAllConsent: (...args: unknown[]) => revokeAllConsent(...args),
}));

const { GET, DELETE } = await import("../charts/route");

const APP_TOKEN = "YXBwLXNlc3Npb24tdG9rZW4tZm9yLWNoYXJ0LXN5bmM";
const CHART_ID = "0b6c2f4e-8d1a-4c3b-9e7f-1a2b3c4d5e6f";

beforeEach(() => {
  resolveSession.mockImplementation(async (token: string | null) =>
    token === APP_TOKEN || token === "browser-token"
      ? { sessionId: "s", userId: "user-1", email: "a@example.test", displayName: null, emailVerifiedAt: null }
      : null,
  );
  listCharts.mockResolvedValue([{ chartId: CHART_ID, queryString: "name=A" }]);
  countCharts.mockResolvedValue(0);
});

afterEach(() => {
  vi.clearAllMocks();
});

function request(url: string, init: { method?: string; bearer?: string; cookie?: string } = {}) {
  const headers: Record<string, string> = {};
  if (init.bearer) headers.authorization = `Bearer ${init.bearer}`;
  if (init.cookie) headers.cookie = init.cookie;
  return new NextRequest(url, { method: init.method ?? "GET", headers });
}

describe("GET /api/sync/charts", () => {
  it("lists the account's charts for the app's bearer header", async () => {
    const response = await GET(request("http://localhost/api/sync/charts", { bearer: APP_TOKEN }));

    expect(listCharts).toHaveBeenCalledWith("user-1");
    await expect(response.json()).resolves.toMatchObject({ stored: 1 });
  });

  it("still lists them for the browser's cookie", async () => {
    await GET(request("http://localhost/api/sync/charts", { cookie: "astro_session=browser-token" }));
    expect(listCharts).toHaveBeenCalledWith("user-1");
  });

  it("lists nothing for a revoked bearer token", async () => {
    const response = await GET(
      request("http://localhost/api/sync/charts", { bearer: "cmV2b2tlZC1vci1tYWRlLXVwLXRva2Vu" }),
    );

    expect(listCharts).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ charts: [], stored: 0 });
  });
});

describe("DELETE /api/sync/charts", () => {
  it("withdraws everything without a chartId, as before", async () => {
    revokeAllConsent.mockResolvedValue(3);

    const response = await DELETE(
      request("http://localhost/api/sync/charts", { method: "DELETE", bearer: APP_TOKEN }),
    );

    expect(revokeAllConsent).toHaveBeenCalledWith("user-1");
    expect(revokeConsent).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ revoked: 3, remaining: 0 });
  });

  it("withdraws one person's birth details for ?chartId", async () => {
    findChartClient.mockResolvedValue("client-7");
    revokeConsent.mockResolvedValue(true);
    countCharts.mockResolvedValue(2);

    const response = await DELETE(
      request(`http://localhost/api/sync/charts?chartId=${CHART_ID}`, { method: "DELETE", bearer: APP_TOKEN }),
    );

    expect(findChartClient).toHaveBeenCalledWith("user-1", CHART_ID);
    expect(revokeConsent).toHaveBeenCalledWith("user-1", "client-7");
    expect(revokeAllConsent).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ revoked: 1, remaining: 2 });
  });

  it("answers a chart that is not this account's like one already gone", async () => {
    findChartClient.mockResolvedValue(null);

    const response = await DELETE(
      request(`http://localhost/api/sync/charts?chartId=${CHART_ID}`, { method: "DELETE", bearer: APP_TOKEN }),
    );

    expect(response.status).toBe(200);
    expect(revokeConsent).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ revoked: 0, remaining: 0 });
  });

  it("refuses a chartId that is not an id", async () => {
    const response = await DELETE(
      request("http://localhost/api/sync/charts?chartId=1%20or%201=1", { method: "DELETE", bearer: APP_TOKEN }),
    );

    expect(response.status).toBe(400);
    expect(findChartClient).not.toHaveBeenCalled();
  });

  it("deletes nothing for a signed-out caller", async () => {
    const response = await DELETE(
      request(`http://localhost/api/sync/charts?chartId=${CHART_ID}`, { method: "DELETE" }),
    );

    expect(response.status).toBe(200);
    expect(findChartClient).not.toHaveBeenCalled();
    expect(revokeConsent).not.toHaveBeenCalled();
  });
});
