import { describe, expect, it } from "vitest";
import english from "@/messages/en.onboarding.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import it_ from "@/messages/it.json";
import hi from "@/messages/hi.json";
import bn from "@/messages/bn.json";

function flatten(
  tree: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === "string"
        ? [[`${prefix}${key}`, value]]
        : Object.entries(
            flatten(value as Record<string, unknown>, `${prefix}${key}.`),
          ),
    ),
  );
}
const baseline = flatten(english.onboarding);
const placeholders = (text: string) =>
  [...text.matchAll(/\{\w+\}/g)].map(([match]) => match).sort();

describe("desktop guidance translations", () => {
  for (const [locale, catalog] of Object.entries({
    es,
    fr,
    de,
    it: it_,
    hi,
    bn,
  })) {
    it(`covers the introduction, glossary, and sections in ${locale}`, () => {
      const translated = flatten(catalog.onboarding);
      for (const [key, text] of Object.entries(baseline)) {
        expect(translated[key], key).toBeTruthy();
        expect(placeholders(translated[key]), key).toEqual(placeholders(text));
      }
    });
  }
});
