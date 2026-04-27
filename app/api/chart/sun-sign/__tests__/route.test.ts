import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "../route";

function makeRequest(searchParams: Record<string, string>) {
  const url = new URL("http://localhost/api/chart/sun-sign");
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

describe("/api/chart/sun-sign", () => {
  it("uses the sidereal chart engine and timezone offset for boundary dates", async () => {
    const response = await GET(
      makeRequest({
        birth_date: "1995-03-14",
        birth_time: "15:45",
        engine_id: "lahiri_classic",
        timezone_offset_minutes: "-240",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      sign: "Aquarius",
      degree_in_sign: 29.9764,
      engine_id: "lahiri_classic",
    });
  });

  it("matches the full chart result when geocoding resolves a different offset", async () => {
    const response = await GET(
      makeRequest({
        birth_date: "1995-03-14",
        birth_time: "15:45",
        engine_id: "lahiri_classic",
        timezone_offset_minutes: "-300",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      sign: "Pisces",
      degree_in_sign: 0.0179,
      engine_id: "lahiri_classic",
    });
  });
});
