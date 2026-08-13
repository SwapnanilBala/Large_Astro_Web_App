export type DivisionalChartSensitivity = "foundation" | "exact-time" | "rectified-time";

export type ImportantDivisionalChartGuide = {
  division: number;
  label: string;
  name: string;
  focus: string;
  summary: string;
  readWith: string;
  clientQuestion: string;
  sensitivity: DivisionalChartSensitivity;
  sensitivityNote: string;
};

/**
 * The ten vargas that receive a client-facing explanation in the atlas.
 *
 * The engine still calculates every supported division between D1 and D60.
 * This list is deliberately smaller: a client report benefits from a clear
 * hierarchy, and high divisions should not be presented as twenty independent
 * predictions carrying equal evidential weight.
 */
export const IMPORTANT_DIVISIONAL_CHARTS: ImportantDivisionalChartGuide[] = [
  {
    division: 1,
    label: "D1",
    name: "Rashi",
    focus: "Natal foundation",
    summary:
      "The main chart describes the overall pattern: identity, life direction, houses, and the natal promise that every other varga must refine rather than replace.",
    readWith: "Begin here. No divisional conclusion should contradict a weak or absent promise in D1.",
    clientQuestion: "What is the central pattern through which the rest of this reading unfolds?",
    sensitivity: "foundation",
    sensitivityNote:
      "Planetary signs are comparatively stable; the ascendant and houses still depend on the recorded birth time.",
  },
  {
    division: 2,
    label: "D2",
    name: "Hora",
    focus: "Resources and stewardship",
    summary:
      "D2 refines the way resources are gathered, protected, shared, and converted into material stability.",
    readWith: "Read with the D1 second and eleventh houses, their lords, and Jupiter and Venus strength.",
    clientQuestion: "What style of resource-building is easiest to sustain over time?",
    sensitivity: "exact-time",
    sensitivityNote: "Use an exact birth time before promoting the D2 ascendant or houses into a firm conclusion.",
  },
  {
    division: 4,
    label: "D4",
    name: "Chaturthamsa",
    focus: "Home, property, and rootedness",
    summary:
      "D4 refines home, property, settlement, emotional rootedness, and the conditions that make a place feel secure.",
    readWith: "Read with the D1 fourth house, Moon, Mars, and relevant property or relocation periods.",
    clientQuestion: "What conditions help home and long-term security become genuinely restorative?",
    sensitivity: "exact-time",
    sensitivityNote: "An exact time is important because the divisional ascendant can change within a short interval.",
  },
  {
    division: 7,
    label: "D7",
    name: "Saptamsa",
    focus: "Children, care, and legacy",
    summary:
      "D7 refines themes of children, caregiving, mentorship, creative continuation, and what is carried into the next generation.",
    readWith: "Read with the D1 fifth house, Jupiter, its lord, and supportive timing periods.",
    clientQuestion: "How does the chart describe care, continuation, and the legacy you cultivate?",
    sensitivity: "exact-time",
    sensitivityNote: "Treat D7 house-based statements as provisional unless the recorded time is exact.",
  },
  {
    division: 9,
    label: "D9",
    name: "Navamsa",
    focus: "Partnership and inner maturity",
    summary:
      "D9 refines relationship maturity, commitments, values, dharma, and how natal potential develops with experience.",
    readWith: "Read with the D1 seventh house, Venus, Jupiter, relationship rules, and the active dasha lords.",
    clientQuestion: "What qualities help commitment become more mature and sustainable?",
    sensitivity: "exact-time",
    sensitivityNote: "D9 is highly useful, but its ascendant should be trusted only when the birth time is exact.",
  },
  {
    division: 10,
    label: "D10",
    name: "Dashamsa",
    focus: "Career and public contribution",
    summary:
      "D10 refines vocation, responsibility, leadership, professional visibility, and the way work reaches the wider world.",
    readWith: "Read with the D1 tenth house, its lord, Sun, Saturn, Mercury, and current career timing.",
    clientQuestion: "Where can competence become visible, useful, and increasingly authoritative?",
    sensitivity: "exact-time",
    sensitivityNote: "Small time errors can change the D10 ascendant; confirm it before making specific career claims.",
  },
  {
    division: 12,
    label: "D12",
    name: "Dwadashamsa",
    focus: "Parents and inherited patterns",
    summary:
      "D12 refines parental influence, ancestry, inherited habits, and the family patterns a person carries forward or consciously changes.",
    readWith: "Read with the D1 fourth and ninth houses, Sun, Moon, and family-domain evidence.",
    clientQuestion: "Which inherited patterns provide support, and which are ready to be handled differently?",
    sensitivity: "exact-time",
    sensitivityNote: "Use exact-time data for the D12 ascendant and house emphasis.",
  },
  {
    division: 24,
    label: "D24",
    name: "Chaturvimshamsa",
    focus: "Learning and mastery",
    summary:
      "D24 refines education, learning style, disciplined study, teachers, and how knowledge becomes usable mastery.",
    readWith: "Read with the D1 fourth, fifth, and ninth houses, plus Mercury and Jupiter strength.",
    clientQuestion: "Which conditions make learning deeper, more consistent, and easier to apply?",
    sensitivity: "exact-time",
    sensitivityNote: "At this resolution, exact birth time and boundary awareness are essential.",
  },
  {
    division: 30,
    label: "D30",
    name: "Trimshamsa",
    focus: "Pressure and resilience",
    summary:
      "D30 refines how strain, conflict, vulnerability, and recovery are experienced. It is best used for practical risk awareness, not fear-based prediction.",
    readWith: "Read with the D1 sixth, eighth, and twelfth houses, Saturn and Mars, and measured support factors.",
    clientQuestion: "What helps you respond to pressure without letting it define the whole story?",
    sensitivity: "exact-time",
    sensitivityNote: "High sensitivity makes exact-time input necessary for house-level interpretation.",
  },
  {
    division: 60,
    label: "D60",
    name: "Shashtiamsa",
    focus: "Fine-grained patterning",
    summary:
      "D60 is a very fine-grained traditional layer used to qualify deeper patterning. It should never be treated as a standalone verdict or used to override more stable evidence.",
    readWith: "Use only after D1, the relevant domain varga, strength measures, and timing all point in the same direction.",
    clientQuestion: "Does this fine layer repeat an already well-supported theme, or merely introduce noise?",
    sensitivity: "rectified-time",
    sensitivityNote: "D60 needs a rectified or exceptionally precise birth time; otherwise treat it as exploratory only.",
  },
];

export const IMPORTANT_DIVISION_NUMBERS = IMPORTANT_DIVISIONAL_CHARTS.map(
  (chart) => chart.division,
);

export function getImportantDivisionalChartGuide(division: number) {
  return IMPORTANT_DIVISIONAL_CHARTS.find((chart) => chart.division === division);
}
