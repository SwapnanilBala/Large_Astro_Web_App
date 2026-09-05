import { describe, expect, it } from "vitest";

import {
  chartFactsFromQueryString,
  resolveBirthTimeColumns,
  timezoneSource,
  toSqlTime,
} from "@/lib/sync/facts";
import {
  birthFingerprint,
  chartInputFingerprint,
  clientReference,
  type BirthFacts,
} from "@/lib/sync/fingerprint";
import { ChartSyncFactsSchema, ChartSyncRequestSchema } from "@/lib/schemas";

const COMPLETE_QUERY =
  "name=Asha&birthDate=1992-05-12&birthTime=08%3A30&timezoneOffsetMinutes=330" +
  "&latitude=22.57&longitude=88.36&country=India&state=West+Bengal&city=Kolkata" +
  "&engineId=lahiri_classic";

const FACTS: BirthFacts = {
  name: "Asha",
  birthDate: "1992-05-12",
  birthTime: "08:30",
  latitude: 22.57,
  longitude: 88.36,
  timezoneOffsetMinutes: 330,
  timeZoneId: "Asia/Kolkata",
  country: "India",
  state: "West Bengal",
  city: "Kolkata",
  town: "",
};

describe("birth facts from a query string", () => {
  it("reads the fields /insights was rendered from", () => {
    const { facts, engineId } = chartFactsFromQueryString(COMPLETE_QUERY);

    expect(facts.name).toBe("Asha");
    expect(facts.birthDate).toBe("1992-05-12");
    expect(facts.birthTime).toBe("08:30");
    expect(facts.latitude).toBe(22.57);
    expect(facts.longitude).toBe(88.36);
    expect(facts.timezoneOffsetMinutes).toBe(330);
    expect(facts.city).toBe("Kolkata");
    expect(engineId).toBe("lahiri_classic");
  });

  it("defaults the engine rather than storing a blank one", () => {
    const { engineId } = chartFactsFromQueryString("name=Asha&birthDate=1992-05-12");
    expect(engineId).toBe("lahiri_classic");
  });

  /* birth_profiles_coordinate_pair_check: (lat is null) = (long is null). A
     chart with one usable axis is not half-located, it is unlocated. */
  it("drops a half-present coordinate pair rather than storing one axis", () => {
    const { facts } = chartFactsFromQueryString(
      COMPLETE_QUERY.replace("&longitude=88.36", ""),
    );
    expect(facts.latitude).toBeNull();
    expect(facts.longitude).toBeNull();
  });

  it("drops the pair when an axis is present but blank", () => {
    const { facts } = chartFactsFromQueryString(
      COMPLETE_QUERY.replace("longitude=88.36", "longitude="),
    );
    expect(facts.latitude).toBeNull();
    expect(facts.longitude).toBeNull();
  });

  it("keeps a legitimate zero coordinate", () => {
    const { facts } = chartFactsFromQueryString(
      "name=Kofi&birthDate=1992-05-12&latitude=0&longitude=0",
    );
    expect(facts.latitude).toBe(0);
    expect(facts.longitude).toBe(0);
  });

  it("treats a missing offset as UTC, not NaN", () => {
    const { facts } = chartFactsFromQueryString("name=Asha&birthDate=1992-05-12");
    expect(facts.timezoneOffsetMinutes).toBe(0);
  });

  it("carries the fallback flag through", () => {
    expect(chartFactsFromQueryString(COMPLETE_QUERY).birthTimeIsFallback).toBe(false);
    expect(
      chartFactsFromQueryString(`${COMPLETE_QUERY}&birthTimeFallback=fallback`)
        .birthTimeIsFallback,
    ).toBe(true);
  });
});

describe("birth time columns", () => {
  it("widens HH:MM to the HH:MM:SS a time column wants", () => {
    expect(toSqlTime("8:30")).toBe("08:30:00");
    expect(toSqlTime("08:30:15")).toBe("08:30:15");
  });

  /* An exact time must have reported = calculation and the flag clear. */
  it("records an exact time as reported and not a fallback", () => {
    expect(resolveBirthTimeColumns("08:30", "exact", false)).toEqual({
      reportedBirthTime: "08:30:00",
      calculationBirthTime: "08:30:00",
      birthTimeAccuracy: "exact",
      calculationTimeIsFallback: false,
    });
  });

  /* Anything not exact must have the fallback flag set, and a reported time of
     null — the visitor never reported one. */
  it("records an approximate time with no reported value", () => {
    expect(resolveBirthTimeColumns("12:00", "morning", true)).toEqual({
      reportedBirthTime: null,
      calculationBirthTime: "12:00:00",
      birthTimeAccuracy: "morning",
      calculationTimeIsFallback: true,
    });
  });

  it("demotes an exact accuracy that admits to being a fallback", () => {
    /* Both constraints would reject exact+fallback. Resolving to unknown keeps
       the chart and describes the time honestly. */
    expect(resolveBirthTimeColumns("12:00", "exact", true)).toEqual({
      reportedBirthTime: null,
      calculationBirthTime: "12:00:00",
      birthTimeAccuracy: "unknown",
      calculationTimeIsFallback: true,
    });
  });

  it("treats a non-exact accuracy as a fallback even when the flag is clear", () => {
    const columns = resolveBirthTimeColumns("12:00", "unknown", false);
    expect(columns.calculationTimeIsFallback).toBe(true);
    expect(columns.reportedBirthTime).toBeNull();
  });
});

