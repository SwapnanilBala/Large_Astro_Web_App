import type { DeterministicRule, RuleCategory } from "@/lib/astro-types";
import { bySelectionRank } from "@/lib/rule-order";
import type { ReadingRoomFilter, ReadingRoomContent, ReadingRoomItem } from "./ReadingRoom";
import type { ReadingRoomClasses, Translate } from "./classes";
import { roomNavigation } from "./navigation";

/*
 * Every finding the rule engine matched, as reading-room content.
 *
 * The list is in the order the results page ranks them: the selected few first,
 * numbered as they are on the report, then the rest by score. Each row names
 * the area of life it speaks to; the reading carries the evidence that used to
 * sit folded under "Why this reading", open beside or under the text.
 *
 * `tr` must resolve the fullReading namespace (messages/en.full-reading.json).
 */

/* The engine files every finding under one of these (RuleCategory), and the
   record below makes adding a fourth a compile error here rather than a row
   with no label. */
export const FINDING_THEMES: readonly RuleCategory[] = ["core", "career", "love"];

export const FINDING_THEME_KEYS: Record<RuleCategory, string> = {
  core: "fullReading.themes.core",
  career: "fullReading.themes.career",
  love: "fullReading.themes.love",
};

const RARE_BANDS = new Set(["rare", "very_rare"]);

export function buildFindingRoom(
  rules: DeterministicRule[],
  tr: Translate,
  c: ReadingRoomClasses,
): ReadingRoomContent {
  const ordered = [...rules].sort(bySelectionRank);
  const topCount = ordered.filter((rule) => rule.selection?.selected).length;

  const filters: ReadingRoomFilter[] = [
    { value: "all", label: tr("fullReading.filterAll"), count: ordered.length },
    { value: "top", label: tr("fullReading.filterTop"), count: topCount },
    ...FINDING_THEMES.map((theme) => ({
      value: theme,
      label: tr(FINDING_THEME_KEYS[theme]),
      count: ordered.filter((rule) => rule.category === theme).length,
    })),
  ].filter((filter) => filter.count > 0);

  const items: ReadingRoomItem[] = ordered.map((rule) => {
    const rank = rule.selection?.selected ? rule.selection.rank : 0;
    const theme = tr(FINDING_THEME_KEYS[rule.category]);
    const rare = RARE_BANDS.has(rule.evidence.rarity.band);

    return {
      key: rule.instance_key,
      tags: rank > 0 ? [rule.category, "top"] : [rule.category],
      row: (
        <>
          <span className={c.mark}>
            {rank > 0 ? (
              <span className={c.rank}>{rank}</span>
            ) : (
              <span className={`${c.dot} ${c.tone}`} data-tone={rule.category} />
            )}
          </span>
          <span className={c.rowText}>
            <span className={c.rowTitle}>{rule.display.headline}</span>
            <span className={c.rowMeta}>
              {theme}
              {rare && ` · ${tr("fullReading.rare")}`}
            </span>
          </span>
        </>
      ),
      detail: (headingId) => (
        <article>
          <p className={c.meta}>
            <span className={c.tone} data-tone={rule.category}>
              {theme}
            </span>
            {rank > 0 && (
              <span className={c.pill}>{tr("fullReading.topPriority", { rank: String(rank) })}</span>
            )}
          </p>
          <h3 id={headingId} className={c.title}>
            {rule.display.headline}
          </h3>
          <div className={c.detailBody}>
            <div>
              <p className={c.text}>{rule.display.body}</p>
              {rule.display.tension && (
                <div className={c.otherSide}>
                  <p className={c.label}>{tr("fullReading.otherSide")}</p>
                  <p>{rule.display.tension}</p>
                </div>
              )}
            </div>
            <aside className={c.evidence} aria-labelledby={`${headingId}-why`}>
              <p id={`${headingId}-why`} className={c.label}>
                {tr("fullReading.whyThisReading")}
              </p>
              {rule.evidence.claims.length > 0 && (
                <dl className={c.facts}>
                  {rule.evidence.claims.map((claim, index) => (
                    <div key={`${claim.label}-${index}`}>
                      <dt>{claim.label}</dt>
                      <dd>
                        {claim.value}
                        {claim.detail && <span className={c.factDetail}>{claim.detail}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className={c.basis}>{rule.evidence.technical_note}</p>
              <p className={c.rarity} data-band={rule.evidence.rarity.band}>
                {rule.display.rarity_label}
              </p>
            </aside>
          </div>
        </article>
      ),
    };
  });

  return {
    items,
    filters,
    listLabel: tr("fullReading.findingsList"),
    filterLabel: tr("fullReading.findingsFilter"),
    ...roomNavigation(tr),
  };
}
