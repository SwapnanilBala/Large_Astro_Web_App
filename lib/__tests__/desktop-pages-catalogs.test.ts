/**
 * Every label the desktop pages used to type in English is in English and in
 * the other six languages, with the same blanks.
 *
 * The results page, its detail pages (life areas, life shifts, house support,
 * the varga atlas and its key-varga pages, timing, advanced), the sign-in page
 * and the intake wheel read these through `t` and `useRouteMessages`. A key a
 * catalog lacks renders on screen as the English baseline, or on a route
 * catalog's page as the key itself, so the gap is silent at build time.
 *
 * The literal keys are read straight out of the files that hold them. Keys
 * built at runtime from the engine's closed sets -- life areas, activity bands,
 * evidence families, dignities, profection themes, muhurta factors, the
 * advanced page's modules -- are invisible to that scan, so their sets are
 * listed here from the same constants the components build them from.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import en from "@/messages/en.json";
import enAdvanced from "@/messages/en.advanced.json";
import enDivisional from "@/messages/en.divisional.json";
import enLifeAreas from "@/messages/en.life-areas.json";
import enStrength from "@/messages/en.strength.json";
import enTiming from "@/messages/en.timing.json";
import es from "@/messages/es.json";
import bn from "@/messages/bn.json";
import hi from "@/messages/hi.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import {
  ACTIVITY_BANDS,
  CLAIM_LABEL_KEY_LIST,
  CONCLUSION_STRENGTHS,
  CONFIRMATION_STATUSES,
  DOMAIN_ICONS,
  DOMAIN_READ_FIELDS,
  EVIDENCE_FAMILIES,
  EVIDENCE_STATUSES,
  RULE_IMPACTS,
  SUBTHEME_BANDS,
  claimLabel,
  claimValue,
  domainReadCopy,
} from "@/app/(desktop)/insights/components/life-domain-copy";
import { TIMING_STOPS } from "@/app/(desktop)/insights/components/timing-gateway-preview";
import { DIGNITY_LEGEND_ORDER } from "@/app/(desktop)/insights/components/navamsa-chart";
import { FACTOR_IDS, muhurtaSlug } from "@/app/(desktop)/insights/components/muhurta-panel";
import { profectionThemeKey } from "@/app/(desktop)/insights/components/varshaphal-panel";
import { ADVANCED_FOCUS_VIEWS, LOCKED_PREVIEWS } from "@/app/(desktop)/insights/advanced/advanced-views";
import { STORY_DETAILS } from "@/app/(desktop)/insights/advanced/advanced-story";
import {
  DIGNITIES,
  HOUSE_SYSTEM_CODES,
} from "@/app/(desktop)/insights/divisional-charts/[division]/division-detail-view";
import { HOUSE_THEMES } from "@/lib/engines/varshaphal-engine";
import { NAKSHATRA_QUALITY_LABELS, TITHI_GROUP_LABELS } from "@/lib/engines/panchanga";
import { HOUSE_SYSTEMS } from "@/lib/engines/engine-registry";
import { ASCENDANT_NAME_KEY, aspectNameKey } from "@/lib/chart-labels";
import { SNAPSHOT_DIGNITIES } from "@/app/(desktop)/insights/components/planetary-snapshots";
import { luckyTermKey } from "@/app/(desktop)/insights/components/lucky-terms";
import { DASHA_THEME_PLANETS } from "@/app/(desktop)/insights/components/dasha-themes";
import { DIGNITIES as PERIOD_DIGNITIES, RELATION_KINDS } from "@/lib/dasha-reading-facts";
import { KALATRA_FACET_KEYS } from "@/app/(desktop)/insights/life-areas/kalatra-panel";
import { ASK_QUESTION_IDS } from "@/lib/knowledge/ask-questions";
import { RETURN_KEYS, SHIFT_ORDINALS } from "@/app/(desktop)/insights/components/major-shifts-panel";
import { PLANET_THEMES } from "@/lib/engines/major-shifts-engine";
import {
  FORTUNE_DOMAIN_COPY,
  GEMSTONE_SAFETY_NOTE,
  PLANET_CAUTIONS,
  PLANET_GEMSTONE_INTENTIONS,
  PLANET_LUCKY,
} from "@/lib/engines/lucky-elements-engine";
import type { LifeDomainKey } from "@/lib/astro-types";

type Tree = Record<string, unknown>;

function lookup(tree: Tree, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);
}

function merge(target: Tree, source: Tree): Tree {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object") {
      target[key] = merge((target[key] as Tree | undefined) ?? {}, value as Tree);
    } else {
      target[key] = value;
    }
  }
  return target;
}

const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
const tags = (text: string) => (text.match(/<\/?(?:b|strong)>/g) ?? []).sort();

/* The desktop baseline plus every route catalog these pages hand to
   useRouteMessages. Merged deeply: en.json and a route catalog can share a
   namespace, as `strength` and `divisional` do. */
