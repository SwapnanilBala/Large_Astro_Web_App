/**
 * Writes the life shifts readings for one sample birth, as the route would,
 * but straight against the APIs: no route, no budget, no cache. The chart is
 * built in-process; the passages come from the route's own query over each
 * chapter's embedding, so it needs DATABASE_URL and OPENAI_API_KEY from
 * .env.local. With --dry it stops before the readings and prints what would
 * be sent, which costs one embedding call per chapter and nothing else.
 *
 *   npx tsx scripts/knowledge/sample-life-shifts.ts 1985-11-02 06:15 --depth=headline
 *   npx tsx scripts/knowledge/sample-life-shifts.ts 1990-01-01 10:00 --depth=compact --language=hi --sex=female
 *
 * --depth=headline reads the one chapter the results page shows; compact (the
 * default) reads every chapter /insights/life-shifts shows. The place
 * defaults to Bengaluru (+5:30); --lat, --lng and --tz choose another. Without
 * --dry this is one paid call on the route's model (lib/llm-models.ts), and
 * every reading goes through the route's checks.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import OpenAI from "openai";
import { z } from "zod";
import { parseBirthSex } from "../../lib/birth-sex";
import { getChartPayload, readChartParams } from "../../lib/chart-params";
import { computeMajorLifeShifts } from "../../lib/engines/major-shifts-engine";
import type { AreaChart } from "../../lib/knowledge/area-classics-reading";
import { withoutHeadings } from "../../lib/knowledge/ask-classics-reading";
import { checkNote } from "../../lib/knowledge/classical-note-check";
import { copiedPassages, endsMidSentence, readingFromMarkers } from "../../lib/knowledge/dasha-reading";
import { KNOWLEDGE_EMBEDDING_DIMENSIONS, KNOWLEDGE_EMBEDDING_MODEL } from "../../lib/knowledge/embedding";
import {
  LIFE_SHIFTS_SYSTEM_PROMPT,
  allGroups,
  chapterPassages,
  chapterQueryText,
  lifeShiftsInstruction,
  shiftChapters,
  shiftPassageListing,
} from "../../lib/knowledge/life-shift-classics";
import { queryPassagesForPeriod } from "../../lib/knowledge/passage-queries";
import { chartPlacementKeys } from "../../lib/knowledge/placements";
import type { LifeShiftDepth } from "../../lib/life-shift-reading";
import { LIFE_SHIFTS_EFFORT, LIFE_SHIFTS_MODEL } from "../../lib/llm-models";

config({ path: ".env.local", quiet: true });

/* Opus 5.5, dollars per token. */
const PRICE = { input: 4 / 1e6, output: 20 / 1e6, cacheRead: 0.4 / 1e6, cacheWrite: 5 / 1e6 };

