import type {
  ChartApiResponse,
  DeterministicRule,
  LifeDomainInsight,
  PlanetPosition,
  ShadbalaResult,
} from "@/lib/astro-types";
import {
  computeMajorLifeShifts,
  type MajorLifeShift,
} from "@/lib/engines/major-shifts-engine";

export type PersonalStoryChapterId =
  | "essence"
  | "strengths"
  | "emotional-orientation"
  | "timing"
  | "grounding";

export type PersonalStorySignal = {
  label: string;
  value: string;
};

export type PersonalStoryChapter = {
  id: PersonalStoryChapterId;
  eyebrow: string;
  title: string;
  body: string;
  highlights: string[];
  signals: PersonalStorySignal[];
};

export type PersonalStory = {
  title: string;
  introduction: string;
  chapters: PersonalStoryChapter[];
  reflectionNote: string;
};

export type BuildPersonalStoryOptions = {
  /**
   * Supplying life shifts makes callers/tests fully deterministic and avoids
   * recalculating the shared timing model. Omit it for the standard app flow.
   */
  lifeShifts?: MajorLifeShift[];
};

const SIGN_APPROACHES: Record<string, string> = {
  Aries: "You learn through movement, initiative, and a clear challenge to meet.",
  Taurus: "You build confidence through consistency, tangible value, and a pace you can sustain.",
  Gemini: "You make sense of life by comparing ideas, asking questions, and keeping conversation moving.",
  Cancer: "You orient around belonging, protection, and the emotional safety of the people and places you call home.",
  Leo: "You grow when you can create visibly, lead generously, and take pride in your contribution.",
  Virgo: "You gain traction by improving what is in front of you, making systems clearer, and practicing a craft.",
  Libra: "You find direction through dialogue, fairness, and relationships where both sides can flourish.",
  Scorpio: "You are built for depth: research, truth-telling, and turning difficult material into useful insight.",
  Sagittarius: "You thrive when a horizon is opening through learning, travel, meaning, or a larger point of view.",
  Capricorn: "You prefer a path that can be earned, structured, and made durable over time.",
  Aquarius: "You come alive when you can improve systems, connect people, and test an original idea.",
  Pisces: "You move through life with imagination, compassion, and a need for work that feels meaningful.",
};

const MOON_NEEDS: Record<string, string> = {
  Aries: "short action loops, honest expression, and room to reset after friction",
  Taurus: "predictable rhythms, sensory comfort, and time to settle into a decision",
  Gemini: "conversation, variety, and enough mental space to name what you feel",
  Cancer: "trusted people, restorative privacy, and a stable home base",
  Leo: "warm recognition, creative expression, and relationships that celebrate your heart",
  Virgo: "clear routines, useful work, and permission to make progress one detail at a time",
  Libra: "fair dialogue, beauty, and enough calm to resolve tension rather than carry it",
  Scorpio: "privacy, loyalty, and a safe place to process intensity before responding",
  Sagittarius: "freedom, learning, and honest perspective when feelings become heavy",
  Capricorn: "competence, boundaries, and time to turn emotion into a practical next step",
  Aquarius: "space to think, friendship, and causes larger than the immediate mood",
  Pisces: "gentle boundaries, creativity, and quiet time to recover from emotional noise",
};

const SIGN_RULERS: Record<string, string> = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
};

const HOUSE_THEMES: Record<number, string> = {
  1: "identity, vitality, and personal direction",
  2: "values, resources, and what you can build or communicate",
  3: "skills, learning, courage, and everyday initiative",
  4: "home, roots, and emotional foundations",
  5: "creativity, joy, romance, and self-expression",
  6: "routines, service, health habits, and problem-solving",
  7: "partnerships, agreements, and the people who mirror you",
  8: "transformation, shared resources, and what needs honest attention",
  9: "meaning, teachers, faith, and long-distance growth",
  10: "vocation, responsibility, and visible contribution",
  11: "community, collaboration, and long-range hopes",
  12: "rest, release, private reflection, and spiritual recovery",
};

const PLANET_GIFTS: Record<string, string> = {
  Sun: "leadership, clarity of purpose, and visible contribution",
  Moon: "care, emotional intelligence, and an instinct for belonging",
  Mars: "courage, decisive action, and protective drive",
  Mercury: "communication, learning, and adaptable problem-solving",
  Jupiter: "teaching, perspective, and principled growth",
  Venus: "relationship skill, taste, and the ability to create harmony",
  Saturn: "discipline, endurance, and patient construction",
  Rahu: "reinvention, ambition, and comfort with unfamiliar terrain",
  Ketu: "discernment, independence, and inward mastery",
};

const STRENGTH_RANK: Record<string, number> = {
  strong: 0,
  moderate: 1,
  weak: 2,
};

