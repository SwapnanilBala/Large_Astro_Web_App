/**
 * One-time setup for the PyJHora comparison: a Python 3.12 venv with PyJHora
 * and the packages its calculation code imports.
 *
 *   npm run pyjhora:setup
 *
 * Python 3.12 because PyJHora's pinned dependencies (pyswisseph, numpy)
 * publish ready-made wheels for it; newer Pythons may need a C compiler.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VENV_DIR, venvPython } from "./python-env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const requirements = path.join(here, "requirements.txt");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  return result.status === 0;
}

const python = venvPython();
if (!existsSync(python)) {
  console.log(`Creating a Python 3.12 environment at ${VENV_DIR}`);
  const created =
    process.platform === "win32"
      ? run("py", ["-3.12", "-m", "venv", VENV_DIR])
      : run("python3.12", ["-m", "venv", VENV_DIR]);
  if (!created) {
    console.error("Could not create the environment. Install Python 3.12 (python.org), then rerun.");
    process.exit(1);
  }
}

console.log("Installing PyJHora and its calculation dependencies (about 400 MB on disk, mostly ephemeris data)");
if (!run(python, ["-m", "pip", "install", "--disable-pip-version-check", "-q", "-r", requirements])) {
  process.exit(1);
}
console.log(`Ready. The comparison will use ${python}`);