const ENGLISH: Tree = [enAdvanced, enDivisional, enLifeAreas, enStrength, enTiming].reduce<Tree>(
  (tree, catalog) => merge(tree, catalog as Tree),
  merge({}, en as Tree),
);

const SOURCE_FILES = [
  "app/(desktop)/layout.tsx",
  "app/(desktop)/login/ZodiacFloater.tsx",
  "app/(desktop)/login/page-client.tsx",
  "app/(desktop)/insights/advanced/advanced-content.tsx",
  "app/(desktop)/insights/advanced/advanced-gate.tsx",
  "app/(desktop)/insights/advanced/advanced-story.tsx",
  "app/(desktop)/insights/components/aspects-panel.tsx",
  "app/(desktop)/insights/components/constellation-chart.tsx",
  "app/(desktop)/insights/components/dasha-format.ts",
  "app/(desktop)/insights/components/dasha-now.tsx",
  "app/(desktop)/insights/components/dasha-period-card.tsx",
  "app/(desktop)/insights/components/dasha-timeline.tsx",
  "app/(desktop)/insights/components/atlas-gateway-preview.tsx",
  "app/(desktop)/insights/components/detail-page-back-link.tsx",
  "app/(desktop)/insights/components/divisional-charts-panel.tsx",
  "app/(desktop)/insights/components/future-forecast-panel.tsx",
  "app/(desktop)/insights/components/house-support-page-copy.tsx",
  "app/(desktop)/insights/components/insights-content.tsx",
  "app/(desktop)/insights/components/life-domain-copy.ts",
  "app/(desktop)/insights/components/lucky-elements-panel.tsx",
  "app/(desktop)/insights/components/lucky-terms.ts",
  "app/(desktop)/insights/components/major-shifts-panel.tsx",
  "app/(desktop)/insights/components/muhurta-panel.tsx",
  "app/(desktop)/insights/components/nakshatra-dasha-panel.tsx",
  "app/(desktop)/insights/components/navamsa-chart.tsx",
  "app/(desktop)/insights/components/personal-story.tsx",
  "app/(desktop)/insights/components/planetary-snapshots.tsx",
  "app/(desktop)/insights/components/reading-evidence-preview.tsx",
  "app/(desktop)/insights/components/timing-gateway-preview.tsx",
  "app/(desktop)/insights/components/todays-sky-band.tsx",
  "app/(desktop)/insights/components/transits-panel.tsx",
  "app/(desktop)/insights/components/varshaphal-panel.tsx",
  "app/(desktop)/insights/components/weekly-energy-chart.tsx",
  "app/(desktop)/insights/components/weekly-energy-panel.tsx",
  "app/(desktop)/insights/divisional-charts/divisional-charts-client.tsx",
  "app/(desktop)/insights/divisional-charts/[division]/division-detail-view.tsx",
  "app/(desktop)/insights/life-areas/ask-classics-panel.tsx",
  "app/(desktop)/insights/life-areas/kalatra-panel.tsx",
  "app/(desktop)/insights/life-areas/life-areas-client.tsx",
  "app/(desktop)/insights/life-areas/life-areas-text.tsx",
  "app/components/BirthChartTeaser.tsx",
  "app/components/BottomNav.tsx",
  "app/components/Navbar.tsx",
  "app/components/PlanetOrb.tsx",
  "app/components/SkipToContent.tsx",
  "lib/chart-labels.ts",
  "lib/daily-sky-line.ts",
];

