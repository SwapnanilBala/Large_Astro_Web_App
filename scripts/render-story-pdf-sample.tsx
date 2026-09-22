/**
 * Render the personal-story PDF for one fixed sample chart.
 *
 *   npm run pdf:sample                 -- engine prose, free, instant
 *   npm run pdf:sample -- --prose      -- Opus 5 written prose, BILLED, ~2 min
 *   npm run pdf:sample -- --prose --fresh   -- ignore the cached prose
 *
 * WHY --prose EXISTS. The engine's own prose is 1,100 words for the whole
 * report, which leaves a chapter page about forty per cent blank. Type sizes
 * and page breaks tuned against that are tuned against the wrong document --
 * the shipped report runs to roughly 2,900 words. So this can produce the real
 * thing, and caches it in output/pdf/ so the typography can then be iterated
 * on for free.
 *
 * It calls Anthropic directly rather than the route, because the route needs a
 * dev server and this script does not. The system prompt is read out of the
 * route file rather than copied, for the same reason
 * scripts/effort-compare.mjs does it: a copy drifts the first time either
 * changes.
 *
 * --prose SPENDS REAL MONEY. One call, and it prints what it cost.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { Font, renderToFile } from "@react-pdf/renderer";
import type { ChartApiResponse } from "@/lib/astro-types";
import { buildChart } from "@/lib/engines/chart-service";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { buildPersonalStory, type PersonalStory } from "@/lib/story-engine";
import { verifyChartForStory } from "@/lib/story-verification";
import {
  PARAGRAPHS_PER_CHAPTER,
  STORY_PROSE_SCHEMA,
  WORDS_PER_PARAGRAPH,
  applyStoryProse,
  buildStoryProseFacts,
  missingProseChapters,
  parseStoryProse,
  renderStoryProseFacts,
} from "@/lib/story-prose";
import { PersonalStoryPdfDocument } from "@/app/(desktop)/insights/components/personal-story-pdf";

const root = process.env.STORY_PDF_ROOT || path.resolve(__dirname, "..");
const fonts = path.join(root, "public", "fonts");
const outputDir = path.join(root, "output", "pdf");
const proseCachePath = () => path.join(outputDir, `sample-prose-${effort}.json`);
const routePath = path.join(root, "app", "api", "chart", "story-prose", "route.ts");

const wantProse = process.argv.includes("--prose");
const wantFresh = process.argv.includes("--fresh");
/*
 * Which tier to render. The route picks this from the session -- high for an
 * account, medium for an address -- and a script has no session, so it is a
 * flag. Both cache separately, the way the route keys them separately.
 */
const effort = (process.argv.find((a) => a.startsWith("--effort="))?.slice(9)
  ?? "high") as "low" | "medium" | "high" | "xhigh" | "max";

