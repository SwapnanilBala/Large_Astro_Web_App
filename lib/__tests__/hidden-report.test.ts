/**
 * docs/what-the-readings-keep-hidden.md lists every passage the corpora keep
 * hidden. Its second half is generated from the corpus files, so a rebuild
 * that changes what is hidden must regenerate it too.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { report } from "../../scripts/knowledge/hidden-report";

describe("the record of what the readings keep hidden", () => {
  const doc = readFileSync(join(process.cwd(), "docs", "what-the-readings-keep-hidden.md"), "utf8").replace(/\r\n/g, "\n");
  const generated = report();

  it("is up to date with the corpus files (run `npm run knowledge:hidden-report`)", () => {
    expect(doc).toContain(generated);
  });

  it("sorts every hidden passage into a named kind", () => {
    expect(generated).not.toContain("### Other");
  });
});
