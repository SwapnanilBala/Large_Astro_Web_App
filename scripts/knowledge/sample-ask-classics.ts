/**
 * Runs "Ask the classics" for one sample birth, as the route would, but
 * straight against the APIs: no route, no budget, no cache. The search is the
 * route's own query (lib/knowledge/passage-queries.ts) over the question's
 * embedding, so it needs DATABASE_URL and OPENAI_API_KEY from .env.local.
 * With --dry it stops before the answer and prints what each question would
 * be sent, which costs one embedding call per question and nothing else.
 *
 *   npx tsx scripts/knowledge/sample-ask-classics.ts 1990-01-01 10:00 all 7001 --sex=female --dry
 *   npx tsx scripts/knowledge/sample-ask-classics.ts 1985-11-02 06:15 health,career_year 7001 --language=de
 *   npx tsx scripts/knowledge/sample-ask-classics.ts 1985-11-02 06:15 none 7001 "--ask=Wie wird mein Liebesleben?"
 *
 * Arguments: birth date, birth time, the fixed questions (ids from
 * lib/knowledge/ask-questions.ts, comma-separated, "all" or "none"), and the
 * port of a running dev server, which is where the chart comes from. Each
 * --ask= is a typed question, put through the route's screen first (about
 * $0.0005), which prints its verdict and rewrite. --language= is the answer's
 * language (default en). The place defaults to Bengaluru (+5:30); --lat,
 * --lng and --tz (minutes east of UTC) choose another; --sex=female or
 * --sex=male opens the chapters on women's charts. Each question answered
 * without --dry is one paid call on Claude Haiku 4.5, about $0.003, and the
 * answer is put through the route's content check in that language.
 */

import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import OpenAI from "openai";
import type { ChartApiResponse } from "../../lib/astro-types";
import { parseBirthSex } from "../../lib/birth-sex";
import type { AreaChart } from "../../lib/knowledge/area-classics-reading";
import { describePlacement } from "../../lib/knowledge/area-classics-reading";
import {
  ASK_CANDIDATE_LIMIT,
  ASK_CLASSICS_SYSTEM_PROMPT,
  askClassicsInstruction,
  describePeriods,
  periodLords,
  questionDocumentGroups,
  questionDocuments,
  selectQuestionPassages,
  withoutHeadings,
  yearPeriods,
} from "../../lib/knowledge/ask-classics-reading";
import { ASK_QUESTION_IDS, ASK_QUESTIONS, isAskQuestionId, type AskQuestion } from "../../lib/knowledge/ask-questions";
import {
  ASK_SCREEN_SCHEMA,
  ASK_SCREEN_SYSTEM_PROMPT,
  parseScreen,
  screenInput,
  screenMessage,
} from "../../lib/knowledge/ask-screen";
import { checkNote } from "../../lib/knowledge/classical-note-check";
import { KNOWLEDGE_EMBEDDING_DIMENSIONS, KNOWLEDGE_EMBEDDING_MODEL } from "../../lib/knowledge/embedding";
import { queryPassagesNearQuestion } from "../../lib/knowledge/passage-queries";
import { chartPlacementKeys } from "../../lib/knowledge/placements";
import { readingFrom } from "../../lib/knowledge/yoga-classics-reading";

