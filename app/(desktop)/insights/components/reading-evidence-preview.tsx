import { BookOpen } from "lucide-react";
import type { DeterministicRule } from "@/lib/astro-types";
import { bySelectionRank } from "./rule-order";
import styles from "./reading-gateway-previews.module.css";

export default function ReadingEvidencePreview({
  rules,
  yogaCount,
}: {
  rules: DeterministicRule[];
  yogaCount: number;
}) {
  const ordered = [...rules].sort(bySelectionRank);
  const finding = ordered.find((rule) => rule.evidence.claims.some(
    (claim) => claim.kind === "placement" || claim.kind === "lordship",
  )) ?? ordered[0];
  const claims = finding?.evidence.claims.filter(
    (claim) => claim.kind !== "measurement" && claim.kind !== "count",
  ).slice(0, 3) ?? [];

  return (
    <div className={styles.readingPreview}>
      {finding ? (
        <>
          <div className={styles.finding}>
            <span className={styles.previewLabel}>A finding from your chart</span>
            <h4>{finding.display.headline}</h4>
            <p>{finding.display.body}</p>
          </div>
          <aside className={styles.findingEvidence} aria-label="Chart evidence for this finding">
            <span className={styles.previewLabel}>The placement behind it</span>
            {claims.length ? (
              <dl className={styles.evidenceClaims}>
                {claims.map((claim, index) => (
                  <div key={`${claim.label}-${index}`}>
                    <dt>{claim.label}</dt>
                    <dd>{claim.value}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className={styles.previewEmpty}>{finding.evidence.technical_note}</p>}
          </aside>
        </>
      ) : <p className={styles.previewEmpty}>No matched findings are available for this chart.</p>}
      <div className={styles.readingSummary}>
        <dl className={styles.readingStats}>
          <div><dt>Chart findings</dt><dd>{rules.length}</dd></div>
          <div><dt>Lifetime combinations</dt><dd>{yogaCount}</dd></div>
        </dl>
        <p className={styles.readingScope}><BookOpen aria-hidden="true" /> Karmic patterns and inherited themes</p>
      </div>
    </div>
  );
}