async function main() {
  const args = process.argv.slice(2);
  const [date = "1985-11-02", time = "06:15"] = args.filter((arg) => !arg.startsWith("--"));
  const flag = (name: string, fallback: string) =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const dry = args.includes("--dry");
  const sex = parseBirthSex(flag("sex", ""));
  const language = flag("language", "en");
  const depth = (flag("depth", "compact") === "headline" ? "headline" : "compact") as LifeShiftDepth;

  const payload = getChartPayload(
    readChartParams({
      name: `Sample ${date} ${time}`,
      birthDate: date,
      birthTime: time,
      timezoneOffsetMinutes: flag("tz", "330"),
      latitude: flag("lat", "12.9716"),
      longitude: flag("lng", "77.5946"),
      birthSex: sex ?? "",
    }),
  );
  const { chart } = payload;
  const reader: AreaChart = {
    keys: chartPlacementKeys({
      planets: chart.planets,
      ascendantSign: chart.ascendant.sign,
      navamsa: chart.navamsa,
      moonNakshatra: chart.nakshatra?.name,
      sex,
    }),
    yogas: (chart.yogas ?? []).filter((yoga) => yoga.present).map((yoga) => ({ id: yoga.yoga_id, planets: yoga.involved_planets })),
  };
  console.log(`${chart.ascendant.sign} rising; ${chart.planets.map((planet) => `${planet.name} ${planet.sign}`).join(", ")}`);

  /* The panel's choice (major-shifts-panel.tsx): the brief page shows the one live chapter, the full page the next two and the past. */
  const shifts = computeMajorLifeShifts(payload);
  const forward = shifts.filter((shift) => shift.status !== "past").slice(0, depth === "headline" ? 1 : 2);
  const featured = forward.length > 0 ? forward : shifts.slice(-1);
  const shown = depth === "headline" ? featured : [...featured, ...shifts.filter((shift) => shift.status === "past" && !featured.includes(shift))];
  const chapters = shiftChapters(shown, payload);

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is needed (in .env.local).");
  const db = drizzle({ client: neon(url) });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const candidates = await Promise.all(
    chapters.map(async (chapter) => {
      const embedded = await openai.embeddings.create({
        model: KNOWLEDGE_EMBEDDING_MODEL,
        input: chapterQueryText(chapter),
        dimensions: KNOWLEDGE_EMBEDDING_DIMENSIONS,
      });
      return queryPassagesForPeriod(db, {
        chartKeys: [...reader.keys],
        yogaIds: reader.yogas.map((yoga) => yoga.id),
        embedding: embedded.data[0].embedding,
        limit: 200,
      });
    }),
  );
  const sets = chapterPassages(chapters, candidates, reader, depth);
  const groups = allGroups(sets);
  const listing = shiftPassageListing(sets);
  const instruction = lifeShiftsInstruction(sets, depth, sex, language);
  for (const { chapter, groups: own } of sets) {
    console.log(`  ${chapter.id}: ${own.flatMap((group) => group.passages.map((passage) => `${group.lord}:${passage.id}`)).join(", ") || "no passages"}`);
  }
  if (dry) {
    console.log(`\n--- passages ---\n${listing}\n\n--- instruction ---\n${instruction}`);
    return;
  }

  const started = Date.now();
  const response = await new Anthropic().messages.parse({
    model: LIFE_SHIFTS_MODEL,
    max_tokens: 8000,
    output_config: {
      effort: LIFE_SHIFTS_EFFORT,
      format: zodOutputFormat(z.object({ readings: z.array(z.object({ id: z.string(), reading: z.string() })) })),
    },
    system: [{ type: "text", text: LIFE_SHIFTS_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: listing ? `The passages:\n${listing}` : "The books have no passages for these chapters in this chart." },
          { type: "text", text: instruction },
        ],
      },
    ],
  });
  const usage = response.usage;
  const cost =
    usage.input_tokens * PRICE.input +
    usage.output_tokens * PRICE.output +
    (usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
    (usage.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite;
  console.log(
    `\n${response.model} | ${((Date.now() - started) / 1000).toFixed(1)}s | ${usage.input_tokens} in + ${usage.output_tokens} out + ` +
      `${usage.cache_read_input_tokens ?? 0} cache read + ${usage.cache_creation_input_tokens ?? 0} cache write | ${response.stop_reason} | $${cost.toFixed(4)}`,
  );
  const written = new Map((response.parsed_output?.readings ?? []).map((entry) => [entry.id, entry.reading]));
  for (const set of sets) {
    const raw = written.get(set.chapter.id);
    if (!raw) {
      console.log(`\n=== ${set.chapter.id}: MISSING`);
      continue;
    }
    const reading = withoutHeadings(readingFromMarkers(raw, groups).reading);
    const text = reading.segments.map((s) => s.text + (s.sources.length ? `[${s.sources.join(",")}]` : "")).join("");
    const words = text.replace(/\[[\d,]+\]/g, "").split(/\s+/).filter(Boolean).length;
    const check = checkNote(reading, language);
    const copied = copiedPassages(reading, groups.flatMap((group) => group.passages));
    const verdict =
      set.groups.length > 0 && reading.sources.length === 0
        ? "UNCITED"
        : endsMidSentence(reading)
          ? "CUT SHORT"
          : check.problems.length > 0
            ? `CHECK FAILS ${JSON.stringify(check.problems)}`
            : copied.length > 0
              ? `COPIED ${JSON.stringify(copied)}`
              : "passes";
    console.log(`\n=== ${set.chapter.id} (${set.chapter.status}) | ${words} words | ${verdict}\n${text}`);
    for (const source of reading.sources) console.log(`   [${source.number}] ${source.book} ${source.ref}: ${source.text.slice(0, 90)}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
