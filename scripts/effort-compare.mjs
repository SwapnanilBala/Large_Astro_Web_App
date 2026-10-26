/**
 * Run one LLM route's real prompt at several effort levels and print what each costs.
 *
 * Written for the question "is medium worth it on the dasha chain route" (that
 * route was removed on 2026-10-08; the default is now current-period), which
 * cannot be answered from prompt sizes: the input side is easy to estimate and
 * is not where the money is. Thinking bills at the output rate, is most of what
 * a request generates at any effort above low, and is invisible until a real
 * call reports `usage.output_tokens`.
 *
 * The prompt is never copied here, so this measures the prompt that actually
 * ships and cannot quietly drift from it: current-period imports its system
 * prompt and user turn from lib/, which is why this runs under tsx; the varga
 * prompt is read out of its route file, and the reader refuses one that
 * interpolates.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/effort-compare.mjs
 *   ... npx tsx scripts/effort-compare.mjs --efforts low,medium,high --repeat 2
 *   ... npx tsx scripts/effort-compare.mjs --route varga --efforts low,medium,high
 *
 * `--route` picks which route's prompt to sweep; ROUTES below is the registry.
 * It grew a second entry rather than a second script so that "read the prompt
 * that ships" keeps holding for both -- a copy of this file pointed at another
 * route would drift from it the first time either prompt changed.
 *
 * THIS SPENDS REAL MONEY. Every row is a billed request; the script prints the
 * total before exiting. Default is 3 cases x 2 efforts = 6 calls.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const routeFile = (...parts) => join(HERE, "..", "app", "api", ...parts, "route.ts");

/* Claude Opus 5, $ per token. */
const PRICE = { input: 5 / 1e6, output: 25 / 1e6, cacheRead: 0.5 / 1e6, cacheWrite: 6.25 / 1e6 };
const MODEL = "claude-opus-5-5";

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
const POINTS = [
  "Ascendant", "Sun", "Moon", "Mercury", "Venus",
  "Mars", "Jupiter", "Saturn", "Rahu", "Ketu",
];
const D1 = {
  Ascendant: "Taurus", Sun: "Aries", Moon: "Scorpio", Mercury: "Aries", Venus: "Aquarius",
  Mars: "Aquarius", Jupiter: "Gemini", Saturn: "Capricorn", Rahu: "Capricorn", Ketu: "Cancer",
};

/* One synthetic chart, mapped deterministically so every run sweeps the same
   input. The varga route takes all ten key divisions in a single call, so there
   is only one case to sweep -- the axis that varies on the other route (chain
   depth) has no counterpart here. */
function vargaFacts() {
  return [1, 2, 4, 7, 9, 10, 12, 24, 30, 60].map((division) => ({
    division,
    label: `D${division}`,
    positions: POINTS.map((name, index) => ({
      name,
      rashi: D1[name],
      divisional:
        division === 1
          ? D1[name]
          : SIGNS[(SIGNS.indexOf(D1[name]) + division * (index + 1)) % 12],
    })),
  }));
}

function renderVargaFacts(facts) {
  return facts
    .map((fact) => {
      const rows = fact.positions
        .map((position) => {
          const repeats = position.rashi === position.divisional ? "  (repeats D1)" : "";
          return `  ${position.name}: D1 ${position.rashi} -> ${fact.label} ${position.divisional}${repeats}`;
        })
        .join("\n");
      return `${fact.label}\n${rows}`;
    })
    .join("\n\n");
}

/* One synthetic reader, the D1 chart above: Taurus rising, a Venus Maha Dasha
   with natal Venus in Aquarius (10th), a Saturn Antardasha with Saturn in
   Capricorn (9th), a Mercury Pratyantardasha with Mercury in Aries (12th), and
   the Moon in Scorpio, in Anuradha. */
const CURRENT_PERIOD_STACK = [
  { lord: "Venus", startDate: "2023-11-06", endDate: "2043-11-06", sign: "Aquarius", house: 10 },
  { lord: "Saturn", startDate: "2027-01-06", endDate: "2030-03-08", sign: "Capricorn", house: 9 },
  { lord: "Mercury", startDate: "2027-08-14", endDate: "2028-01-11", sign: "Aries", house: 12 },
];
const CURRENT_PERIOD_CHART = {
  ascendantSign: D1.Ascendant,
  planets: POINTS.filter((name) => name !== "Ascendant").map((name) => ({ name, sign: D1[name] })),
};
const CURRENT_PERIOD_NAKSHATRA = { name: "Anuradha", lord: "Saturn", pada: 2 };

