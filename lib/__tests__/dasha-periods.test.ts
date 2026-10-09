/**
 * The Vimshottari periods the dasha panel walks and the reading route checks:
 * four levels from the chart's Maha Dasha list, by the engine's own rule.
 */
import { describe, expect, it } from "vitest";
import {
  DEEPEST_DASHA_LEVEL,
  chainKey,
  childSpans,
  dayMs,
  daysLeftAt,
  findChain,
  mahaSpans,
  pathAt,
  progressAt,
  spanAt,
  spanDays,
  statusAt,
} from "../dasha-periods";
import { DASHA_YEARS, NAKSHATRA_LORDS, calculateDashaTimeline } from "../engines/nakshatra-engine";

/* Born 1 January 1990 in Rohini, 5 degrees in: the Moon's Maha Dasha has begun before birth. */
const NOW = Date.parse("2026-10-08T12:00:00Z");
const BIRTH = Date.parse("1990-01-01T04:30:00Z");
const timeline = calculateDashaTimeline(
  { name: "Rohini", index: 3, lord: "Moon", pada: 2, degree_in_nakshatra: 5 },
  "1990-01-01",
  NOW,
  BIRTH,
);
const DASHA = { periods: timeline.periods };

describe("the Maha Dasha periods", () => {
  it("come from the chart's list, the first counted from its true start", () => {
    const spans = mahaSpans(DASHA);
    expect(spans.map((span) => span.planet).slice(0, 3)).toEqual(["Moon", "Mars", "Rahu"]);
    expect(spans[0].level).toBe(1);
    expect(spans[0].lords).toEqual(["Moon"]);
    expect(spans[0].start).toBe("1990-01-01");
    expect(dayMs(spans[0].sequenceStart)).toBeLessThan(dayMs(spans[0].start));
  });
});

describe("sub-periods", () => {
  const mars = mahaSpans(DASHA)[1];

  it("divide a whole period into nine, from its own lord on, in proportion to the lords' years", () => {
    const antars = childSpans(mars);
    expect(antars).toHaveLength(9);
    expect(antars.map((span) => span.planet)).toEqual([
      ...NAKSHATRA_LORDS.slice(NAKSHATRA_LORDS.indexOf("Mars")),
      ...NAKSHATRA_LORDS.slice(0, NAKSHATRA_LORDS.indexOf("Mars")),
    ]);
    expect(antars[0].start).toBe(mars.start);
    expect(antars[8].end).toBe(mars.end);
    for (let index = 1; index < antars.length; index++) expect(antars[index].start).toBe(antars[index - 1].end);
    const marsDays = spanDays(mars);
    expect(spanDays(antars[0]) / marsDays).toBeCloseTo(DASHA_YEARS.Mars / 120, 2);
    expect(antars.every((span) => span.level === 2 && span.lords[0] === "Mars")).toBe(true);
  });

  it("go four levels deep and no further", () => {
    const sookshmas = childSpans(childSpans(childSpans(mars)[0])[0]);
    expect(sookshmas).toHaveLength(9);
    expect(sookshmas[0].level).toBe(DEEPEST_DASHA_LEVEL);
    expect(sookshmas[0].lords).toEqual(["Mars", "Mars", "Mars", "Mars"]);
    expect(childSpans(sookshmas[0])).toEqual([]);
  });

  it("of a period begun before birth are cut at birth", () => {
    const moonAntars = childSpans(mahaSpans(DASHA)[0]);
    expect(moonAntars.length).toBeLessThan(9);
    expect(moonAntars[0].start).toBe("1990-01-01");
  });
});

describe("the periods running at an instant", () => {
  it("agree with the engine's current period, three levels down, and add the Sookshma", () => {
    const path = pathAt(DASHA, NOW);
    expect(path).toHaveLength(4);
    expect(path[0].planet).toBe(timeline.current_dasha?.planet);
    expect(path[1].planet).toBe(timeline.current_antardasha?.sub_lord);
    expect(path[1].sequenceStart).toBe(timeline.current_antardasha_start);
    expect(path[2].planet).toBe(timeline.current_pratyantar?.pratyantar_lord);
    expect(path[2].sequenceEnd).toBe(timeline.current_pratyantar_end);
    for (const span of path) expect(statusAt(span, NOW)).toBe("now");
    expect(path[3].lords).toEqual(path.map((span) => span.planet));
  });

  it("can stop short of the Sookshma", () => {
    expect(pathAt(DASHA, NOW, 2)).toHaveLength(2);
  });

  it("are none before birth", () => {
    expect(pathAt(DASHA, Date.parse("1980-01-01T00:00:00Z"))).toEqual([]);
  });

  it("count a period's first day as its own and its last as the next one's", () => {
    const antars = childSpans(mahaSpans(DASHA)[1]);
    expect(spanAt(antars, dayMs(antars[3].start))).toBe(antars[3]);
    expect(spanAt(antars, dayMs(antars[3].end))).toBe(antars[4]);
  });
});

describe("finding a period by its lords and its start", () => {
  const path = pathAt(DASHA, NOW);

  it("walks down to the period named", () => {
    const found = findChain(DASHA, path.map((span) => span.planet), path[3].start);
    expect(found).toEqual(path);
    expect(findChain(DASHA, path.slice(0, 2).map((span) => span.planet), path[1].start)).toEqual(path.slice(0, 2));
  });

  it("refuses a period the chart does not have", () => {
    expect(findChain(DASHA, ["Venus", "Venus"], path[1].start)).toBeNull();
    expect(findChain(DASHA, path.map((span) => span.planet), "2026-01-01")).toBeNull();
    expect(findChain(DASHA, path.map((span) => span.planet), "01/10/2026")).toBeNull();
    expect(findChain(DASHA, [], path[0].start)).toBeNull();
    expect(findChain(DASHA, [...path.map((span) => span.planet), "Sun"], path[3].start)).toBeNull();
  });
});

describe("where an instant falls against a period", () => {
  const span = { start: "2020-01-01", end: "2020-01-11", sequenceStart: "2019-12-27", sequenceEnd: "2020-01-11" };

  it("says past, now or upcoming", () => {
    expect(statusAt(span, Date.parse("2019-12-31T23:00:00Z"))).toBe("upcoming");
    expect(statusAt(span, Date.parse("2020-01-05T00:00:00Z"))).toBe("now");
    expect(statusAt(span, Date.parse("2020-01-11T00:00:00Z"))).toBe("past");
  });

  it("measures progress against the whole period and days left against its end", () => {
    expect(progressAt(span, Date.parse("2020-01-06T00:00:00Z"))).toBeCloseTo(10 / 15, 5);
    expect(progressAt(span, Date.parse("2030-01-01T00:00:00Z"))).toBe(1);
    expect(daysLeftAt(span, Date.parse("2020-01-06T00:00:00Z"))).toBe(5);
    expect(daysLeftAt(span, Date.parse("2030-01-01T00:00:00Z"))).toBe(0);
    expect(spanDays(span)).toBe(10);
  });

  it("names a period for a reading by its lords and its start", () => {
    expect(chainKey([{ planet: "Saturn", start: "2019-03-01" }, { planet: "Mercury", start: "2024-11-02" }])).toBe(
      "Saturn>Mercury@2024-11-02",
    );
    expect(chainKey([])).toBe("");
  });
});
