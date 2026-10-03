import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * The /m page entrance must not leave a containing block behind.
 *
 * The action bar at the foot of the intake and the method chooser is
 * position: fixed, and it sits inside the page the entrance animates. Any
 * transform on that page -- an identity one included, which is what a held
 * `transform: none` keyframe ends as -- makes the page the bar's containing
 * block, so on a page taller than the screen the bar sat at the end of the
 * page rather than the foot of the screen. The method chooser's "See my
 * chart" was below all six traditions for six weeks: the top of the page
 * looked right, axe and the layout-shift sweep had nothing to say about where
 * a fixed element is, and only walking the flow found it. So this reads the
 * keyframes.
 */

const SHELL = readFileSync(join(process.cwd(), "app", "m", "mobile-shell.css"), "utf8");

/* Properties whose values, held at the end of an animation, would make the
   animated page the containing block for a fixed descendant. */
const TRAPS_FIXED = new Set([
  "transform",
  "translate",
  "rotate",
  "scale",
  "perspective",
  "filter",
  "backdrop-filter",
  "contain",
  "container-type",
  "will-change",
]);

function keyframesBody(name: string): string {
  const head = SHELL.indexOf(`@keyframes ${name}`);
  if (head === -1) throw new Error(`@keyframes ${name} is not declared in mobile-shell.css`);
  const open = SHELL.indexOf("{", head);
  let depth = 0;
  for (let i = open; i < SHELL.length; i++) {
    if (SHELL[i] === "{") depth++;
    if (SHELL[i] === "}" && --depth === 0) return SHELL.slice(open + 1, i);
  }
  throw new Error(`@keyframes ${name} is not closed`);
}

describe("mobile page entrance", () => {
  it("animates nothing that would pull the fixed action bar off the screen", () => {
    const rule = SHELL.match(/main\s*>\s*\*\s*\{[^}]*?animation:\s*([\w-]+)/);
    expect(rule, "the page entrance rule moved; point this test at it").not.toBeNull();

    const properties = [...keyframesBody(rule![1]).matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]);
    expect(properties.length).toBeGreaterThan(0);
    expect(properties.filter((property) => TRAPS_FIXED.has(property))).toEqual([]);
  });
});
