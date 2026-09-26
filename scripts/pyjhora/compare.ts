/**
 * Step 3 of the PyJHora comparison: line our yogas up against PyJHora's and
 * write the report to docs/pyjhora-yoga-comparison.md.
 *
 * Ours are judged twice. "Detected" is the yoga's own test, before anything
 * is filtered; that is what a definition comparison needs. "Shown" is what
 * detectYogas returns after its 30% cut, which hides weak yogas that are also
 * cancelled; the report counts how often that cut is the only reason the two
 * disagree.
 *
 *   npx tsx scripts/pyjhora/compare.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  detectYogas,
  YOGA_DEFINITIONS,
  type YogaChartInput,
} from "../../lib/engines/yoga-engine";
import { CHARTS_FILE, OUT_DIR, type ExportedChart } from "./export-charts";
import { explain, type CoLords } from "./explain";
import { YOGA_PAIRS, type YogaPair } from "./yoga-map";

const RESULTS_FILE = path.join(OUT_DIR, "pyjhora-results.json");
const REPORT_FILE = path.resolve(__dirname, "../../docs/pyjhora-yoga-comparison.md");
const EXAMPLES = 3;

type PyjhoraResults = {
  pyjhora_version: string;
  python_version: string;
  missing_functions: string[];
  mutated_globals: Record<string, string[]>;
  strength_table: number[][];
  strength_friend: number;
  results: Array<{ id: number; present: string[]; errors: Record<string, string>; co_lords: CoLords }>;
  positions: Array<{ id: number; gaps: Record<string, number>; sign_mismatch: string[] }>;
};

type PairStats = YogaPair & {
  oursName: string;
  both: number;
  oursOnly: number;
  theirsOnly: number;
  neither: number;
  /** Charts where ours detected it, PyJHora did not, and our page hides it anyway. */
  oursOnlyHidden: number;
  errors: number;
  oursOnlyExamples: number[];
  theirsOnlyExamples: number[];
  /** Known reasons for each disagreement, by which side said yes. */
  reasons: { ours: Map<string, number>; theirs: Map<string, number> };
  /** Disagreements no known reason covers: the ones worth a closer look. */
  unexplained: { ours: number[]; theirs: number[] };
};

/** The same input chart-service.ts hands detectYogas on the site. */
function chartInput(record: ExportedChart): YogaChartInput {
  return {
    planets: record.chart.planets,
    houses: record.chart.houses,
    ascendantSign: record.chart.ascendant.sign,
    ascendantDegreeInSign: record.chart.ascendant.degree_in_sign,
  };
}

function detected(chart: YogaChartInput): Set<string> {
  const found = new Set<string>();
  for (const definition of YOGA_DEFINITIONS) {
    try {
      const result = definition.detect(chart);
      if (result?.present) found.add(definition.id);
    } catch {
      // detectYogas skips a failing definition; so does this.
    }
  }
  return found;
}

