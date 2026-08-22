"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ChartApiResponse } from "@/lib/astro-types";
import styles from "../insights.module.css";

/*
 * One deterministic rule, as a card.
 *
 * Extracted from insights-content.tsx so the full-reading page can render the
 * same card without importing that module — it is a 70KB client component and
 * pulling it in for one card would ship the entire results page twice.
 *
 * Still reads from insights.module.css: the card's styling is shared with the
 * results page and duplicating it would let the two drift.
 */

/**
 * Order by the measured rank, with unselected rules after the selected ones.
 *
 * `rank` is 0 for anything the selection layer did not pick, so a naive
 * ascending sort would float every unselected rule to the top.
 *
 * Lives here rather than in insights-content because the full-reading page is
 * now the only place that renders the whole rule list, and it was rendering it
 * in raw engine order -- the comparator was left behind on the results page
 * when the list moved.
 */
export function bySelectionRank(
  left: ChartApiResponse["chart"]["deterministic_rules"][number],
  right: ChartApiResponse["chart"]["deterministic_rules"][number],
): number {
  const leftRank = left.selection?.selected ? left.selection.rank : Number.MAX_SAFE_INTEGER;
  const rightRank = right.selection?.selected ? right.selection.rank : Number.MAX_SAFE_INTEGER;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return (right.selection?.score ?? 0) - (left.selection?.score ?? 0);
}

type RuleCardProps = {
  rule: ChartApiResponse["chart"]["deterministic_rules"][number];
  index: number;
};

export default function RuleCard({ rule, index }: RuleCardProps) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.article
      className={`${styles.ruleCard} ${rule.priority === "high" ? styles.ruleHigh : rule.priority === "medium" ? styles.ruleMedium : styles.ruleLow}`}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={shouldReduceMotion ? { duration: 0 } : {
        type: "spring",
        stiffness: 200,
        damping: 20,
        delay: index * 0.05,
      }}
    >
      <header className={styles.ruleHeader}>
        <h3>{rule.display.headline}</h3>
      </header>
      <p className={styles.ruleInsight}>{rule.display.body}</p>
      {rule.display.tension && (
        <p className={styles.ruleTension}>{rule.display.tension}</p>
      )}

      {/* The technical tier. Native <details> rather than a hand-rolled
          disclosure: it is keyboard accessible and correct by default, and
          nothing here needs to animate. The confidence bar that used to sit
          here is gone -- it rendered a hardcoded constant as a percentage. */}
      <details className={styles.evidence}>
        <summary className={styles.evidenceSummary}>Why this reading</summary>
        <div className={styles.evidenceBody}>
          <p
            className={`${styles.rarityLabel} ${
              rule.priority === "high"
                ? styles.rarityHigh
                : rule.priority === "medium"
                  ? styles.rarityMedium
                  : styles.rarityLow
            }`}
          >
            {rule.display.rarity_label}
          </p>
          <p className={styles.ruleBasis}>{rule.evidence.technical_note}</p>
          <dl className={styles.claims}>
            {rule.evidence.claims.map((claim) => (
              <div key={claim.label} className={styles.claim}>
                <dt className={styles.claimLabel}>{claim.label}</dt>
                <dd className={styles.claimValue}>
                  {claim.value}
                  {claim.detail && (
                    <span className={styles.claimDetail}>{claim.detail}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
    </motion.article>
  );
}
