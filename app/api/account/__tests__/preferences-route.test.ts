import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const findRequestAccount = vi.fn();
const readPreferences = vi.fn();
const saveChartStyle = vi.fn();

vi.mock("@/lib/sync/account", () => ({
  findRequestAccount: (...args: unknown[]) => findRequestAccount(...args),
}));
vi.mock("@/lib/sync/preferences", () => ({
  readPreferences: (...args: unknown[]) => readPreferences(...args),
  saveChartStyle: (...args: unknown[]) => saveChartStyle(...args),
}));

const { GET, PUT } = await import("../preferences/route");

const URL = "http://localhost:7001/api/account/preferences";
const put = (body: unknown) =>
  new NextRequest(URL, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/account/preferences", () => {
  it("answers a signed-out visitor plainly, without touching the store", async () => {
    findRequestAccount.mockResolvedValue(null);

    const response = await GET(new NextRequest(URL));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ signedIn: false, preferences: null });
    expect(readPreferences).not.toHaveBeenCalled();
  });

  it("returns the account's chart style", async () => {
    findRequestAccount.mockResolvedValue({ userId: "user-1" });
    readPreferences.mockResolvedValue({ chartStyle: "north-indian" });

    const response = await GET(new NextRequest(URL));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      signedIn: true,
      preferences: { chartStyle: "north-indian" },
    });
    expect(readPreferences).toHaveBeenCalledWith("user-1");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("says 503 when the store cannot answer, as before migration 0009 is applied", async () => {
    findRequestAccount.mockResolvedValue({ userId: "user-1" });
    readPreferences.mockRejectedValue(new Error('relation "user_preferences" does not exist'));

    const response = await GET(new NextRequest(URL));

    expect(response.status).toBe(503);
  });
});

describe("PUT /api/account/preferences", () => {
  it("saves a valid style for a signed-in account", async () => {
    findRequestAccount.mockResolvedValue({ userId: "user-1" });
    saveChartStyle.mockResolvedValue(undefined);

    const response = await PUT(put({ chartStyle: "north-indian" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ preferences: { chartStyle: "north-indian" } });
    expect(saveChartStyle).toHaveBeenCalledWith("user-1", "north-indian");
  });

  it("refuses a style it does not know, before looking for an account", async () => {
    const response = await PUT(put({ chartStyle: "south-indian" }));

    expect(response.status).toBe(400);
    expect(findRequestAccount).not.toHaveBeenCalled();
    expect(saveChartStyle).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    const response = await PUT(put("not json"));

    expect(response.status).toBe(400);
    expect(saveChartStyle).not.toHaveBeenCalled();
  });

  it("refuses a signed-out write", async () => {
    findRequestAccount.mockResolvedValue(null);

    const response = await PUT(put({ chartStyle: "constellation" }));

    expect(response.status).toBe(401);
    expect(saveChartStyle).not.toHaveBeenCalled();
  });

  it("says 503 when the store cannot take the write", async () => {
    findRequestAccount.mockResolvedValue({ userId: "user-1" });
    saveChartStyle.mockRejectedValue(new Error("connection refused"));

    const response = await PUT(put({ chartStyle: "constellation" }));

    expect(response.status).toBe(503);
  });
});
