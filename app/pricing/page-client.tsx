"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import BackButton from "../components/BackButton";
import styles from "./pricing.module.css";

type PricingPageClientProps = {
  returnTo?: string;
};

type PlanId = "basic" | "pro" | "ultimate";

const ACCENT_MAP: Record<PlanId, string> = {
  basic: styles.cardBasic,
  pro: styles.cardPro,
  ultimate: styles.cardUltimate,
};

const PLAN_ORDER: Array<{
  id: PlanId;
  priceLabel: string;
  fieldClass: string;
  featureLines: string[];
}> = [
  {
    id: "basic",
    priceLabel: "$5",
    fieldClass: "input-glow-aqua",
    featureLines: [
      "Guest mode starts here by default",
      "All chart-reading features are already unlocked",
      "Create an account only if you want synced workspace storage",
    ],
  },
  {
    id: "pro",
    priceLabel: "$20",
    fieldClass: "input-glow-gold",
    featureLines: [
      "Same open chart access as guest mode",
      "Useful if you still want to test plan-code flows",
      "Keeps compatibility and workspace tools under an account label",
    ],
  },
  {
    id: "ultimate",
    priceLabel: "$50",
    fieldClass: "input-glow-coral",
    featureLines: [
      "Same open chart access as every other tier",
      "Reserved labels still work for internal/demo accounts",
      "Useful for testing upgrade flows without changing public access",
      "Does not unlock extra chart modules because they are already open",
    ],
  },
];

const FEATURE_MATRIX: Array<{
  label: string;
  plans: Record<PlanId, string>;
}> = [
  {
    label: "Core natal chart",
    plans: { basic: "Included", pro: "Included", ultimate: "Included" },
  },
  {
    label: "Saved charts workspace",
    plans: { basic: "Account required", pro: "Account required", ultimate: "Account required" },
  },
  {
    label: "Nakshatra and dasha",
    plans: { basic: "Included", pro: "Included", ultimate: "Included" },
  },
  {
    label: "Aspects and Navamsa",
    plans: { basic: "Included", pro: "Included", ultimate: "Included" },
  },
  {
    label: "Compatibility reports",
    plans: { basic: "Included", pro: "Included", ultimate: "Included" },
  },
  {
    label: "Live transits",
    plans: { basic: "Included", pro: "Included", ultimate: "Included" },
  },
  {
    label: "Workspace export",
    plans: { basic: "Account required", pro: "Account required", ultimate: "Account required" },
  },
  {
    label: "Life-domain deep dives",
    plans: { basic: "Included", pro: "Included", ultimate: "Included" },
  },
];

function normalizePlan(tier: string | undefined): PlanId | "guest" {
  if (!tier) return "guest";
  if (tier === "premium" || tier === "premium_trial") return "pro";
  if (tier === "admin") return "ultimate";
  if (tier === "basic" || tier === "pro" || tier === "ultimate") return tier;
  return "guest";
}

export default function PricingPageClient({ returnTo = "" }: PricingPageClientProps) {
  const { isAuthenticated, user } = useAuth();

  const currentPlan = useMemo(() => normalizePlan(user?.subscription_tier), [user?.subscription_tier]);

  return (
    <main className="insights-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <BackButton href="/" />
      <section className="dashboard-shell">
        <p className="kicker">Pricing</p>
        <h1>Open access and account labels</h1>
        <p className="lead">
          All chart features are open to every visitor, and account-backed workspace data now lives in
          Supabase instead of the old backend database layer.
        </p>

        <div className={styles.activePlan}>
          <span className="access-pill access-pill--premium">Active plan</span>
          <p>
            {isAuthenticated
              ? `Your account label is ${currentPlan === "guest" ? "guest" : currentPlan}.`
              : "You are currently browsing as guest with full chart access."}
          </p>
        </div>

        {!isAuthenticated && (
          <p className="error-note">
            Sign in only if you want synced saved charts, workspace actions, or account-based testing.
          </p>
        )}

        <div className={styles.grid}>
          {PLAN_ORDER.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;

            return (
              <article
                key={plan.id}
                className={`${isCurrentPlan ? styles.cardActive : styles.card} ${ACCENT_MAP[plan.id]}`}
              >
                <div className={styles.cardHeader}>
                  <div>
                    <p className="kicker">{plan.id}</p>
                    <h2>{plan.priceLabel}</h2>
                  </div>
                  {isCurrentPlan && (
                    <span className="access-pill access-pill--premium">Already purchased</span>
                  )}
                </div>

                <div className={styles.featureList}>
                  {plan.featureLines.map((feature) => (
                    <p key={feature}>{feature}</p>
                  ))}
                </div>
                <p className={`${styles.codeLabel} ${plan.fieldClass}`}>
                  {plan.id === "basic" &&
                    "Guest mode is the default. Create an account only if you want synced charts and saved reports."}
                  {plan.id === "pro" &&
                    "Supabase auth keeps your workspace synced across devices while the chart engine stays open-access."}
                  {plan.id === "ultimate" &&
                    "Ultimate is now just an account label; it no longer controls chart access or hidden modules."}
                </p>
              </article>
            );
          })}
        </div>

        <section className={`rules-panel ${styles.matrixPanel}`}>
          <div className="rules-header">
            <p className="kicker">Feature Matrix</p>
            <h2>Current access state</h2>
          </div>
          <div className={styles.matrix}>
            <div className={styles.matrixRowHeader}>
              <span>Feature</span>
              <span>Guest</span>
              <span>Pro</span>
              <span>Ultimate</span>
            </div>
            {FEATURE_MATRIX.map((row) => (
              <div key={row.label} className={styles.matrixRow}>
                <span>{row.label}</span>
                <span>{row.plans.basic}</span>
                <span>{row.plans.pro}</span>
                <span>{row.plans.ultimate}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="workspace-actions">
          {isAuthenticated ? (
            <Link href="/workspace" className="ghost-link">
              Open workspace
            </Link>
          ) : (
            <>
              <Link href="/login" className="ghost-link">
                Sign in
              </Link>
              <Link href="/register" className="recalculate-btn">
                Create account
              </Link>
            </>
          )}
          {returnTo && (
            <Link href={returnTo} className="recalculate-btn">
              Return to locked page
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
