"use client";

import type { DeterministicRule, RuleCategory } from "@/lib/astro-types";
import { useRouteMessages } from "@/lib/i18n-context";
import fullReadingMessages from "@/messages/en.full-reading.json";
import { bySelectionRank } from "../components/rule-order";
import ReadingRoom, { type ReadingRoomFilter, type ReadingRoomItem } from "./reading-room";
import room from "./reading-room.module.css";

/*
 * Every finding the rule engine matched, in the reading room.
 *
 * The list is in the order the results page ranks them: the selected few first,
 * numbered as they are on the report, then the rest by score. Each row names
 * the area of life it speaks to; the reading carries the evidence that used to
 * sit folded under "Why this reading", open beside the text.
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

export default function FindingsRoom({ rules }: { rules: DeterministicRule[] }) {
  const tr = useRouteMessages(fullReadingMessages);
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
          <span className={room.mark}>
            {rank > 0 ? (
              <span className={room.rank}>{rank}</span>
            ) : (
              <span className={`${room.dot} ${room.tone}`} data-tone={rule.category} />
            )}
          </span>
          <span className={room.rowText}>
            <span className={room.rowTitle}>{rule.display.headline}</span>
            <span className={room.rowMeta}>
              {theme}
              {rare && ` · ${tr("fullReading.rare")}`}
            </span>
          </span>
        </>
      ),
      detail: (headingId) => (
        <article>
          <p className={room.meta}>
            <span className={room.tone} data-tone={rule.category}>
              {theme}
            </span>
            {rank > 0 && (
              <span className={room.pill}>
                {tr("fullReading.topPriority", { rank: String(rank) })}
              </span>
            )}
          </p>
          <h3 id={headingId} className={room.title}>
            {rule.display.headline}
          </h3>
          <div className={room.detailBody}>
            <div>
              <p className={room.text}>{rule.display.body}</p>
              {rule.display.tension && (
                <div className={room.otherSide}>
                  <p className={room.label}>{tr("fullReading.otherSide")}</p>
                  <p>{rule.display.tension}</p>
                </div>
              )}
            </div>
            <aside className={room.evidence} aria-labelledby={`${headingId}-why`}>
              <p id={`${headingId}-why`} className={room.label}>
                {tr("fullReading.whyThisReading")}
              </p>
              {rule.evidence.claims.length > 0 && (
                <dl className={room.facts}>
                  {rule.evidence.claims.map((claim, index) => (
                    <div key={`${claim.label}-${index}`}>
                      <dt>{claim.label}</dt>
                      <dd>
                        {claim.value}
                        {claim.detail && <span className={room.factDetail}>{claim.detail}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className={room.basis}>{rule.evidence.technical_note}</p>
              <p className={room.rarity} data-band={rule.evidence.rarity.band}>
                {rule.display.rarity_label}
              </p>
            </aside>
          </div>
        </article>
      ),
    };
  });

  return (
    <ReadingRoom
      items={items}
      listLabel={tr("fullReading.findingsList")}
      filters={filters}
      filterLabel={tr("fullReading.findingsFilter")}
      previousLabel={tr("fullReading.previous")}
      nextLabel={tr("fullReading.next")}
      positionLabel={(position, total) =>
        tr("fullReading.position", { position: String(position), total: String(total) })
      }
    />
  );
}
