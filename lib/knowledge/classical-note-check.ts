import type { ClassicalReading } from "./classical-reading";

/*
 * What a classical note has to pass before a reader sees it, checked in code
 * rather than trusted to the prompt.
 *
 * Both "From the classics" notes are written by Claude Haiku 4.5 since
 * e178ac3, and measured on 2026-10-06 (five charts, the routes' own requests)
 * it did not always keep to its instructions. Asked for Hindi or Bengali,
 * about half its notes either declined, in Hindi and citing nothing, or came
 * back in English; and in any language it now and then said what
 * CLASSICAL_NOTE_RULES forbid ("freedom from disease", "Krankheit"). A
 * decline cites nothing, which the routes already refuse to ship. The other
 * two are caught here:
 *
 * - The script. A Hindi note is written in Devanagari and a Bengali one in
 *   Bengali script, but yoga and book names may stay in Latin letters -- the
 *   yoga prompt asks for the names as given -- so capitalised Latin words,
 *   which in such a note are names, are left out, and the test is a share of
 *   the rest rather than purity. Measured notes in the right language scored
 *   1.00 so counted (0.84 at worst counting the names too) and the English
 *   ones 0, so MIN_SCRIPT_SHARE sits well clear of both.
 * - The content line: the books' words for a spouse, and death, lifespan,
 *   illness, blindness or disability, caste, eunuchs and prostitution, found
 *   as whole words in the note's language, and in English as well for the
 *   two scripts English words slip into.
 *
 * A note that fails is retried once on Opus 5.5 by its route, which is the
 * owner's call for Hindi and Bengali, the languages the measurement found
 * broken. In the others a banned word is only logged and the note still
 * ships, so the logs can show whether enforcing it there would pay.
 */

/** Reader languages in which a failed check keeps a note from shipping. */
export const ENFORCED_LANGUAGES: ReadonlySet<string> = new Set(["hi", "bn"]);

/** The script a note is written in, for the languages not written in Latin letters. */
const SCRIPTS: Record<string, RegExp> = {
  hi: /\p{Script=Devanagari}/u,
  bn: /\p{Script=Bengali}/u,
};

/** The least share of a note's letters that must be in its language's script. */
export const MIN_SCRIPT_SHARE = 0.6;

const WORD = /[\p{L}\p{M}]+/gu;
/** "Brihat", "Kemadruma", "Yoga": a name, which a note in any script may leave in Latin letters. */
const LATIN_NAME = /^\p{Script=Latin}/u;
const CAPITAL = /^\p{Lu}/u;

/**
 * The share of a text's letters, vowel signs included, that are in the
 * language's script, or null for a language written in Latin letters, which a
 * script cannot tell from English. Capitalised Latin words are names and do
 * not count, and nor do digits, punctuation, spaces or citation markers, so an
 * English sentence still scores 0 on its lower-case words.
 */
export function scriptShare(text: string, languageCode: string): number | null {
  const script = Object.hasOwn(SCRIPTS, languageCode) ? SCRIPTS[languageCode] : undefined;
  if (!script) return null;
  let letters = 0;
  let inScript = 0;
  for (const [word] of text.matchAll(WORD)) {
    if (LATIN_NAME.test(word) && CAPITAL.test(word)) continue;
    for (const char of word) {
      letters++;
      if (script.test(char)) inScript++;
    }
  }
  return letters === 0 ? 0 : inScript / letters;
}

/*
 * Whole words only: a term matches where no letter or vowel sign touches it,
 * so पति (husband) is not found inside बृहस्पति (Jupiter) or अधिपति (lord). A
 * trailing "*" lets the word run on, for the endings a language adds to a stem
 * (Bengali মৃত্যুর "of death", German Krankheiten), and is used only where no
 * innocent word shares the stem: "husband*" would catch "husbandry".
 *
 * Left out on purpose, because the same word is one a note has to use: Hindi
 * स्वामी and Bengali স্বামী, which name a sign's or a house's lord as well as
 * a husband; Hindi आयु, which is age, and marrying late may be said; Spanish
 * and Italian casta, which is also "chaste".
 */
