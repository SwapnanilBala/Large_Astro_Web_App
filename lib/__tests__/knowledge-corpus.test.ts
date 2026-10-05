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
import { NAKSHATRAS } from "../engines/panchanga";
import {
  chapterScanAgreementFloor,
  knowledgeCorpusSchema,
  passageId,
  scanAgreementFloor,
} from "../knowledge/corpus";
import { PLACEMENT_KEYS, nakshatraKey } from "../knowledge/placements";
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
          expect(median, `chapter ${chapter}`).toBeGreaterThanOrEqual(chapterScanAgreementFloor(corpus.source));
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

  /* Chapter 24, on women's charts, joined the life chapters in prompt v5 (2026-10-05). */
  const LIFE_CHAPTERS = [10, 17, 18, 19, 20, 21, 24];

  it("keeps the chapter on women's charts to women's charts", () => {
    // Every chapter-24 verse with a condition of its own also needs the
    // reader to have said she is a woman; one with none stays unmatched.
    const unguarded = (corpus?.passages ?? []).filter(
      (passage) =>
        passage.chapter === 24 &&
        passage.placements.length + passage.placementsAny.length > 0 &&
        !passage.placements.includes("reader.sex.female"),
    );
    expect(unguarded.map((passage) => passage.id)).toEqual([]);
  });

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
      /\b(die|dies|died|dying|death|dead|kill\w*|blind\w*|lepro\w*|leper|thie(f|ves)|theft|robber\w*|murder\w*|castes?|outcastes?|chandala|prostitut\w*|harlot\w*|courtesans?|widow\w*|eunuch\w*|hermaphrodit\w*|impoten\w*|barren|immoral\w*|bad\s+wom[ae]n)\b/i;
    const found = (corpus?.passages ?? [])
      .filter((passage) => !passage.withheld && !(passage.id in ALLOWED))
      .flatMap((passage) => {
        const match = `${passage.text} ${passage.notes ?? ""}`.match(FORBIDDEN);
        return match ? [`${passage.id}: ${match[0]}`] : [];
      });
    expect(found).toEqual([]);
  });

  it("shows few or no children, as the owner decided, but not a child's death", () => {
    // 2026-10-04: having few children or none is "inherently not a problem";
    // a child's death still falls under the rule against death. By the words,
    // not the refs: prompt v5 re-split the chapters and renumbered the parts.
    const shown = (corpus?.passages ?? []).filter((passage) => !passage.withheld);
    expect(shown.filter((passage) => /\b(very few|no) (sons|children)\b/i.test(passage.text)).length).toBeGreaterThan(5);
    expect(shown.filter((passage) => /lose his (sons|children)|loss of (his )?(sons|children)/i.test(passage.text))).toEqual([]);
  });

  it("prints 'may have no children' for barren, and keeps 'a woman of low deeds' hidden, as the owner decided", () => {
    // 2026-10-05: "show barren as 'may have no children' ... keep the 'a woman
    // of low deeds' and 'dirty women' hidden".
    const find = (ref: string) => corpus?.passages.find((passage) => passage.id === "brihat-jataka-1885:" + ref);
    expect(find("24.5.20")?.withheld).toBe(false);
    expect(find("24.5.20")?.text).toMatch(/she \[may have no children\]\.$/);
    expect(find("18.20.75")?.withheld).toBe(true);
    expect(find("18.20.75")?.withheldReason).toBe('the owner keeps "a woman of low deeds" hidden');
  });

  it("prints 'multiple illicit relationships' for 'bad women', and shows 'unchaste' as printed, as the owner decided", () => {
    const find = (ref: string) => corpus?.passages.find((passage) => passage.id === "brihat-jataka-1885:" + ref);
    expect(find("18.15.4")?.text).toMatch(/fond of \[multiple illicit relationships\]\.$/);
    expect(find("18.15.4")?.withheld).toBe(false);
    expect(find("24.3.1")?.withheld).toBe(false);
    expect(find("24.3.1")?.text).toContain("unchaste before marriage");
  });

  it("shows adultery, for men as for women, as the owner decided", () => {
    // 2026-10-05: "Adultery is fine, not too bad, same do it for men as well".
    const shown = (corpus?.passages ?? []).filter((passage) => !passage.withheld);
    const said = shown.filter((passage) => /wives of other men|commit adultery/i.test(passage.text));
    expect(said.length).toBeGreaterThan(3);
    expect(said.some((passage) => passage.chapter === 14)).toBe(true); // a yoga chapter, shown by hand
    expect(said.some((passage) => passage.chapter === 18)).toBe(true); // a life chapter, shown by prompt v5
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

describe("the Strijataka corpus", () => {
  const corpus = corpora.find(({ corpus }) => corpus.source === "strijataka-1931")?.corpus;
  const passages = corpus?.passages ?? [];
  const shown = passages.filter((passage) => !passage.withheld);

  it("is present, with most of the house, sign and star passages matched to a chart", () => {
    // Measured on the 2026-10-05 build: 516 of 625 shown passages carry
    // conditions; the rest are the author's discussion, or need a navamsa
    // lord, a trimsamsa or "a benefic" the keys cannot state.
    expect(corpus).toBeDefined();
    const keyed = shown.filter((passage) => passage.placements.length + passage.placementsAny.length > 0);
    expect(keyed.length).toBeGreaterThan(450);
  });

  it("keeps every passage to women's charts, and away from the yoga notes every reader gets", () => {
    const unguarded = passages.filter(
      (passage) =>
        passage.placements.length + passage.placementsAny.length > 0 && !passage.placements.includes("reader.sex.female"),
    );
    expect(unguarded.map((passage) => passage.id)).toEqual([]);
    expect(passages.filter((passage) => passage.yogaIds.length > 0).map((passage) => passage.id)).toEqual([]);
  });

  it("reaches a woman through her birth star, for all twenty-seven", () => {
    const stars = new Set(
      shown.flatMap((passage) => passage.placements).filter((key) => key.startsWith("Moon.nakshatra.")),
    );
    expect([...stars].sort()).toEqual(NAKSHATRAS.map((name) => `Moon.nakshatra.${nakshatraKey(name)}`).sort());
  });

  it("prints the owner's wording for the book's words for a prostitute, and keeps the book's own words aside", () => {
    // 2026-10-05: "calling prostitute is a bit too bold and some people might
    // get hurt ... multiple illicit relationships would be better".
    const reworded = passages.filter((passage) => /prostitut|whore|harlot|courtesan/i.test(passage.printedText ?? ""));
    expect(reworded.length).toBeGreaterThan(0);
    for (const passage of reworded) {
      expect(passage.text, passage.id).toMatch(/\[[^\]]*multiple illicit relationships[^\]]*\]/i);
      expect(passage.text, passage.id).not.toMatch(/prostitut|whore|harlot|courtesan/i);
    }
  });

  it("prints 'may have no children' for barren, as the owner worded it", () => {
    // 2026-10-05: "show barren as 'may have no children'".
    const reworded = passages.filter((passage) => /\bbarren\b/i.test(passage.printedText ?? ""));
    expect(reworded.map((passage) => passage.id)).toContain("strijataka-1931:6.9.4");
    for (const passage of reworded) {
      expect(passage.text, passage.id).toContain("[may have no children]");
      expect(passage.withheld, passage.id).toBe(false);
    }
  });

  it("holds back, until the owner words them, only labels the owner has not yet seen", () => {
    // The owner asked to see these before any is shown ("if you find similar
    // stuff let me know I will recommend"). Every one they have seen is
    // settled (build-shared.ts): said plainly, reworded, or hidden for good.
    const waiting = passages.filter((passage) => passage.withheldReason?.startsWith("awaiting the owner's wording"));
    expect(waiting.every((passage) => passage.withheld)).toBe(true);
    const settled =
      /adulter|free with other men|going wrong|free in her sexual intercourse|unchaste|chaste|bad character|bad conduct|a bad one|bad in morality|questionable|barren|immoral|bad women|low deeds|dirty women/;
    expect(waiting.filter((passage) => settled.test(passage.withheldReason ?? "")).map((passage) => passage.id)).toEqual([]);
  });

  it("prints the owner's words for 'immoral', and says 'bad character', 'unchaste' and 'questionable morals' plainly", () => {
    // 2026-10-05: "Unchaste sounds fine, keep multiple illicit relationships,
    // bad character is fine and then keep the questionable morals".
    const find = (ref: string) => passages.find((passage) => passage.id === "strijataka-1931:" + ref);
    expect(find("4.5.2")?.text).toContain("the husband will be [given to multiple illicit relationships]");
    expect(find("11.2.3")?.text).toContain("fall into [multiple illicit relationships]");
    expect(find("7.4.1")?.withheld).toBe(false);
    expect(find("7.4.1")?.text).toContain("bad character");
    expect(find("10.28.4")?.text).toBe("[Sani in 4 —] questionable morals"); // the scan reads "morais"
    // Not cleared with "immoral": it is how the passage says a son is not his father's.
    expect(find("6.6.2")?.withheld).toBe(true);
  });

  it("shows adultery, as the owner decided, but not a slur on someone's birth", () => {
    // 2026-10-05: "Adultery is fine, not too bad". "Born of adultery" is about
    // the husband's birth, which the content line withholds as low birth.
    const said = shown.filter((passage) => /adulter|free with other men/i.test(passage.text));
    expect(said.map((passage) => passage.id)).toContain("strijataka-1931:5.2.5");
    expect(shown.some((passage) => /born of adultery/i.test(passage.text))).toBe(false);
  });

  it("shows no passage that speaks of death, crime, caste, or brands a woman", () => {
    const ALLOWED: Record<string, string> = {
      "strijataka-1931:11.1.4": "'love is blind', a proverb, in the author's discussion of beauty",
    };
    const FORBIDDEN =
      /\b(die|dies|died|dying|death|dead|kill\w*|poison\w*|blind\w*|lepro\w*|leper|thie(f|ves|vish)|theft|robber\w*|murder\w*|castes?|outcastes?|chandala|brahmin\w*|sudras?|prostitut\w*|whores?|harlots?|courtesans?|immoral\w*|bad\s+wom[ae]n|wanton|barren|widow\w*|eunuchs?|hermaphrodit\w*|impoten\w*)\b/i;
    const found = shown
      .filter((passage) => !(passage.id in ALLOWED))
      .flatMap((passage) => {
        const match = `${passage.text} ${passage.notes ?? ""}`.match(FORBIDDEN);
        return match ? [`${passage.id}: ${match[0]}`] : [];
      });
    expect(found).toEqual([]);
  });
});

