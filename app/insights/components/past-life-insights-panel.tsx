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

const SIGN_ELEMENT: Record<string, "fire" | "earth" | "air" | "water"> = {
  Aries: "fire",
  Leo: "fire",
  Sagittarius: "fire",
  Taurus: "earth",
  Virgo: "earth",
  Capricorn: "earth",
  Gemini: "air",
  Libra: "air",
  Aquarius: "air",
  Cancer: "water",
  Scorpio: "water",
  Pisces: "water",
};

const SIGN_LORD: Record<string, string> = {
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

const ELEMENT_OLD_CRAFT: Record<"fire" | "earth" | "air" | "water", string> = {
  fire: "command, performance, or work where presence and willpower carried the room",
  earth: "stewardship, craft, land, ritual, or any practice that rewarded patient repetition",
  air: "language, counsel, study, mediation, or moving ideas between people",
  water: "tending, healing, devotion, ancestry, or holding emotional weight for a community",
};

const NAKSHATRA_IMAGERY: Record<string, string> = {
  Ashwini: "the swift twin healers — instinctive aid given quickly, then moving on",
  Bharani: "the womb-keeper — thresholds, intensity, and the cost of bringing things to life",
  Krittika: "the cutting flame — sharp discrimination, refining what is true from what is borrowed",
  Rohini: "the red doe — beauty, abundance, and a strong body memory of being adored",
  Mrigashira: "the seeker's deer — quiet curiosity that follows scents through unfamiliar terrain",
  Ardra: "the storm tear — necessary breakdown, emotional honesty, the clearing after grief",
  Punarvasu: "the returning home — exile, then renewal, then home again with what was learned",
  Pushya: "the nourishing flower — the caretaker, the guide, the one who fed others",
  Ashlesha: "the coiled serpent — hypnotic insight, occult knowledge, complicated bonds",
  Magha: "the throne — ancestral authority, lineage pride, leadership inherited not won",
  PurvaPhalguni: "the front fig — pleasure, performance, courtly love, ease",
  UttaraPhalguni: "the back fig — generous service, contracts, dignified partnership",
  Hasta: "the skilful hand — craft, healing, sleight, and what hands remember",
  Chitra: "the bright jewel — design, architecture, image-making, the eye for form",
  Swati: "the independent reed — diplomacy, trade, freedom, the wind-blown self",
  Vishakha: "the forked branch — fierce focus, devotion, choosing one path over many",
  Anuradha: "the devoted disciple — friendship, loyalty, devotional practice",
  Jyeshtha: "the elder sister — protective authority, secrets, hard-won status",
  Mula: "the root — investigation, getting to the bottom, painful uprooting",
  PurvaAshadha: "the early invincible — undefeated will, eloquence, tides",
  UttaraAshadha: "the later invincible — long-game leadership, lasting victory",
  Shravana: "the listening ear — teaching, lineage transmission, and hearing what others miss",
  Dhanishta: "the drum — wealth through skill, rhythm, ensemble work",
  Shatabhishaj: "the hundred healers — secrecy, medicine, mystical research",
  PurvaBhadrapada: "the front bier — extreme devotion, sacrifice, intensity",
  UttaraBhadrapada: "the back bier — depth, compassion, the contemplative recluse",
  Revati: "the wealthy ferry — kindness to all beings, safe passage, gentle leave-taking",
};

const ASCENDANT_TONE: Record<string, string> = {
  Aries: "an Aries lagna pushes the pattern toward action and self-direction",
  Taurus: "a Taurus lagna grounds the pattern in stability, beauty, and sensual reality",
  Gemini: "a Gemini lagna routes the pattern through ideas, contacts, and shifting roles",
  Cancer: "a Cancer lagna keeps the pattern intimate, family-aware, and protective",
  Leo: "a Leo lagna asks the pattern to be expressed visibly, with creative dignity",
  Virgo: "a Virgo lagna makes the pattern serviceable, refined, and detail-honest",
  Libra: "a Libra lagna runs the pattern through partnership and aesthetic balance",
  Scorpio: "a Scorpio lagna turns the pattern toward depth, secrecy, and transformation",
  Sagittarius: "a Sagittarius lagna gives the pattern philosophical reach and travel",
  Capricorn: "a Capricorn lagna asks the pattern to be earned, structured, and lasting",
  Aquarius: "an Aquarius lagna routes the pattern through community and unconventional paths",
  Pisces: "a Pisces lagna softens the pattern into compassion, art, and quiet service",
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
  return signals.filter(Boolean).slice(0, 4).join(" | ");
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

function nakshatraKey(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return name.replace(/\s+/g, "");
}

function buildPastLifeInsights(payload: ChartApiResponse): PastLifeInsightCard[] {
  const planets = payload.chart.planets;
  const houses = payload.chart.houses;
  const ascendantSign = payload.chart.ascendant?.sign;
  const ketu = getPlanet(planets, "Ketu");
  const rahu = getPlanet(planets, "Rahu");
  const saturn = getPlanet(planets, "Saturn");
  const jupiter = getPlanet(planets, "Jupiter");
  const sun = getPlanet(planets, "Sun");
  const moon = getPlanet(planets, "Moon");
  const tenthHouse = getHouse(houses, 10);
  const ninthHouse = getHouse(houses, 9);
  const twelfthHouse = getHouse(houses, 12);
  const secondHouse = getHouse(houses, 2);
  const currentDasha = payload.chart.dasha?.current_dasha;
  const currentAntardasha = payload.chart.dasha?.current_antardasha;
  const nakshatra = payload.chart.nakshatra;
  const strongest = strongestPlanet(payload);
  const yoga = strongestYoga(payload);

  const ketuHouseTheme = ketu?.house ? HOUSE_ARCHETYPES[ketu.house] : undefined;
  const rahuHouseTheme = rahu?.house ? HOUSE_ARCHETYPES[rahu.house] : undefined;
  const ketuElement = ketu?.sign ? SIGN_ELEMENT[ketu.sign] : undefined;
  const rahuElement = rahu?.sign ? SIGN_ELEMENT[rahu.sign] : undefined;
  const ketuLord = ketu?.sign ? SIGN_LORD[ketu.sign] : undefined;
  const rahuLord = rahu?.sign ? SIGN_LORD[rahu.sign] : undefined;
  const oldCraft = ketuElement ? ELEMENT_OLD_CRAFT[ketuElement] : "a craft you have already practiced before";
  const growthCraft = rahuElement ? ELEMENT_OLD_CRAFT[rahuElement] : "the unfamiliar territory you are growing into";
  const ascendantLine = ascendantSign ? ASCENDANT_TONE[ascendantSign] : undefined;
  const moonNakshatraImage = NAKSHATRA_IMAGERY[nakshatraKey(nakshatra?.name) ?? ""];
  const tenthTheme = tenthHouse?.sign
    ? VOCATION_BY_TENTH_SIGN[tenthHouse.sign]
    : "work that makes your chart's strongest planet useful in the world";
  const tenthPlanets = tenthHouse?.planets ?? [];
  const vocationPlanet =
    tenthPlanets[0] ?? strongest?.planet ?? currentDasha ?? sun?.name ?? "Sun";
  const vocationLord = tenthHouse?.sign ? SIGN_LORD[tenthHouse.sign] : undefined;
  const strongestHouse = strongest
    ? getPlanet(planets, strongest.planet)?.house
    : undefined;
  const yogaTraits = yoga?.key_traits && yoga.key_traits.length
    ? yoga.key_traits.slice(0, 2).join(" and ").toLowerCase()
    : undefined;

  const karmaBody = ketu
    ? `Ketu sits in ${ketu.sign} (${SIGN_QUALITIES[ketu.sign] ?? "an old element"}) in ${formatHouse(ketu.house)}, ruled by ${ketuLord ?? "an ancestral lord"}. The signature reads as a soul that has already practiced ${oldCraft}, in the field of ${ketuHouseTheme ?? "a familiar territory"}. ${moonNakshatraImage ? `Your Moon's nakshatra — ${nakshatra?.name}, ${moonNakshatraImage} — is the emotional imprint that still runs in the background. ` : ""}The risk now is using this old competence on autopilot: avoiding what is unfamiliar, dismissing what feels beneath you, or going inward when the moment asks for visibility.${ascendantLine ? ` (Note that ${ascendantLine}.)` : ""}`
    : `The karmic thread shows up most clearly through your Moon's nakshatra${nakshatra ? ` — ${nakshatra.name}, ruled by ${nakshatra.lord}` : ""}${moonNakshatraImage ? `: ${moonNakshatraImage}` : ""}. Saturn anchors the discipline this lifetime is asking you to mature, rather than repeat.`;

  const fateBody = rahu
    ? `Rahu mirrors Ketu across the chart, in ${rahu.sign} (${SIGN_QUALITIES[rahu.sign] ?? "the unfamiliar element"}) in ${formatHouse(rahu.house)}, ruled by ${rahuLord ?? "the new lord"}. The growth direction is ${rahuHouseTheme ?? "an unfamiliar field"} — specifically ${growthCraft}. Fate keeps arriving as ${rahuLord ?? "Rahu"} situations: rooms you would not naturally walk into, allies who do not match your old script, decisions that ask for more nerve than your past competence wants to spend.${currentDasha ? ` The active mahadasha (${currentDasha}${currentAntardasha ? ` / ${currentAntardasha}` : ""}) is the timing engine that puts pressure on this axis right now.` : ""}`
    : `Without a clear nodal axis to read, the active dasha — ${currentDasha ?? "the current period"}${currentAntardasha ? ` / ${currentAntardasha}` : ""} — is the fate engine. Treat it less as a sentence and more as a repeating invitation to grow that planet's healthier qualities.`;

  const vocationBody = `Your 10th house sits in ${tenthHouse?.sign ?? "an unsigned vocation field"}${tenthPlanets.length > 0 ? `, occupied by ${tenthPlanets.join(", ")}` : ""}, ruled by ${vocationLord ?? "the natural lord"} — pointing to ${tenthTheme}. The practical tone is set by ${vocationPlanet}, which carries ${PLANET_ARCHETYPES[vocationPlanet] ?? "visible contribution"}. ${strongest ? `Your strongest planet by shadbala is ${strongest.planet}${strongestHouse ? ` (active in house ${strongestHouse})` : ""}, so the most reliable vocation is one that lets ${strongest.planet}'s gifts do real work.` : ""} The 9th (${ninthHouse?.sign ?? "—"}) gives the meaning layer; the 12th (${twelfthHouse?.sign ?? "—"}) is where retreat, faith, or quiet service keep the work spiritually honest${secondHouse ? `; the 2nd (${secondHouse.sign}) shows the resources and skills you can already speak.` : "."}`;

  const integrationBody = yoga
    ? `${yoga.name} runs in your chart at ${yoga.strength} strength${yogaTraits ? ` — its signature is ${yogaTraits}` : ""}. ${yoga.effects} The integration move is to lean on ${jupiter ? `Jupiter (${jupiter.sign}, ${formatHouse(jupiter.house)})` : "Jupiter"} for meaning and ${saturn ? `Saturn (${saturn.sign}, ${formatHouse(saturn.house)})` : "Saturn"} for structure. Stop performing the old role from the Karma card; build routines around the field that yoga points to; and let the active dasha lord be answerable to your stated values, not your inherited reflexes.`
    : `The cleanest integration is to pair ${saturn ? `Saturn in ${saturn.sign} (${formatHouse(saturn.house)})` : "Saturn's discipline"} with ${jupiter ? `Jupiter in ${jupiter.sign} (${formatHouse(jupiter.house)})` : "Jupiter's sense of meaning"}. Build routines that make your gifts reliable — ${moon?.sign ? `your Moon in ${moon.sign} ` : ""}then choose roles where your already-practiced experience becomes useful to other people, not a private comfort.`;

  return [
    {
      label: "Karma",
      title: "Past-life residue and unfinished mastery",
      tone: "gold",
      body: karmaBody,
      evidence: joinSignals([
        ascendantSign ? `Lagna: ${ascendantSign}` : "",
        ketu ? `Ketu: ${ketu.sign}, ${formatHouse(ketu.house)}` : "",
        nakshatra ? `Moon nakshatra: ${nakshatra.name} (lord ${nakshatra.lord})` : "",
        saturn ? `Saturn: ${saturn.sign}, ${formatHouse(saturn.house)}` : "",
      ]),
    },
    {
      label: "Fate",
      title: "The direction fate keeps pulling forward",
      tone: "teal",
      body: fateBody,
      evidence: joinSignals([
        rahu ? `Rahu: ${rahu.sign}, ${formatHouse(rahu.house)}` : "",
        rahuLord ? `Rahu lord: ${rahuLord}` : "",
        currentDasha ? `Mahadasha: ${currentDasha}` : "",
        currentAntardasha ? `Antardasha: ${currentAntardasha}` : "",
      ]),
    },
    {
      label: "Vocation",
      title: "Work that completes the karmic arc",
      tone: "coral",
      body: vocationBody,
      evidence: joinSignals([
        tenthHouse ? `10th: ${tenthHouse.sign}${tenthPlanets.length > 0 ? ` with ${tenthPlanets.join(", ")}` : ""}` : "",
        vocationLord ? `10th lord: ${vocationLord}` : "",
        strongest ? `Strongest: ${strongest.planet} (${Math.round(strongest.strengthRatio)}%)` : "",
        ninthHouse ? `9th: ${ninthHouse.sign}` : "",
      ]),
    },
    {
      label: "Integration",
      title: "How to work with the pattern now",
      tone: "gold",
      body: integrationBody,
      evidence: joinSignals([
        yoga ? `${yoga.name}: ${yoga.strength}` : "",
        strongest ? `Strongest planet: ${strongest.planet}` : "",
        jupiter ? `Jupiter: ${jupiter.sign}, ${formatHouse(jupiter.house)}` : "",
        saturn ? `Saturn: ${saturn.sign}, ${formatHouse(saturn.house)}` : "",
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
  const ascendantSign = payload.chart.ascendant?.sign;
  const ketu = getPlanet(payload.chart.planets, "Ketu");
  const rahu = getPlanet(payload.chart.planets, "Rahu");

  return (
    <div className={styles.pastLifePanel}>
      <p className={styles.sectionIntro}>
        A symbolic past-life layer drawn from your specific lagna, nodal axis,
        Moon's nakshatra, dasha timing, yogas, and vocation houses — read for
        you, not as a generic template. This is separate from palm reading and
        uses only the birth chart results already on the page.
      </p>

      <div className={styles.pastLifeSignalBar} aria-label="Past-life reading signals">
        {ascendantSign && (
          <span>{ascendantSign} lagna</span>
        )}
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
        The useful part is the pattern your chart actually carries: what to
        mature, what to release, and what kind of work makes the old story
        serve the present one.
      </p>
    </div>
  );
}
