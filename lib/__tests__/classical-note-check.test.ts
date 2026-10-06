/**
 * The checks a classical note passes before it ships: written in the reader's
 * script, and free of what the content line forbids. The samples are the
 * measured failures (2026-10-06) and the words most likely to be flagged
 * wrongly: the lord of a sign, Jupiter's name, the Strijataka's.
 */
import { describe, expect, it } from "vitest";
import { YOGA_DEFINITIONS } from "../engines/yoga-engine";
import { AREA_NAMES } from "../knowledge/area-classics-reading";
import type { ClassicalReading } from "../knowledge/classical-reading";
import {
  ENFORCED_LANGUAGES,
  MIN_SCRIPT_SHARE,
  bannedTerms,
  checkNote,
  noteText,
  scriptShare,
} from "../knowledge/classical-note-check";
import { KNOWLEDGE_SOURCES } from "../knowledge/sources";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";

const note = (...texts: string[]): ClassicalReading => ({
  segments: texts.map((text, index) => ({ text, sources: [index + 1] })),
  sources: [],
});

/* Haiku's own words on 2026-10-06, a Hindi note that kept the yoga names in
   Latin letters as the prompt asks, and an English one sent to a Hindi reader. */
const HINDI_WITH_NAMES =
  "Brihat Jataka के अनुसार, आपका Ardha Chandra Yoga आपको सर्वप्रिय, सुखद स्वभाव वाला और सभी द्वारा सम्मानित[1] बनाता है।";
const ENGLISH = "The Brihat Jataka holds that with Venus in your 10th house from the Moon, you gain wealth through your partner.[1]";
const BENGALI =
  "স্ত্রীজাতকে বলা হয়েছে যে আপনার উঠন্ত রাশি এবং চন্দ্র উভয়ই বিষম রাশিতে থাকায় আপনি দুঃখী হবেন[1]।";

describe("the script", () => {
  it("counts a Hindi note that keeps yoga and book names in Latin letters as Hindi", () => {
    expect(scriptShare(HINDI_WITH_NAMES, "hi")).toBe(1);
    expect(scriptShare(BENGALI, "bn")).toBe(1);
  });

  it("scores an English note 0 for a Hindi or Bengali reader, capitalised names or not", () => {
    expect(scriptShare(ENGLISH, "hi")).toBe(0);
    expect(scriptShare(ENGLISH, "bn")).toBe(0);
    // Devanagari is not Bengali script.
    expect(scriptShare(HINDI_WITH_NAMES, "bn")).toBe(0);
  });

  it("counts English words left inside a Hindi sentence against it", () => {
    const share = scriptShare("मैं आपकी yogas के बारे में लिखने के लिए तैयार हूँ", "hi")!;
    expect(share).toBeGreaterThan(MIN_SCRIPT_SHARE);
    expect(share).toBeLessThan(1);
  });

  it("has nothing to say about a language written in Latin letters", () => {
    for (const code of ["en", "de", "es", "fr", "it", "constructor"]) expect(scriptShare(ENGLISH, code)).toBeNull();
  });
});

