import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/*
 * Text contrast for the /m tree, computed from the stylesheet rather than
 * asserted as a remembered number.
 *
 * --text-tertiary shipped at #6b6560, which is 2.52:1 against the lightest
 * surface in the sheet — under the 4.5:1 AA floor, on twelve pieces of real
 * 11-13px copy. Nothing caught it because contrast is a property of a pair,
 * and neither half looks wrong on its own: a text tone is just a hex, a
 * surface is just a hex, and the failure only exists where they meet.
 *
 * So this pairs them. Every text tone against every surface a mobile page can
 * paint it on, recomputed from the declarations each run, which means the
 * check also covers the case that caused the bug in the first place — someone
 * lightening a surface later without thinking about what is written on it.
 *
 * Only the light-on-dark body tones are checked here. The accent and the
 * inverted text on gold fills are pairings this cannot infer from the token
 * list alone; they were measured by hand against the rendered page.
 */

const SHELL = join(process.cwd(), "app", "m", "mobile-shell.css");
const MOBILE_DIR = join(process.cwd(), "app", "m");

type Rgb = [number, number, number];

function readToken(css: string, name: string): string {
  const match = css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m"));
  if (!match) throw new Error(`token --${name} is not declared in mobile-shell.css`);
  return match[1].trim();
}

function parseColor(value: string): { rgb: Rgb; alpha: number } {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  const rgba = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/i);
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
      alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  throw new Error(`cannot parse colour: ${value}`);
}

const composite = (fg: Rgb, alpha: number, bg: Rgb): Rgb =>
  [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha)) as Rgb;

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const luminance = ([r, g, b]: Rgb) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(SHELL, "utf8");

const bgDeep = parseColor(readToken(css, "bg-deep")).rgb;
const bgSurface = parseColor(readToken(css, "bg-surface")).rgb;

/*
 * The lightest point of every surface, since that is where contrast is worst.
 * The two "lit" tokens are top-down washes that fade out part way down, so
 * their first stop over their own base is the value to check.
 */
const washStop = (declaration: string): { rgb: Rgb; alpha: number } => {
  const first = declaration.match(/rgba?\([^)]*\)/);
  if (!first) throw new Error(`no colour stop in: ${declaration}`);
  return parseColor(first[0]);
};

const litBase = (declaration: string): Rgb => {
  const solid = declaration.match(/#[0-9a-f]{6}(?![0-9a-f])/gi);
  if (!solid?.length) throw new Error(`no base colour in: ${declaration}`);
  return parseColor(solid[solid.length - 1]).rgb;
};

const surfaceToken = parseColor(readToken(css, "surface"));
const surfaceStrongToken = parseColor(readToken(css, "surface-strong"));
const lit = readToken(css, "surface-lit");
const litStrong = readToken(css, "surface-lit-strong");

const SURFACES: Record<string, Rgb> = {
  "bg-deep": bgDeep,
  "bg-surface": bgSurface,
  surface: composite(surfaceToken.rgb, surfaceToken.alpha, bgDeep),
  "surface-strong": composite(surfaceStrongToken.rgb, surfaceStrongToken.alpha, bgDeep),
  "surface-lit (top)": composite(washStop(lit).rgb, washStop(lit).alpha, litBase(lit)),
  "surface-lit-strong (top)": composite(
    washStop(litStrong).rgb,
    washStop(litStrong).alpha,
    litBase(litStrong),
  ),
};

const TEXT_TONES: Record<string, Rgb> = {
  "text-primary": parseColor(readToken(css, "text-primary")).rgb,
  "text-secondary": parseColor(readToken(css, "text-secondary")).rgb,
  "text-tertiary": parseColor(readToken(css, "text-tertiary")).rgb,
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return entry.endsWith(".css") ? [full] : [];
  });
}

describe("mobile text contrast", () => {
  it("clears AA for every body tone on every surface the tree paints", () => {
    const failures: string[] = [];

    for (const [toneName, tone] of Object.entries(TEXT_TONES)) {
      for (const [surfaceName, surface] of Object.entries(SURFACES)) {
        const ratio = contrast(tone, surface);
        if (ratio < 4.5) {
          failures.push(`${toneName} on ${surfaceName}: ${ratio.toFixed(2)}:1`);
        }
      }
    }

    expect(failures, `below the 4.5:1 AA floor — ${failures.join("; ")}`).toEqual([]);
  });

  /*
   * Every reference is written var(--token, #literal). The literal is what
   * renders if the token ever fails to resolve, so a stale one is a silent
   * path back to the colour this file exists to keep out.
   */
  it("keeps inline var() fallbacks equal to the token they back", () => {
    const drifted: string[] = [];
    const declared = new Map(
      Object.entries(TEXT_TONES).map(([name, rgb]) => [
        name,
        `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`,
      ]),
    );

    for (const file of walk(MOBILE_DIR)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/var\(\s*--(text-[a-z]+)\s*,\s*(#[0-9a-f]{6})\s*\)/gi)) {
        const expected = declared.get(match[1]);
        if (expected && match[2].toLowerCase() !== expected) {
          drifted.push(
            `${file.replace(process.cwd(), "")}: var(--${match[1]}, ${match[2]}) should fall back to ${expected}`,
          );
        }
      }
    }

    expect(drifted, drifted.join("; ")).toEqual([]);
  });

  it("still has a visible step between the three tones", () => {
    /* Raising tertiary to clear AA narrows the ramp; this guards against a
       later nudge closing it altogether and leaving three names for one
       colour. */
    const primary = luminance(TEXT_TONES["text-primary"]);
    const secondary = luminance(TEXT_TONES["text-secondary"]);
    const tertiary = luminance(TEXT_TONES["text-tertiary"]);

    expect(primary).toBeGreaterThan(secondary);
    expect(secondary / tertiary).toBeGreaterThan(1.1);
  });
});
