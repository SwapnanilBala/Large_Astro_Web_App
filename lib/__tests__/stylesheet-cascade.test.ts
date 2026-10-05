import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Phone and tablet overrides that can never apply.
 *
 * globals.css and insights-global.css hold rules of equal specificity, so
 * order settles them: insights-global.css loads after globals.css, and within
 * a file the later rule wins. An @media override that comes before the rule it
 * overrides is dead -- silently, at every width. That is how the dasha panel's
 * "Current life chapter" card ended up printing "Rahu to Moon" one letter per
 * line on a phone: its base rule moved to insights-global.css in the split
 * (4a4bee8) and the phone override stayed behind in globals.css, along with 62
 * others.
 *
 * A later rule under the same condition replacing an earlier one is ordinary
 * and allowed; what fails is an override beaten by a rule that applies at
 * every width.
 */

type Declaration = { selector: string; prop: string; media: string; line: number };

/* Enough of a reader for these two files, which are plain CSS without
   nesting: comments out, then blocks by brace depth, with the @media
   conditions around each rule. */
function declarations(css: string): Declaration[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const found: Declaration[] = [];
  const stack: string[] = [];
  let buffer = "";
  let line = 1;
  let bufferLine = 1;

  const splitSelectors = (header: string) => {
    const parts: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of header) {
      if (ch === "(" || ch === "[") depth++;
      if (ch === ")" || ch === "]") depth--;
      if (ch === "," && depth === 0) {
        parts.push(current);
        current = "";
      } else current += ch;
    }
    parts.push(current);
    return parts.map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
  };

  const inRule = () => stack.length > 0 && !stack[stack.length - 1].startsWith("@");
  const skipped = () => stack.some((header) => /^@(keyframes|font-face)/.test(header));
  const media = () =>
    stack
      .filter((header) => header.startsWith("@media"))
      .map((header) => header.replace(/\s+/g, " ").trim())
      .join(" && ");

  const flushDeclaration = () => {
    const body = buffer.trim();
    buffer = "";
    if (!body || !inRule() || skipped()) return;
    const colon = body.indexOf(":");
    if (colon < 0 || /!important\s*$/.test(body)) return;
    const prop = body.slice(0, colon).trim();
    for (const selector of splitSelectors(stack[stack.length - 1])) {
      found.push({ selector, prop, media: media(), line: bufferLine });
    }
  };

  for (const ch of text) {
    if (ch === "{") {
      stack.push(buffer.replace(/\s+/g, " ").trim());
      buffer = "";
    } else if (ch === "}") {
      flushDeclaration();
      stack.pop();
    } else if (ch === ";") {
      flushDeclaration();
    } else {
      if (!buffer.trim() && ch.trim()) bufferLine = line;
      buffer += ch;
    }
    if (ch === "\n") line++;
  }
  return found;
}

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const GLOBALS = "app/globals.css";
const INSIGHTS = "app/(desktop)/insights/insights-global.css";
const describeDecl = (d: Declaration) => `${d.media} ${d.selector} { ${d.prop} } (line ${d.line})`;

describe("stylesheet cascade", () => {
  const globals = declarations(read(GLOBALS));
  const insights = declarations(read(INSIGHTS));

  it("reads both stylesheets", () => {
    /* a guard on the reader itself: an empty result would pass everything */
    expect(globals.length).toBeGreaterThan(1000);
    expect(insights.length).toBeGreaterThan(1000);
    expect(globals.some((d) => d.selector === ".error-card" && d.media.includes("640px"))).toBe(true);
  });

  it("keeps the dasha card's phone layout where it can win", () => {
    expect(
      insights.some((d) => d.selector === ".dasha-command-hero" && d.prop === "grid-template-columns" && d.media.includes("680px")),
    ).toBe(true);
  });

  it("leaves no override in globals.css that insights-global.css beats", () => {
    const dead = globals.filter(
      (g) =>
        g.media &&
        insights.some(
          (i) => i.selector === g.selector && i.prop === g.prop && (i.media === "" || i.media === g.media),
        ),
    );
    /* Move these into insights-global.css, after the rule they override. */
    expect(dead.map(describeDecl)).toEqual([]);
  });

  it.each([
    [GLOBALS, globals],
    [INSIGHTS, insights],
  ])("has no override in %s beaten by a later rule for every width", (_file, list) => {
    const dead = list.filter((m, index) =>
      m.media &&
      list.some((b, later) => later > index && b.media === "" && b.selector === m.selector && b.prop === m.prop),
    );
    /* Move the override below the rule it overrides. */
    expect(dead.map(describeDecl)).toEqual([]);
  });
});
