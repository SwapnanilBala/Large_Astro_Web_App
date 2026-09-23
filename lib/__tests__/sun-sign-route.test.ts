// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "../../app/api/chart/sun-sign/route";

const call = async (query: string) => {
  const response = await GET(new NextRequest(`http://localhost/api/chart/sun-sign?${query}`));
  return { status: response.status, body: await response.json() };
};

describe("/api/chart/sun-sign", () => {
  it("answers bad input in the shape every other route uses", async () => {
    const { status, body } = await call("birth_date=1990-02-31&birth_time=14:30&timezone_offset_minutes=330");
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(typeof body.error.message).toBe("string");
  });

  it("refuses an offset no time zone uses", async () => {
    const { status } = await call("birth_date=1990-04-15&birth_time=14:30&timezone_offset_minutes=99999");
    expect(status).toBe(400);
  });

  it("still returns the sun for a real birth", async () => {
    const { status, body } = await call("birth_date=1990-04-15&birth_time=14:30&timezone_offset_minutes=330");
    expect(status).toBe(200);
    expect(typeof body.sign).toBe("string");
    expect(body.degree_in_sign).toBeGreaterThanOrEqual(0);
    expect(body.degree_in_sign).toBeLessThan(30);
  });
});
