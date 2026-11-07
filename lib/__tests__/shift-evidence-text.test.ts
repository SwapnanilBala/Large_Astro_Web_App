/**
 * The evidence line under a life chapter ("Cycle: ~18.6 years | Rahu:
 * Capricorn / H6"), printed in the reader's language from the parts the
 * engine sends (app/(desktop)/insights/components/life-shift-labels.ts
 * shiftEvidence). The English rebuilt from the catalog has to be the engine's
 * own line, word for word, on real charts and every kind of chapter.
 */
import { describe, expect, it } from "vitest";
import { getChartPayload, readChartParams } from "@/lib/chart-params";
import { computeMajorLifeShifts } from "@/lib/engines/major-shifts-engine";
import { shiftEvidence } from "@/app/(desktop)/insights/components/life-shift-labels";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import de from "@/messages/de.json";

type Tree = { [key: string]: string | Tree };

function translator(tree: Tree) {
  return (key: string, params?: Record<string, string>) => {
    let node: string | Tree | undefined = tree;
    for (const part of key.split(".")) node = typeof node === "object" ? node[part] : undefined;
    if (typeof node !== "string") return key;
    return node.replace(/\{(\w+)\}/g, (whole, name: string) => params?.[name] ?? whole);
  };
}

const CHARTS = [
  { name: "Chart A", birthDate: "1992-02-20", birthTime: "08:30", timezoneOffsetMinutes: "-300", latitude: "40.7128", longitude: "-74.0060" },
  { name: "Chart B", birthDate: "1975-11-03", birthTime: "23:45", timezoneOffsetMinutes: "330", latitude: "19.0760", longitude: "72.8777" },
  { name: "Chart C", birthDate: "2001-07-14", birthTime: "05:05", timezoneOffsetMinutes: "60", latitude: "48.8566", longitude: "2.3522" },
  { name: "Chart D", birthDate: "1958-09-30", birthTime: "14:20", timezoneOffsetMinutes: "540", latitude: "35.69", longitude: "139.69" },
];

const SHIFTS = CHARTS.flatMap((chart) =>
  computeMajorLifeShifts(
    getChartPayload(
      readChartParams({ ...chart, country: "X", state: "Y", city: "Z", engineId: "lahiri_classic", birthTimeAccuracy: "exact" }),
    ),
  ),
);

describe("a life chapter's evidence line in the reader's language", () => {
  it("covers every kind of chapter", () => {
    expect(new Set(SHIFTS.map((shift) => shift.kind))).toEqual(
      new Set(["mahadasha", "saturn-return", "jupiter-return", "nodal-return"]),
    );
  });

  it("rebuilds the engine's English word for word", () => {
    for (const shift of SHIFTS) {
      expect(shift.evidenceParts?.length).toBeGreaterThan(0);
      expect(shiftEvidence(shift, translator(en as Tree), "en-US")).toBe(shift.evidence);
    }
  });

  it("leaves no English in Hindi, and writes German decimals with a comma", () => {
    for (const shift of SHIFTS) {
      expect(shiftEvidence(shift, translator(hi as Tree), "hi-IN")).not.toMatch(/[A-Za-z]/);
    }
    const nodal = SHIFTS.find((shift) => shift.kind === "nodal-return")!;
    expect(shiftEvidence(nodal, translator(de as Tree), "de-DE")).toMatch(/^Zyklus: etwa 18,6 Jahre \| Rahu: \S+ \/ Haus \d+/);
  });

  it("prints the engine's English for a chapter sent without parts", () => {
    const [first] = SHIFTS;
    expect(shiftEvidence({ ...first, evidenceParts: undefined }, translator(hi as Tree), "hi-IN")).toBe(first.evidence);
  });
});
