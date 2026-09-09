"use client";

import { useMemo, useState } from "react";
import {
  DOMAIN_ICONS,
  DOMAIN_READ_COPY,
  buildDomainRules,
} from "@/app/(desktop)/insights/components/life-domain-copy";
import { getLifeDomainTimingWindows } from "@/lib/life-domain-timing";
import type { DashaInfo, LifeDomainInsight } from "@/lib/astro-types";
import { useRouteMessages } from "@/lib/i18n-context";
import lifeAreasMessages from "@/messages/en.life-areas.json";
import styles from "./life-areas.module.css";

/*
 * The life-area deep dives, on their own page.
 *
 * These used to be three tabs inside one section of the results page. Brief
 * stayed there and got shorter; Detailed and Action Plan moved here, and so did
 * the blocks that used to render under every tab -- the evidence verdict, the
 * ranked subthemes, the timing windows, guidance and long game. The results
 * page now carries a headline and a paragraph per area and links here, which
 * is the same handoff /insights/timing and the varga atlas already use.
 *
 * All seven areas are on this page, not just the one the reader clicked, so
 * the link is a doorway rather than a dead end.
 */

type ViewMode = "detailed" | "action";

type LifeAreasClientProps = {
  insights: LifeDomainInsight[];
  dasha?: DashaInfo | null;
  initialDomainKey: string;
};

