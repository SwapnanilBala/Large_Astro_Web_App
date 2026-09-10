export type DivisionalChartSensitivity = "foundation" | "exact-time" | "rectified-time";

export type ImportantDivisionalChartGuide = {
  division: number;
  label: string;
  sensitivity: DivisionalChartSensitivity;
};

/**
 * The ten vargas that receive a client-facing explanation in the atlas.
 *
 * The engine still calculates every supported division between D1 and D60.
 * This list is deliberately smaller: a client report benefits from a clear
 * hierarchy, and high divisions should not be presented as twenty independent
 * predictions carrying equal evidential weight.
 *
 * Structure only. The prose that describes each varga -- its Sanskrit name,
 * focus, summary, what to read it with, the client question, and the
 * birth-time caveat -- lives in the `divisional.guide` namespace so it can be
 * translated; reach it with divisionalGuideKey below. What stays here is what
 * no catalog can answer: which divisions are promoted, and how much the
 * conclusions drawn from each depend on an accurate birth time.
 */
export const IMPORTANT_DIVISIONAL_CHARTS: ImportantDivisionalChartGuide[] = [
  { division: 1, label: "D1", sensitivity: "foundation" },
  { division: 2, label: "D2", sensitivity: "exact-time" },
  { division: 4, label: "D4", sensitivity: "exact-time" },
  { division: 7, label: "D7", sensitivity: "exact-time" },
  { division: 9, label: "D9", sensitivity: "exact-time" },
  { division: 10, label: "D10", sensitivity: "exact-time" },
  { division: 12, label: "D12", sensitivity: "exact-time" },
  { division: 24, label: "D24", sensitivity: "exact-time" },
  { division: 30, label: "D30", sensitivity: "exact-time" },
  { division: 60, label: "D60", sensitivity: "rectified-time" },
];

export const IMPORTANT_DIVISION_NUMBERS = IMPORTANT_DIVISIONAL_CHARTS.map(
  (chart) => chart.division,
);

export function getImportantDivisionalChartGuide(division: number) {
  return IMPORTANT_DIVISIONAL_CHARTS.find((chart) => chart.division === division);
}

/** The per-varga prose fields carried by `divisional.guide.dN`. */
export type DivisionalGuideField =
  | "name"
  | "focus"
  | "summary"
  | "readWith"
  | "clientQuestion"
  | "sensitivityNote"
  | "mappingMethod";

/**
 * The message key for one prose field of one varga.
 *
 * Built rather than written out at each call site because the division is
 * runtime data -- the selected tab, the route segment -- while the field is
 * not, so the field is the part worth typing. Callers pass the result to
 * useRouteMessages with messages/en.divisional.json.
 */
export function divisionalGuideKey(
  division: number,
  field: DivisionalGuideField,
): string {
  return `divisional.guide.d${division}.${field}`;
}