const BANNED_TERMS: Record<string, readonly string[]> = {
  en: [
    "husband", "husbands", "wife", "wives", "widow*",
    "death*", "die", "dies", "died", "dying", "dead", "deceased",
    "lifespan*", "life span*", "longevity", "long-lived", "short-lived", "long life",
    "ill health", "illness*", "disease*", "sick", "sickly", "sickness*", "ailment*", "malady", "maladies",
    "blind", "blindness", "disabled", "disability", "disabilities", "deaf", "deafness", "crippled", "lame",
    "caste*", "outcaste*", "low-born", "lowborn",
    "hermaphrodite*", "eunuch*", "prostitut*", "harlot*", "courtesan*",
  ],
  hi: [
    "पति", "पतियों", "पत्नी", "पत्नियाँ", "पत्नियां", "पत्नियों", "भार्या", "बीवी", "शौहर", "विधवा", "विधुर", "पतिव्रता",
    "मृत्यु", "मौत", "मरण", "मरना", "मरने", "मृत", "मृतक", "निधन", "देहांत",
    "दीर्घायु", "अल्पायु", "दीर्घ आयु", "अल्प आयु", "लंबी आयु", "लंबी उम्र",
    "रोग", "रोगों", "रोगी", "रोगमुक्त", "निरोग", "निरोगी", "नीरोग", "बीमार", "बीमारी", "बीमारियाँ", "बीमारियों", "व्याधि",
    "अंधा", "अंधी", "अंधे", "अंधापन", "अन्धा", "अन्धी", "अन्धे", "नेत्रहीन", "विकलांग", "अपंग", "बहरा", "बहरी", "लंगड़ा",
    "जाति", "जातियों", "जातिगत",
    "नपुंसक", "हिजड़ा", "वेश्या", "वेश्याओं", "गणिका",
  ],
  bn: [
    "স্ত্রী", "স্ত্রীর", "স্ত্রীকে", "স্ত্রীদের", "পত্নী*", "ভার্যা*", "বউ", "বধূ", "বিধবা*", "বিপত্নীক", "পতিব্রতা*",
    "মৃত্যু*", "মরণ", "মৃত", "মৃতের", "নিধন", "দীর্ঘায়ু*", "অল্পায়ু*", "আয়ু", "আয়ুর", "আয়ুষ্কাল",
    "রোগ", "রোগে", "রোগের", "রোগী*", "রোগমুক্ত*", "রোগহীন", "নীরোগ*", "নিরোগ*", "অসুখ*", "অসুস্থ*", "ব্যাধি*",
    "অন্ধ", "অন্ধত্ব", "প্রতিবন্ধী*", "পঙ্গু*", "বধির*", "খোঁড়া",
    "জাতি", "জাতিভেদ", "জাতিচ্যুত", "বর্ণভেদ",
    "নপুংসক*", "হিজড়া*", "বেশ্যা*", "পতিতা*", "গণিকা*",
  ],
  de: [
    "Ehemann", "Ehemannes", "Ehemänner*", "Ehefrau*", "Gatte", "Gatten", "Gattin*", "Witwe*",
    "Tod", "Todes*", "tot", "tote", "toten", "toter", "totes", "stirbt", "sterben", "starb", "Sterblichkeit",
    "Lebensdauer", "Langlebigkeit",
    "Krankheit*", "krank", "kranke", "kranken", "kranker", "kränklich*",
    "blind", "blinde", "blinden", "Blindheit", "behindert*", "Behinderung*", "taub", "gelähmt",
    "Kaste", "Kastenwesen",
    "Zwitter*", "Eunuch*", "Prostitu*", "Hure*", "Kurtisane*",
  ],
  es: [
    "marido*", "esposo", "esposos", "esposa", "esposas", "viud*",
    "muerte*", "muere", "mueren", "morir*", "muerto*", "muerta*", "fallec*", "longevidad",
    "enfermedad*", "enfermo", "enfermos", "enferma", "enfermas", "enfermiz*", "dolencia*",
    "ciego*", "ciega*", "ceguera", "discapacid*", "discapacitad*", "sordo*", "sorda*",
    "hermafrodita*", "eunuco*", "prostitu*", "ramera*", "cortesana*",
  ],
  fr: [
    "mari", "maris", "épouse", "épouses", "époux", "veuf*", "veuv*",
    "mort", "morte", "morts", "mortes", "meurt", "meurent", "mourir", "mourra*", "décès", "longévité",
    "maladie*", "malade*", "infirmité*", "infirme*",
    "aveugle*", "cécité", "handicap*", "sourd", "sourde*", "sourds",
    "caste", "castes",
    "hermaphrodite*", "eunuque*", "prostitu*", "courtisane*",
  ],
  it: [
    "marito", "mariti", "moglie", "mogli", "sposo", "sposa", "vedov*",
    "morte", "muore", "muoiono", "morire", "morirà", "morto", "morta", "morti", "decesso", "longevità",
    "malattia", "malattie", "malato", "malata", "malati", "malate", "ammalat*", "infermità",
    "cieco", "cieca", "ciechi", "cecità", "disabil*", "sordo", "sorda",
    "ermafrodit*", "eunuc*", "prostitu*", "cortigiana", "cortigiane",
  ],
};

