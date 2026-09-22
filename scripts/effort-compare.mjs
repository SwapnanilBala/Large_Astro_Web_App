/**
 * Run one LLM route's real prompt at several effort levels and print what each costs.
 *
 * Written for the question "is medium worth it on the dasha route", which
 * cannot be answered from prompt sizes: the input side is easy to estimate and
 * is not where the money is. Thinking bills at the output rate, is most of what
 * a request generates at any effort above low, and is invisible until a real
 * call reports `usage.output_tokens`.
 *
 * The system prompt is read out of the route file rather than copied here, so
 * this measures the prompt that actually ships and cannot quietly drift from
 * it. The user turn is built the same way the route builds it.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/effort-compare.mjs
 *   ... node scripts/effort-compare.mjs --efforts low,medium,high --repeat 2
 *   ... node scripts/effort-compare.mjs --route varga --efforts low,medium,high
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
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const routeFile = (...parts) => join(HERE, "..", "app", "api", ...parts, "route.ts");

/* Claude Opus 5, $ per token. */
const PRICE = { input: 5 / 1e6, output: 25 / 1e6, cacheRead: 0.5 / 1e6, cacheWrite: 6.25 / 1e6 };
const MODEL = "claude-opus-5";

const LEVEL_LABELS = {
  1: "Maha Dasha",
  2: "Antardasha",
  3: "Pratyantardasha",
  4: "Sookshma Dasha",
  5: "Prana Dasha",
};

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

/* One synthetic reader, so every run sweeps the same chapters. The shapes are
   the ones lib/engines/major-shifts-engine.ts actually emits: mahadasha
   openings plus the Saturn, Jupiter and nodal returns nearest to now, ordered
   by pivot and spanning past, active and upcoming. */
function lifeShiftFacts() {
  return [
    {
      id: "jupiter-return-2009-04-02T00:00:00.000Z",
      label: "Jupiter return (second)",
      planet: "Jupiter",
      theme: "expansion, meaning, and a wider field of play",
      status: "past",
      ageAtPivot: 24,
      pivot: "April 2009",
      window: "Aug 2008 → Dec 2009",
      evidence: "Cycle: ~11.9 years | Natal Jupiter: Gemini / H2",
    },
    {
      id: "saturn-return-2014-09-18T00:00:00.000Z",
      label: "Saturn return (first)",
      planet: "Saturn",
      theme: "structure, responsibility, and the cost of choices",
      status: "past",
      ageAtPivot: 29,
      pivot: "September 2014",
      window: "Sep 2013 → Sep 2015",
      evidence: "Cycle: ~29.5 years | Natal Saturn: Capricorn / H9",
    },
    {
      id: "mahadasha-2023-11-06T00:00:00.000Z",
      label: "Venus mahadasha begins",
      planet: "Venus",
      theme: "love, partnership, money, and pleasure",
      status: "active",
      ageAtPivot: 38,
      pivot: "November 2023",
      window: "Feb 2023 → Aug 2024",
      evidence: "Mahadasha lord: Venus | Lasts ~20 years | Natal Venus: Aquarius / H10",
    },
    {
      id: "nodal-return-2026-12-11T00:00:00.000Z",
      label: "Nodal return (second)",
      planet: "Rahu / Ketu",
      theme: "fate axis — what you reach for and what you release",
      status: "upcoming",
      ageAtPivot: 41,
      pivot: "December 2026",
      window: "Mar 2026 → Sep 2027",
      evidence: "Cycle: ~18.6 years | Rahu: Capricorn / H9 | Ketu: Cancer / H3",
    },
    {
      id: "jupiter-return-2033-01-20T00:00:00.000Z",
      label: "Jupiter return (fourth)",
      planet: "Jupiter",
      theme: "expansion, meaning, and a wider field of play",
      status: "upcoming",
      ageAtPivot: 47,
      pivot: "January 2033",
      window: "May 2032 → Sep 2033",
      evidence: "Cycle: ~11.9 years | Natal Jupiter: Gemini / H2",
    },
  ];
}

