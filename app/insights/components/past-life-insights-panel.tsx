"use client";

import type { ChartApiResponse, HousePlacement, PlanetPosition } from "@/lib/astro-types";
import styles from "../insights.module.css";

type InsightTone = "gold" | "teal" | "coral";

type PastLifeInsightCard = {
  title: string;
  label: string;
  body: string;
  evidence: string;
  tone: InsightTone;
};

const PLANET_ARCHETYPES: Record<string, string> = {
  Sun: "leadership, sovereignty, and visibility",
  Moon: "care, memory, belonging, and emotional safety",
  Mars: "courage, conflict, protection, and decisive action",
  Mercury: "language, trade, study, and clever adaptation",
  Jupiter: "wisdom, faith, teaching, and ethical growth",
  Venus: "devotion, beauty, pleasure, and relational harmony",
  Saturn: "duty, endurance, discipline, and karmic accountability",
  Rahu: "future appetite, reinvention, and worldly ambition",
  Ketu: "past-life memory, detachment, mastery, and spiritual residue",
};

const HOUSE_ARCHETYPES: Record<number, string> = {
  1: "identity, body, and personal direction",
  2: "lineage, values, speech, and stored resources",
  3: "skills, courage, siblings, and daily initiative",
  4: "home, roots, emotional foundations, and ancestral memory",
  5: "creativity, merit, children, and intelligence",
  6: "service, debt, health routines, and problem-solving",
  7: "partnership, contracts, mirroring, and public bonds",
  8: "inheritance, occult insight, crisis, and transformation",
  9: "dharma, teachers, blessings, and higher meaning",
  10: "vocation, public work, authority, and visible contribution",
  11: "networks, gains, patrons, and future-facing communities",
  12: "release, retreat, hidden worlds, and spiritual completion",
};

const SIGN_QUALITIES: Record<string, string> = {
  Aries: "initiatory fire",
  Taurus: "steady earth",
  Gemini: "curious air",
  Cancer: "protective water",
  Leo: "radiant fire",
  Virgo: "refining earth",
  Libra: "relational air",
  Scorpio: "transformational water",
  Sagittarius: "seeking fire",
  Capricorn: "structuring earth",
  Aquarius: "visionary air",
  Pisces: "mystic water",
};

const VOCATION_BY_TENTH_SIGN: Record<string, string> = {
  Aries: "work that rewards initiative, speed, technical grit, or leadership under pressure",
  Taurus: "work tied to material stability, beauty, finance, cultivation, food, design, or craft",
  Gemini: "work built around language, teaching, media, analysis, commerce, or adaptable problem-solving",
  Cancer: "work involving care, homes, hospitality, memory, families, nourishment, or public trust",
  Leo: "work that asks for creative authority, performance, visibility, mentoring, or leadership",
  Virgo: "work involving systems, service, health, craft, editing, operations, or practical refinement",
  Libra: "work shaped by diplomacy, aesthetics, client work, justice, mediation, or partnership",
  Scorpio: "work with research, psychology, crisis, finance, healing, investigation, or hidden systems",
  Sagittarius: "work connected to education, publishing, guidance, travel, law, philosophy, or belief",
  Capricorn: "work that rewards discipline, administration, strategy, institutions, or long-range building",
  Aquarius: "work involving technology, communities, reform, networks, invention, or unusual systems",
  Pisces: "work through healing, imagination, spirituality, film, music, compassion, or liminal spaces",
};

function getPlanet(planets: PlanetPosition[], name: string) {
  return planets.find((planet) => planet.name === name);
}

function getHouse(houses: HousePlacement[], houseNumber: number) {
  return houses.find((house) => house.house_number === houseNumber);
}

function formatHouse(houseNumber?: number) {
  return houseNumber ? `house ${houseNumber}` : "an unplaced house";
}

function joinSignals(signals: string[]) {
  return signals.filter(Boolean).slice(0, 3).join(" | ");
}

function strongestPlanet(payload: ChartApiResponse) {
  return [...(payload.chart.shadbala ?? [])].sort(
    (left, right) => right.strengthRatio - left.strengthRatio
  )[0];
}

function strongestYoga(payload: ChartApiResponse) {
  return [...(payload.chart.yogas ?? [])].sort((left, right) => {
    const strengthRank = { strong: 0, moderate: 1, weak: 2 };
    return strengthRank[left.strength] - strengthRank[right.strength];
  })[0];
}

