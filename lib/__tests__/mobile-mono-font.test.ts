/**
 * Hindi and Bengali reach every monospace label on /m through one variable.
 *
 * No system monospace has Devanagari or Bengali letters, but its spaces are
 * more than twice as wide as a text face's, so a mono label in either language
 * read with gaps twice the width of the sentence beside it. mobile-shell.css
 * swaps --font-mono for the text face under :lang(hi) and :lang(bn). That
 * reaches a label only if the label takes its font from the variable: a
 * monospace stack written out in a stylesheet would bring the wide gaps back
 * for that label alone, and nobody reviewing in English would see it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "app", "m");
const SHELL = join(ROOT, "mobile-shell.css");

function stylesheets(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return stylesheets(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

const uncommented = (file: string) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("monospace on /m", () => {
  it("is written out only where --font-mono is defined", () => {
    const offenders = stylesheets(ROOT).flatMap((file) =>
      uncommented(file)
        .split("\n")
        .filter((line) => /monospace/i.test(line) && !/^\s*--font-mono\s*:/.test(line))
        .map((line) => `${relative(process.cwd(), file)}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });

  it("is the text face in Hindi and Bengali", () => {
    const css = uncommented(SHELL);
    for (const lang of ["hi", "bn"]) {
      expect(css, lang).toMatch(
        new RegExp(`:lang\\(${lang}\\)[^{]*\\{[^}]*--font-mono:\\s*var\\(--font-text\\)`),
      );
    }
  });
});
