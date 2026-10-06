/**
 * Runs the yoga section's classical note for one sample birth, exactly as the
 * route would, but straight against the API: no route, no budget, no cache.
 * For tuning the prompt, which scripts/effort-compare.mjs cannot do for this
 * route because it sends plain text and this one sends cited documents.
 *
 *   npx tsx scripts/knowledge/sample-yoga-classics.ts 1985-11-02 06:15
 *   npx tsx scripts/knowledge/sample-yoga-classics.ts 1990-05-15 10:30 Hindi 7001
 *   npx tsx scripts/knowledge/sample-yoga-classics.ts 1990-05-16 11:09 English 7001 --lat=35.69 --lng=139.69 --tz=540
 *
 * Arguments: birth date, birth time, the language as the prompt names it, and
 * the port of a running dev server, which is where the chart and its yogas
 * come from. (There was an effort argument before the route moved to Claude
 * Haiku 4.5 on 2026-10-06; Haiku takes no effort setting.) The place defaults
 * to Bengaluru (+5:30); --lat, --lng and --tz (minutes east of UTC) choose
 * another. Passages are read from the corpus file rather than the table,
 * withheld ones dropped, so it needs no database. Each run is one paid call,
 * well under the $0.02 it was on Opus 5.5 at low effort.
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { YOGA_DEFINITIONS } from "../../lib/engines/yoga-engine";
import { knowledgeCorpusSchema } from "../../lib/knowledge/corpus";
import { rankYogas, yogaClassicsRequest } from "../../lib/knowledge/yoga-classics";
import {
  YOGA_CLASSICS_SYSTEM_PROMPT,
  readingFrom,
  selectYogaPassages,
  yogaClassicsInstruction,
  yogaDocuments,
  type PassageRow,
} from "../../lib/knowledge/yoga-classics-reading";
import type { YogaDetectionResult } from "../../lib/astro-types";

config({ path: ".env.local", quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const [date = "1985-11-02", time = "06:15", language = "English", port = "7001"] = args.filter(
    (arg) => !arg.startsWith("--"),
  );
  const flag = (name: string, fallback: string) =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;

  const query = new URLSearchParams({
    name: `Sample ${date} ${time}`,
    birth_date: date,
    birth_time: time,
    timezone_offset_minutes: flag("tz", "330"),
    latitude: flag("lat", "12.9716"),
    longitude: flag("lng", "77.5946"),
  });
  const chart = (await (await fetch(`http://localhost:${port}/api/chart?${query}`)).json()) as {
    chart: { yogas: YogaDetectionResult[] };
  };
  const yogas = yogaClassicsRequest(rankYogas(chart.chart.yogas));

  const corpus = knowledgeCorpusSchema.parse(
    JSON.parse(readFileSync(resolve("lib/knowledge/corpus/brihat-jataka-1885.json"), "utf8")),
  );
  const rows: PassageRow[] = corpus.passages.filter((passage) => !passage.withheld);
  const selection = selectYogaPassages(rows, yogas);
  if (selection.length === 0) {
    console.log("The book names none of this chart's yogas; the route would answer reading: null.");
    return;
  }
  const names = selection.map(({ yoga }) => YOGA_DEFINITIONS.find((d) => d.id === yoga.id)?.name ?? yoga.id);

  const started = Date.now();
  const response = await new Anthropic().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4000,
    system: [{ type: "text", text: YOGA_CLASSICS_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [...yogaDocuments(selection), { type: "text", text: yogaClassicsInstruction(names, language) }],
      },
    ],
  });
  const reading = readingFrom(response.content, selection);
  const text = reading.segments.map((s) => s.text + (s.sources.length ? `[${s.sources.join(",")}]` : "")).join("");

  console.log(
    `${names.join(", ")} | ${response.model} | ${((Date.now() - started) / 1000).toFixed(1)}s |`,
    `${response.usage.input_tokens} in + ${response.usage.cache_read_input_tokens ?? 0} cached +`,
    `${response.usage.output_tokens} out | ${response.stop_reason}`,
  );
  console.log(`\n${text}\n`);
  console.log(`${text.replace(/\[[\d,]+\]/g, "").split(/\s+/).filter(Boolean).length} words`);
  for (const source of reading.sources) {
    console.log(`[${source.number}] ${source.ref} ${source.kind}: ${source.text.slice(0, 100)}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
