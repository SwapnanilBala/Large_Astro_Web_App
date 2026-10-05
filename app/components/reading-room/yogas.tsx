import type { YogaDetectionResult } from "@/lib/astro-types";
import { planetName } from "@/lib/planet-labels";
import type { ReadingRoomContent, ReadingRoomFilter, ReadingRoomGroup, ReadingRoomItem } from "./ReadingRoom";
import type { ReadingRoomClasses, Translate } from "./classes";
import { roomNavigation } from "./navigation";

/*
 * The chart's yogas, as reading-room content.
 *
 * Grouped by family rather than by strength, which is what the old three-up
 * grid did: 34 cards in three strength bands said little that a strength mark
 * on each row does not, while the families -- wealth, benefic, reversal, the
 * whole-chart figures -- are how the combinations are actually told apart.
 * Strength stays a filter. Within a family the engine's own order holds
 * (strength, then its score), because Array.prototype.sort is stable.
 *
 * `tr` must resolve fullReading (messages/en.full-reading.json) and `ts` the
 * yoga panel's strength namespace (messages/en.strength.json): the family and
 * strength names and the trait label are that panel's own keys, already
 * translated, rather than new copies of them. Planet names come from
 * lib/planet-labels, the lookup the mobile chart and tables use too.
 */

type Category = YogaDetectionResult["category"];
type Strength = YogaDetectionResult["strength"];

export const YOGA_FAMILIES: readonly Category[] = [
  "mahapurusha",
  "wealth",
  "benefic",
  "viparita",
  "nabhasa",
  "challenging",
];

export const YOGA_STRENGTHS: readonly Strength[] = ["strong", "moderate", "weak"];

/* Text presentation (U+FE0E) after each, or some platforms draw the Venus and
   Mars signs as colour emoji. */
const PLANET_GLYPHS: Record<string, string> = {
  Sun: "\u2609\uFE0E",
  Moon: "\u263D\uFE0E",
  Mercury: "\u263F\uFE0E",
  Venus: "\u2640\uFE0E",
  Mars: "\u2642\uFE0E",
  Jupiter: "\u2643\uFE0E",
  Saturn: "\u2644\uFE0E",
  Rahu: "\u260A\uFE0E",
  Ketu: "\u260B\uFE0E",
};

/* A strength label is stored lower-case for use mid-sentence; a filter or a
   badge leads with it. toLocaleUpperCase leaves scripts without case alone. */
function leading(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/* Generated records repeat the English name in `sanskrit`; only show it when
   it is something else. */
function sanskritLine(yoga: YogaDetectionResult): string | null {
  const sanskrit = yoga.sanskrit?.trim();
  return sanskrit && sanskrit !== yoga.name ? sanskrit : null;
}

export function buildYogaRoom(
  yogas: YogaDetectionResult[],
  tr: Translate,
  ts: Translate,
  c: ReadingRoomClasses,
): ReadingRoomContent {
  const strengthLabel = (strength: Strength) => leading(ts(`strength.yogas.strengthLabels.${strength}`));
  const familyLabel = (category: Category) => ts(`strength.yogas.categories.${category}`);

  const ordered = [...yogas].sort(
    (left, right) =>
      YOGA_FAMILIES.indexOf(left.category) - YOGA_FAMILIES.indexOf(right.category) ||
      YOGA_STRENGTHS.indexOf(left.strength) - YOGA_STRENGTHS.indexOf(right.strength),
  );

  const groups: ReadingRoomGroup[] = YOGA_FAMILIES.filter((family) =>
    ordered.some((yoga) => yoga.category === family),
  ).map((family) => ({ key: family, label: familyLabel(family) }));

  const filters: ReadingRoomFilter[] = [
    { value: "all", label: tr("fullReading.filterAll"), count: ordered.length },
    ...YOGA_STRENGTHS.map((strength) => ({
      value: strength,
      label: strengthLabel(strength),
      count: ordered.filter((yoga) => yoga.strength === strength).length,
    })),
  ].filter((filter) => filter.count > 0);

  const items: ReadingRoomItem[] = ordered.map((yoga) => {
    const sanskrit = sanskritLine(yoga);
    const glyphs = yoga.involved_planets.slice(0, 3).map((planet) => PLANET_GLYPHS[planet] ?? "").join(" ");
    const traits = yoga.key_traits ?? [];

    return {
      key: yoga.yoga_id,
      group: yoga.category,
      tags: [yoga.strength],
      row: (
        <>
          <span className={c.mark}>
            <span className={c.strengthMark} data-strength={yoga.strength} />
          </span>
          <span className={c.rowText}>
            <span className={c.rowTitle}>{yoga.name}</span>
            <span className={c.rowMeta}>{strengthLabel(yoga.strength)}</span>
          </span>
          {glyphs.trim() && (
            <span className={c.glyphs} aria-hidden="true">
              {glyphs}
              {yoga.involved_planets.length > 3 && " +"}
            </span>
          )}
        </>
      ),
      detail: (headingId) => (
        <article>
          <p className={c.meta}>
            <span className={c.tone} data-tone="quiet">
              {familyLabel(yoga.category)}
            </span>
            <span className={c.pill} data-strength={yoga.strength}>
              {strengthLabel(yoga.strength)}
            </span>
          </p>
          <h3 id={headingId} className={c.title}>
            {yoga.name}
          </h3>
          {sanskrit && (
            <p className={c.subtitle} lang="sa">
              {sanskrit}
            </p>
          )}
          {yoga.involved_planets.length > 0 && (
            <p className={c.planets}>
              {yoga.involved_planets
                .map((planet) => `${PLANET_GLYPHS[planet] ?? ""} ${planetName(planet, tr)}`.trim())
                .join("  ·  ")}
            </p>
          )}
          <div className={c.detailBody}>
            <div>
              <div className={c.block}>
                <p className={c.label}>{tr("fullReading.yogaDoes")}</p>
                <p className={c.text}>{yoga.effects}</p>
                {traits.length > 0 && (
                  <ul className={c.traits} aria-label={ts("strength.yogas.traitsAriaLabel", { name: yoga.name })}>
                    {traits.map((trait) => (
                      <li key={trait}>{trait}</li>
                    ))}
                  </ul>
                )}
              </div>
              {yoga.activation_timing && (
                <div className={c.block}>
                  <p className={c.label}>{tr("fullReading.yogaShows")}</p>
                  <p className={c.text}>{yoga.activation_timing}</p>
                </div>
              )}
              {yoga.cancellation && (
                <div className={c.block}>
                  <p className={c.label}>{tr("fullReading.yogaSoftened")}</p>
                  <p className={c.text}>{yoga.cancellation}</p>
                </div>
              )}
            </div>
            <aside className={c.evidence} aria-labelledby={`${headingId}-why`}>
              <p id={`${headingId}-why`} className={c.label}>
                {tr("fullReading.yogaForms")}
              </p>
              <p className={c.asideText}>{yoga.description}</p>
              {yoga.source && (
                <p className={c.basis}>
                  {tr("fullReading.yogaSource")}: {yoga.source}
                </p>
              )}
            </aside>
          </div>
        </article>
      ),
    };
  });

  return {
    items,
    groups,
    filters,
    listLabel: tr("fullReading.yogasList"),
    filterLabel: tr("fullReading.yogasFilter"),
    ...roomNavigation(tr),
  };
}
