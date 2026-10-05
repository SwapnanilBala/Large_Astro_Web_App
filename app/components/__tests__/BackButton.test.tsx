import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import { LanguageProvider, type MessageTree } from "@/lib/i18n-context";
import BackButton from "../BackButton";
import BackToReadingButton, { BACK_TO_READING_LABELS } from "../BackToReadingButton";

/*
 * The shared back buttons, as the visitor reads them.
 *
 * Most pages that render these are server components, which cannot translate
 * a label themselves, so the label is read inside the button. Pinned here:
 * the defaults and every key a page can name come out of the catalog in the
 * provider's language rather than as English text, and no page hands either
 * button its label as a string literal -- which reads in English whatever
 * language the visitor chose.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: () => {} }) }));

afterEach(cleanup);

type Tree = Record<string, unknown>;

function lookup(tree: Tree, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);
}

function merge(base: Tree, extra: Tree): Tree {
  const out: Tree = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    out[key] =
      value && typeof value === "object" && out[key] && typeof out[key] === "object"
        ? merge(out[key] as Tree, value as Tree)
        : value;
  }
  return out;
}

const TRANSLATIONS: Record<string, Tree> = { es, bn, hi, it: it_, fr, de };

/* Translations staged for the fold, each shaped { lang: { namespace: ... } }.
   The fold deletes them and the catalogs carry the keys from then on, so
   either place counts. */
const FRAGMENT_DIR = join(process.cwd(), "messages", "fragments");
const FRAGMENTS: Tree[] = existsSync(FRAGMENT_DIR)
  ? readdirSync(FRAGMENT_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(join(FRAGMENT_DIR, file), "utf8")) as Tree)
  : [];

/* Translation files cannot be imported dynamically here, so a provider whose
   baseline is the Spanish catalog -- with anything still staged folded in --
   stands in for a visitor who chose Spanish. */
const spanish = FRAGMENTS.reduce<Tree>((tree, fragment) => merge(tree, (fragment.es as Tree) ?? {}), es);

function inLanguage(messages: MessageTree, children: ReactNode) {
  return render(<LanguageProvider baseMessages={messages}>{children}</LanguageProvider>);
}

describe("the shared back buttons", () => {
  it("default to the catalog's English", () => {
    inLanguage(en, <BackButton href="/" />);
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/");
    cleanup();

    /* No chart in the history, so it goes home. */
    inLanguage(en, <BackToReadingButton />);
    expect(screen.getByRole("link", { name: "Back to your reading" })).toHaveAttribute("href", "/");
  });

  it("are written in the visitor's language, defaults and named keys alike", () => {
    inLanguage(
      spanish,
      <>
        <BackButton href="/" />
        <BackToReadingButton />
        <BackToReadingButton path="/insights/advanced" labelKey="insights.backToAdvanced" />
      </>,
    );
    expect(screen.getByRole("link", { name: "Atrás" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a tu lectura" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al análisis avanzado" })).toBeInTheDocument();
  });

  it("take a label already in the visitor's language over a key", () => {
    inLanguage(en, <BackToReadingButton labelKey="home.back" label="Zurück" />);
    expect(screen.getByRole("link", { name: "Zurück" })).toBeInTheDocument();
  });

  it("can name only keys that are in the English baseline", () => {
    for (const key of BACK_TO_READING_LABELS) {
      expect(typeof lookup(en, key), key).toBe("string");
    }
  });

  it.each(Object.keys(TRANSLATIONS))("can name only keys translated into %s", (lang) => {
    for (const key of BACK_TO_READING_LABELS) {
      const folded = lookup(TRANSLATIONS[lang], key);
      const pending = FRAGMENTS.map((fragment) => lookup(fragment, `${lang}.${key}`)).filter(
        (value) => value !== undefined,
      );
      /* One home or the other: the fold reports a staged key the catalog
         already has as a clash. */
      expect(Number(folded !== undefined) + pending.length, `${lang}: ${key}`).toBe(1);
      expect(typeof (folded ?? pending[0]), `${lang}: ${key}`).toBe("string");
    }
  });

  it("are never handed an English label by a page", () => {
    const appDir = join(process.cwd(), "app");
    const literal = /<(?:BackButton|BackToReadingButton)\b[^>]*?\blabel="[^"]*"/g;
    const offenders = (readdirSync(appDir, { recursive: true }) as string[])
      .filter((file) => file.endsWith(".tsx") && !file.includes("__tests__"))
      .flatMap((file) =>
        [...readFileSync(join(appDir, file), "utf8").matchAll(literal)].map((match) => `${file}: ${match[0]}`),
      );
    expect(offenders).toEqual([]);
  });
});
