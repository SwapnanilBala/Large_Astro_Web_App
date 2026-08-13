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
import {
  verifyChartForStory,
  type StoryVerification,
} from "@/lib/story-verification";

export type PersonalStoryChapterId =
  | "essence"
  | "marriage"
  | "family"
  | "career"
  | "wealth"
  | "strengths"
  | "emotional-orientation"
  | "timing"
  | "grounding";

export type PersonalStorySignal = {
  label: string;
  value: string;
};

export type StorySupportLevel = "well-supported" | "supported" | "exploratory";

export type StoryAtAGlanceItem = {
  label: string;
  value: string;
  context: string;
};

export type StoryTimelineItem = {
  status: "active" | "upcoming" | "background";
  label: string;
  window: string;
  narrative: string;
};

export type PersonalStoryChapter = {
  id: PersonalStoryChapterId;
  eyebrow: string;
  title: string;
  body: string;
  highlights: string[];
  signals: PersonalStorySignal[];
  opening?: string;
  narrative?: string[];
  practices?: string[];
  reflectionPrompt?: string;
  support?: StorySupportLevel;
  supportNote?: string;
};

export type PersonalStory = {
  title: string;
  subtitle: string;
  introduction: string;
  preface: string[];
  atAGlance: StoryAtAGlanceItem[];
  centralThemes: string[];
  timeline: StoryTimelineItem[];
  chapters: PersonalStoryChapter[];
  verification: StoryVerification;
  reflectionNote: string;
};

export type BuildPersonalStoryOptions = {
  /**
   * Supplying life shifts makes callers/tests fully deterministic and avoids
   * recalculating the shared timing model. Omit it for the standard app flow.
   */
  lifeShifts?: MajorLifeShift[];
  verification?: StoryVerification;
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

function getDomainByKey(
  payload: ChartApiResponse,
  key: LifeDomainInsight["key"],
): LifeDomainInsight | undefined {
  return (payload.chart.life_domain_insights ?? []).find((domain) => domain.key === key);
}

// Marriage, family, career, and wealth each already get their own dedicated
// chapter below, so the cross-cutting Strengths/Grounding chapters should
// favor a different life domain when one is available, rather than repeating
// the same headline and bullets a reader just saw in a dedicated chapter.
const DEDICATED_DOMAIN_KEYS = new Set<LifeDomainInsight["key"]>([
  "love_life",
  "family",
  "career",
  "inheritance",
]);

function getTopUndedicatedDomain(payload: ChartApiResponse): LifeDomainInsight | undefined {
  const domains = payload.chart.life_domain_insights ?? [];
  const undedicated = domains.filter((domain) => !DEDICATED_DOMAIN_KEYS.has(domain.key));
  const pool = undedicated.length > 0 ? undedicated : domains;
  return [...pool].sort((left, right) => right.confidence_score - left.confidence_score)[0];
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
    // selection.score is rarity x strength, so descending still means "most
    // noteworthy first". Reading a fire rate here would headline the single
    // most ordinary thing in the chart.
    return (right.selection?.score ?? 0) - (left.selection?.score ?? 0);
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
      coreRule ? coreRule.display.body : undefined,
    ]),
    signals: withoutDuplicates([
      ascendant ? `Ascendant|${ascendant}` : undefined,
      rulerPlacement ? `Life-path ruler|${ruler} in ${rulerPlacement.sign}, house ${rulerPlacement.house}` : undefined,
      coreRule ? `Primary chart signal|${coreRule.display.headline}` : undefined,
    ]).map(toSignal),
  };
}

