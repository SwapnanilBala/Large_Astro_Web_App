/**
 * Runs the life areas' classical notes for one sample birth, as the route
 * would, but straight against the API: no route, no budget, no cache. With
 * --dry it stops before the call and prints what each area would be sent,
 * which costs nothing and is the way to check the selection.
 *
 *   npx tsx scripts/knowledge/sample-area-classics.ts 1985-11-02 06:15 --dry
 *   npx tsx scripts/knowledge/sample-area-classics.ts 1990-05-15 10:30 Hindi low 7001
 *   npx tsx scripts/knowledge/sample-area-classics.ts 1990-05-16 11:09 English low 7001 --lat=35.69 --lng=139.69 --tz=540
 *   npx tsx scripts/knowledge/sample-area-classics.ts 1992-03-08 14:20 English low 7001 --sex=female --dry
 *
 * Arguments: birth date, birth time, the language as the prompt names it, the
 * effort, and the port of a running dev server, which is where the chart comes
 * from. The place defaults to Bengaluru (+5:30); --lat, --lng and --tz
 * (minutes east of UTC) choose another; --sex=female or --sex=male is the
 * reader's sex at birth, which opens the chapters on women's charts. Passages
 * are read from the corpus files rather than the table, withheld ones dropped,
 * so it needs no database; the
 * route's own query returns the same rows (see retrieve.ts). Each run without
 * --dry is one paid call.
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ChartApiResponse } from "../../lib/astro-types";
import {
  AREA_CLASSICS_SYSTEM_PROMPT,
  areaClassicsInstruction,
  areaDocuments,
  areaReadingsFrom,
  describePlacement,
  selectAreas,
  type AreaChart,
} from "../../lib/knowledge/area-classics-reading";
import { knowledgeCorpusSchema } from "../../lib/knowledge/corpus";
import { parseBirthSex } from "../../lib/birth-sex";
import { chartPlacementKeys } from "../../lib/knowledge/placements";
import type { PassageRow } from "../../lib/knowledge/yoga-classics-reading";

config({ path: ".env.local", quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const [date = "1985-11-02", time = "06:15", language = "English", effort = "low", port = "7001"] = args.filter(
    (arg) => !arg.startsWith("--"),
  );
  const flag = (name: string, fallback: string) =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const dry = args.includes("--dry");
  const sex = parseBirthSex(flag("sex", ""));

  const query = new URLSearchParams({
    name: `Sample ${date} ${time}`,
    birth_date: date,
    birth_time: time,
    timezone_offset_minutes: flag("tz", "330"),
    latitude: flag("lat", "12.9716"),
    longitude: flag("lng", "77.5946"),
  });
  const { chart } = (await (await fetch(`http://localhost:${port}/api/chart?${query}`)).json()) as ChartApiResponse;
  const areaChart: AreaChart = {
    keys: chartPlacementKeys({
      planets: chart.planets,
      ascendantSign: chart.ascendant.sign,
      navamsa: chart.navamsa,
      moonNakshatra: chart.nakshatra?.name,
      sex,
    }),
    yogas: (chart.yogas ?? [])
      .filter((yoga) => yoga.present)
      .map((yoga) => ({ id: yoga.yoga_id, planets: yoga.involved_planets })),
  };

  const corpusDir = resolve("lib/knowledge/corpus");
  const rows: PassageRow[] = readdirSync(corpusDir)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => knowledgeCorpusSchema.parse(JSON.parse(readFileSync(resolve(corpusDir, file), "utf8"))).passages)
    .filter((passage) => !passage.withheld);
  const selection = selectAreas(rows, areaChart);

  console.log(
    `${chart.ascendant.sign} rising; ${chart.planets.map((planet) => `${planet.name} ${planet.sign}`).join(", ")}`,
  );
  if (selection.length === 0) {
    console.log("The book has nothing for any area of this chart; the route would answer readings: {}.");
    return;
  }
  for (const { area, passages, conditions, yogaNames } of selection) {
    console.log(`\n${area}: ${conditions.map(describePlacement).join("; ")}${yogaNames.length ? ` | ${yogaNames.join(", ")}` : ""}`);
    for (const passage of passages) {
      console.log(`  ${passage.id} ${passage.kind}: ${passage.text.slice(0, 110)}`);
    }
  }
  if (dry) return;

  const started = Date.now();
  const response = await new Anthropic().messages.create({
    model: "claude-opus-5-5",
    max_tokens: 6000,
    output_config: { effort: effort as "low" | "medium" | "high" },
    system: [{ type: "text", text: AREA_CLASSICS_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [...areaDocuments(selection), { type: "text", text: areaClassicsInstruction(selection, language, sex) }],
      },
    ],
  });
  const readings = areaReadingsFrom(response.content, selection);

  console.log(
    `\n${selection.length} areas | ${effort} | ${((Date.now() - started) / 1000).toFixed(1)}s |`,
    `${response.usage.input_tokens} in + ${response.usage.cache_read_input_tokens ?? 0} cached +`,
    `${response.usage.output_tokens} out | ${response.stop_reason}`,
  );
  for (const { area } of selection) {
    const reading = readings[area];
    if (!reading) {
      console.log(`\n${area}: no cited note came back`);
      continue;
    }
    const text = reading.segments.map((s) => s.text + (s.sources.length ? `[${s.sources.join(",")}]` : "")).join("");
    const words = text.replace(/\[[\d,]+\]/g, "").split(/\s+/).filter(Boolean).length;
    console.log(`\n${area} (${words} words):${text}`);
    for (const source of reading.sources) {
      console.log(`  [${source.number}] ${source.book} ${source.ref} ${source.kind}: ${source.text.slice(0, 90)}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
