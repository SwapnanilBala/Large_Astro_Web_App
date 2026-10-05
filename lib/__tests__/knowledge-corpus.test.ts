/**
 * The knowledge corpora, checked as data before any of it reaches the database.
 *
 * A corpus file is written by a model reading OCR, so these are the things it
 * could get wrong without anyone noticing: a verse dropped or numbered twice, a
 * yoga id the engine has never heard of (which would silently never match a
 * chart), a withheld passage with no reason, or a "repaired" verse that no
 * longer reads like the scan. The build script refuses all of these too; the
 * tests keep a hand edit to the file from slipping one past it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { YOGA_DEFINITIONS } from "../engines/yoga-engine";
import {
  MIN_CHAPTER_SCAN_AGREEMENT,
  knowledgeCorpusSchema,
  passageId,
  scanAgreementFloor,
} from "../knowledge/corpus";
import { PLACEMENT_KEYS } from "../knowledge/placements";
import { KNOWLEDGE_SOURCES } from "../knowledge/sources";

const CORPUS_DIR = join(process.cwd(), "lib", "knowledge", "corpus");

const corpora = readdirSync(CORPUS_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => ({
    file,
    corpus: knowledgeCorpusSchema.parse(JSON.parse(readFileSync(join(CORPUS_DIR, file), "utf8"))),
  }));

const yogaIds = new Set(YOGA_DEFINITIONS.map((definition) => definition.id));
const placementKeys = new Set(PLACEMENT_KEYS);

describe("knowledge corpora", () => {
  it("exist", () => {
    expect(corpora.length).toBeGreaterThan(0);
  });

  for (const { file, corpus } of corpora) {
    describe(file, () => {
      it("come from a registered source, named after it", () => {
        expect(KNOWLEDGE_SOURCES[corpus.source], corpus.source).toBeDefined();
        expect(file).toBe(`${corpus.source}.json`);
      });

      it("give every passage the id its chapter, verse and part imply, once", () => {
        const ids = corpus.passages.map((passage) => passage.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const passage of corpus.passages) {
          expect(passage.source).toBe(corpus.source);
          expect(passage.id).toBe(passageId(corpus.source, passage.chapter, passage.verse, passage.part));
        }
      });

      it("number each chapter's verses 1..N and each verse's parts 1..M, none missing", () => {
        const chapters = new Map<number, Map<number, number[]>>();
        for (const { chapter, verse, part } of corpus.passages) {
          const verses = chapters.get(chapter) ?? new Map<number, number[]>();
          verses.set(verse, [...(verses.get(verse) ?? []), part]);
          chapters.set(chapter, verses);
        }
        for (const [chapter, verses] of chapters) {
          const numbers = [...verses.keys()];
          expect(numbers, `chapter ${chapter}`).toEqual(numbers.map((_, index) => index + 1));
          for (const [verse, parts] of verses) {
            expect(parts, `${chapter}.${verse}`).toEqual(parts.map((_, index) => index + 1));
          }
        }
      });

      it("keep some of every verse's own words, not only notes on it", () => {
        const verses = new Set(corpus.passages.map((p) => `${p.chapter}.${p.verse}`));
        const withText = new Set(corpus.passages.filter((p) => p.kind === "verse").map((p) => `${p.chapter}.${p.verse}`));
        expect([...verses].filter((verse) => !withText.has(verse))).toEqual([]);
      });

      it("tag only yogas the engine knows", () => {
        for (const passage of corpus.passages) {
          expect(passage.yogaIds.filter((id) => !yogaIds.has(id)), passage.id).toEqual([]);
        }
      });

      it("tag only placement keys in the vocabulary, and never offer a single alternative", () => {
        for (const passage of corpus.passages) {
          const keys = [...passage.placements, ...passage.placementsAny];
          expect(keys.filter((key) => !placementKeys.has(key)), passage.id).toEqual([]);
          expect(passage.placementsAny.length, passage.id).not.toBe(1);
        }
      });

      it("give a reason for every withheld passage and for no other", () => {
        for (const passage of corpus.passages) {
          expect(passage.withheldReason !== null, passage.id).toBe(passage.withheld);
        }
      });

      it("keep every passage, and every chapter as a whole, close to the scan it was read from", () => {
        for (const passage of corpus.passages) {
          expect(passage.ocrAgreement, passage.id).toBeGreaterThanOrEqual(scanAgreementFloor(passage));
        }
        for (const chapter of new Set(corpus.passages.map((passage) => passage.chapter))) {
          const scores = corpus.passages
            .filter((passage) => passage.chapter === chapter)
            .map((passage) => passage.ocrAgreement)
            .sort((a, b) => a - b);
          const middle = Math.floor(scores.length / 2);
          const median = scores.length % 2 === 1 ? scores[middle] : (scores[middle - 1] + scores[middle]) / 2;
          expect(median, `chapter ${chapter}`).toBeGreaterThanOrEqual(MIN_CHAPTER_SCAN_AGREEMENT);
        }
      });
    });
  }
});

describe("the Brihat Jataka corpus", () => {
  const corpus = corpora.find(({ corpus }) => corpus.source === "brihat-jataka-1885")?.corpus;

  it("is present", () => {
    expect(corpus).toBeDefined();
  });

  it("tags every yoga the catalogue cites to chapter 12 somewhere in that chapter", () => {
    // All 32 Nabhasa entries cite the chapter. Kedara and Yava did not until
    // 2026-10-04: Yava's rule then (planets paired two to a sign) was not the
    // one the chapter gives, so its verses were left untagged. Both moved in
    // with the family when Yava was corrected, and are held to it like the rest.
    const tagged = new Set(
      corpus?.passages.filter((passage) => passage.chapter === 12).flatMap((passage) => passage.yogaIds),
    );
    const cited = YOGA_DEFINITIONS.filter((definition) => definition.source?.startsWith("Brihat Jataka ch. 12"));
    expect(cited.length).toBeGreaterThanOrEqual(32);
    expect(cited.map((definition) => definition.id).filter((id) => !tagged.has(id))).toEqual([]);
  });

  const LIFE_CHAPTERS = [10, 17, 18, 19, 20, 21];

  it("covers the life chapters, with most of the Moon, sign and house verses tagged by placement", () => {
    // Measured on the 2026-10-04 build: of the passages shown, 63 of 65 in
    // chapter 17, 93 of 115 in chapter 18 and 54 of 70 in chapter 20 carry
    // placement keys. The rest are general rules, or need a navamsa lord or
    // an either/or the build did not yet ask for. Chapters 10 and 21 rest on
    // divisional lords and are reached by none.
    const chapters = new Set(corpus?.passages.map((passage) => passage.chapter));
    for (const chapter of LIFE_CHAPTERS) expect(chapters.has(chapter), `chapter ${chapter}`).toBe(true);
    const share = (chapter: number) => {
      const shown = corpus?.passages.filter((passage) => passage.chapter === chapter && !passage.withheld) ?? [];
      return shown.filter((passage) => passage.placements.length + passage.placementsAny.length > 0).length / shown.length;
    };
    expect(share(17)).toBeGreaterThan(0.9);
    expect(share(18)).toBeGreaterThan(0.75);
    expect(share(20)).toBeGreaterThan(0.7);
  });

  it("keeps placement keys off the yoga chapters, which are reached by their yoga ids", () => {
    const tagged = corpus?.passages.filter(
      (passage) =>
        !LIFE_CHAPTERS.includes(passage.chapter) && passage.placements.length + passage.placementsAny.length > 0,
    );
    expect(tagged?.map((passage) => passage.id)).toEqual([]);
  });

  it("shows no passage that speaks of death, crime, caste and the rest", () => {
    // A reading quotes its sources word for word, so a withheld topic in a
    // shown passage is printed even when the note itself steers clear. Words
    // a passage may use harmlessly are listed with the reason.
    const ALLOWED: Record<string, string> = {
      "brihat-jataka-1885:15.1.2": "an ascetic life kept 'till death' means for life",
    };
    const FORBIDDEN =
      /\b(die|dies|died|dying|death|dead|kill\w*|blind\w*|lepro\w*|leper|thie(f|ves)|theft|robber\w*|murder\w*|castes?|outcastes?|chandala|prostitut\w*|adulter\w*|harlot\w*|widow\w*|eunuch\w*|impoten\w*|childless|barren)\b/i;
    const found = (corpus?.passages ?? [])
      .filter((passage) => !passage.withheld && !(passage.id in ALLOWED))
      .flatMap((passage) => {
        const match = `${passage.text} ${passage.notes ?? ""}`.match(FORBIDDEN);
        return match ? [`${passage.id}: ${match[0]}`] : [];
      });
    expect(found).toEqual([]);
  });

  it("shows three passages of the malefic-yogas chapter, the marriage ones, each tied only to its own yoga", () => {
    // The owner's line, 2026-10-04: a spouse leaving, more than one marriage and
    // marrying late can be shown; a spouse's death, disability and disease
    // cannot. Each passage is tagged only with the yoga built from it, so the
    // same planets elsewhere never pull it in.
    const shown = corpus?.passages.filter((passage) => passage.chapter === 23 && !passage.withheld) ?? [];
    expect(shown.map((passage) => [passage.id, passage.yogaIds])).toEqual([
      ["brihat-jataka-1885:23.1.4", ["kalatra_chandra_shani"]],
      ["brihat-jataka-1885:23.1.7", ["kalatra_chandra_shukra"]],
      ["brihat-jataka-1885:23.5.4", ["kalatra_mangala_shani"]],
    ]);
    expect(shown[0].text).toMatch(/wife will quit him and marry another/);
    expect(shown[1].text).toMatch(/several wives/);
    expect(shown[2].text).toMatch(/marry late in life/);
    for (const passage of shown) {
      const yoga = YOGA_DEFINITIONS.find((definition) => definition.id === passage.yogaIds[0]);
      expect(yoga?.source, passage.id).toContain("ch. 23");
    }
  });
});
