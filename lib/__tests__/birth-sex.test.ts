/**
 * Sex at birth: the two values a reader can give, the partner significator
 * each implies, and the trip from the URL to the engine's birth input. Not
 * given must read exactly as a chart did before the question existed.
 */
import { describe, expect, it } from "vitest";
import { BIRTH_SEX_CHOICES, parseBirthSex, partnerSignificator } from "../birth-sex";
import { buildChartHistoryQuery, chartParamsToBirthInput, chartParamsToQuery, readChartParams } from "../chart-params";
import { BirthInputSchema } from "../schemas";

const RAW = {
  name: "Asha",
  birthDate: "1990-05-15",
  birthTime: "10:30",
  timezoneOffsetMinutes: "330",
  latitude: "12.9716",
  longitude: "77.5946",
  country: "India",
  state: "Karnataka",
  city: "Bengaluru",
};

describe("sex at birth", () => {
  it("accepts female and male, and treats anything else as not given", () => {
    expect(parseBirthSex("female")).toBe("female");
    expect(parseBirthSex("male")).toBe("male");
    for (const value of [undefined, "", "Female", "woman", "other", 1]) {
      expect(parseBirthSex(value), String(value)).toBeUndefined();
    }
  });

  it("reads the partner's significator as Jupiter for a woman and Venus for a man", () => {
    expect(partnerSignificator("female")).toBe("Jupiter");
    expect(partnerSignificator("male")).toBe("Venus");
    expect(partnerSignificator(undefined)).toBeNull();
  });

  it("offers woman, man and prefer not to say, the last as the empty value", () => {
    expect(BIRTH_SEX_CHOICES.map((choice) => choice.value)).toEqual(["female", "male", ""]);
  });

  it("rides the URL only when given, and survives the history query", () => {
    expect(readChartParams({ ...RAW, birthSex: "female" }).birthSex).toBe("female");
    expect(readChartParams({ ...RAW, birthSex: "intersex" }).birthSex).toBe("");
    expect(readChartParams(RAW).birthSex).toBe("");

    const given = readChartParams({ ...RAW, birthSex: "male" });
    expect(new URLSearchParams(buildChartHistoryQuery(given)).get("birthSex")).toBe("male");
    expect(new URLSearchParams(chartParamsToQuery(given)).get("birthSex")).toBe("male");
    expect(buildChartHistoryQuery(readChartParams(RAW))).not.toContain("birthSex");
  });

  it("reaches the engine's birth input as birth_sex, and is absent when not given", () => {
    expect(chartParamsToBirthInput(readChartParams({ ...RAW, birthSex: "female" })).birth_sex).toBe("female");
    expect(chartParamsToBirthInput(readChartParams(RAW)).birth_sex).toBeUndefined();
    const parsed = BirthInputSchema.parse({
      name: "Asha",
      birth_date: "1990-05-15",
      birth_time: "10:30",
      timezone_offset_minutes: "330",
      latitude: "12.97",
      longitude: "77.59",
      birth_sex: "nonsense",
    });
    expect(parsed.birth_sex).toBeUndefined();
  });
});