function buildPastLifeInsights(payload: ChartApiResponse): PastLifeInsightCard[] {
  const planets = payload.chart.planets;
  const houses = payload.chart.houses;
  const ketu = getPlanet(planets, "Ketu");
  const rahu = getPlanet(planets, "Rahu");
  const saturn = getPlanet(planets, "Saturn");
  const jupiter = getPlanet(planets, "Jupiter");
  const sun = getPlanet(planets, "Sun");
  const tenthHouse = getHouse(houses, 10);
  const ninthHouse = getHouse(houses, 9);
  const twelfthHouse = getHouse(houses, 12);
  const currentDasha = payload.chart.dasha?.current_dasha;
  const currentAntardasha = payload.chart.dasha?.current_antardasha;
  const nakshatra = payload.chart.nakshatra;
  const strongest = strongestPlanet(payload);
  const yoga = strongestYoga(payload);

  const ketuHouseTheme = ketu?.house ? HOUSE_ARCHETYPES[ketu.house] : undefined;
  const rahuHouseTheme = rahu?.house ? HOUSE_ARCHETYPES[rahu.house] : undefined;
  const tenthTheme = tenthHouse?.sign
    ? VOCATION_BY_TENTH_SIGN[tenthHouse.sign]
    : "work that makes your chart's strongest planet useful in the world";
  const tenthPlanets = tenthHouse?.planets ?? [];
  const vocationPlanet =
    tenthPlanets[0] ?? strongest?.planet ?? currentDasha ?? sun?.name ?? "Sun";

  return [
    {
      label: "Karma",
      title: "Past-life residue and unfinished mastery",
      tone: "gold",
      body: ketu
        ? `Ketu in ${ketu.sign} in ${formatHouse(ketu.house)} points to old competence around ${ketuHouseTheme}. The pattern is not something to escape; it is something to use without letting it become automatic, isolated, or overly detached.`
        : `The chart still carries a visible karmic thread through the Moon's nakshatra and Saturn. The emphasis is on turning inherited instincts into conscious choice rather than repeating them by habit.`,
      evidence: joinSignals([
        ketu ? `Ketu: ${ketu.sign}, ${formatHouse(ketu.house)}` : "",
        nakshatra ? `Moon nakshatra: ${nakshatra.name} ruled by ${nakshatra.lord}` : "",
        saturn ? `Saturn: ${saturn.sign}, ${formatHouse(saturn.house)}` : "",
      ]),
    },
    {
      label: "Fate",
      title: "The direction fate keeps pulling forward",
      tone: "teal",
      body: rahu
        ? `Rahu in ${rahu.sign} in ${formatHouse(rahu.house)} describes the edge of growth: ${rahuHouseTheme}. Fate tends to arrive through unfamiliar rooms, unusual people, and choices that ask for more courage than your old pattern prefers.`
        : `The current dasha is the main timing key here. Fate shows up less as a fixed sentence and more as a repeating invitation to grow the active planet's healthier qualities.`,
      evidence: joinSignals([
        rahu ? `Rahu: ${rahu.sign}, ${formatHouse(rahu.house)}` : "",
        currentDasha ? `Mahadasha: ${currentDasha}` : "",
        currentAntardasha ? `Antardasha: ${currentAntardasha}` : "",
      ]),
    },
    {
      label: "Vocation",
      title: "Work that completes the karmic arc",
      tone: "coral",
      body: `The vocation signature leans toward ${tenthTheme}. ${vocationPlanet} adds the practical tone of ${PLANET_ARCHETYPES[vocationPlanet] ?? "visible contribution"}, while the 9th and 12th houses show where meaning, retreat, faith, or service keep the work spiritually honest.`,
      evidence: joinSignals([
        tenthHouse ? `10th house: ${tenthHouse.sign}${tenthPlanets.length > 0 ? ` with ${tenthPlanets.join(", ")}` : ""}` : "",
        ninthHouse ? `9th house: ${ninthHouse.sign}` : "",
        twelfthHouse ? `12th house: ${twelfthHouse.sign}` : "",
      ]),
    },
    {
      label: "Integration",
      title: "How to work with the pattern now",
      tone: "gold",
      body: yoga
        ? `${yoga.name} adds a lifetime pattern of ${yoga.effects.toLowerCase()} Treat this as a symbolic thread: repeat what builds character, release what keeps you performing an old role, and make the active dasha planet accountable to your values.`
        : `The cleanest integration is to pair Saturn's discipline with Jupiter's sense of meaning. Build routines that make your gifts reliable, then choose roles where your experience becomes useful to other people.`,
      evidence: joinSignals([
        yoga ? `${yoga.name}: ${yoga.strength}` : "",
        strongest ? `Strongest planet: ${strongest.planet}` : "",
        jupiter ? `Jupiter: ${jupiter.sign}, ${formatHouse(jupiter.house)}` : "",
      ]),
    },
  ];
}

export default function PastLifeInsightsPanel({
  payload,
}: {
  payload: ChartApiResponse;
}) {
  const insights = buildPastLifeInsights(payload);
  const nakshatra = payload.chart.nakshatra;
  const dasha = payload.chart.dasha;
  const ketu = getPlanet(payload.chart.planets, "Ketu");
  const rahu = getPlanet(payload.chart.planets, "Rahu");

  return (
    <div className={styles.pastLifePanel}>
      <p className={styles.sectionIntro}>
        A symbolic past-life layer drawn from nodal placement, dasha timing,
        nakshatra, yogas, and vocation houses. This is separate from palm
        reading and uses only the birth chart results already on the page.
      </p>

      <div className={styles.pastLifeSignalBar} aria-label="Past-life reading signals">
        {ketu && (
          <span>Ketu in {ketu.sign} / H{ketu.house}</span>
        )}
        {rahu && (
          <span>Rahu in {rahu.sign} / H{rahu.house}</span>
        )}
        {nakshatra && (
          <span>{nakshatra.name} pada {nakshatra.pada}</span>
        )}
        {dasha && (
          <span>{dasha.current_dasha} / {dasha.current_antardasha}</span>
        )}
      </div>

      <div className={styles.pastLifeGrid}>
        {insights.map((insight) => (
          <article
            key={insight.title}
            className={`${styles.pastLifeCard} ${styles[`pastLifeCard${insight.tone[0].toUpperCase()}${insight.tone.slice(1)}`]}`}
          >
            <p className={styles.pastLifeLabel}>{insight.label}</p>
            <h3>{insight.title}</h3>
            <p>{insight.body}</p>
            {insight.evidence && (
              <small>{insight.evidence}</small>
            )}
          </article>
        ))}
      </div>

      <p className={styles.pastLifeNote}>
        These insights are framed as reflective astrology, not fixed destiny.
        The useful part is the pattern: what to mature, what to release, and
        what kind of work makes the old story serve the present one.
      </p>
    </div>
  );
}