/*
 * Phrases that hold a banned word but mean something else, blanked before the
 * scan. Bengali স্ত্রী is a wife, but also "female": the Strijataka's own
 * name, and a feminine sign or planet.
 */
const ALLOWED_PHRASES: Record<string, readonly string[]> = {
  bn: ["স্ত্রী জাতক", "স্ত্রী রাশি", "স্ত্রী গ্রহ"],
};

/** The lists a note is read against: its own language's, and English's where English words slip into the script. */
const LISTS: Record<string, readonly string[]> = {
  hi: ["hi", "en"],
  bn: ["bn", "en"],
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A space in a phrase is any run of spaces or hyphens. */
const phrase = (value: string) => escapeRegExp(value.normalize("NFC")).replace(/ /g, "[\\s-]+");

function wordPattern(terms: readonly string[]): RegExp {
  const alternatives = terms.map((term) =>
    term.endsWith("*") ? `${phrase(term.slice(0, -1))}[\\p{L}\\p{M}]*` : `${phrase(term)}(?![\\p{L}\\p{M}])`,
  );
  return new RegExp(`(?<![\\p{L}\\p{M}])(?:${alternatives.join("|")})`, "giu");
}

const PATTERNS = new Map(Object.entries(BANNED_TERMS).map(([code, terms]) => [code, wordPattern(terms)]));
const ALLOWED = new Map(
  Object.entries(ALLOWED_PHRASES).map(([code, phrases]) => [code, new RegExp(phrases.map(phrase).join("|"), "gu")]),
);

/**
 * The content line's words found in a text, as written, each once, in the
 * order the text first uses them. A language without a list of its own is
 * read as English, as the routes treat an unknown language.
 */
export function bannedTerms(text: string, languageCode: string): string[] {
  const code = Object.hasOwn(BANNED_TERMS, languageCode) ? languageCode : "en";
  const lists = Object.hasOwn(LISTS, code) ? LISTS[code] : [code];
  let scanned = text.normalize("NFC");
  const allowed = ALLOWED.get(code);
  if (allowed) scanned = scanned.replace(allowed, (match) => " ".repeat(match.length));
  const found = new Set<string>();
  for (const list of lists) {
    for (const match of scanned.matchAll(PATTERNS.get(list)!)) found.add(match[0].toLowerCase());
  }
  return [...found];
}

/**
 * Why an answer could not be shipped as a note: the model declined, ran out
 * of tokens, cited nothing (a decline in words usually does), or failed
 * checkNote. Each is retried once on Opus 5.5.
 */
export type NoteFailure = "refusal" | "max_tokens" | "uncited" | "check";

export type NoteProblem =
  /** Written mostly outside the reader's script: an English note for a Hindi reader. */
  | { kind: "script"; share: number }
  /** Says what the content line forbids; the words, for the log. */
  | { kind: "content"; terms: string[] };

export type NoteCheck = {
  problems: NoteProblem[];
  /** Whether the problems keep the note from shipping, which they do only in ENFORCED_LANGUAGES. */
  blocks: boolean;
};

/** The words of a note as the reader sees them, without its sources. */
export function noteText(reading: ClassicalReading): string {
  return reading.segments.map((segment) => segment.text).join("");
}

export function checkNote(reading: ClassicalReading, languageCode: string): NoteCheck {
  const text = noteText(reading);
  const problems: NoteProblem[] = [];
  const share = scriptShare(text, languageCode);
  if (share !== null && share < MIN_SCRIPT_SHARE) problems.push({ kind: "script", share: Math.round(share * 100) / 100 });
  const terms = bannedTerms(text, languageCode);
  if (terms.length > 0) problems.push({ kind: "content", terms });
  return { problems, blocks: problems.length > 0 && ENFORCED_LANGUAGES.has(languageCode) };
}
