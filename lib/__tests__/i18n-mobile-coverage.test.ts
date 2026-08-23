import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import mobileMessages from "@/messages/en.mobile.json";
import fullMessages from "@/messages/en.json";

/*
 * messages/en.mobile.json is a trimmed English baseline for the /m tree — the
 * namespaces its pages actually render, rather than the whole English file.
 *
 * The saving is only safe while every key a mobile page renders is present in
 * the subset, because a miss in t() falls through to returning the key itself
 * and the visitor sees "home.formCity" on screen. That failure is silent at
 * build time and easy to miss in review, so it is asserted here instead.
 */

const MOBILE_DIR = join(process.cwd(), "app", "m");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === "string") out[full] = value;
    else if (value && typeof value === "object") {
      Object.assign(out, flatten(value as Record<string, unknown>, full));
    }
  }
  return out;
}

/* Matches t("some.key") but not edit("name") or commit("birthDate") — the
   leading boundary is what keeps the trailing `t` of those two out. */
const T_CALL = /(?<![A-Za-z0-9_$])t\(\s*"([A-Za-z0-9_.]+)"/g;

const mobileKeys = flatten(mobileMessages as Record<string, unknown>);
const fullKeys = flatten(fullMessages as Record<string, unknown>);

const usedKeys = [...new Set(
  walk(MOBILE_DIR).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(T_CALL)].map((m) => m[1]),
  ),
)].sort();

describe("mobile translation baseline", () => {
  it("finds the t() calls it is meant to be checking", () => {
    /* Guards the regex itself: if a refactor renames the hook or changes the
       call shape, the suite would otherwise pass by matching nothing. */
    expect(usedKeys.length).toBeGreaterThan(10);
  });

  it("covers every key any page under app/m renders", () => {
    const missing = usedKeys.filter((key) => !(key in mobileKeys));
    expect(missing, `add these to messages/en.mobile.json: ${missing.join(", ")}`).toEqual([]);
  });

  it("uses the same strings as the full English file", () => {
    /* The subset is generated from en.json, so any drift means one of the two
       was hand-edited and the trees now disagree. */
    const drifted = Object.keys(mobileKeys).filter(
      (key) => fullKeys[key] !== mobileKeys[key],
    );
    expect(drifted).toEqual([]);
  });

  it("stays a strict subset — no keys the full file lacks", () => {
    expect(Object.keys(mobileKeys).filter((key) => !(key in fullKeys))).toEqual([]);
  });
});