function percent(part: number, whole: number): string {
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function describeChart(record: ExportedChart): string {
  const { year, month, day, hour, minute } = record.utc;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `#${record.id} (${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)} UTC, ${record.city})`;
}

function main() {
  const exported = JSON.parse(readFileSync(CHARTS_FILE, "utf8")) as {
    seed: number;
    engine: string;
    charts: ExportedChart[];
  };
  const theirs = JSON.parse(readFileSync(RESULTS_FILE, "utf8")) as PyjhoraResults;
  const theirsById = new Map(theirs.results.map((result) => [result.id, result]));
  const names = new Map(YOGA_DEFINITIONS.map((definition) => [definition.id, definition.name]));
  const total = exported.charts.length;

  const stats: PairStats[] = YOGA_PAIRS.map((pair) => ({
    ...pair,
    oursName: names.get(pair.ours) ?? pair.ours,
    both: 0,
    oursOnly: 0,
    theirsOnly: 0,
    neither: 0,
    oursOnlyHidden: 0,
    errors: 0,
    oursOnlyExamples: [],
    theirsOnlyExamples: [],
    reasons: { ours: new Map(), theirs: new Map() },
    unexplained: { ours: [], theirs: [] },
  }));
  const strength = { table: theirs.strength_table, friend: theirs.strength_friend };
  const explainOne = (entry: PairStats, side: "ours" | "theirs", chart: YogaChartInput, id: number, coLords: CoLords) => {
    const reason = explain(entry.ours, chart, strength, coLords, side === "ours");
    if (reason) entry.reasons[side].set(reason, (entry.reasons[side].get(reason) ?? 0) + 1);
    else entry.unexplained[side].push(id);
  };

  for (const record of exported.charts) {
    const chart = chartInput(record);
    const ours = detected(chart);
    const shown = new Set(detectYogas(chart).map((yoga) => yoga.yoga_id));
    const result = theirsById.get(record.id);
    if (!result) throw new Error(`PyJHora has no result for chart ${record.id}; rerun step 2.`);
    const present = new Set(result.present);

    for (const entry of stats) {
      if (result.errors[entry.theirs]) {
        entry.errors++;
        continue;
      }
      const a = ours.has(entry.ours);
      const b = present.has(entry.theirs);
      if (a && b) entry.both++;
      else if (!a && !b) entry.neither++;
      else if (a) {
        entry.oursOnly++;
        if (!shown.has(entry.ours)) entry.oursOnlyHidden++;
        if (entry.oursOnlyExamples.length < EXAMPLES) entry.oursOnlyExamples.push(record.id);
        explainOne(entry, "ours", chart, record.id, result.co_lords);
      } else {
        entry.theirsOnly++;
        if (entry.theirsOnlyExamples.length < EXAMPLES) entry.theirsOnlyExamples.push(record.id);
        explainOne(entry, "theirs", chart, record.id, result.co_lords);
      }
    }
  }

  const byId = new Map(exported.charts.map((record) => [record.id, record]));
  const agreement = (entry: PairStats) => (entry.both + entry.neither) / Math.max(1, total - entry.errors);
  const row = (entry: PairStats) => {
    const judged = total - entry.errors;
    return `| ${entry.oursName} | \`${entry.theirs}\` | ${percent(entry.both + entry.neither, judged)} | ${entry.oursOnly} | ${entry.theirsOnly} | ${entry.both} |`;
  };
  const header =
    "| Our yoga | PyJHora | Agree | Only ours | Only PyJHora | Both |\n|---|---|---|---|---|---|";

  const same = stats.filter((entry) => entry.expect === "same").sort((l, r) => agreement(l) - agreement(r));
  const different = stats.filter((entry) => entry.expect === "different").sort((l, r) => agreement(l) - agreement(r));
  const sameExact = same.filter((entry) => entry.oursOnly === 0 && entry.theirsOnly === 0);
  const sameSplit = same.filter((entry) => entry.oursOnly > 0 || entry.theirsOnly > 0);
  const matched = new Set(YOGA_PAIRS.map((pair) => pair.ours));
  const unmatched = YOGA_DEFINITIONS.filter((definition) => !matched.has(definition.id));

  // Positions: how far PyJHora's own chart lands from ours.
  const bodies = Object.keys(theirs.positions[0]?.gaps ?? {});
  const positionRows = bodies.map((body) => {
    const gaps = theirs.positions.map((p) => p.gaps[body]);
    const max = Math.max(...gaps);
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const signDiffers = theirs.positions.filter((p) => p.sign_mismatch.includes(body)).length;
    return { body, max, mean, signDiffers };
  });
  const planetsOnly = positionRows.filter((r) => !r.body.startsWith("Rahu") && r.body !== "Ketu");
  const worstPlanetGap = Math.max(...planetsOnly.map((r) => r.max));
  const planetSignDiffs = planetsOnly.reduce((sum, r) => sum + r.signDiffers, 0);
  const rahuTrue = positionRows.find((r) => r.body === "Rahu");
  const rahuMean = positionRows.find((r) => r.body === "Rahu (mean node)");

  const examples = (ids: number[]) => ids.slice(0, EXAMPLES).map((id) => describeChart(byId.get(id)!)).join("; ");
  const side = (entry: PairStats, which: "ours" | "theirs", count: number, label: string) => {
    if (count === 0) return [];
    const hidden = which === "ours" && entry.oursOnlyHidden > 0 ? ` (${entry.oursOnlyHidden} hidden on our page anyway)` : "";
    const lines = [`  - ${label}, ${count} charts${hidden}:`];
    for (const [reason, n] of [...entry.reasons[which]].sort((l, r) => r[1] - l[1])) {
      lines.push(`    - ${n}: ${reason}.`);
    }
    const open = entry.unexplained[which];
    if (open.length > 0) {
      lines.push(`    - **${open.length} not explained by any known difference**: ${examples(open)}`);
    }
    return lines;
  };
  const detail = (entry: PairStats) => {
    const lines: string[] = [];
    if (entry.note) lines.push(`  - Expected difference: ${entry.note}`);
    if (entry.expect === "same") {
      lines.push(...side(entry, "ours", entry.oursOnly, "Only ours"));
      lines.push(...side(entry, "theirs", entry.theirsOnly, "Only PyJHora"));
    } else {
      if (entry.oursOnly > 0) lines.push(`  - Only ours, ${entry.oursOnly} charts: ${examples(entry.oursOnlyExamples)}`);
      if (entry.theirsOnly > 0) lines.push(`  - Only PyJHora, ${entry.theirsOnly} charts: ${examples(entry.theirsOnlyExamples)}`);
    }
    if (entry.errors > 0) lines.push(`  - PyJHora raised an error on ${entry.errors} charts.`);
    return `- **${entry.oursName}** vs \`${entry.theirs}\`: agree on ${percent(entry.both + entry.neither, total - entry.errors)} of charts.\n${lines.join("\n")}`;
  };
  const sameDisagreements = same.reduce((sum, entry) => sum + entry.oursOnly + entry.theirsOnly, 0);
  const sameUnexplained = same.reduce((sum, entry) => sum + entry.unexplained.ours.length + entry.unexplained.theirs.length, 0);
  const mutated = Object.entries(theirs.mutated_globals ?? {});

  const report = `# Our yogas compared with PyJHora

Generated by \`npm run compare:pyjhora\` (see \`scripts/pyjhora/README.md\`). Do not edit by hand; rerun the script.

- Charts: ${total}, seed ${exported.seed}, births 1940 to 2015 in ten cities.
- Our engine: ${exported.engine}.
- PyJHora ${theirs.pyjhora_version} on Python ${theirs.python_version}.
- Our yogas matched to a PyJHora yoga: ${matched.size} of ${YOGA_DEFINITIONS.length} (${YOGA_PAIRS.length} pairs; Mala is compared with two).

## How to read this

PyJHora is given **our** planet positions for every chart, so both sides judge exactly the same chart. When they disagree, it is because the yoga is defined differently, not because a planet is in a different place.

Each pair is marked in \`scripts/pyjhora/yoga-map.ts\` before the comparison runs:

- **Same definition**: PyJHora describes the same combination we do. A disagreement here is worth a look: it is a bug on one side, or a reading of the rule that should be written down.
- **Different definition**: PyJHora already describes a different rule. Disagreement is expected; the numbers show how far apart the two land.

"Agree" is the share of charts where both say yes or both say no. Ours is judged by the yoga's own test, before the page's 30% cut.

## Summary

- ${sameExact.length} of ${same.length} same-definition pairs agree on every chart.
- ${sameSplit.length} same-definition pairs disagree somewhere, on ${sameDisagreements} chart-yoga pairs in all. ${sameUnexplained === 0 ? "Every one of those disagreements is explained by a known difference in how PyJHora's code reads the rule (listed below)." : `**${sameUnexplained} of them are not explained by any known difference** and are worth a closer look; they are marked below.`}
- The two engines' own charts: the ascendant and the seven planets never differ by more than ${worstPlanetGap.toFixed(3)}°. ${planetSignDiffs === 0 ? "None of them lands in a different sign." : `${planetSignDiffs === 1 ? "One placement lands" : `${planetSignDiffs} placements land`} in a different sign, from a planet sitting right on a sign boundary.`}${rahuTrue && rahuMean ? `
- Rahu and Ketu: ours matches the **mean** node (never more than ${rahuMean.max.toFixed(3)}° away), although the code calls it the true node. PyJHora uses the true node, up to ${rahuTrue.max.toFixed(2)}° away, which puts Rahu in a different sign in ${percent(rahuTrue.signDiffers, total)} of charts.` : ""}${mutated.length > 0 ? `
- A PyJHora bug the comparison works around: ${mutated.map(([list, fns]) => `${fns.map((fn) => `\`${fn}\``).join(", ")} change PyJHora's shared \`const.${list}\` list in place`).join("; ")}. In a long-running process, every yoga checked afterwards then sees the changed list. \`run_pyjhora.py\` restores it after every call.` : ""}

## Same-definition pairs that disagree

${sameSplit.length === 0 ? "None." : sameSplit.map(detail).join("\n")}

## All same-definition pairs

${header}
${same.map(row).join("\n")}

## Different-definition pairs

${different.map(detail).join("\n")}

${header}
${different.map(row).join("\n")}

## Our yogas with no PyJHora counterpart (${unmatched.length})

${unmatched.map((definition) => definition.name).join(", ")}.

## The two engines' own charts

PyJHora computed each chart itself from the same moment and place, with the Lahiri ayanamsa. The gap is the distance between its longitude and ours.

| Body | Largest gap | Average gap | Different sign |
|---|---|---|---|
${positionRows.map((r) => `| ${r.body} | ${r.max.toFixed(3)}° | ${r.mean.toFixed(3)}° | ${r.signDiffers} of ${total} |`).join("\n")}
${theirs.missing_functions.length > 0 ? `\nPyJHora functions named in yoga-map.ts but not found: ${theirs.missing_functions.join(", ")}.\n` : ""}`;

  writeFileSync(REPORT_FILE, report);
  console.log(
    `Same definition: ${sameExact.length}/${same.length} pairs agree on every chart. ` +
      `Different definition: ${different.length} pairs. Unmatched: ${unmatched.length}. ` +
      `Wrote ${path.relative(process.cwd(), REPORT_FILE)}`
  );
}

main();
