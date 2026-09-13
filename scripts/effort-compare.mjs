/**
 * Run one LLM route's real prompt at two effort levels and print what each costs.
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
 *
 * THIS SPENDS REAL MONEY. Every row is a billed request; the script prints the
 * total before exiting. Default is 3 chains x 2 efforts = 6 calls.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTE = join(HERE, "..", "app", "api", "chart", "dasha-interpretation", "route.ts");

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

/* Three shapes the panel actually produces: the shallowest chain this route
   accepts, a middling one, and the deepest. Depth is the only thing that
   varies in the user turn, so it is the only axis worth sweeping. */
const CHAINS = [
  { lords: ["Sun", "Saturn", "Moon"], startDate: "2026-01-04", endDate: "2026-03-19" },
  { lords: ["Venus", "Mercury", "Ketu", "Jupiter"], startDate: "2027-06-11", endDate: "2027-07-02" },
  { lords: ["Rahu", "Mars", "Sun", "Venus", "Saturn"], startDate: "2029-02-17", endDate: "2029-02-23" },
];

function arg(name, fallback) {
  const hit = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

/** The template literal assigned to SYSTEM_PROMPT, read from the route source. */
function readSystemPrompt() {
  const src = readFileSync(ROUTE, "utf8").replace(/\r\n/g, "\n");
  const start = src.indexOf("const SYSTEM_PROMPT");
  if (start < 0) throw new Error("SYSTEM_PROMPT not found in " + ROUTE);
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

function userTurn({ lords, startDate, endDate }) {
  const chain = lords
    .map((lord, index) => `${LEVEL_LABELS[index + 1] ?? `level ${index + 1}`}: ${lord}`)
    .join("\n");
  return `${chain}\n\nThe ${lords[lords.length - 1]} period runs ${startDate} to ${endDate}.`;
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

  const efforts = arg("efforts", "low,medium").split(",").map((s) => s.trim()).filter(Boolean);
  const repeat = Number(arg("repeat", "1"));
  const system = readSystemPrompt();

  console.log(`model ${MODEL}  |  efforts ${efforts.join(", ")}  |  ${CHAINS.length} chains x ${repeat}`);
  console.log(`system prompt ${system.length} chars\n`);

  const totals = Object.fromEntries(efforts.map((e) => [e, { cost: 0, ms: 0, out: 0, n: 0, truncated: 0 }]));

  for (const chain of CHAINS) {
    console.log(`--- ${chain.lords.join(" > ")}`);
    for (const effort of efforts) {
      for (let run = 0; run < repeat; run += 1) {
        const started = Date.now();
        let response;
        try {
          response = await client.messages.create({
            model: MODEL,
            max_tokens: 8000,
            output_config: { effort },
            system: [{ type: "text", text: system }],
            messages: [{ role: "user", content: userTurn(chain) }],
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