Font.register({
  family: "Cinzel",
  fonts: [
    { src: path.join(fonts, "cinzel-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(fonts, "cinzel-latin-700-normal.woff"), fontWeight: 700 },
  ],
});
Font.register({
  family: "EBGaramond",
  fonts: [
    { src: path.join(fonts, "eb-garamond-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(fonts, "eb-garamond-latin-400-italic.woff"), fontWeight: 400, fontStyle: "italic" },
    { src: path.join(fonts, "eb-garamond-latin-600-normal.woff"), fontWeight: 600 },
  ],
});

const birth: BirthDetailsInput = {
  name: "Ananya Mehra",
  birth_date: "1990-06-15",
  birth_time: "14:30",
  latitude: 28.6139,
  longitude: 77.209,
  timezone_offset_minutes: 330,
  country: "India",
  state: "Delhi",
  city: "New Delhi",
  town: "",
  time_zone_id: "Asia/Kolkata",
  engine_id: "lahiri_classic",
  birth_time_accuracy: "exact",
  birth_time_source: "exact",
  birth_time_fallback: false,
};

/** The template literal assigned to SYSTEM_PROMPT, read from the route source. */
function readSystemPrompt(): string {
  const src = readFileSync(routePath, "utf8").replace(/\r\n/g, "\n");
  const start = src.indexOf("const SYSTEM_PROMPT");
  if (start < 0) throw new Error(`SYSTEM_PROMPT not found in ${routePath}`);
  const open = src.indexOf("`", start);
  let i = open + 1;
  let out = "";
  while (i < src.length && src[i] !== "`") {
    if (src[i] === "\\") {
      out += src[i] + src[i + 1];
      i += 2;
      continue;
    }
    out += src[i];
    i += 1;
  }
  /*
   * The prompt interpolates two constants from lib/story-prose.ts, and reading
   * the template out of the route means this has to interpolate them too.
   *
   * They are imported rather than written out. The first version of this
   * function hardcoded "3" and "85 to 110", which then silently kept sending
   * the old instruction after the lib changed to 2 and 110-140: the sweep came
   * back with three 90-word paragraphs per chapter, looking for all the world
   * like the model ignoring the brief. It was this function lying about what
   * the brief said -- exactly the drift the header claims reading the route
   * prevents.
   */
  return out
    .replace(/\$\{WORDS_PER_PARAGRAPH\}/g, WORDS_PER_PARAGRAPH)
    .replace(/\$\{PARAGRAPHS_PER_CHAPTER\}/g, String(PARAGRAPHS_PER_CHAPTER));
}

async function writtenProse(story: PersonalStory) {
  if (!wantFresh && existsSync(proseCachePath())) {
    const cached = parseStoryProse(JSON.parse(readFileSync(proseCachePath(), "utf8")));
    if (cached) {
      console.log(`prose: reusing ${path.relative(root, proseCachePath())} (pass --fresh to re-bill)`);
      return cached;
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set. --prose makes one billed API call.");
    process.exit(2);
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, timeout: 250_000 });
  const facts = buildStoryProseFacts(story, birth.name);

  console.log(`prose: calling claude-opus-5 at ${effort} effort, one call, please wait...`);
  const startedAt = Date.now();
  const response = await client.messages
    .stream({
      model: "claude-opus-5",
      max_tokens: 32000,
      output_config: {
        effort,
        format: { type: "json_schema", schema: STORY_PROSE_SCHEMA as unknown as Record<string, unknown> },
      },
      system: [{ type: "text", text: readSystemPrompt() }],
      messages: [{ role: "user", content: renderStoryProseFacts(facts) }],
    })
    .finalMessage();
  const elapsed = Date.now() - startedAt;

  const usage = response.usage;
  const cost =
    (usage.input_tokens ?? 0) * 5e-6 +
    (usage.output_tokens ?? 0) * 25e-6 +
    (usage.cache_read_input_tokens ?? 0) * 0.5e-6 +
    (usage.cache_creation_input_tokens ?? 0) * 6.25e-6;
  console.log(
    `prose: ${(elapsed / 1000).toFixed(1)}s  in ${usage.input_tokens}  out ${usage.output_tokens}  ` +
      `${response.stop_reason}  $${cost.toFixed(4)}`,
  );

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join("");
  const prose = parseStoryProse(JSON.parse(text));
  if (!prose) throw new Error("The written report was the wrong shape.");

  const missing = missingProseChapters(facts, prose);
  if (missing.length > 0) console.warn(`prose: WARNING chapters missing -- ${missing.join(", ")}`);

  const words = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
  const total =
    words(prose.introduction) +
    prose.preface.reduce((sum, p) => sum + words(p), 0) +
    prose.chapters.reduce(
      (sum, c) => sum + words(c.opening) + c.narrative.reduce((s, p) => s + words(p), 0),
      0,
    );
  console.log(`prose: ${prose.chapters.length} chapters, ${total} words written`);

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(proseCachePath(), JSON.stringify(prose, null, 2));
  return prose;
}

async function main() {
  const payload = buildChart(birth, {
    includeTransits: true,
    includePremium: true,
    includeUltimate: true,
    deferLifeDomains: false,
  }) as unknown as ChartApiResponse;
  const verification = verifyChartForStory(payload);
  if (verification.status === "failed") {
    throw new Error("Sample report did not pass verification.");
  }
  let story = buildPersonalStory(payload, { verification });

  if (wantProse) {
    story = applyStoryProse(story, await writtenProse(story));
  }

  mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(
    outputDir,
    wantProse ? `sample-client-personal-story-${effort}.pdf` : "sample-client-personal-story.pdf",
  );

  await renderToFile(
    <PersonalStoryPdfDocument
      story={story}
      clientName={payload.client.name}
      ascendant={payload.chart.ascendant.sign}
      locationLabel="New Delhi, Delhi, India"
      generatedOn="August 13, 2026"
    />,
    outputPath,
  );

  console.log(outputPath);
}

void main();
