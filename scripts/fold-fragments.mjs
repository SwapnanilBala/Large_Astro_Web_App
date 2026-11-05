#!/usr/bin/env node
/**
 * Fold the staged translations in messages/fragments/*.json into the
 * per-language catalogs messages/{es,bn,hi,it,fr,de}.json.
 *
 *   node scripts/fold-fragments.mjs            audit only, writes nothing
 *   node scripts/fold-fragments.mjs --write    fold, read back, delete the fragments
 *
 * A fragment is shaped { "<lang>": { "<namespace>": { ...new keys } } } and
 * carries new keys only. The fold is purely additive: it refuses (writes
 * nothing at all) on a key the catalog already has, on a key two fragments
 * both stage, on a path that is a string on one side and an object on the
 * other, on a key with no English, on placeholders that differ from the
 * English, on the "\p{L}?\p{L}" corruption pattern, and on AI or paid/free
 * wording. Hindi and Bengali are NFC-normalised before they go in.
 *
 * Formatting: each catalog must round-trip through
 * JSON.stringify(tree, null, 2) with its own line ending, byte for byte,
 * before anything is written, so the only change is the new keys, appended
 * at the end of their namespace object (new namespaces at the end of the
 * file). After writing, every catalog is read back from disk and every
 * fragment value is asserted present exactly, every key that was there
 * before is asserted unchanged, and the key count is asserted to have grown
 * by exactly the number of staged keys.
 */
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MESSAGES = join(ROOT, "messages");
const FRAGMENTS = join(MESSAGES, "fragments");
const LANGUAGES = ["es", "bn", "hi", "it", "fr", "de"];
const NFC_LANGUAGES = new Set(["hi", "bn"]);
const WRITE = process.argv.includes("--write");

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Every string leaf of a tree, as [dotted key, value]. */
function leaves(tree, prefix = "") {
  const out = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isObject(value)) out.push(...leaves(value, path));
    else out.push([path, value]);
  }
  return out;
}

const lookup = (tree, key) => key.split(".").reduce((node, part) => (isObject(node) ? node[part] : undefined), tree);

const placeholders = (text) => [...String(text).matchAll(/\{\w+\}/g)].map((m) => m[0]).sort().join(" ");

/** The file's own line ending, and whether the stringified tree reproduces it byte for byte. */
function serialiserFor(raw) {
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const serialise = (tree) => JSON.stringify(tree, null, 2).replace(/\n/g, eol) + eol;
  return { eol, serialise };
}

/* Wording reader-facing copy never uses (feedback: no AI, no paid/free). AI is case-sensitive on purpose. */
const AI_WORDING = /\bAI\b|\bIA\b|\bKI\b|\bA\.I\./u;
const PAID_WORDING =
  /\b(paid|free|expensive|cheap|gratis|gratuit\w*|payant\w*|kostenlos|bezahlt|teuer|günstig|pagato|pagamento|costoso|de pago)\b|मुफ़्त|मुफ्त|महंग|सशुल्क|বিনামূল্যে|ফ্রি|দামি|ব্যয়বহুল/iu;

