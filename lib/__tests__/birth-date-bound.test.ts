import { describe, expect, it } from "vitest";
import { BirthInputSchema } from "../schemas";

const base = {
  name: "Test Reader",
  birth_time: "14:30",
  timezone_offset_minutes: 330,
  latitude: 19.076,
  longitude: 72.8777,
  country: "India",
  state: "Maharashtra",
  city: "Mumbai",
};

const isoDay = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const check = (birth_date: string) => BirthInputSchema.safeParse({ ...base, birth_date });

describe("birth_date ceiling", () => {
  it("accepts today and tomorrow in UTC, so every timezone's today passes", () => {
    expect(check(isoDay(0)).success).toBe(true);
    expect(check(isoDay(1)).success).toBe(true);
  });

  it("refuses anything later, with a readable message", () => {
    for (const date of [isoDay(2), "2999-01-01"]) {
      const result = check(date);
      expect(result.success, date).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.message)).toContain(
          "birth_date cannot be in the future",
        );
      }
    }
  });

  it("still accepts a historical chart", () => {
    expect(check("1869-10-02").success).toBe(true);
  });
});
