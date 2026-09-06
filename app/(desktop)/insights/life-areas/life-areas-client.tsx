"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FiArrowLeft, FiCompass } from "react-icons/fi";
import {
  DOMAIN_ICONS,
  DOMAIN_READ_COPY,
  buildDomainRules,
} from "@/app/(desktop)/insights/components/life-domain-copy";
import { getLifeDomainTimingWindows } from "@/lib/life-domain-timing";
import type { DashaInfo, LifeDomainInsight } from "@/lib/astro-types";
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
  clientName: string;
  insights: LifeDomainInsight[];
  dasha?: DashaInfo | null;
  historyQs: string;
  initialDomainKey: string;
};

export default function LifeAreasClient({
  clientName,
  insights,
  dasha,
  historyQs,
  initialDomainKey,
}: LifeAreasClientProps) {
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
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href={`/insights?${historyQs}#ultimate`} className={styles.backButton}>
          <FiArrowLeft aria-hidden="true" />
          Back to your reading
        </Link>

        <header className={styles.hero}>
          <div className={styles.heroIcon} aria-hidden="true">
            <FiCompass />
          </div>
          <p className={styles.kicker}>Ultimate Module · Life areas</p>
          <h1>{clientName}&apos;s life areas in full</h1>
          <p className={styles.lead}>
            Each area runs its own evidence matrix across natal promise,
            supporting factors, divisional confirmation, measured strength,
            house support, combinations, timing, and contradictions.
          </p>
        </header>

        <nav className={styles.domainNav} aria-label="Life areas">
          <p className={styles.domainNavLabel}>
            Choose a life area
            <span>Most active first</span>
          </p>
          <div className={styles.domainChips} role="tablist" aria-label="Life areas">
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
                {domain.signal_profile.activity_band} activity
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
                  {domain.evidence_matrix.conclusion_strength} conclusion
                </strong>
              </div>
              <p>{domain.evidence_matrix.synthesis}</p>
            </div>
          )}

          <div className={styles.modeTabs} role="tablist" aria-label="Reading depth">
            {(["detailed", "action"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={viewMode === mode}
                className={viewMode === mode ? styles.modeTabActive : styles.modeTab}
                onClick={() => setViewMode(mode)}
              >
                {mode === "detailed" ? "Detailed" : "Action Plan"}
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
                  What stands out within this area
                </h3>
                <span>Ranked from this chart&apos;s evidence</span>
              </div>
              <div className={styles.domainSubthemeGrid}>
                {domain.subthemes.slice(0, 6).map((subtheme, index) => (
                  <article key={subtheme.key} className={styles.domainSubthemeCard}>
                    <span className={styles.domainSubthemeRank}>#{index + 1}</span>
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
                  <h3>Clarity statement</h3>
                  <p>{domain.display.clarity ?? copy.clarity}</p>
                </section>
                <section className={styles.domainStatement}>
                  <h3>Decision rule</h3>
                  <p>{domain.display.decision_rule ?? copy.decisionRule}</p>
                </section>
                <section className={styles.domainStatement}>
                  <h3>Boundary rule</h3>
                  <p>{domain.display.boundary_rule ?? copy.boundaryRule}</p>
                </section>
              </div>
            </div>
          )}

          {viewMode === "detailed" && (
            <div className={styles.domainGrid}>
              <section className={styles.domainCol}>
                <h3>Support</h3>
                <ul>
                  {domain.display.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
              {domain.display.watchouts.length > 0 && (
                <section className={styles.domainCol}>
                  <h3>Watch</h3>
                  <ul>
                    {domain.display.watchouts.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
              <section className={styles.domainCol}>
                <h3>Timing</h3>
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
                How this domain is being read
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
                <h3>Do next</h3>
                <p>{domain.display.guidance}</p>
              </section>
              <section>
                <h3>Keep in mind</h3>
                <p>{domain.display.long_game}</p>
              </section>
              <section>
                <h3>Decision filter</h3>
                <p>
                  {domain.display.decision_rule ??
                    copy?.decisionRule ??
                    "Move when the support, timing, and evidence point in the same direction."}
                </p>
              </section>
            </div>
          )}

          {viewMode !== "action" && (
            <>
              <p className={styles.domainGuidance}>
                <strong>Guidance:</strong> {domain.display.guidance}
              </p>
              <p className={styles.domainLongGame}>
                <strong>Long game:</strong> {domain.display.long_game}
              </p>
            </>
          )}
        </article>

        <Link href={`/insights?${historyQs}#ultimate`} className={styles.backButtonBottom}>
          <FiArrowLeft aria-hidden="true" />
          Back to your reading
        </Link>
      </div>
    </main>
  );
}