/* A quoted dotted token whose first part is a catalog namespace. */
const NAMESPACES = new Set(Object.keys(ENGLISH));
const LITERAL_KEYS = [
  ...new Set(
    SOURCE_FILES.map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .flatMap((source) => [...source.matchAll(/["'`]([A-Za-z]\w*(?:\.\w+)+)["'`]/g)])
      .map((match) => match[1])
      .filter((key) => NAMESPACES.has(key.split(".")[0]))
      /* A prefix handed to a helper ("lifeAreas.classics") names a subtree, not a string. */
      .filter((key) => typeof lookup(ENGLISH, key) !== "object"),
  ),
];

const DOMAINS = Object.keys(DOMAIN_ICONS) as LifeDomainKey[];

/* The muhurta engine's qualities: the two labelled sets, and the plain words
   its yoga, karana, weekday, period and hora factors use. */
const MUHURTA_QUALITIES = [
  ...Object.values(TITHI_GROUP_LABELS),
  ...Object.values(NAKSHATRA_QUALITY_LABELS),
  "auspicious",
  "inauspicious",
  "neutral",
  "favorable",
];

const RUNTIME_KEYS = [
  ...DOMAINS.map((domain) => `lifeDomains.names.${domain}`),
  ...ACTIVITY_BANDS.map((band) => `lifeDomains.activity.${band}`),
  ...DOMAINS.flatMap((domain) => DOMAIN_READ_FIELDS.map((field) => `lifeAreas.copy.${domain}.${field}`)),
  ...CONFIRMATION_STATUSES.map((status) => `lifeAreas.confirmation.${status}`),
  ...CONCLUSION_STRENGTHS.map((strength) => `lifeAreas.conclusion.${strength}`),
  ...SUBTHEME_BANDS.map((band) => `lifeAreas.subthemeBands.${band}`),
  ...EVIDENCE_FAMILIES.map((family) => `lifeAreas.families.${family}`),
  ...EVIDENCE_STATUSES.map((status) => `lifeAreas.evidenceStatus.${status}`),
  ...RULE_IMPACTS.map((impact) => `lifeAreas.ruleImpact.${impact}`),
  ...["current", "next", "caution"].map((id) => `lifeAreas.timingWindows.${id}`),
  ...CLAIM_LABEL_KEY_LIST,
  ...Array.from({ length: 12 }, (_, index) => `lifeAreas.claims.houses.h${index + 1}`),
  ...TIMING_STOPS.flatMap((stop) => [
    `insights.timingPreview.stops.${stop.key}.label`,
    `insights.timingPreview.stops.${stop.key}.note`,
  ]),
  ...LOCKED_PREVIEWS.flatMap((module) => [`advanced.locked.${module}.title`, `advanced.locked.${module}.description`]),
  ...ADVANCED_FOCUS_VIEWS.flatMap((view) =>
    ["breadcrumb", "status", "description"].map((field) => `advanced.focus.${view}.${field}`),
  ),
  ...STORY_DETAILS.flatMap((detail) => [`advanced.story.show.${detail}`, `advanced.story.hide.${detail}`]),
  ...DIGNITY_LEGEND_ORDER.map((dignity) => `navamsa.dignities.${dignity}`),
  ...DIGNITIES.map((dignity) => `divisional.detail.dignities.${dignity}`),
  ...HOUSE_SYSTEM_CODES.map((code) => `divisional.detail.method.houseSystems.${code}`),
  ...Object.values(HOUSE_THEMES).flat().map(profectionThemeKey),
  ...Object.values(FACTOR_IDS).map((id) => `timing.muhurta.factors.${id}`),
  ...MUHURTA_QUALITIES.map((quality) => `timing.muhurta.factorQualities.${muhurtaSlug(quality)}`),
  ...["active", "clear"].map((state) => `timing.muhurta.periodStates.${state}`),
  ...["excellent", "good", "fair", "poor"].map((quality) => `timing.muhurta.windowQualities.${quality}`),
  ...["conjunction", "opposition", "trine", "square", "sextile"].map((aspect) => aspectNameKey(aspect)!),
  ASCENDANT_NAME_KEY,
];

/* The lucky-elements engine's words, as the panel keys them. */
const LUCKY_WORDS: Array<readonly [Parameters<typeof luckyTermKey>[0], string]> = [
  ...Object.values(PLANET_LUCKY).flatMap((attributes) => [
    ...attributes.colors.map((color) => ["colors", color] as const),
    ["gems", attributes.gemstone] as const,
    ["metals", attributes.metal] as const,
    ["directions", attributes.direction] as const,
  ]),
  ...Object.values(PLANET_CAUTIONS).flatMap((caution) => [
    ...caution.colors.map((color) => ["colors", color] as const),
    ...caution.items.map((item) => ["items", item] as const),
    ...caution.omens.map((omen) => ["omens", omen] as const),
  ]),
  ...Object.values(FORTUNE_DOMAIN_COPY).flatMap((domain) => [
    ["domainTitles", domain.title] as const,
    ["domainBasis", domain.basis] as const,
    ...("yogakarakaBasis" in domain ? [["domainBasis", domain.yogakarakaBasis] as const] : []),
  ]),
];

RUNTIME_KEYS.push(
  ...SNAPSHOT_DIGNITIES.map((dignity) => `insights.snapshots.dignities.${dignity.toLowerCase()}`),
  ...LUCKY_WORDS.map(([kind, word]) => luckyTermKey(kind, word)),
  ...Object.values(FORTUNE_DOMAIN_COPY).map((domain) => luckyTermKey("domainFocus", domain.title)),
  ...Object.keys(PLANET_GEMSTONE_INTENTIONS).map((planet) => `insights.lucky.intentions.${planet.toLowerCase()}`),
  "insights.lucky.safetyNote",
  ...DASHA_THEME_PLANETS.map((planet) => `dasha.panel.themes.${planet.toLowerCase()}`),
  /* The dasha period card: each house by number, what it stands for, a planet's dignity, and how a level meets the one above. */
  ...Array.from({ length: 12 }, (_, index) => `dasha.reading.houses.h${index + 1}`),
  ...Array.from({ length: 12 }, (_, index) => `dasha.reading.meanings.h${index + 1}`),
  ...PERIOD_DIGNITIES.map((dignity) => `dasha.reading.dignity.${dignity}`),
  ...RELATION_KINDS.map((kind) => `dasha.reading.kinds.${kind}`),
  ...KALATRA_FACET_KEYS.map((facet) => `lifeAreas.kalatraFacets.${facet}`),
  ...ASK_QUESTION_IDS.map((id) => `lifeAreas.ask.questions.${id}`),
  "insights.shifts.labels.mahadasha",
  ...Object.values(RETURN_KEYS).flatMap((kind) => [`insights.shifts.labels.${kind}`, `insights.shifts.themes.${kind}`]),
  ...SHIFT_ORDINALS.map((ordinal) => `insights.shifts.ordinals.${ordinal}`),
  ...Object.keys(PLANET_THEMES).map((planet) => `insights.shifts.themes.${planet.toLowerCase()}`),
);

const KEYS = [...new Set([...LITERAL_KEYS, ...RUNTIME_KEYS])];

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

function staged(lang: string, key: string): unknown[] {
  return FRAGMENTS.map((fragment) => lookup(fragment, `${lang}.${key}`)).filter(
    (value) => value !== undefined,
  );
}

/* What a component hands `t`: the English baseline, as the provider does. */
const english = (key: string, params?: Record<string, string>) => {
  let text = lookup(ENGLISH, key);
  if (typeof text !== "string") return key;
  for (const [name, value] of Object.entries(params ?? {})) text = (text as string).split(`{${name}}`).join(value);
  return text as string;
};

describe("the desktop pages' catalog keys", () => {
  it("finds the literals it reads", () => {
    /* A guard on the scan itself: one key from each kind of file. */
    expect(LITERAL_KEYS).toEqual(
      expect.arrayContaining([
        "insights.page.hero.copyLink",
        "insights.backToReading",
        "dasha.panel.timelineTitle",
        "advanced.gate.signIn",
        "lifeAreas.hero.title",
        "signIn.facts.aries1",
        "signIn.sky.moonIn",
        "birthChartTeaser.markers.midheaven",
        "timing.varshaphal.yearLordReasons.munthaSign",
        "planetOrb.orb",
        "navbar.skipToContent",
      ]),
    );
  });

  it("are all in English", () => {
    for (const key of KEYS) {
      expect(typeof lookup(ENGLISH, key), key).toBe("string");
    }
  });

  it.each(Object.keys(TRANSLATIONS))("are translated into %s, with the same blanks and tags", (lang) => {
    for (const key of KEYS) {
      const folded = lookup(TRANSLATIONS[lang], key);
      const pending = staged(lang, key);
      /* One home or the other: the fold reports a staged key the catalog
         already has as a clash, and two staged copies leave it guessing. */
      expect(Number(folded !== undefined) + pending.length, `${lang}: ${key}`).toBe(1);

      const translated = folded ?? pending[0];
      expect(typeof translated, `${lang}: ${key}`).toBe("string");
      const source = lookup(ENGLISH, key) as string;
      expect(placeholders(translated as string), `${lang}: ${key}`).toEqual(placeholders(source));
      expect(tags(translated as string), `${lang}: ${key}`).toEqual(tags(source));
    }
  });
});

describe("English that moved out of the code reads as it did", () => {
  it("names the profection themes the engine's own way", () => {
    for (const theme of Object.values(HOUSE_THEMES).flat()) {
      expect(lookup(ENGLISH, profectionThemeKey(theme)), theme).toBe(theme);
    }
  });

  it("words the lucky-elements engine's tables as the engine does", () => {
    for (const [kind, word] of LUCKY_WORDS) {
      expect(lookup(ENGLISH, luckyTermKey(kind, word)), `${kind}: ${word}`).toBe(word);
    }
    for (const domain of Object.values(FORTUNE_DOMAIN_COPY)) {
      expect(lookup(ENGLISH, luckyTermKey("domainFocus", domain.title)), domain.title).toBe(domain.focus);
    }
    for (const [planet, intention] of Object.entries(PLANET_GEMSTONE_INTENTIONS)) {
      expect(lookup(ENGLISH, `insights.lucky.intentions.${planet.toLowerCase()}`), planet).toBe(intention);
    }
    expect(lookup(ENGLISH, "insights.lucky.safetyNote")).toBe(GEMSTONE_SAFETY_NOTE);
  });

  it("names the life chapters as the major-shifts engine does", () => {
    for (const [planet, theme] of Object.entries(PLANET_THEMES)) {
      expect(lookup(ENGLISH, `insights.shifts.themes.${planet.toLowerCase()}`), planet).toBe(theme);
    }
    for (const ordinal of SHIFT_ORDINALS) {
      expect(lookup(ENGLISH, `insights.shifts.ordinals.${ordinal}`)).toBe(ordinal);
    }
  });

  it("matches the muhurta engine's quality labels", () => {
    for (const quality of MUHURTA_QUALITIES) {
      expect(lookup(ENGLISH, `timing.muhurta.factorQualities.${muhurtaSlug(quality)}`), quality).toBe(quality);
    }
  });

  it("matches the registry's house system names", () => {
    for (const system of HOUSE_SYSTEMS) {
      expect(lookup(ENGLISH, `divisional.detail.method.houseSystems.${system.code}`), system.code).toBe(system.label);
    }
  });

  it("labels the rule engine's evidence claims as the engine does", () => {
    for (const label of [
      "Primary house",
      "Sign on that house",
      "House lord",
      "Lord placement",
      "Supporting house",
      "Supporting lord",
      "Anchor planet",
    ]) {
      expect(claimLabel(label, english)).toBe(label);
    }
    expect(claimValue("10th house", english)).toBe("10th house");
    expect(claimValue("1st house", english)).toBe("1st house");
    expect(claimValue("Gemini", english)).toBe("Gemini");
    expect(claimValue("Saturn", english)).toBe("Saturn");
  });

  it("keeps every area's reading copy", () => {
    for (const domain of DOMAINS) {
      const copy = domainReadCopy(domain, english);
      for (const field of DOMAIN_READ_FIELDS) {
        expect(copy[field], `${domain}.${field}`).not.toMatch(/^lifeAreas\./);
      }
    }
  });
});
