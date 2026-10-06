import { BookOpen } from "lucide-react";
import type { DeterministicRule } from "@/lib/astro-types";
import { useTranslation } from "@/lib/i18n-context";
import { bySelectionRank } from "@/lib/rule-order";
import styles from "./reading-gateway-previews.module.css";
import { chartValue } from "@/lib/chart-labels";

export default function ReadingEvidencePreview({
  rules,
  yogaCount,
}: {
  rules: DeterministicRule[];
  yogaCount: number;
}) {
  const { t } = useTranslation();
  const ordered = [...rules].sort(bySelectionRank);
  const finding = ordered.find((rule) => rule.evidence.claims.some(
    (claim) => claim.kind === "placement" || claim.kind === "lordship",
  )) ?? ordered[0];
  const claims = finding?.evidence.claims.filter(
    (claim) => claim.kind !== "measurement" && claim.kind !== "count",
  ).slice(0, 3) ?? [];

  /* The finding and its evidence are the rule engine's own words, English by
     design; only the frame around them is the page's. */
  return (
    <div className={styles.readingPreview}>
      {finding ? (
        <>
          <div className={styles.finding}>
            <span className={styles.previewLabel}>{t("insights.evidence.finding")}</span>
            <h4>{finding.display.headline}</h4>
            <p>{finding.display.body}</p>
          </div>
          <aside className={styles.findingEvidence} aria-label={t("insights.evidence.aria")}>
            <span className={styles.previewLabel}>{t("insights.evidence.placement")}</span>
            {claims.length ? (
              <dl className={styles.evidenceClaims}>
                {claims.map((claim, index) => (
                  <div key={`${claim.label}-${index}`}>
                    <dt>{claim.label}</dt>
                    <dd>{chartValue(claim.value, t)}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className={styles.previewEmpty}>{finding.evidence.technical_note}</p>}
          </aside>
        </>
      ) : <p className={styles.previewEmpty}>{t("insights.evidence.none")}</p>}
      <div className={styles.readingSummary}>
        <dl className={styles.readingStats}>
          <div><dt>{t("insights.evidence.findings")}</dt><dd>{rules.length}</dd></div>
          <div><dt>{t("insights.evidence.combinations")}</dt><dd>{yogaCount}</dd></div>
        </dl>
        <p className={styles.readingScope}><BookOpen aria-hidden="true" /> {t("insights.evidence.scope")}</p>
      </div>
    </div>
  );
}