/*
 * The shipped prompt and user turn, imported rather than copied. The copy this
 * replaced drifted twice: it never learnt the chart facts added on 2026-10-14,
 * and the system prompt read out of the route stopped at the backtick inside
 * its stock-phrase list, so sweeps sent a prompt cut off mid-rule. Importing
 * TypeScript with the app's `@/` paths needs tsx, hence `npx tsx`.
 */
async function loadCurrentPeriod() {
  const lib = (name) => pathToFileURL(join(HERE, "..", "lib", name)).href;
  try {
    const [{ CURRENT_PERIOD_SYSTEM_PROMPT }, { renderCurrentPeriodFacts }] = await Promise.all([
      import(lib("current-period-prompt.ts")),
      import(lib("current-period-reading.ts")),
    ]);
    /* Measured in English, as the route writes for an English page. */
    return { system: CURRENT_PERIOD_SYSTEM_PROMPT, userTurn: ({ facts }) => renderCurrentPeriodFacts(facts, "en") };
  } catch (error) {
    console.error("The current-period route imports its prompt from lib/; run this with `npx tsx scripts/effort-compare.mjs`.");
    throw error;
  }
}

const ROUTES = {
  varga: {
    maxTokens: 16000,
    cases: [{ label: "ten key vargas", facts: vargaFacts() }],
    load: async () => ({
      system: readSystemPrompt(routeFile("chart", "varga-commentary")),
      userTurn: ({ facts }) =>
        `Write exactly ${facts.length} notes, one for each of these vargas: ` +
        `${facts.map((fact) => fact.label).join(", ")}.\n\n${renderVargaFacts(facts)}`,
    }),
  },
  "current-period": {
    maxTokens: 8000,
    /* The shapes the card renders. Stack depth is one axis: a chart without a
       pratyantardasha sends two lords. The other is whether the panel had the
       chart, which decides if the prompt carries rulerships, relations and
       shared houses or each lord's sign and house only; the third case is the
       three-lord stack without it, so a sweep shows what the chart buys. The
       percentage is the Antardasha's, as the panel sends it. */
    cases: [
      {
        label: "two lords, with the chart",
        facts: {
          stack: CURRENT_PERIOD_STACK.slice(0, 2),
          chart: CURRENT_PERIOD_CHART,
          nakshatra: CURRENT_PERIOD_NAKSHATRA,
          progressPercent: 50,
        },
      },
      {
        label: "three lords, with the chart",
        facts: {
          stack: CURRENT_PERIOD_STACK,
          chart: CURRENT_PERIOD_CHART,
          nakshatra: CURRENT_PERIOD_NAKSHATRA,
          progressPercent: 92,
        },
      },
      {
        label: "three lords, signs and houses only",
        facts: { stack: CURRENT_PERIOD_STACK, nakshatra: CURRENT_PERIOD_NAKSHATRA, progressPercent: 5 },
      },
    ],
    load: loadCurrentPeriod,
  },
};