function renderLifeShiftFacts(facts) {
  return facts
    .map((fact) =>
      [
        `id: ${fact.id}`,
        `chapter: ${fact.label}`,
        `planet: ${fact.planet}`,
        `standing theme: ${fact.theme}`,
        `where it sits: ${fact.status}`,
        `pivot: ${fact.pivot} (age ${fact.ageAtPivot})`,
        `window: ${fact.window}`,
        fact.evidence ? `evidence: ${fact.evidence}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

/* The same synthetic chart the life-shift facts above are cut from -- Venus
   mahadasha, natal Venus in Aquarius / H10, Saturn in Capricorn / H9 -- so the
   two routes are measured against one reader rather than two. */
const CURRENT_PERIOD_LEVELS = ["Maha Dasha", "Antardasha", "Pratyantardasha"];

/* Mirrors renderCurrentPeriodFacts and currentPeriodPhase in
   lib/current-period-reading.ts. Duplicated for the same reason the other two
   render helpers here are: this file is .mjs and cannot import the TypeScript.
   The SYSTEM_PROMPT is still read from the route, so only the user turn can
   drift -- check it against the lib if a sweep reads oddly. */
function renderCurrentPeriodFacts({ stack, nakshatra, phase }) {
  const rows = stack.map((step, index) => {
    const level = CURRENT_PERIOD_LEVELS[index] ?? `level ${index + 1}`;
    const placement =
      step.sign && step.house ? `, natal ${step.lord} in ${step.sign}, house ${step.house}` : "";
    return `${level}: ${step.lord} (${step.window})${placement}`;
  });
  const innermost = CURRENT_PERIOD_LEVELS[stack.length - 1] ?? "innermost period";
  return [
    rows.join("\n"),
    `Birth nakshatra: ${nakshatra.name}, pada ${nakshatra.pada}, ruled by ${nakshatra.lord}.`,
    `The ${innermost} ${phase}.`,
  ].join("\n\n");
}

const CURRENT_PERIOD_STACK = [
  { lord: "Venus", window: "Nov 6, 2023 - Nov 6, 2043", sign: "Aquarius", house: 10 },
  { lord: "Saturn", window: "Jan 6, 2027 - Mar 8, 2030", sign: "Capricorn", house: 9 },
  { lord: "Mercury", window: "Aug 14, 2027 - Jan 11, 2028", sign: "Aries", house: 12 },
];

const ROUTES = {
  dasha: {
    file: routeFile("chart", "dasha-interpretation"),
    maxTokens: 8000,
    /* Three shapes the panel actually produces: the shallowest chain this route
       accepts, a middling one, and the deepest. Depth is the only thing that
       varies in the user turn, so it is the only axis worth sweeping. */
    cases: [
      { label: "Sun > Saturn > Moon", lords: ["Sun", "Saturn", "Moon"], startDate: "2026-01-04", endDate: "2026-03-19" },
      { label: "Venus > Mercury > Ketu > Jupiter", lords: ["Venus", "Mercury", "Ketu", "Jupiter"], startDate: "2027-06-11", endDate: "2027-07-02" },
      { label: "Rahu > Mars > Sun > Venus > Saturn", lords: ["Rahu", "Mars", "Sun", "Venus", "Saturn"], startDate: "2029-02-17", endDate: "2029-02-23" },
    ],
    userTurn: ({ lords, startDate, endDate }) => {
      const chain = lords
        .map((lord, index) => `${LEVEL_LABELS[index + 1] ?? `level ${index + 1}`}: ${lord}`)
        .join("\n");
      return `${chain}\n\nThe ${lords[lords.length - 1]} period runs ${startDate} to ${endDate}.`;
    },
  },
  varga: {
    file: routeFile("chart", "varga-commentary"),
    maxTokens: 16000,
    cases: [{ label: "ten key vargas", facts: vargaFacts() }],
    userTurn: ({ facts }) =>
      `Write exactly ${facts.length} notes, one for each of these vargas: ` +
      `${facts.map((fact) => fact.label).join(", ")}.\n\n${renderVargaFacts(facts)}`,
  },
  "life-shifts": {
    file: routeFile("chart", "life-shifts"),
    maxTokens: 12000,
    /* The two shapes the panel actually produces, and they differ on both
       axes at once because the page decides both: the results page asks for
       the one chapter it shows and asks for it at length, while
       /insights/life-shifts asks for the full set in the short form. Sweeping
       them as one case each is what makes the numbers comparable to what
       ships -- a long single reading is the expensive one to get wrong, since
       it is on the most visited page. */
    cases: [
      { label: "one chapter, headline", depth: "headline", facts: lifeShiftFacts().slice(2, 3) },
      { label: "five chapters, compact", depth: "compact", facts: lifeShiftFacts() },
    ],
    userTurn: ({ facts, depth }) =>
      `Write exactly ${facts.length} reading${facts.length === 1 ? "" : "s"} at ` +
      `LENGTH "${depth}", one for each of these chapter ids: ` +
      `${facts.map((fact) => fact.id).join(", ")}.\n\n` +
      renderLifeShiftFacts(facts),
  },
  "current-period": {
    file: routeFile("chart", "current-period"),
    maxTokens: 8000,
    /* The two shapes the card actually renders. Stack depth is one axis: a
       chart without a pratyantardasha sends two lords. The other is whether
       the chart carried positions at all, which is what decides if the
       placements -- the input this route exists for -- are in the prompt; the
       third case is the same stack with them stripped, so a sweep shows
       directly what they buy. */
    cases: [
      {
        label: "two lords, with placements",
        stack: CURRENT_PERIOD_STACK.slice(0, 2),
        nakshatra: { name: "Rohini", lord: "Moon", pada: 2 },
        phase: "is around its midpoint",
      },
      {
        label: "three lords, with placements",
        stack: CURRENT_PERIOD_STACK,
        nakshatra: { name: "Rohini", lord: "Moon", pada: 2 },
        phase: "is in its closing stretch",
      },
      {
        label: "three lords, no placements",
        stack: CURRENT_PERIOD_STACK.map(({ lord, window }) => ({ lord, window })),
        nakshatra: { name: "Rohini", lord: "Moon", pada: 2 },
        phase: "has only just opened",
      },
    ],
    userTurn: renderCurrentPeriodFacts,
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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set. This script makes billed API calls.");
    process.exit(2);
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, timeout: 120_000 });

  const routeName = arg("route", "dasha");
  const route = ROUTES[routeName];
  if (!route) {
    console.error(`unknown --route ${routeName}. Known: ${Object.keys(ROUTES).join(", ")}`);
    process.exit(2);
  }

  const efforts = arg("efforts", "low,medium").split(",").map((s) => s.trim()).filter(Boolean);
  const repeat = Number(arg("repeat", "1"));
  const system = readSystemPrompt(route.file);

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
            messages: [{ role: "user", content: route.userTurn(testCase) }],
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