describe("the content line", () => {
  it.each([
    ["en", "Free from fear and disease.", ["disease"]],
    ["en", "Her husband's travels; your wife", ["husband", "wife"]],
    ["en", "Widowhood, and a short-lived marriage.", ["widowhood", "short-lived"]],
    ["hi", "आपके पति-पत्नी संबंध", ["पति", "पत्नी"]],
    ["hi", "रोगों से मुक्ति", ["रोगों"]],
    ["bn", "আপনার স্ত্রী বিদেশে যাবেন", ["স্ত্রী"]],
    ["bn", "রোগের ভয় নেই, মৃত্যুর কথা", ["রোগের", "মৃত্যুর"]],
    // English slips into a Hindi or Bengali note, so both are read for it.
    ["bn", "আপনি ধনী হবেন, freedom from disease", ["disease"]],
    ["de", "Er befreit dich von Krankheit und Krankheiten.", ["krankheit", "krankheiten"]],
    ["es", "Tu esposa y una enfermedad.", ["esposa", "enfermedad"]],
    ["fr", "Ton épouse, ta maladie.", ["épouse", "maladie"]],
    ["it", "Tua moglie e la malattia.", ["moglie", "malattia"]],
  ] as const)("finds, in %s, the words of %j", (code, text, terms) => {
    expect(bannedTerms(text, code)).toEqual(terms);
  });

  it.each([
    // पति inside Jupiter's name, a lord, a general.
    ["hi", "बृहस्पति लग्न के अधिपति हैं, और आप सेनापति के समान हैं।"],
    // स्वामी and স্বামী are a sign's lord; आयु is age, and marrying late may be said.
    ["hi", "चंद्र राशि स्वामी शुक्र है; अधिक आयु में विवाह।"],
    ["bn", "চন্দ্র রাশি স্বামী শুক্র; নবম ভাব স্বামী বৃহস্পতি।"],
    // The Strijataka by name, run together or not, and a feminine sign.
    ["bn", "স্ত্রীজাতক অনুসারে, স্ত্রী জাতকে বলা হয়, স্ত্রী-জাতক, স্ত্রী রাশিতে।"],
    // Classical, memory, darkness, thin: words that hold a banned one.
    ["bn", "শাস্ত্রীয় স্মৃতি, অন্ধকার, রোগা শরীর।"],
    ["hi", "आरोग्य, अंधेरा, अमृत।"],
    ["en", "Animal husbandry, a partner who leaves, more than one marriage, romance."],
    // German's article is not English's verb.
    ["de", "Die Ehe, die Partnerschaft und die Liebe."],
  ] as const)("leaves, in %s, %j alone", (code, text) => {
    expect(bannedTerms(text, code)).toEqual([]);
  });

  it("finds a word typed with a precomposed nukta letter", () => {
    const precomposed = `हिज${String.fromCodePoint(0x095c)}ा`;
    expect(precomposed).not.toBe(precomposed.normalize("NFC"));
    expect(bannedTerms(`वह ${precomposed} है`, "hi")).toEqual(["हिजड़ा".normalize("NFC")]);
  });

  it("reads a language it has no list for as English", () => {
    expect(bannedTerms("A note about disease.", "constructor")).toEqual(["disease"]);
  });
});

describe("what is never flagged", () => {
  it("no yoga's name, area's name or book's name and description", () => {
    const names = [
      ...YOGA_DEFINITIONS.map((definition) => definition.name),
      ...Object.values(AREA_NAMES),
      ...Object.values(KNOWLEDGE_SOURCES).flatMap((book) => [book.title, book.author, book.described]),
    ];
    expect(names.filter((name) => bannedTerms(name, "en").length > 0)).toEqual([]);
  });

  /* The planets, signs, nakshatras, elements and areas are what a note in
     any language names; one of them flagged would retry every note that
     mentions it. */
  const CATALOGS: Record<string, Record<string, unknown>> = { en, es, bn, hi, it: it_, fr, de };
  const VOCABULARY = ["planetNames", "zodiacSigns", "nakshatraNames", "zodiacElements", "lifeDomains"];
  const strings = (node: unknown): string[] =>
    typeof node === "string" ? [node] : node && typeof node === "object" ? Object.values(node).flatMap(strings) : [];

  it.each(Object.keys(CATALOGS))("no chart word in the %s catalog", (code) => {
    const words = VOCABULARY.flatMap((namespace) => strings(CATALOGS[code][namespace]));
    expect(words.length).toBeGreaterThan(20);
    expect(words.filter((word) => bannedTerms(word, code).length > 0)).toEqual([]);
  });
});

describe("checking a note", () => {
  it("joins the note's segments, without its sources", () => {
    expect(noteText(note("One,", " two."))).toBe("One, two.");
  });

  it("stops an English note for a Hindi or Bengali reader", () => {
    for (const code of ["hi", "bn"]) {
      expect(checkNote(note(ENGLISH), code)).toEqual({ problems: [{ kind: "script", share: 0 }], blocks: true });
    }
  });

  it("stops a Hindi note that says what the content line forbids", () => {
    expect(checkNote(note("आप रोगों से मुक्त रहेंगे।[1]"), "hi")).toEqual({
      problems: [{ kind: "content", terms: ["रोगों"] }],
      blocks: true,
    });
  });

  it("passes a clean note in any language", () => {
    expect(checkNote(note(HINDI_WITH_NAMES), "hi")).toEqual({ problems: [], blocks: false });
    expect(checkNote(note(BENGALI), "bn")).toEqual({ problems: [], blocks: false });
    expect(checkNote(note(ENGLISH), "en")).toEqual({ problems: [], blocks: false });
  });

  it("only reports a banned word outside Hindi and Bengali", () => {
    expect([...ENFORCED_LANGUAGES].sort()).toEqual(["bn", "hi"]);
    expect(checkNote(note("Der Anapha Yoga befreit dich von Krankheit.[1]"), "de")).toEqual({
      problems: [{ kind: "content", terms: ["krankheit"] }],
      blocks: false,
    });
  });
});
