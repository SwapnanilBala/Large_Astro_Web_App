import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import mobileMessages from "@/messages/en.mobile.json";
import engineSelectMessages from "@/messages/en.engine-select.json";
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

/* Matches t("some.key") and tr("some.key") but not edit("name") or
   commit("birthDate") — the leading boundary is what keeps the trailing `t` of
   those two out. Template-literal keys are invisible to this, here as on the
   desktop tree; what it catches is the plain-string majority. */
const T_CALL = /(?<![A-Za-z0-9_$])tr?\(\s*"([A-Za-z0-9_.]+)"/g;

/*
 * Catalogs that ship with one route instead of the layout's baseline.
 *
 * The baseline is downloaded by every page under app/m, so a namespace only
 * one route renders is waste on all the others — engineSelect is 1.8KB gzipped
 * of copy the intake never shows. A route with its own body of text passes it
 * to useRouteMessages instead, and the keys under that directory are checked
 * against the baseline plus its own catalog.
 */
const ROUTE_CATALOGS = [
  { dir: join(MOBILE_DIR, "engine-select"), messages: engineSelectMessages },
] as const;

const mobileKeys = flatten(mobileMessages as Record<string, unknown>);
const fullKeys = flatten(fullMessages as Record<string, unknown>);

/* Every key, paired with the set it is allowed to come from. */
const usedKeys = walk(MOBILE_DIR).flatMap((file) => {
  const catalog = ROUTE_CATALOGS.find((entry) => file.startsWith(entry.dir));
  const allowed = catalog
    ? { ...mobileKeys, ...flatten(catalog.messages as Record<string, unknown>) }
    : mobileKeys;
  return [...readFileSync(file, "utf8").matchAll(T_CALL)].map((m) => ({
    key: m[1],
    file,
    allowed,
  }));
});

describe("mobile translation baseline", () => {
  it("finds the t() calls it is meant to be checking", () => {
    /* Guards the regex itself: if a refactor renames the hook or changes the
       call shape, the suite would otherwise pass by matching nothing. */
    expect(usedKeys.length).toBeGreaterThan(10);
  });

  it("covers every key any page under app/m renders", () => {
    const missing = usedKeys
      .filter((used) => !(used.key in used.allowed))
      .map((used) => `${used.key} (${used.file.replace(process.cwd(), "")})`);
    expect(missing, `no catalog covers: ${missing.join(", ")}`).toEqual([]);
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

describe("route-local catalogs", () => {
  it("say the same thing as the full English file", () => {
    for (const catalog of ROUTE_CATALOGS) {
      const keys = flatten(catalog.messages as Record<string, unknown>);
      const drifted = Object.keys(keys).filter((key) => fullKeys[key] !== keys[key]);
      expect(drifted, `${catalog.dir} has drifted from en.json`).toEqual([]);
    }
  });

  /*
   * The point of a route catalog is that the layout's baseline does not carry
   * it. Re-adding the namespace there would work — every key would resolve, no
   * test would fail on coverage — and quietly put the bytes back on every
   * mobile page, which is the thing this arrangement exists to prevent.
   */
  it("stay out of the baseline the layout ships", () => {
    for (const catalog of ROUTE_CATALOGS) {
      const duplicated = Object.keys(flatten(catalog.messages as Record<string, unknown>))
        .filter((key) => key in mobileKeys);
      expect(
        duplicated,
        `these are in messages/en.mobile.json as well as ${catalog.dir}, so every ` +
          `mobile page pays for them: ${duplicated.slice(0, 5).join(", ")}`,
      ).toEqual([]);
    }
  });

  it("are actually read through useRouteMessages", () => {
    /* A catalog nothing imports is dead weight that still passes every other
       assertion here. */
    for (const catalog of ROUTE_CATALOGS) {
      const sources = walk(catalog.dir).map((file) => readFileSync(file, "utf8"));
      expect(
        sources.some((source) => source.includes("useRouteMessages")),
        `nothing under ${catalog.dir} calls useRouteMessages`,
      ).toBe(true);
    }
  });
});
