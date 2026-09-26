/**
 * Where the PyJHora comparison's Python environment lives.
 *
 * Outside the repository by default (~/.venvs/pyjhora), for two reasons:
 * every worktree of this repo can share one install, and Windows refuses the
 * deepest paths pip writes when the venv sits inside a long worktree path.
 *
 *   PYJHORA_VENV    use a different venv directory
 *   PYJHORA_PYTHON  use this Python executable directly (skips the venv)
 */

import os from "node:os";
import path from "node:path";

export const VENV_DIR = process.env.PYJHORA_VENV ?? path.join(os.homedir(), ".venvs", "pyjhora");

export function venvPython() {
  if (process.env.PYJHORA_PYTHON) return process.env.PYJHORA_PYTHON;
  return process.platform === "win32"
    ? path.join(VENV_DIR, "Scripts", "python.exe")
    : path.join(VENV_DIR, "bin", "python");
}