export default function LifeAreasClient({
  insights,
  dasha,
  initialDomainKey,
}: LifeAreasClientProps) {
  /* tr, not t: this page's copy is a namespace of its own that ships with the
     route rather than riding in the desktop baseline. */
  const tr = useRouteMessages(lifeAreasMessages);
  const ranked = useMemo(
    () =>
      [...insights].sort(
        (left, right) => right.confidence_score - left.confidence_score
      ),
    [insights]
  );

  const [selectedKey, setSelectedKey] = useState(
    () =>
      ranked.find((domain) => domain.key === initialDomainKey)?.key ??
      ranked[0]?.key
  );
  const [viewMode, setViewMode] = useState<ViewMode>("detailed");

  const domain = ranked.find((entry) => entry.key === selectedKey) ?? ranked[0];
  if (!domain) return null;

  const copy = DOMAIN_READ_COPY[domain.key];
  const rules = buildDomainRules(domain);
  const timingWindows = getLifeDomainTimingWindows(domain, dasha);

  return (
    <>
        <nav className={styles.domainNav} aria-label={tr("lifeAreas.navLabel")}>
          <p className={styles.domainNavLabel}>
            {tr("lifeAreas.chooseArea")}
            <span>{tr("lifeAreas.mostActiveFirst")}</span>
          </p>
          <div
            className={styles.domainChips}
            role="tablist"
            aria-label={tr("lifeAreas.navLabel")}
          >
            {ranked.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={entry.key === domain.key}
                className={
                  entry.key === domain.key ? styles.domainChipActive : styles.domainChip
                }
                onClick={() => setSelectedKey(entry.key)}
              >
                {DOMAIN_ICONS[entry.key] && (
                  <span className={styles.domainChipIcon} aria-hidden="true">
                    {DOMAIN_ICONS[entry.key]}
                  </span>
                )}
                {entry.label}
              </button>
            ))}
          </div>
        </nav>

        <article className={styles.domainCard}>
          <div className={styles.domainHeader}>
            <div>
              <p className={styles.kicker}>{domain.label}</p>
              <h2>{domain.display.headline}</h2>
            </div>
            {domain.signal_profile?.activity_band && (
              <span className={styles.domainSignalBadge}>
                {tr("lifeAreas.activityBadge", {
                  band: domain.signal_profile.activity_band,
                })}
              </span>
            )}
          </div>

          <p className={styles.domainOverview}>{domain.display.body}</p>

          {domain.evidence_matrix && (
            <div className={styles.domainEvidenceVerdict}>
              <div>
                <span className={styles.domainVerdictLabel}>
                  {domain.evidence_matrix.confirmation_status.replace("_", " ")}
                </span>
                <strong>
                  {tr("lifeAreas.conclusionStrength", {
                    strength: domain.evidence_matrix.conclusion_strength,
                  })}
                </strong>
              </div>
              <p>{domain.evidence_matrix.synthesis}</p>
            </div>
          )}

          <div
            className={styles.modeTabs}
            role="tablist"
            aria-label={tr("lifeAreas.readingDepth")}
          >
            {(["detailed", "action"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={viewMode === mode}
                className={viewMode === mode ? styles.modeTabActive : styles.modeTab}
                onClick={() => setViewMode(mode)}
              >
                {mode === "detailed"
                  ? tr("lifeAreas.modeDetailed")
                  : tr("lifeAreas.modeAction")}
              </button>
            ))}
          </div>

          {(domain.subthemes?.length ?? 0) > 0 && (
            <section
              className={styles.domainSubthemes}
              aria-labelledby="domain-subthemes-heading"
            >
              <div className={styles.domainSubthemeHeader}>
                <h3 id="domain-subthemes-heading">
                  {tr("lifeAreas.subthemesHeading")}
                </h3>
                <span>{tr("lifeAreas.subthemesRankNote")}</span>
              </div>
              <div className={styles.domainSubthemeGrid}>
                {domain.subthemes.slice(0, 6).map((subtheme, index) => (
                  <article key={subtheme.key} className={styles.domainSubthemeCard}>
                    <span className={styles.domainSubthemeRank}>
                      {tr("lifeAreas.subthemeRank", { rank: String(index + 1) })}
                    </span>
                    <div>
                      <strong>{subtheme.label}</strong>
                      <small>{subtheme.band}</small>
                    </div>
                    <p>{subtheme.summary}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className={styles.domainTimingWindows}>
            {timingWindows.map((window) => (
              <section key={window.label}>
                <h3>{window.label}</h3>
                <p>{window.value}</p>
              </section>
            ))}
          </div>

          {viewMode === "detailed" && copy && (
            <div className={styles.domainClarityBlock}>
              <p className={styles.domainDeepDescription}>{copy.description}</p>
              <div className={styles.domainStatementGrid}>
                <section className={styles.domainStatement}>
                  <h3>{tr("lifeAreas.clarityStatement")}</h3>
                  <p>{domain.display.clarity ?? copy.clarity}</p>
                </section>
                <section className={styles.domainStatement}>
                  <h3>{tr("lifeAreas.decisionRule")}</h3>
                  <p>{domain.display.decision_rule ?? copy.decisionRule}</p>
                </section>
                <section className={styles.domainStatement}>
                  <h3>{tr("lifeAreas.boundaryRule")}</h3>
                  <p>{domain.display.boundary_rule ?? copy.boundaryRule}</p>
                </section>
              </div>
            </div>
          )}

          {viewMode === "detailed" && (
            <div className={styles.domainGrid}>
              <section className={styles.domainCol}>
                <h3>{tr("lifeAreas.support")}</h3>
                <ul>
                  {domain.display.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
              {domain.display.watchouts.length > 0 && (
                <section className={styles.domainCol}>
                  <h3>{tr("lifeAreas.watch")}</h3>
                  <ul>
                    {domain.display.watchouts.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
              <section className={styles.domainCol}>
                <h3>{tr("lifeAreas.timing")}</h3>
                <ul>
                  {domain.display.timing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {/* The technical read stays behind a disclosure even here. House-lord
              notation and the rule trace mean nothing without training, and
              this page is still written for the client, not the astrologer. */}
          {viewMode === "detailed" && (
            <details className={styles.evidence}>
              <summary className={styles.evidenceSummary}>
                {tr("lifeAreas.evidenceSummary")}
              </summary>
              <div className={styles.evidenceBody}>
                <p className={styles.ruleBasis}>{domain.evidence.technical_note}</p>
                <dl className={styles.claims}>
                  {domain.evidence.claims.map((claim) => (
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
                <div className={styles.domainRulesPanel}>
                  <ol>
                    {rules.map((rule, index) => (
                      <li key={`${rule.label}-${index}`}>
                        <strong>{rule.label}:</strong> {rule.body}
                      </li>
                    ))}
                  </ol>
                </div>
                {domain.evidence_matrix && (
                  <div className={styles.domainEvidenceMatrix}>
                    {domain.evidence_matrix.entries.map((entry) => (
                      <section key={entry.family}>
                        <div>
                          <h4>{entry.label}</h4>
                          <span data-status={entry.status}>{entry.status}</span>
                        </div>
                        <p>{entry.summary}</p>
                      </section>
                    ))}
                  </div>
                )}
                {domain.supporting_patterns.length > 0 && (
                  <ul className={styles.evidencePatterns}>
                    {domain.supporting_patterns.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          )}

          {viewMode === "action" && (
            <div className={styles.domainActionPanel}>
              <section>
                <h3>{tr("lifeAreas.doNext")}</h3>
                <p>{domain.display.guidance}</p>
              </section>
              <section>
                <h3>{tr("lifeAreas.keepInMind")}</h3>
                <p>{domain.display.long_game}</p>
              </section>
              <section>
                <h3>{tr("lifeAreas.decisionFilter")}</h3>
                <p>
                  {domain.display.decision_rule ??
                    copy?.decisionRule ??
                    tr("lifeAreas.decisionFilterFallback")}
                </p>
              </section>
            </div>
          )}

          {viewMode !== "action" && (
            <>
              <p className={styles.domainGuidance}>
                <strong>{tr("lifeAreas.guidanceLabel")}</strong>{" "}
                {domain.display.guidance}
              </p>
              <p className={styles.domainLongGame}>
                <strong>{tr("lifeAreas.longGameLabel")}</strong>{" "}
                {domain.display.long_game}
              </p>
            </>
          )}
        </article>
    </>
  );
}