function buildStrengthsChapter(payload: ChartApiResponse): PersonalStoryChapter {
  const topDomain = getTopUndedicatedDomain(payload);
  const strongestPlanet = getStrongestPlanet(payload);
  const strongestPlacement = getPlanet(payload.chart.planets, strongestPlanet?.planet);
  const yoga = getStrongestYoga(payload);
  const strengthSentence = strongestPlanet
    ? `${strongestPlanet.planet} is one of the chart's most supported tools, adding ${PLANET_GIFTS[strongestPlanet.planet] ?? "reliable capacity"}.`
    : "The clearest strengths emerge where your chart combines natural interest with steady effort.";
  const domainSentence = topDomain
    ? `${topDomain.display.headline}: ${topDomain.display.body}`
    : "Your best contribution is likely to come from work that lets you combine skill, usefulness, and a sense of meaning.";

  return {
    id: "strengths",
    eyebrow: "Strengths & where to shine",
    title: topDomain ? `Make ${topDomain.label.toLowerCase()} a deliberate stage` : "Make your strongest gifts visible",
    body: `${domainSentence} ${strengthSentence}${strongestPlacement ? ` Its placement in house ${strongestPlacement.house} points especially toward ${houseTheme(strongestPlacement.house)}.` : ""}`,
    highlights: withoutDuplicates([
      topDomain?.display.strengths[0],
      topDomain?.display.strengths[1],
      yoga ? `${yoga.name}: ${yoga.effects}` : undefined,
    ]),
    signals: withoutDuplicates([
      // No percentage. confidence_score is an internal strength signal on an
      // arbitrary [0.55, 0.94] scale; rendering it as "86%" reads as a
      // confidence claim about the client's life, which it is not.
      topDomain ? `Leading domain|${topDomain.label}` : undefined,
      strongestPlanet
        ? `Strongest support|${strongestPlanet.planet}${strongestPlacement ? ` · house ${strongestPlacement.house}` : ""}`
        : undefined,
      yoga ? `Supporting pattern|${yoga.name} (${yoga.strength})` : undefined,
    ]).map(toSignal),
  };
}

type LifeDomainChapterConfig = {
  id: "marriage" | "family" | "career" | "wealth";
  eyebrow: string;
  domain: LifeDomainInsight | undefined;
  /**
   * A fixed, on-brand title rather than `domain.headline` — the generated
   * headline is prefixed with the domain's own catalogue label (e.g.
   * "Love Life:", "Inheritance:"), which visibly clashes with this chapter's
   * reframed eyebrow (Marriage & partnership, Wealth & inheritance, ...).
   */
  title: string;
  /**
   * What this chapter calls the domain in its own voice (e.g. "Partnership"
   * for the love_life domain). `domain.guidance` and `domain.long_game` are
   * generated prose that names the domain by its raw catalogue label
   * ("Love Life improves when...", "For love life, use your...") — verified
   * by actually rendering a chapter and seeing "Love Life" appear under a
   * "Marriage & partnership" heading. Any mention of the raw label is
   * swapped for this alias so the body reads consistently with the eyebrow.
   */
  domainAlias: string;
  fallbackBody: string;
  fallbackHighlight: string;
};

function relabelDomainMentions(text: string, domainLabel: string, alias: string): string {
  if (domainLabel.toLowerCase() === alias.toLowerCase()) return text;
  const pattern = new RegExp(`\\b${domainLabel}\\b`, "gi");
  return text.replace(pattern, (match) =>
    match === match.toLowerCase() ? alias.toLowerCase() : alias,
  );
}

function buildLifeDomainChapter(config: LifeDomainChapterConfig): PersonalStoryChapter {
  const { id, eyebrow, domain, title, domainAlias, fallbackBody, fallbackHighlight } = config;

  if (!domain) {
    return {
      id,
      eyebrow,
      title,
      body: fallbackBody,
      highlights: [fallbackHighlight],
      signals: [],
    };
  }

  const guidance = relabelDomainMentions(domain.display.guidance, domain.label, domainAlias);
  const longGame = relabelDomainMentions(domain.display.long_game, domain.label, domainAlias);
  const body = `${domain.display.body} ${guidance} ${longGame}`.trim();
  // The technical headline still supplies the placement line, which belongs in
  // signals (the evidence tier of a chapter) rather than in the prose.
  const placement = domain.headline.replace(/^[^:]*:\s*/, "").replace(/\.$/, "");

  return {
    id,
    eyebrow,
    title,
    body,
    highlights: withoutDuplicates([
      domain.display.strengths[0],
      domain.display.strengths[1],
      domain.display.watchouts[0] ? `Watch for: ${domain.display.watchouts[0]}` : undefined,
    ]),
    signals: withoutDuplicates([
      placement ? `Chart placement|${placement}` : undefined,
      domain.display.timing[0] ? `Timing to watch|${domain.display.timing[0]}` : undefined,
      domain.supporting_patterns[0] ? `Supporting pattern|${domain.supporting_patterns[0]}` : undefined,
    ]).map(toSignal),
  };
}

