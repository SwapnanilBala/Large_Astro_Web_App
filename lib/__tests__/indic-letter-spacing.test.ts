/**
 * Hindi and Bengali are never tracked out, in either tree.
 *
 * Devanagari and Bengali letters hang from one headline stroke, and any
 * letter-spacing cuts it into pieces. Both shells reset letter-spacing under
 * :lang(hi) and :lang(bn) with !important, which reaches every module class
 * and inline style without each label having to remember. Two things can
 * still defeat that, and nobody reviewing in English would see either:
 *
 * - the reset going missing from a shell, or losing a pseudo-element;
 * - a rule that sets letter-spacing !important itself. In the shell's own file
 *   it must come before the reset (equal specificity, so order decides); in a
 *   module, which loads later and is usually more specific, it needs its own
 *   :lang override.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const APP = join(process.cwd(), "app");
const SHELLS = [join(APP, "globals.css"), join(APP, "m", "mobile-shell.css")];

function stylesheets(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return stylesheets(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

const uncommented = (file: string) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Every `selector { ... letter-spacing: X !important ... }` in a file, with where it starts. */
function importantSpacing(css: string): { selector: string; value: string; at: number }[] {
  const found: { selector: string; value: string; at: number }[] = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = rule.exec(css); m; m = rule.exec(css)) {
    const decl = /letter-spacing\s*:\s*([^;!}]+?)\s*!important/.exec(m[2]);
    if (decl) found.push({ selector: m[1].trim(), value: decl[1].trim(), at: m.index });
  }
  return found;
}

const isReset = (r: { selector: string; value: string }) =>
  /:lang\((hi|bn)\)/.test(r.selector) && /^(0|0em|0px|normal)$/.test(r.value);

describe("letter-spacing in Hindi and Bengali", () => {
  for (const shell of SHELLS) {
    const name = relative(process.cwd(), shell);

    it(`${name} resets it for both scripts, pseudo-elements included`, () => {
      const reset = importantSpacing(uncommented(shell)).find(
        (r) => isReset(r) && r.selector.split(",").map((s) => s.trim()).includes(":lang(hi)"),
      );
      expect(reset, "no `:lang(hi), :lang(bn) { letter-spacing: 0 !important }` rule").toBeTruthy();
      const parts = reset!.selector.split(",").map((s) => s.trim());
      for (const lang of ["hi", "bn"]) {
        for (const pseudo of ["", "::before", "::after", "::placeholder"]) {
          expect(parts, `${name} misses :lang(${lang})${pseudo}`).toContain(`:lang(${lang})${pseudo}`);
        }
      }
    });

    it(`${name} sets no tracking !important after its reset`, () => {
      const rules = importantSpacing(uncommented(shell));
      const resetAt = rules.find(isReset)!.at;
      const later = rules.filter((r) => r.at > resetAt && !isReset(r)).map((r) => r.selector);
      expect(later).toEqual([]);
    });
  }

  it("is reset in a module wherever the module sets it !important", () => {
    const offenders = stylesheets(APP)
      .filter((file) => !SHELLS.includes(file))
      .flatMap((file) => {
        const rules = importantSpacing(uncommented(file));
        const tracked = rules.filter((r) => !isReset(r) && !/^(0|0em|0px|normal)$/.test(r.value));
        if (!tracked.length) return [];
        const resets = rules.filter(isReset).map((r) => r.selector).join(",");
        return tracked
          .filter((r) => !r.selector.split(",").every((sel) => resets.includes(`${sel.trim()}:lang(hi)`) && resets.includes(`${sel.trim()}:lang(bn)`)))
          .map((r) => `${relative(process.cwd(), file)}: ${r.selector.replace(/\s+/g, " ")}`);
      });
    expect(offenders).toEqual([]);
  });
});