describe("the Brihat Samhita corpus", () => {
  const corpus = corpora.find(({ corpus }) => corpus.source === "brihat-samhita-1884")?.corpus;
  const passages = corpus?.passages ?? [];
  const shown = passages.filter((passage) => !passage.withheld);

  it("holds the chapters on the features of men and of women, with their hand passages marked", () => {
    expect(new Set(passages.map((passage) => passage.chapter))).toEqual(new Set([68, 70]));
    for (const chapter of [68, 70]) {
      expect(shown.some((passage) => passage.chapter === chapter && passage.hand), `chapter ${chapter}`).toBe(true);
    }
  });

  it("never reaches a chart-driven note: no chart conditions, no yoga ids", () => {
    const reachable = passages.filter(
      (passage) => passage.placements.length + passage.placementsAny.length + passage.yogaIds.length > 0,
    );
    expect(reachable.map((passage) => passage.id)).toEqual([]);
  });

  it("shows no lifespan, death, disease, caste or the rest", () => {
    // A long life counts here too: the palm reading says no line fixes a lifespan.
    const FORBIDDEN =
      /\b(die|dies|died|dying|death|dead|kill\w*|hundred years|years of age|blind\w*|lepro\w*|leper|thie(f|ves)|theft|murder\w*|castes?|outcastes?|chandala|prostitut\w*|harlot\w*|courtesans?|widow\w*|eunuchs?|hermaphrodit\w*|impoten\w*|barren|immoral\w*|bad\s+wom[ae]n)\b/i;
    const found = shown.flatMap((passage) => {
      const match = `${passage.text} ${passage.notes ?? ""}`.match(FORBIDDEN);
      return match ? [`${passage.id}: ${match[0]}`] : [];
    });
    expect(found).toEqual([]);
  });
});