function arg(name, fallback) {
  const hit = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

/** The template literal assigned to SYSTEM_PROMPT, read from the route source. */
function readSystemPrompt(file) {
  const src = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const start = src.indexOf("const SYSTEM_PROMPT");
  if (start < 0) throw new Error("SYSTEM_PROMPT not found in " + file);
  const open = src.indexOf("`", start);
  let i = open + 1;
  let out = "";
  while (i < src.length && src[i] !== "`") {
    if (src[i] === "\\") { out += src[i] + src[i + 1]; i += 2; continue; }
    /* An interpolation is code this reader cannot run, and a backtick inside
       one would end the prompt early. Refuse rather than send half of it: the
       route should export its prompt from lib/, as current-period does. */
    if (src[i] === "$" && src[i + 1] === "{") {
      throw new Error(`SYSTEM_PROMPT in ${file} interpolates a value; import it from lib/ instead of reading the source.`);
    }
    out += src[i];
    i += 1;
  }
  return out;
}

function costOf(usage) {
  return (
    (usage.input_tokens ?? 0) * PRICE.input +
    (usage.output_tokens ?? 0) * PRICE.output +
    (usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
    (usage.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite
  );
}

async function main() {
  /* --dry prints what would be sent and stops: no key, no calls, no cost. */
  if (process.argv.includes("--dry")) {
    const routeName = arg("route", "current-period");
    const route = ROUTES[routeName];
    if (!route) throw new Error(`unknown --route ${routeName}`);
    const { system, userTurn } = await route.load();
    console.log(`=== system (${system.length} chars)\n${system}`);
    for (const testCase of route.cases) console.log(`\n=== ${testCase.label}\n${userTurn(testCase)}`);
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set. This script makes billed API calls.");
    process.exit(2);
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, timeout: 120_000 });

  const routeName = arg("route", "current-period");
  const route = ROUTES[routeName];
  if (!route) {
    console.error(`unknown --route ${routeName}. Known: ${Object.keys(ROUTES).join(", ")}`);
    process.exit(2);
  }

  const efforts = arg("efforts", "low,medium").split(",").map((s) => s.trim()).filter(Boolean);
  const repeat = Number(arg("repeat", "1"));
  const { system, userTurn } = await route.load();

  console.log(`model ${MODEL}  |  route ${routeName}  |  efforts ${efforts.join(", ")}  |  ${route.cases.length} cases x ${repeat}`);
  console.log(`system prompt ${system.length} chars\n`);

  const totals = Object.fromEntries(efforts.map((e) => [e, { cost: 0, ms: 0, out: 0, n: 0, truncated: 0 }]));

  for (const testCase of route.cases) {
    console.log(`--- ${testCase.label}`);
    for (const effort of efforts) {
      for (let run = 0; run < repeat; run += 1) {
        const started = Date.now();
        let response;
        try {
          response = await client.messages.create({
            model: MODEL,
            max_tokens: route.maxTokens,
            output_config: { effort },
            system: [{ type: "text", text: system }],
            messages: [{ role: "user", content: userTurn(testCase) }],
          });
        } catch (error) {
          console.log(`    ${effort.padEnd(6)} ERROR ${error?.status ?? ""} ${error?.message ?? error}`);
          continue;
        }
        const ms = Date.now() - started;
        const text = response.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim();
        const cost = costOf(response.usage);
        const bucket = totals[effort];
        bucket.cost += cost;
        bucket.ms += ms;
        bucket.out += response.usage.output_tokens ?? 0;
        bucket.n += 1;
        if (response.stop_reason === "max_tokens") bucket.truncated += 1;

        console.log(
          `    ${effort.padEnd(6)} ${String(ms).padStart(6)}ms  in ${String(response.usage.input_tokens).padStart(4)}  out ${String(response.usage.output_tokens).padStart(5)}  ${response.stop_reason.padEnd(10)} $${cost.toFixed(5)}`,
        );
        const flat = text.replace(/\s+/g, " ");
        if (process.argv.includes("--full")) {
          /* Wrapped rather than truncated: the reason to run this at all is to
             read the difference, and a 150-character window hides it. */
          for (const line of flat.match(/.{1,96}(\s|$)/g) ?? [flat]) {
            console.log(`           ${line.trim()}`);
          }
        } else {
          console.log(`           ${flat.slice(0, 150)}${flat.length > 150 ? "..." : ""}`);
        }
      }
    }
  }

  console.log("\n=== per call, averaged ===");
  let grand = 0;
  for (const [effort, t] of Object.entries(totals)) {
    if (t.n === 0) continue;
    grand += t.cost;
    console.log(
      `  ${effort.padEnd(6)} $${(t.cost / t.n).toFixed(5)}  ${Math.round(t.ms / t.n)}ms  ${Math.round(t.out / t.n)} output tokens${t.truncated ? `  TRUNCATED ${t.truncated}/${t.n}` : ""}`,
    );
  }
  const base = totals[efforts[0]];
  for (const effort of efforts.slice(1)) {
    const t = totals[effort];
    if (base.n && t.n) {
      console.log(`  ${effort} is ${((t.cost / t.n) / (base.cost / base.n)).toFixed(1)}x ${efforts[0]} per call`);
    }
  }
  console.log(`\n  this run spent $${grand.toFixed(4)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
