import { describe, expect, it } from "vitest";
import type { ChartApiResponse } from "@/lib/astro-types";
import type { MajorLifeShift } from "@/lib/engines/major-shifts-engine";
import { buildPersonalStory } from "@/lib/story-engine";
import { makeDomainInsight, makeRule } from "./factories";

const LIFE_SHIFTS: MajorLifeShift[] = [
  {
    index: 1,
    kind: "jupiter-return",
    label: "Jupiter return (third)",
    planet: "Jupiter",
    pivotIso: "2027-04-15T00:00:00.000Z",
    windowStartIso: "2026-08-15T00:00:00.000Z",
    windowEndIso: "2027-12-15T00:00:00.000Z",
    status: "upcoming",
    ageAtPivot: 36,
    theme: "expansion, meaning, and a wider field of play",
    narrative: "A wider field of play is opening.",
    evidence: "Cycle: ~11.9 years",
  },
];

function makePayload(): ChartApiResponse {
  return {
    generated_at_utc: "2026-07-26T00:00:00.000Z",
    client: {
      name: "Avery",
      country: "United States",
      state: "NY",
      city: "New York",
      town: "",
      latitude: 40.7128,
      longitude: -74.006,
      timezone_offset_minutes: -240,
      time_zone_id: "America/New_York",
    },
    chart: {
      julian_day_ut: 2448057.0,
      ascendant: { longitude: 12, sign: "Aries", degree_in_sign: 12 },
      planets: [
        { name: "Sun", longitude: 82, sign: "Gemini", degree_in_sign: 22, house: 3 },
        { name: "Moon", longitude: 119, sign: "Cancer", degree_in_sign: 29, house: 4 },
        { name: "Mars", longitude: 18, sign: "Aries", degree_in_sign: 18, house: 1 },
        { name: "Jupiter", longitude: 274, sign: "Capricorn", degree_in_sign: 4, house: 10 },
        { name: "Saturn", longitude: 302, sign: "Aquarius", degree_in_sign: 2, house: 11 },
        { name: "Rahu", longitude: 241, sign: "Sagittarius", degree_in_sign: 1, house: 9 },
        { name: "Ketu", longitude: 61, sign: "Gemini", degree_in_sign: 1, house: 3 },
      ],
      houses: [],
      deterministic_rules: [makeRule()],
      summary: "A focused chart with a practical impulse toward leadership.",
      nakshatra: {
        name: "Ashlesha",
        index: 9,
        lord: "Mercury",
        pada: 4,
        degree_in_nakshatra: 12,
      },
      dasha: {
        current_dasha: "Jupiter",
        current_antardasha: "Moon",
        current_dasha_start: "2021-01-01",
        current_dasha_end: "2037-01-01",
        current_antardasha_start: "2026-06-01",
        current_antardasha_end: "2027-10-01",
        periods: [],
      },
      life_domain_insights: [makeDomainInsight()],
      shadbala: [
        {
          planet: "Mars",
          sthanaBala: 1,
          digBala: 1,
          kalaBala: 1,
          cheshtaBala: 1,
          naisargikaBala: 1,
          drikBala: 1,
          totalVirupas: 420,
          totalRupas: 7,
          requiredMinimum: 6,
          strengthRatio: 1.17,
          isStrong: true,
        },
      ],
      yogas: [
        {
          yoga_id: "gaja-kesari",
          name: "Gaja-Kesari Support",
          sanskrit: "Gaja-Kesari",
          category: "benefic",
          present: true,
          strength: "strong",
          occurrence_chance: 0.88,
          involved_planets: ["Moon", "Jupiter"],
          description: "Perspective and resilience reinforce one another.",
          effects: "Supports perspective, social grace, and recovery after emotional turbulence.",
        },
      ],
    },
    engine: {
      engine_id: "lahiri_classic",
      engine_label: "Lahiri Classic",
      ephemeris_provider: "test",
      ayanamsha: "Lahiri",
      house_system: "Whole Sign",
      fallback_mode: false,
      available_engines: [],
    },
    storage: { configured: false, persisted: false, message: "Test" },
    access: {
      subscription_tier: "guest",
      premium_features_enabled: true,
      ultimate_features_enabled: true,
      locked_features: [],
    },
  };
}

describe("buildPersonalStory", () => {
  it("builds all nine requested story chapters from chart signals", () => {
    const story = buildPersonalStory(makePayload(), { lifeShifts: LIFE_SHIFTS });

    expect(story.title).toBe("Avery story");
    expect(story.chapters.map((chapter) => chapter.id)).toEqual([
      "essence",
      "marriage",
      "family",
      "career",
      "wealth",
      "strengths",
      "emotional-orientation",
      "timing",
      "grounding",
    ]);
    expect(story.chapters[0].body).toContain("Aries");
    // Marriage/family/wealth fall back to general guidance because the mock
    // payload only supplies a "career" life-domain insight.
    expect(story.chapters[1].body).toContain("7th house");
    expect(story.chapters[2].body).toContain("4th house");
    expect(story.chapters[3].body).toContain("Career patterns reward steady leadership");
    expect(story.chapters[4].body).toContain("8th house");
    expect(story.chapters[5].body).toContain("Career");
    expect(story.chapters[6].body).toContain("Moon in Cancer");
    expect(story.chapters[7].body).toContain("Jupiter");
    expect(story.chapters[7].highlights).toContain(
      "Upcoming: Jupiter return (third) (Aug 2026 – Dec 2027)",
    );
    expect(story.chapters[8].body).toContain("Saturn");
  });

  it("remains deterministic when its life-shift inputs are supplied", () => {
    const payload = makePayload();

    expect(buildPersonalStory(payload, { lifeShifts: LIFE_SHIFTS })).toEqual(
      buildPersonalStory(payload, { lifeShifts: LIFE_SHIFTS }),
    );
  });

  it("returns a usable story when premium enrichment is unavailable", () => {
    const payload = makePayload();
    payload.chart.nakshatra = undefined;
    payload.chart.dasha = undefined;
    payload.chart.life_domain_insights = undefined;
    payload.chart.shadbala = undefined;
    payload.chart.yogas = undefined;

    const story = buildPersonalStory(payload, { lifeShifts: [] });

    expect(story.chapters).toHaveLength(9);
    expect(story.chapters.every((chapter) => chapter.body.length > 0)).toBe(true);
  });
});
