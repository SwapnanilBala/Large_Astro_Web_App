import type { SynastryAspectInfo } from "@/lib/engines/compatibility-service";

type Translate = (key: string, params?: Record<string, string>) => string;

/*
 * The engine names planets and aspects in English -- "Venus", "Trine" -- and
 * both are closed sets: the seven grahas in PRIORITY_PLANETS and the five
 * aspects in ASPECT_DEFS (lib/engines/compatibility-service.ts). So they are
 * looked up rather than shown as sent. The planets are the baseline
 * `planetNames` keys every chart panel already reads. A name the catalogs do
 * not have renders as sent rather than as a raw key.
 */
function translated(t: Translate, key: string, fallback: string): string {
  const text = t(key);
  /* `t` returns the key itself when it cannot resolve it. */
  return text === key ? fallback : text;
}

export function planetLabel(t: Translate, planet: string): string {
  return translated(t, `planetNames.${planet.toLowerCase()}`, planet);
}

/** "Venus Trine Mars", in the reader's language and word order. */
export function aspectLabel(t: Translate, aspect: SynastryAspectInfo): string {
  return t("compatibility.aspectPair", {
    primary: planetLabel(t, aspect.primary_planet),
    aspect: translated(
      t,
      `compatibility.aspectTypes.${aspect.aspect_type.toLowerCase()}`,
      aspect.aspect_type,
    ),
    partner: planetLabel(t, aspect.partner_planet),
  });
}