function buildMarriageChapter(payload: ChartApiResponse): PersonalStoryChapter {
  return buildLifeDomainChapter({
    id: "marriage",
    eyebrow: "Marriage & partnership",
    domain: getDomainByKey(payload, "love_life"),
    title: "Partnership grows through honesty and a shared pace",
    domainAlias: "Partnership",
    fallbackBody:
      "Durable partnership tends to grow from consistency, mutual respect, and honest communication more than from attraction alone. Your chart's 7th house and Venus placement sharpen exactly how that shows up once more birth detail is available — until then, treat steady, honest pacing as the load-bearing habit of any bond you build.",
    fallbackHighlight: "Look for a partner who matches your pace, not just your interests.",
  });
}

function buildFamilyChapter(payload: ChartApiResponse): PersonalStoryChapter {
  return buildLifeDomainChapter({
    id: "family",
    eyebrow: "Family & home life",
    domain: getDomainByKey(payload, "family"),
    title: "Home is where your pattern resets",
    domainAlias: "Family",
    fallbackBody:
      "Home tends to feel safest when routine and repair are treated as more effective than any single conversation. Your chart's 4th house and Moon placement shape exactly how that safety gets built once more detail is available — until then, protect a few small routines that reliably restore you.",
    fallbackHighlight: "Protect a few small home routines that reliably restore you.",
  });
}

function buildCareerChapter(payload: ChartApiResponse): PersonalStoryChapter {
  return buildLifeDomainChapter({
    id: "career",
    eyebrow: "Career & vocation",
    domain: getDomainByKey(payload, "career"),
    title: "Build authority through repeatable outcomes",
    domainAlias: "Career",
    fallbackBody:
      "Authority tends to build fastest around whichever skill you can make repeatable and visible, more than around any single opportunity. Your chart's 10th house and Saturn placement sharpen exactly how that plays out once more detail is available — until then, choose one scope you can own fully rather than many half-owned tasks.",
    fallbackHighlight: "Choose one scope you can own fully rather than many half-owned tasks.",
  });
}