function getPlanet(planets: PlanetPosition[], name: string | undefined) {
  return name ? planets.find((planet) => planet.name === name) : undefined;
}

function houseTheme(house: number | undefined): string {
  return house ? HOUSE_THEMES[house] ?? "a meaningful life area" : "a meaningful life area";
}

function displayName(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed || "Your";
}

function compactText(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

function getTopDomain(payload: ChartApiResponse): LifeDomainInsight | undefined {
  return [...(payload.chart.life_domain_insights ?? [])].sort(
    (left, right) => right.confidence_score - left.confidence_score,
  )[0];
}

function getStrongestPlanet(payload: ChartApiResponse): ShadbalaResult | undefined {
  return [...(payload.chart.shadbala ?? [])].sort(
    (left, right) => right.strengthRatio - left.strengthRatio,
  )[0];
}

function getMostRelevantRule(payload: ChartApiResponse): DeterministicRule | undefined {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  return [...payload.chart.deterministic_rules].sort((left, right) => {
    const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority];
    if (priorityDifference !== 0) return priorityDifference;
    return (right.confidence_score ?? 0) - (left.confidence_score ?? 0);
  })[0];
}

function getStrongestYoga(payload: ChartApiResponse) {
  return [...(payload.chart.yogas ?? [])]
    .filter((yoga) => yoga.present)
    .sort((left, right) => {
      const strengthDifference =
        (STRENGTH_RANK[left.strength] ?? 3) -
        (STRENGTH_RANK[right.strength] ?? 3);
      if (strengthDifference !== 0) return strengthDifference;
      return right.occurrence_chance - left.occurrence_chance;
    })[0];
}

function parseDateParts(value: string | undefined): { month: string; year: string } | null {
  const match = value?.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  const monthIndex = Number(match[2]) - 1;
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][monthIndex];
  return month ? { month, year: match[1] } : null;
}

function formatMonthYear(value: string | undefined): string | undefined {
  const date = parseDateParts(value);
  return date ? `${date.month} ${date.year}` : undefined;
}

function formatWindow(shift: MajorLifeShift): string {
  const start = formatMonthYear(shift.windowStartIso);
  const end = formatMonthYear(shift.windowEndIso);
  if (start && end) return `${start} – ${end}`;
  return formatMonthYear(shift.pivotIso) ?? "a nearby life pivot";
}

function chooseTimingShift(shifts: MajorLifeShift[]): MajorLifeShift | undefined {
  return (
    shifts.find((shift) => shift.status === "active") ??
    shifts.find((shift) => shift.status === "upcoming") ??
    shifts[0]
  );
}

function getTimingHighlights(shifts: MajorLifeShift[]): string[] {
  const relevant = shifts.filter(
    (shift) => shift.status === "active" || shift.status === "upcoming",
  );
  const selections = relevant.length > 0 ? relevant : shifts.slice(0, 1);

  return selections.slice(0, 3).map((shift) => {
    const label = shift.status === "active" ? "Active now" : "Upcoming";
    return `${label}: ${shift.label} (${formatWindow(shift)})`;
  });
}

function withoutDuplicates(items: Array<string | undefined>): string[] {
  return [...new Set(items.filter((item): item is string => Boolean(item?.trim())))];
}

function buildEssenceChapter(payload: ChartApiResponse): PersonalStoryChapter {
  const ascendant = payload.chart.ascendant?.sign;
  const ruler = SIGN_RULERS[ascendant];
  const rulerPlacement = getPlanet(payload.chart.planets, ruler);
  const coreRule = getMostRelevantRule(payload);
  const approach = compactText(
    ascendant ? SIGN_APPROACHES[ascendant] : undefined,
    "Your chart points toward a path built through attention, choice, and repeated practice rather than a fixed script.",
  );
  const rulerSentence = rulerPlacement
    ? `Your life-path ruler, ${ruler}, works through ${houseTheme(rulerPlacement.house)} in ${rulerPlacement.sign}, so that is where your approach becomes most concrete.`
    : ruler
      ? `Your life-path ruler is ${ruler}, which gives the chart a recurring emphasis on ${PLANET_GIFTS[ruler] ?? "purposeful action"}.`
      : "The chart's practical direction becomes clearer through the roles and environments that consistently give you energy.";

  return {
    id: "essence",
    eyebrow: "Essence & life approach",
    title: ascendant ? `Lead with your ${ascendant} approach` : "Start with the approach that feels most alive",
    body: `${approach} ${rulerSentence}`,
    highlights: withoutDuplicates([
      ascendant ? `${ascendant} ascendant: ${approach}` : undefined,
      coreRule ? coreRule.insight : undefined,
    ]),
    signals: withoutDuplicates([
      ascendant ? `Ascendant|${ascendant}` : undefined,
      rulerPlacement ? `Life-path ruler|${ruler} in ${rulerPlacement.sign}, house ${rulerPlacement.house}` : undefined,
      coreRule ? `Primary chart signal|${coreRule.title}` : undefined,
    ]).map(toSignal),
  };
}

