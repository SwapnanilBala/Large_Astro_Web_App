/**
 * Run the whole PyJHora comparison: export our charts, judge them with
 * PyJHora, and write docs/pyjhora-yoga-comparison.md.
 *
 *   npm run compare:pyjhora            # 2000 charts
 *   npm run compare:pyjhora -- 500     # a quicker sample
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { venvPython } from "./python-env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const count = process.argv[2];
// tsx's CLI run through this Node, rather than `npx`, which needs a shell on
// Windows and then mangles paths with spaces.
const tsx = createRequire(import.meta.url).resolve("tsx/cli");

const python = venvPython();
if (!existsSync(python)) {
  console.error(`No PyJHora environment at ${python}. Run: npm run pyjhora:setup`);
  process.exit(1);
}

function step(label, command, args) {
  console.log(`\n${label}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

step("1/3 Exporting charts from our engine", process.execPath, [tsx, path.join(here, "export-charts.ts"), ...(count ? [count] : [])]);
step("2/3 Judging them with PyJHora", python, [path.join(here, "run_pyjhora.py")]);
step("3/3 Comparing and writing the report", process.execPath, [tsx, path.join(here, "compare.ts")]);