function buildWealthChapter(payload: ChartApiResponse): PersonalStoryChapter {
  return buildLifeDomainChapter({
    id: "wealth",
    eyebrow: "Wealth & inheritance",
    domain: getDomainByKey(payload, "inheritance"),
    title: "Build wealth through documentation and patience",
    domainAlias: "Wealth",
    fallbackBody:
      "Wealth tends to compound through documentation, transparency, and patient sequencing rather than speed. Your chart's 2nd house, 8th house, and Jupiter placement sharpen exactly how that plays out once more detail is available — until then, put agreements about shared money or property in writing early.",
    fallbackHighlight: "Put agreements about shared money or property in writing early.",
  });
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
  const triggerSentenceFragment = trigger?.toLowerCase().replace(/\.$/, "");
  const shiftLine = timingShift
    ? `${timingShift.status === "active" ? "A current pivot" : "A nearby pivot"} is ${timingShift.label.toLowerCase()} (${formatWindow(timingShift)}).`
    : undefined;

  return {
    id: "timing",
    eyebrow: "Best life seasons & timing",
    title: "Use timing as a season, not a deadline",
    body: `${timingBody}${triggerSentenceFragment ? ` The chart's ${topDomain?.label.toLowerCase() ?? "leading"} signal is especially responsive when ${triggerSentenceFragment}.` : ""} ${shiftLine ?? ""}`.trim(),
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
  const topDomain = getTopUndedicatedDomain(payload);
  const tensionRule = [...payload.chart.deterministic_rules]
    .filter((rule) => Boolean(rule.display?.tension?.trim()))
    .sort((left, right) => (right.selection?.score ?? 0) - (left.selection?.score ?? 0))[0];
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
    body: `${saturnLine} ${compactText(tensionRule?.display?.tension, "A chart is most useful when it helps you choose a next step, not when it replaces your judgment.")}`,
    highlights: withoutDuplicates([
      watchout ? `Watch for: ${watchout}` : undefined,
      guidance ? `Practical guidance: ${guidance}` : undefined,
    ]),
    signals: withoutDuplicates([
      saturn ? `Structure signal|Saturn in ${saturn.sign}, house ${saturn.house}` : undefined,
      tensionRule ? `Growth edge|${tensionRule.display.headline}` : undefined,
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

const DOMAIN_BY_CHAPTER: Partial<Record<PersonalStoryChapterId, LifeDomainInsight["key"]>> = {
  marriage: "love_life",
  family: "family",
  career: "career",
  wealth: "inheritance",
};

const REFLECTION_PROMPTS: Record<PersonalStoryChapterId, string> = {
  essence: "Where do you feel most like yourself without needing to perform or explain?",
  marriage: "What shared pace, boundary, or conversation would make partnership feel more sustainable?",
  family: "Which home rhythm restores you reliably, and which inherited pattern are you ready to change?",
  career: "What capability could become unmistakable if you practiced and documented it for one year?",
  wealth: "Which financial agreement, habit, or uncertainty would benefit most from clearer structure?",
  strengths: "Where are you underusing a strength because it feels too natural to count as valuable?",
  "emotional-orientation": "What does your inner state need before you ask it to make a major decision?",
  timing: "What would wise preparation look like if this season were an invitation rather than a deadline?",
  grounding: "Which part of this reading becomes useful only when translated into one grounded choice?",
};

function supportForChapter(
  chapter: PersonalStoryChapter,
  payload: ChartApiResponse,
  verification: StoryVerification,
): { level: StorySupportLevel; note: string } {
  const domainKey = DOMAIN_BY_CHAPTER[chapter.id];
  const domain = domainKey ? getDomainByKey(payload, domainKey) : undefined;
  const matrix = domain?.evidence_matrix;
  const supportGroups = matrix?.independent_support_groups?.length ?? 0;

  let level: StorySupportLevel;
  if (matrix) {
    if (
      matrix.conclusion_strength === "strong" &&
      supportGroups >= 2 &&
      matrix.confirmation_status !== "contradictory"
    ) {
      level = "well-supported";
    } else if (
      matrix.confirmation_status === "insufficient" ||
      matrix.confirmation_status === "contradictory"
    ) {
      level = "exploratory";
    } else {
      level = "supported";
    }
  } else if (chapter.signals.length >= 3) {
    level = "well-supported";
  } else if (chapter.signals.length > 0) {
    level = "supported";
  } else {
    level = "exploratory";
  }

  const timeSensitive = ["marriage", "family", "career", "wealth", "timing"].includes(chapter.id);
  if (
    timeSensitive &&
    (payload.client.birth_time_fallback || payload.client.birth_time_accuracy !== "exact") &&
    level === "well-supported"
  ) {
    level = "supported";
  }
  if (verification.status === "failed") level = "exploratory";

  const note = level === "well-supported"
    ? "Repeated across independent chart factors and suitable for emphasis."
    : level === "supported"
      ? "Supported by the available chart factors, with normal interpretive caution."
      : "A reflective possibility; do not treat it as a fixed outcome or standalone prediction.";
  return { level, note };
}

function chapterOpening(chapter: PersonalStoryChapter, payload: ChartApiResponse): string {
  const ascendant = payload.chart.ascendant?.sign;
  const moon = getPlanet(payload.chart.planets, "Moon");
  const ruler = SIGN_RULERS[ascendant];
  const rulerPlacement = getPlanet(payload.chart.planets, ruler);

  const openings: Record<PersonalStoryChapterId, string> = {
    essence: ascendant
      ? `The first thread in your story is the contrast between a ${ascendant} way of meeting life and the deeper needs described by your ${moon?.sign ?? "inner"} Moon.`
      : "The first thread in your story is the relationship between how you meet the world and what quietly restores you.",
    marriage: "Partnership is presented here as a practice of pacing, repair, and mutual responsibility - not as a promise about a particular person.",
    family: "Home is more than a location in this chart; it is the emotional system that determines how quickly you recover your clarity.",
    career: rulerPlacement
      ? `Your vocational story grows where ${ruler} in house ${rulerPlacement.house} turns natural orientation into visible contribution.`
      : "Your vocational story becomes clearer when aptitude is converted into work other people can reliably recognize and use.",
    wealth: "Your resource story is strongest when money, ownership, and shared obligations are handled with patience and explicit agreements.",
    strengths: "The chart's strongest factors are not guarantees; they are capacities that become dependable when you give them repetition and a useful outlet.",
    "emotional-orientation": moon
      ? `Your ${moon.sign} Moon describes an inner tempo that may be quieter, faster, or more private than the identity other people first encounter.`
      : "Your inner tempo deserves to be understood separately from the identity other people first encounter.",
    timing: "Timing works best as weather: it describes the kind of preparation a season rewards, while leaving choices and outcomes in your hands.",
    grounding: "A useful reading should return you to agency. The final chapter separates durable guidance from anything too fragile to carry forward.",
  };
  return openings[chapter.id];
}

function chapterPractices(
  chapter: PersonalStoryChapter,
  payload: ChartApiResponse,
): string[] {
  const domainKey = DOMAIN_BY_CHAPTER[chapter.id];
  const domain = domainKey ? getDomainByKey(payload, domainKey) : undefined;
  return withoutDuplicates([
    domain?.display.decision_rule,
    domain?.display.boundary_rule,
    ...chapter.highlights,
  ]).slice(0, 4);
}

function enrichChapter(
  chapter: PersonalStoryChapter,
  payload: ChartApiResponse,
  verification: StoryVerification,
): PersonalStoryChapter {
  const support = supportForChapter(chapter, payload, verification);
  const opening = chapterOpening(chapter, payload);
  return {
    ...chapter,
    opening,
    narrative: withoutDuplicates([opening, chapter.body]),
    practices: chapterPractices(chapter, payload),
    reflectionPrompt: REFLECTION_PROMPTS[chapter.id],
    support: support.level,
    supportNote: support.note,
  };
}

function buildAtAGlance(payload: ChartApiResponse): StoryAtAGlanceItem[] {
  const ascendant = payload.chart.ascendant?.sign;
  const ruler = SIGN_RULERS[ascendant];
  const rulerPlacement = getPlanet(payload.chart.planets, ruler);
  const moon = getPlanet(payload.chart.planets, "Moon");
  const strongest = getStrongestPlanet(payload);
  const strongestPlacement = getPlanet(payload.chart.planets, strongest?.planet);
  const dasha = payload.chart.dasha;

  return [
    ascendant
      ? {
          label: "How you meet life",
          value: `${ascendant} rising`,
          context: rulerPlacement
            ? `${ruler} carries this approach into house ${rulerPlacement.house}.`
            : `${ruler ?? "Its ruler"} sets the chart's practical direction.`,
        }
      : undefined,
    moon
      ? {
          label: "Inner rhythm",
          value: `${moon.sign} Moon`,
          context: `Emotional attention returns to ${houseTheme(moon.house)}.`,
        }
      : undefined,
    strongest
      ? {
          label: "Strongest support",
          value: strongest.planet,
          context: strongestPlacement
            ? `Most available through ${houseTheme(strongestPlacement.house)}.`
            : "A capacity worth making visible and repeatable.",
        }
      : undefined,
    dasha?.current_dasha && dasha.current_dasha !== "Unknown"
      ? {
          label: "Current season",
          value: `${dasha.current_dasha}${dasha.current_antardasha && dasha.current_antardasha !== "Unknown" ? ` / ${dasha.current_antardasha}` : ""}`,
          context: formatMonthYear(dasha.current_dasha_end)
            ? `Long-cycle emphasis through ${formatMonthYear(dasha.current_dasha_end)}.`
            : "Use this as a planning lens, not a deadline.",
        }
      : undefined,
  ].filter((item): item is StoryAtAGlanceItem => Boolean(item));
}

function buildCentralThemes(payload: ChartApiResponse): string[] {
  const concise = (value: string) => {
    const sentence = value.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? value.trim();
    return sentence.length > 190 ? `${sentence.slice(0, 187).trimEnd()}...` : sentence;
  };
  const domains = [...(payload.chart.life_domain_insights ?? [])]
    .filter((domain) => domain.evidence_matrix?.confirmation_status !== "insufficient")
    .sort((left, right) => right.confidence_score - left.confidence_score)
    .slice(0, 3);
  if (domains.length > 0) {
    return domains.map((domain) => `${domain.label}: ${concise(domain.display.clarity)}`);
  }
  return payload.chart.deterministic_rules
    .filter((rule) => rule.priority === "high")
    .slice(0, 3)
    .map((rule) => rule.display.headline);
}

function buildStoryTimeline(
  payload: ChartApiResponse,
  lifeShifts: MajorLifeShift[],
): StoryTimelineItem[] {
  const selected = lifeShifts
    .filter((shift) => shift.status === "active" || shift.status === "upcoming")
    .slice(0, 3)
    .map((shift): StoryTimelineItem => ({
      status: shift.status === "active" ? "active" : "upcoming",
      label: shift.label,
      window: formatWindow(shift),
      narrative: shift.narrative,
    }));

  if (selected.length > 0) return selected;
  const dasha = payload.chart.dasha;
  if (dasha?.current_dasha && dasha.current_dasha !== "Unknown") {
    return [{
      status: "background",
      label: `${dasha.current_dasha} long cycle`,
      window: formatMonthYear(dasha.current_dasha_end) ?? "Current background cycle",
      narrative: "A broad developmental background rather than a single predicted event.",
    }];
  }
  return [];
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
  const verification = options.verification ?? verifyChartForStory(payload);
  const name = displayName(payload.client.name);
  const ascendant = payload.chart.ascendant?.sign;
  const moon = getPlanet(payload.chart.planets, "Moon");
  const strongest = getStrongestPlanet(payload);
  const chapters = [
    buildEssenceChapter(payload),
    buildMarriageChapter(payload),
    buildFamilyChapter(payload),
    buildCareerChapter(payload),
    buildWealthChapter(payload),
    buildStrengthsChapter(payload),
    buildEmotionalOrientationChapter(payload),
    buildTimingChapter(payload, lifeShifts),
    buildGroundingChapter(payload),
  ].map((chapter) => enrichChapter(chapter, payload, verification));

  return {
    title: `${name} story`,
    subtitle: "A verified, client-focused astrological portrait",
    introduction: ascendant
      ? `A practical reading of your ${ascendant} ascendant, partnership style, family life, career direction, wealth patterns, emotional rhythm, and current timing cycles.`
      : "A practical reading of the recurring patterns, partnership style, family life, career direction, wealth outlook, and timing signals already present in this chart.",
    preface: [
      `${name}, this report is written as a connected portrait rather than a list of placements. It begins with the natal foundation, then asks where independent strength, divisional, domain, and timing factors repeat the same theme.`,
      ascendant
        ? `The central contrast is between your ${ascendant} way of approaching life${moon ? ` and the private rhythm of a ${moon.sign} Moon` : ""}${strongest ? `. ${strongest.planet} appears as one of the cleaner resources available when the chart becomes demanding.` : "."}`
        : "The most useful themes are the ones repeated across independent factors and translated into choices you can observe in real life.",
    ],
    atAGlance: buildAtAGlance(payload),
    centralThemes: buildCentralThemes(payload),
    timeline: buildStoryTimeline(payload, lifeShifts),
    chapters,
    verification,
    reflectionNote:
      "Use this as a reflective planning tool, not a prediction or a substitute for professional, medical, legal, or financial advice.",
  };
}