function buildStrengthsChapter(payload: ChartApiResponse): PersonalStoryChapter {
  const topDomain = getTopDomain(payload);
  const strongestPlanet = getStrongestPlanet(payload);
  const strongestPlacement = getPlanet(payload.chart.planets, strongestPlanet?.planet);
  const yoga = getStrongestYoga(payload);
  const strengthSentence = strongestPlanet
    ? `${strongestPlanet.planet} is one of the chart's most supported tools, adding ${PLANET_GIFTS[strongestPlanet.planet] ?? "reliable capacity"}.`
    : "The clearest strengths emerge where your chart combines natural interest with steady effort.";
  const domainSentence = topDomain
    ? `The strongest current life-domain signal is ${topDomain.label}: ${topDomain.headline}`
    : "Your best contribution is likely to come from work that lets you combine skill, usefulness, and a sense of meaning.";

  return {
    id: "strengths",
    eyebrow: "Strengths & where to shine",
    title: topDomain ? `Make ${topDomain.label.toLowerCase()} a deliberate stage` : "Make your strongest gifts visible",
    body: `${domainSentence} ${strengthSentence}${strongestPlacement ? ` Its placement in house ${strongestPlacement.house} points especially toward ${houseTheme(strongestPlacement.house)}.` : ""}`,
    highlights: withoutDuplicates([
      topDomain?.strengths[0],
      topDomain?.strengths[1],
      yoga ? `${yoga.name}: ${yoga.effects}` : undefined,
    ]),
    signals: withoutDuplicates([
      topDomain ? `Leading domain|${topDomain.label} (${Math.round(topDomain.confidence_score * 100)}% signal)` : undefined,
      strongestPlanet
        ? `Strongest support|${strongestPlanet.planet}${strongestPlacement ? ` · house ${strongestPlacement.house}` : ""}`
        : undefined,
      yoga ? `Supporting pattern|${yoga.name} (${yoga.strength})` : undefined,
    ]).map(toSignal),
  };
}

function buildEmotionalOrientationChapter(payload: ChartApiResponse): PersonalStoryChapter {
  const moon = getPlanet(payload.chart.planets, "Moon");
  const nakshatra = payload.chart.nakshatra;
  const emotionalNeed = compactText(
    moon?.sign ? MOON_NEEDS[moon.sign] : undefined,
    "time to notice your feelings before turning them into a decision",
  );
  const body = moon
    ? `Your Moon in ${moon.sign}, house ${moon.house}, keeps returning to ${houseTheme(moon.house)} when you need reassurance or orientation. It tends to be supported by ${emotionalNeed}.`
    : `Your emotional orientation is best supported by ${emotionalNeed}. The chart becomes more useful when you make space for that rhythm instead of treating every feeling as an instruction.`;

  return {
    id: "emotional-orientation",
    eyebrow: "Emotional orientation",
    title: moon ? `Let your ${moon.sign} Moon set the rhythm` : "Let your inner rhythm inform the pace",
    body: `${body}${nakshatra ? ` Your Moon's nakshatra, ${nakshatra.name}, adds a ${nakshatra.lord}-ruled layer to how you restore and make meaning.` : ""}`,
    highlights: withoutDuplicates([
      `Helpful conditions: ${emotionalNeed}.`,
      moon ? `When pressure rises, notice the pull toward ${houseTheme(moon.house)}.` : undefined,
    ]),
    signals: withoutDuplicates([
      moon ? `Moon|${moon.sign}, house ${moon.house}` : undefined,
      nakshatra ? `Moon nakshatra|${nakshatra.name} · pada ${nakshatra.pada}` : undefined,
    ]).map(toSignal),
  };
}

