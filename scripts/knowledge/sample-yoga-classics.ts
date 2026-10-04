/**
 * Runs the yoga section's classical note for one sample birth, exactly as the
 * route would, but straight against the API: no route, no budget, no cache.
 * For tuning the prompt or the effort, which scripts/effort-compare.mjs cannot
 * do for this route because it sends plain text and this one sends cited
 * documents.
 *
 *   npx tsx scripts/knowledge/sample-yoga-classics.ts 1985-11-02 06:15
 *   npx tsx scripts/knowledge/sample-yoga-classics.ts 1990-05-15 10:30 Hindi medium 7001
 *
 * Arguments: birth date, birth time (Bengaluru, +5:30), the language as the
 * prompt names it, the effort, and the port of a running dev server, which is
 * where the chart and its yogas come from. Passages are read from the corpus
 * file rather than the table, withheld ones dropped, so it needs no database.
 * Each run is one paid call, about $0.02 at low effort.
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
  const [date = "1985-11-02", time = "06:15", language = "English", effort = "low", port = "7001"] =
    process.argv.slice(2);

  const query = new URLSearchParams({
    name: `Sample ${date} ${time}`,
    birth_date: date,
    birth_time: time,
    timezone_offset_minutes: "330",
    latitude: "12.9716",
    longitude: "77.5946",
    country: "India",
    city: "Bengaluru",
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
    model: "claude-opus-5-5",
    max_tokens: 4000,
    output_config: { effort: effort as "low" | "medium" | "high" },
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
    `${names.join(", ")} | ${effort} | ${((Date.now() - started) / 1000).toFixed(1)}s |`,
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
