/**
 * Writes the dasha period reading for one sample birth, as the route would,
 * but straight against the APIs: no route, no budget, no cache. The chart is
 * built in-process from the birth details; the passages come from the route's
 * own query (lib/knowledge/passage-queries.ts) over the period's embedding, so
 * it needs DATABASE_URL and OPENAI_API_KEY from .env.local. With --dry it
 * stops before the reading and prints what would be sent, which costs one
 * embedding call per period and nothing else.
 *
 *   npx tsx scripts/knowledge/sample-dasha-reading.ts 1985-11-02 06:15 --depth=1,2,3,4 --dry
 *   npx tsx scripts/knowledge/sample-dasha-reading.ts 1990-01-01 10:00 --depth=4 --sex=female --language=hi
 *   npx tsx scripts/knowledge/sample-dasha-reading.ts 1985-11-02 06:15 --lords=Saturn,Ketu --start=2030-02-12
 *
 * Arguments: birth date and birth time. --depth= lists the levels to read
 * along the periods running at --at= (a YYYY-MM-DD date, default today);
 * --lords= with --start= reads one named period instead. --language= is the
 * reading's language (default en); --sex=female or --sex=male opens the
 * chapters on women's charts. The place defaults to Bengaluru (+5:30); --lat,
 * --lng and --tz (minutes east of UTC) choose another. Each period read
 * without --dry is one paid call on the route's model (lib/llm-models.ts), and
 * the reading is put through the route's content check in that language.
 */

import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import OpenAI from "openai";
import { parseBirthSex } from "../../lib/birth-sex";
import { getChartPayload, readChartParams } from "../../lib/chart-params";
import { dayMs, findChain, pathAt, statusAt, type DashaSpan } from "../../lib/dasha-periods";
import { periodFacts } from "../../lib/dasha-reading-facts";
import type { AreaChart } from "../../lib/knowledge/area-classics-reading";
import { describePlacement } from "../../lib/knowledge/area-classics-reading";
import { withoutHeadings } from "../../lib/knowledge/ask-classics-reading";
import { checkNote } from "../../lib/knowledge/classical-note-check";
import {
  DASHA_READING_SYSTEM_PROMPT,
  dashaReadingInstruction,
  periodDocumentGroups,
  periodDocuments,
  periodQueryText,
  selectPeriodPassages,
} from "../../lib/knowledge/dasha-reading";
import { KNOWLEDGE_EMBEDDING_DIMENSIONS, KNOWLEDGE_EMBEDDING_MODEL } from "../../lib/knowledge/embedding";
import { queryPassagesForPeriod } from "../../lib/knowledge/passage-queries";
import { chartPlacementKeys } from "../../lib/knowledge/placements";
import { readingFrom } from "../../lib/knowledge/yoga-classics-reading";
import { CHART_EFFORT, CHART_MODEL } from "../../lib/llm-models";

config({ path: ".env.local", quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const [date = "1985-11-02", time = "06:15"] = args.filter((arg) => !arg.startsWith("--"));
  const flag = (name: string, fallback: string) =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const dry = args.includes("--dry");
  const sex = parseBirthSex(flag("sex", ""));
  const language = flag("language", "en");
  const at = flag("at", "") ? dayMs(flag("at", "")) + 43_200_000 : Date.now();

  const { chart } = getChartPayload(
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
  if (!chart.dasha) throw new Error("The chart has no dasha.");
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

  const named = flag("lords", "");
  const paths: DashaSpan[][] = [];
  if (named) {
    const path = findChain(chart.dasha, named.split(","), flag("start", ""));
    if (!path) throw new Error(`No period ${named} starting ${flag("start", "")} in this chart.`);
    paths.push(path);
  } else {
    const now = pathAt(chart.dasha, at);
    for (const depth of flag("depth", "1,2,3,4").split(",").map(Number)) {
      if (now.length >= depth) paths.push(now.slice(0, depth));
    }
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is needed (in .env.local).");
  const db = drizzle({ client: neon(url) });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const client = new Anthropic();

  for (const path of paths) {
    const lords = path.map((span) => span.planet);
    const facts = periodFacts({ ascendantSign: chart.ascendant.sign, planets: chart.planets }, lords);
    if (!facts) throw new Error(`The chart does not place ${lords.join(", ")}.`);
    const status = statusAt(path[path.length - 1], at);
    const query = periodQueryText(facts);
    /* As lib/knowledge/question-embedding.ts asks, which is server-only and so not importable here. */
    const embedded = await openai.embeddings.create({
      model: KNOWLEDGE_EMBEDDING_MODEL,
      input: query,
      dimensions: KNOWLEDGE_EMBEDDING_DIMENSIONS,
    });
    const rows = await queryPassagesForPeriod(db, {
      chartKeys: [...reader.keys],
      yogaIds: reader.yogas.map((yoga) => yoga.id),
      embedding: embedded.data[0].embedding,
      limit: 200,
    });
    const chosen = selectPeriodPassages(rows, reader, facts);
    const last = path[path.length - 1];
    console.log(`\n=== ${lords.join(" > ")} (${last.start} to ${last.end}, ${status})`);
    console.log(`query: ${query}`);
    console.log(`${rows.length} candidates, ${chosen.length} chosen`);
    for (const { passage, lord, concern } of chosen) {
      const score = passage.similarity === undefined ? "  -  " : passage.similarity.toFixed(3);
      console.log(`  ${score} ${lord}/${concern} ${passage.id} ${passage.kind}: ${passage.text.slice(0, 110)}`);
    }
    const groups = periodDocumentGroups(chosen, reader, facts);
    for (const group of groups) {
      console.log(`  [${group.lord} ${group.source}] ${group.conditions.map(describePlacement).join("; ")}${group.yogaNames.length ? ` | ${group.yogaNames.join(", ")}` : ""}`);
    }
    const instruction = dashaReadingInstruction(path, facts, status, sex, language);
    if (dry) {
      console.log(`\n${instruction}`);
      continue;
    }
    if (chosen.length === 0) continue;

    const started = Date.now();
    const response = await client.messages.create({
      model: CHART_MODEL,
      max_tokens: 3000,
      output_config: { effort: CHART_EFFORT },
      system: [{ type: "text", text: DASHA_READING_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [...periodDocuments(groups, facts), { type: "text", text: instruction }] }],
    });
    const reading = withoutHeadings(readingFrom(response.content, groups));
    const text = reading.segments.map((s) => s.text + (s.sources.length ? `[${s.sources.join(",")}]` : "")).join("");
    const words = text.replace(/\[[\d,]+\]/g, "").split(/\s+/).filter(Boolean).length;
    const check = checkNote(reading, language);
    console.log(
      `${response.model} | ${((Date.now() - started) / 1000).toFixed(1)}s | ${response.usage.input_tokens} in + ` +
        `${response.usage.output_tokens} out + ${response.usage.cache_read_input_tokens ?? 0} cached | ${response.stop_reason} | ${words} words | ` +
        (reading.sources.length === 0 ? "UNCITED" : check.problems.length > 0 ? `CHECK FAILS ${JSON.stringify(check.problems)}` : "passes"),
    );
    console.log(text);
    for (const source of reading.sources) console.log(`   [${source.number}] ${source.book} ${source.ref}: ${source.text.slice(0, 90)}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
