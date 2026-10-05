/**
 * Both reading-room stylesheets define every class the shared room uses.
 *
 * ReadingRoom and its builders (app/components/reading-room) take their class
 * names from whichever stylesheet a tree passes in. A CSS module answers any
 * name it does not define with `undefined`, so a class missing from one file
 * is an unstyled element in one tree only -- no type error, no failing build,
 * nothing on the other tree to compare against.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { READING_ROOM_CLASS_NAMES } from "@/app/components/reading-room/classes";

const STYLESHEETS = {
  desktop: join(process.cwd(), "app", "(desktop)", "insights", "full-reading", "reading-room.module.css"),
  mobile: join(process.cwd(), "app", "m", "insights", "reading-room.module.css"),
};

/* Class names a stylesheet defines: anything written as `.name` outside a
   comment. */
function definedClasses(file: string): Set<string> {
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((match) => match[1]));
}

describe("reading-room stylesheets", () => {
  it.each(Object.entries(STYLESHEETS))("%s defines every class the room uses", (_, file) => {
    const defined = definedClasses(file);
    expect(READING_ROOM_CLASS_NAMES.filter((name) => !defined.has(name))).toEqual([]);
  });

  it("covers every class the room and its builders read", () => {
    /* The other direction: a class the code reads that the contract does not
       list would never be checked above. */
    const dir = join(process.cwd(), "app", "components", "reading-room");
    const used = new Set(
      ["ReadingRoom.tsx", "findings.tsx", "yogas.tsx", "karma.tsx"].flatMap((file) =>
        [...readFileSync(join(dir, file), "utf8").matchAll(/\bc\.(\w+)/g)].map((match) => match[1]),
      ),
    );
    const listed = new Set<string>(READING_ROOM_CLASS_NAMES);
    expect([...used].filter((name) => !listed.has(name))).toEqual([]);
  });
});