function main() {
  if (!existsSync(FRAGMENTS)) {
    console.log("No messages/fragments folder: nothing to fold.");
    return;
  }
  const fragmentFiles = readdirSync(FRAGMENTS).filter((file) => file.endsWith(".json")).sort();
  if (fragmentFiles.length === 0) {
    console.log("No fragments staged: nothing to fold.");
    return;
  }

  /* English: the union of every messages/en*.json. */
  const englishFiles = readdirSync(MESSAGES).filter((file) => /^en(\..+)?\.json$/.test(file));
  const english = new Map();
  for (const file of englishFiles) {
    for (const [key, value] of leaves(JSON.parse(readFileSync(join(MESSAGES, file), "utf8")))) {
      if (!english.has(key)) english.set(key, value);
    }
  }

  const problems = [];
  const catalogs = {};
  for (const lang of LANGUAGES) {
    const path = join(MESSAGES, `${lang}.json`);
    const raw = readFileSync(path, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) problems.push(`${lang}.json starts with a BOM`);
    const tree = JSON.parse(raw);
    const { serialise } = serialiserFor(raw);
    if (serialise(tree) !== raw) problems.push(`${lang}.json does not round-trip byte for byte; refusing to rewrite it`);
    catalogs[lang] = { path, raw, tree, serialise, before: new Map(leaves(tree)) };
  }

  /* Gather every staged key, per language, refusing duplicates across fragments. */
  const staged = Object.fromEntries(LANGUAGES.map((lang) => [lang, new Map()]));
  const stagedBy = new Map();
  for (const file of fragmentFiles) {
    const fragment = JSON.parse(readFileSync(join(FRAGMENTS, file), "utf8"));
    for (const [lang, subtree] of Object.entries(fragment)) {
      if (!LANGUAGES.includes(lang)) {
        problems.push(`${file}: unknown language "${lang}"`);
        continue;
      }
      if (!isObject(subtree)) {
        problems.push(`${file}: "${lang}" is not an object`);
        continue;
      }
      for (const [key, rawValue] of leaves(subtree)) {
        const where = `${file}: ${lang}.${key}`;
        if (typeof rawValue !== "string") {
          problems.push(`${where} is not a string`);
          continue;
        }
        const value = NFC_LANGUAGES.has(lang) ? rawValue.normalize("NFC") : rawValue;
        const id = `${lang}.${key}`;
        if (stagedBy.has(id)) problems.push(`${where} is also staged by ${stagedBy.get(id)}`);
        stagedBy.set(id, file);
        staged[lang].set(key, value);

        if (!english.has(key)) problems.push(`${where} has no English in messages/en*.json`);
        else if (placeholders(english.get(key)) !== placeholders(value))
          problems.push(`${where} placeholders [${placeholders(value)}] differ from the English [${placeholders(english.get(key))}]`);
        if (/\p{L}\?\p{L}/u.test(value)) problems.push(`${where} has the "letter?letter" corruption pattern`);
        if (AI_WORDING.test(value)) problems.push(`${where} says AI: ${value}`);
        if (PAID_WORDING.test(value)) problems.push(`${where} uses paid/free wording: ${value}`);

        /* Clash or shape conflict with what the catalog already has. */
        const parts = key.split(".");
        let node = catalogs[lang].tree;
        for (let i = 0; i < parts.length; i += 1) {
          const existing = node?.[parts[i]];
          if (existing === undefined) break;
          if (i === parts.length - 1) {
            problems.push(`${where} already exists in ${lang}.json (clash)`);
          } else if (!isObject(existing)) {
            problems.push(`${where}: ${parts.slice(0, i + 1).join(".")} is a string in ${lang}.json, not an object`);
            break;
          }
          node = existing;
        }
      }
    }
  }

  /* Each language a fragment covers should get every key the others get. */
  const allKeys = new Set(LANGUAGES.flatMap((lang) => [...staged[lang].keys()]));
  for (const lang of LANGUAGES) {
    for (const key of allKeys) if (!staged[lang].has(key)) problems.push(`${key} is staged for some languages but not ${lang}`);
  }

  if (problems.length) {
    console.error(`Refusing to fold, ${problems.length} problem(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  const total = LANGUAGES.reduce((sum, lang) => sum + staged[lang].size, 0);
  console.log(`Audit clean: ${allKeys.size} key(s) x ${LANGUAGES.length} languages = ${total} value(s) from ${fragmentFiles.join(", ")}.`);
  if (!WRITE) {
    console.log("Dry run; pass --write to fold.");
    return;
  }

  /* Merge by appending. */
  for (const lang of LANGUAGES) {
    const { tree } = catalogs[lang];
    for (const [key, value] of staged[lang]) {
      const parts = key.split(".");
      let node = tree;
      for (const part of parts.slice(0, -1)) {
        if (node[part] === undefined) node[part] = {};
        node = node[part];
      }
      node[parts.at(-1)] = value;
    }
    writeFileSync(catalogs[lang].path, catalogs[lang].serialise(tree), "utf8");
  }

  /* Read every catalog back from disk and check it. */
  const failures = [];
  for (const lang of LANGUAGES) {
    const raw = readFileSync(catalogs[lang].path, "utf8");
    const tree = JSON.parse(raw);
    const after = new Map(leaves(tree));
    for (const [key, value] of staged[lang]) {
      if (lookup(tree, key) !== value) failures.push(`${lang}.${key} did not read back exactly`);
    }
    for (const [key, value] of catalogs[lang].before) {
      if (after.get(key) !== value) failures.push(`${lang}.${key} changed or vanished`);
    }
    if (after.size !== catalogs[lang].before.size + staged[lang].size)
      failures.push(`${lang}.json has ${after.size} keys, expected ${catalogs[lang].before.size + staged[lang].size}`);
    if (catalogs[lang].serialise(tree) !== raw) failures.push(`${lang}.json no longer round-trips`);
  }
  if (failures.length) {
    console.error("Read-back FAILED (catalogs were written; inspect with git diff and restore):");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  for (const file of fragmentFiles) unlinkSync(join(FRAGMENTS, file));
  console.log(`Folded and read back. Deleted ${fragmentFiles.join(", ")}; git rm them with the catalogs.`);
}

main();