function buildTimingChapter(
  payload: ChartApiResponse,
  lifeShifts: MajorLifeShift[],
): PersonalStoryChapter {
  const dasha = payload.chart.dasha;
  const dashaPlanet = getPlanet(payload.chart.planets, dasha?.current_dasha);
  const topDomain = getTopDomain(payload);
  const timingShift = chooseTimingShift(lifeShifts);
  const timingHighlights = getTimingHighlights(lifeShifts);
  const dashaEnd = formatMonthYear(dasha?.current_dasha_end);
  const timingBody = dasha?.current_dasha && dasha.current_dasha !== "Unknown"
    ? `The active long cycle is ${dasha.current_dasha}${dasha.current_antardasha && dasha.current_antardasha !== "Unknown" ? `, currently refined by ${dasha.current_antardasha}` : ""}.${dashaPlanet ? ` This places extra attention on ${houseTheme(dashaPlanet.house)}.` : ""}${dashaEnd ? ` This particular long-cycle emphasis runs through ${dashaEnd}.` : ""}`
    : "Timing is best treated as a planning lens: look for recurring conditions that support your strongest domains rather than waiting for a single perfect date.";
  const trigger = topDomain?.timing_triggers[0];
  const shiftLine = timingShift
    ? `${timingShift.status === "active" ? "A current pivot" : "A nearby pivot"} is ${timingShift.label.toLowerCase()} (${formatWindow(timingShift)}).`
    : undefined;

  return {
    id: "timing",
    eyebrow: "Best life seasons & timing",
    title: "Use timing as a season, not a deadline",
    body: `${timingBody}${trigger ? ` The chart's ${topDomain?.label.toLowerCase() ?? "leading"} signal is especially responsive when ${trigger.toLowerCase()}.` : ""} ${shiftLine ?? ""}`.trim(),
    highlights: withoutDuplicates([
      trigger ? `Lean in when: ${trigger}` : undefined,
      ...timingHighlights,
    ]),
    signals: withoutDuplicates([
      dasha?.current_dasha && dasha.current_dasha !== "Unknown"
        ? `Active period|${dasha.current_dasha}${dasha.current_antardasha && dasha.current_antardasha !== "Unknown" ? ` / ${dasha.current_antardasha}` : ""}`
        : undefined,
      dashaEnd ? `Long-cycle end|${dashaEnd}` : undefined,
      timingShift ? `Life pivot|${timingShift.status === "active" ? "Active" : "Upcoming"} · ${formatWindow(timingShift)}` : undefined,
    ]).map(toSignal),
  };
}

function buildGroundingChapter(payload: ChartApiResponse): PersonalStoryChapter {
  const topDomain = getTopDomain(payload);
  const tensionRule = [...payload.chart.deterministic_rules]
    .filter((rule) => Boolean(rule.tension_note?.trim()))
    .sort((left, right) => (right.confidence_score ?? 0) - (left.confidence_score ?? 0))[0];
  const saturn = getPlanet(payload.chart.planets, "Saturn");
  const watchout = topDomain?.watchouts[0];
  const guidance = topDomain?.guidance;
  const saturnLine = saturn
    ? `Saturn in house ${saturn.house} makes patient work around ${houseTheme(saturn.house)} especially important.`
    : "Steady routines and honest feedback are the practical counterweight to any chart pattern.";

  return {
    id: "grounding",
    eyebrow: "Grounded considerations",
    title: "Use the pattern; keep your agency",
    body: `${saturnLine} ${compactText(tensionRule?.tension_note, "A chart is most useful when it helps you choose a next step, not when it replaces your judgment.")}`,
    highlights: withoutDuplicates([
      watchout ? `Watch for: ${watchout}` : undefined,
      guidance ? `Practical guidance: ${guidance}` : undefined,
    ]),
    signals: withoutDuplicates([
      saturn ? `Structure signal|Saturn in ${saturn.sign}, house ${saturn.house}` : undefined,
      tensionRule ? `Growth edge|${tensionRule.title}` : undefined,
      topDomain ? `Grounding domain|${topDomain.label}` : undefined,
    ]).map(toSignal),
  };
}

function toSignal(serialized: string): PersonalStorySignal {
  const [label, ...valueParts] = serialized.split("|");
  return {
    label,
    value: valueParts.join("|") || label,
  };
}

/**
 * Builds a concise, explainable synthesis strictly from chart data already
 * present in ChartApiResponse. It is deterministic: no LLM, API request, or
 * randomisation is involved.
 */
export function buildPersonalStory(
  payload: ChartApiResponse,
  options: BuildPersonalStoryOptions = {},
): PersonalStory {
  const lifeShifts = options.lifeShifts ?? computeMajorLifeShifts(payload);
  const name = displayName(payload.client.name);
  const ascendant = payload.chart.ascendant?.sign;

  return {
    title: `${name} story`,
    introduction: ascendant
      ? `A practical reading of your ${ascendant} ascendant, emotional rhythm, strongest chart support, and current timing cycles.`
      : "A practical reading of the recurring patterns, strengths, and timing signals already present in this chart.",
    chapters: [
      buildEssenceChapter(payload),
      buildStrengthsChapter(payload),
      buildEmotionalOrientationChapter(payload),
      buildTimingChapter(payload, lifeShifts),
      buildGroundingChapter(payload),
    ],
    reflectionNote:
      "Use this as a reflective planning tool, not a prediction or a substitute for professional, medical, legal, or financial advice.",
  };
}