config({ path: ".env.local", quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const [date = "1985-11-02", time = "06:15", which = "all", port = "7001"] = args.filter((arg) => !arg.startsWith("--"));
  const flag = (name: string, fallback: string) =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const dry = args.includes("--dry");
  const sex = parseBirthSex(flag("sex", ""));
  const language = flag("language", "en");
  const typed = args.filter((arg) => arg.startsWith("--ask=")).map((arg) => arg.slice(6));
  const ids = which === "all" ? [...ASK_QUESTION_IDS] : which === "none" ? [] : which.split(",").filter(isAskQuestionId);
  if (ids.length === 0 && typed.length === 0) {
    throw new Error(`No known question in "${which}" and no --ask. Known: ${ASK_QUESTION_IDS.join(", ")}.`);
  }

  const query = new URLSearchParams({
    name: `Sample ${date} ${time}`,
    birth_date: date,
    birth_time: time,
    timezone_offset_minutes: flag("tz", "330"),
    latitude: flag("lat", "12.9716"),
    longitude: flag("lng", "77.5946"),
  });
  const { chart } = (await (await fetch(`http://localhost:${port}/api/chart?${query}`)).json()) as ChartApiResponse;
  const reader: AreaChart = {
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
  console.log(`${chart.ascendant.sign} rising; ${chart.planets.map((planet) => `${planet.name} ${planet.sign}`).join(", ")}`);

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is needed (in .env.local).");
  const db = drizzle({ client: neon(url) });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const client = new Anthropic();
  const asked: { label: string; question: AskQuestion }[] = ids.map((id) => ({ label: id, question: ASK_QUESTIONS[id] }));
  for (const text of typed) {
    const input = screenInput(text);
    const started = Date.now();
    const screened = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: [{ type: "text", text: ASK_SCREEN_SYSTEM_PROMPT }],
      messages: [{ role: "user", content: screenMessage(input) }],
      output_config: { format: { type: "json_schema", schema: ASK_SCREEN_SCHEMA as unknown as Record<string, unknown> } },
    });
    const raw = screened.content.find((block) => block.type === "text")?.text ?? "";
    const result = screened.stop_reason === "refusal" ? { verdict: "not_about_chart" as const } : parseScreen(raw);
    console.log(
      `
screen | ${((Date.now() - started) / 1000).toFixed(1)}s | ${screened.usage.input_tokens} in + ${screened.usage.output_tokens} out` +
        ` | "${input}" -> ${result ? (result.verdict === "answer" ? `answer: "${result.question.text}" ${JSON.stringify(result.question.topics)} ${result.question.span}` : result.verdict) : `UNREADABLE ${raw}`}`,
    );
    if (result?.verdict === "answer") asked.push({ label: `typed "${input}"`, question: result.question });
  }
  for (const { label: id, question } of asked) {
    const periods = question.span === "year" ? yearPeriods(chart.dasha) : [];
    /* As lib/knowledge/question-embedding.ts asks, which is server-only and so not importable here. */
    const embedded = await openai.embeddings.create({
      model: KNOWLEDGE_EMBEDDING_MODEL,
      input: question.text,
      dimensions: KNOWLEDGE_EMBEDDING_DIMENSIONS,
    });
    const rows = await queryPassagesNearQuestion(db, {
      embedding: embedded.data[0].embedding,
      topics: question.topics,
      chartKeys: [...reader.keys],
      yogaIds: reader.yogas.map((yoga) => yoga.id),
      limit: ASK_CANDIDATE_LIMIT,
    });
    const passages = selectQuestionPassages(rows, question, reader, periodLords(periods));
    console.log(`\n=== ${id}: ${question.text}`);
    if (periods.length > 0) console.log(`periods: ${describePeriods(periods)}`);
    console.log(`${rows.length} candidates, ${passages.length} chosen`);
    for (const passage of passages) {
      const score = passage.similarity === undefined ? "  -  " : passage.similarity.toFixed(3);
      console.log(`  ${score} ${passage.id} ${passage.kind}: ${passage.text.slice(0, 100)}`);
    }
    if (passages.length === 0 || dry) continue;

    const groups = questionDocumentGroups(passages, reader);
    for (const group of groups) {
      console.log(`  ${group.source}: ${group.conditions.map(describePlacement).join("; ")}${group.yogaNames.length ? ` | ${group.yogaNames.join(", ")}` : ""}`);
    }
    const started = Date.now();
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 3000,
      system: [{ type: "text", text: ASK_CLASSICS_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [...questionDocuments(groups), { type: "text", text: askClassicsInstruction(question, periods, sex, language) }],
        },
      ],
    });
    const reading = withoutHeadings(readingFrom(response.content, groups));
    const text = reading.segments.map((s) => s.text + (s.sources.length ? `[${s.sources.join(",")}]` : "")).join("");
    const words = text.replace(/\[[\d,]+\]/g, "").split(/\s+/).filter(Boolean).length;
    const check = checkNote(reading, language);
    console.log(
      `${response.model} | ${((Date.now() - started) / 1000).toFixed(1)}s | ${response.usage.input_tokens} in + ` +
        `${response.usage.output_tokens} out | ${response.stop_reason} | ${words} words | ` +
        (reading.sources.length === 0 ? "UNCITED" : check.problems.length > 0 ? `CHECK FAILS ${JSON.stringify(check.problems)}` : "passes"),
    );
    console.log(text);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
