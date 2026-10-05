/**
 * The Brihat Samhita's hand passages as the palm reading takes them: the
 * right chapter for the reader, only what the content line lets through, and
 * nothing that names the book, which the owner chose the palm reading never
 * does.
 */
import { describe, expect, it } from "vitest";
import samhita from "@/lib/knowledge/corpus/brihat-samhita-1884.json";
import { knowledgeCorpusSchema } from "@/lib/knowledge/corpus";
import { PALM_READERS } from "@/lib/palm-readings/reader";
import { classicalHandPassages, classicalHandSection } from "@/lib/palm-readings/classical-hand";

const passages = knowledgeCorpusSchema.parse(samhita).passages;
const handOf = (chapter: number) =>
  passages.filter((passage) => passage.chapter === chapter && passage.hand && !passage.withheld).map((passage) => passage.text);

describe("the palm reading's classical hand marks", () => {
  it("give a man chapter 68's hand passages, a woman chapter 70's, and both to a reader who did not say", () => {
    expect(handOf(68).length).toBeGreaterThan(5);
    expect(handOf(70).length).toBeGreaterThan(2);
    expect(classicalHandPassages("man")).toEqual(handOf(68));
    expect(classicalHandPassages("woman")).toEqual(handOf(70));
    expect(classicalHandPassages("unspecified")).toEqual([...handOf(68), ...handOf(70)]);
  });

  it("are about the hand", () => {
    for (const text of classicalHandPassages("unspecified")) {
      expect(text).toMatch(/hand|palm|finger|thumb|nail|wrist|line/i);
    }
  });

  it("keep to the content line: no lifespan, death, disease or caste", () => {
    const all = classicalHandPassages("unspecified").join("\n");
    expect(all).not.toMatch(
      /\b(die|dies|died|death|dead|hundred years|years of age|live (to|for)|disease\w*|blind\w*|widow\w*|eunuch\w*|hermaphrodit\w*|castes?|prostitut\w*|harlot\w*)\b/i,
    );
  });

  it.each(PALM_READERS)("tell the model, for a reader who is %s, to name no text, chapter or verse, and name none itself", (reader) => {
    const section = classicalHandSection(reader);
    expect(section).toContain("Do not name, cite or quote the text, its chapter or its verse");
    expect(section).not.toMatch(/Brihat|Samhita|Varaha|Iyer|chapter \d|verse \d/i);
  });
});