describe("timezone source", () => {
  it("prefers a named zone over coordinates", () => {
    expect(timezoneSource(FACTS)).toBe("time_zone_id");
  });

  it("falls back to coordinates when there is no zone id", () => {
    expect(timezoneSource({ ...FACTS, timeZoneId: "" })).toBe("coordinates");
  });

  it("reports a bare offset when there is neither", () => {
    expect(
      timezoneSource({ timeZoneId: "  ", latitude: null, longitude: null }),
    ).toBe("numeric_offset");
  });
});

describe("fingerprints", () => {
  it("is stable across calls", () => {
    expect(birthFingerprint(FACTS)).toBe(birthFingerprint({ ...FACTS }));
  });

  it("treats the same person as one client despite a corrected birth time", () => {
    expect(clientReference("Asha", "1992-05-12")).toBe(
      clientReference("  asha  ", "1992-05-12"),
    );
  });

  it("separates two people who share a name", () => {
    expect(clientReference("Asha", "1992-05-12")).not.toBe(
      clientReference("Asha", "1988-01-02"),
    );
  });

  it("changes when any stored birth fact changes", () => {
    const base = birthFingerprint(FACTS);
    expect(birthFingerprint({ ...FACTS, birthTime: "08:31" })).not.toBe(base);
    expect(birthFingerprint({ ...FACTS, city: "Howrah" })).not.toBe(base);
    expect(birthFingerprint({ ...FACTS, latitude: 22.58 })).not.toBe(base);
    expect(birthFingerprint({ ...FACTS, timezoneOffsetMinutes: 300 })).not.toBe(base);
  });

  it("does not let field boundaries slide into each other", () => {
    /* Joined on a separator that cannot occur in the values, so "ab"+"c" and
       "a"+"bc" stay distinct. */
    expect(clientReference("ab", "c")).not.toBe(clientReference("a", "bc"));
  });

  it("keeps the same facts on two engines as two charts", () => {
    expect(chartInputFingerprint(FACTS, "lahiri_classic")).not.toBe(
      chartInputFingerprint(FACTS, "fagan_bradley"),
    );
  });

  it("fits the columns it is stored in", () => {
    /* clients.external_reference is varchar(120); input_fingerprint is 128. */
    expect(clientReference("Asha", "1992-05-12")).toHaveLength(64);
    expect(chartInputFingerprint(FACTS, "lahiri_classic")).toHaveLength(64);
  });
});

describe("request validation", () => {
  const validConsent = {
    granted: true as const,
    prompt: "Save this chart to your account?",
    captureSource: "intake" as const,
  };

  it("accepts a chart push with consent", () => {
    const parsed = ChartSyncRequestSchema.safeParse({
      queryString: COMPLETE_QUERY,
      ascendantSign: "Leo",
      consent: validConsent,
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses a push with no consent block at all", () => {
    const parsed = ChartSyncRequestSchema.safeParse({ queryString: COMPLETE_QUERY });
    expect(parsed.success).toBe(false);
  });

  it("refuses a push that says consent was withheld", () => {
    /* granted is a literal true, so "false" is not a shape the route has to
       remember to check — it never parses. */
    const parsed = ChartSyncRequestSchema.safeParse({
      queryString: COMPLETE_QUERY,
      consent: { ...validConsent, granted: false },
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses consent with no record of what was agreed to", () => {
    const parsed = ChartSyncRequestSchema.safeParse({
      queryString: COMPLETE_QUERY,
      consent: { granted: true, prompt: "", captureSource: "intake" },
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts facts inside the ranges the table allows", () => {
    const { facts } = chartFactsFromQueryString(COMPLETE_QUERY);
    expect(ChartSyncFactsSchema.safeParse(facts).success).toBe(true);
  });

  it("refuses a birth date the table would reject", () => {
    /* birth_profiles_birth_date_check has a 1900-01-01 floor. */
    const { facts } = chartFactsFromQueryString(
      COMPLETE_QUERY.replace("1992-05-12", "1832-04-01"),
    );
    const parsed = ChartSyncFactsSchema.safeParse(facts);
    expect(parsed.success).toBe(false);
  });

  it("refuses an out-of-range latitude", () => {
    const { facts } = chartFactsFromQueryString(
      COMPLETE_QUERY.replace("latitude=22.57", "latitude=131"),
    );
    expect(ChartSyncFactsSchema.safeParse(facts).success).toBe(false);
  });

  it("refuses a nameless chart", () => {
    const { facts } = chartFactsFromQueryString(COMPLETE_QUERY.replace("name=Asha", "name="));
    expect(ChartSyncFactsSchema.safeParse(facts).success).toBe(false);
  });
});
