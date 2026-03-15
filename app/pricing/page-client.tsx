"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";

type PricingPageClientProps = {
  returnTo?: string;
};

type PlanId = "basic" | "pro" | "ultimate";

const PLAN_ORDER: Array<{
  id: PlanId;
  priceLabel: string;
  accentClass: string;
  fieldClass: string;
  featureLines: string[];
}> = [
  {
    id: "basic",
    priceLabel: "$5",
    accentClass: "pricing-card--basic",
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
    accentClass: "pricing-card--pro",
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
    accentClass: "pricing-card--ultimate",
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
  const { isAuthenticated, user, redeemPlanCode } = useAuth();
  const { pushToast } = useToast();
  const [codes, setCodes] = useState<Record<PlanId, string>>({
    basic: "",
    pro: "",
    ultimate: "",
  });
  const [status, setStatus] = useState<Record<PlanId, string>>({
    basic: "",
    pro: "",
    ultimate: "",
  });
  const [isSubmitting, setIsSubmitting] = useState<Record<PlanId, boolean>>({
    basic: false,
    pro: false,
    ultimate: false,
  });

  const currentPlan = useMemo(() => normalizePlan(user?.subscription_tier), [user?.subscription_tier]);

  const redeem = async (planId: PlanId) => {
    setIsSubmitting((previous) => ({ ...previous, [planId]: true }));
    const result = await redeemPlanCode(codes[planId], planId);
    if (result.ok) {
      setCodes((previous) => ({ ...previous, [planId]: "" }));
      setStatus((previous) => ({
        ...previous,
        [planId]: `Plan updated to ${planId}.`,
      }));
      pushToast(`Plan updated to ${planId}.`, "success");
    } else {
      setStatus((previous) => ({
        ...previous,
        [planId]: result.error ?? "Plan redemption failed.",
      }));
      pushToast(result.error ?? "Plan redemption failed.", "error");
    }
    setIsSubmitting((previous) => ({ ...previous, [planId]: false }));
  };

  return (
    <main className="insights-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <section className="dashboard-shell">
        <p className="kicker">Pricing</p>
        <h1>Open access and account labels</h1>
        <p className="lead">
          All chart features are now open to every visitor, and the app begins in guest mode. This page
          stays around only for demo account labels and code-redemption testing.
        </p>

        <div className="pricing-active-plan">
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

        <div className="pricing-grid">
          {PLAN_ORDER.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;

            return (
              <article
                key={plan.id}
                className={`pricing-card ${plan.accentClass}${isCurrentPlan ? " pricing-card--active" : ""}`}
              >
                <div className="pricing-card-header">
                  <div>
                    <p className="kicker">{plan.id}</p>
                    <h2>{plan.priceLabel}</h2>
                  </div>
                  {isCurrentPlan && (
                    <span className="access-pill access-pill--premium">Already purchased</span>
                  )}
                </div>

                <div className="pricing-feature-list">
                  {plan.featureLines.map((feature) => (
                    <p key={feature}>{feature}</p>
                  ))}
                </div>

                <label className={`pricing-code-label ${plan.fieldClass}`}>
                  Want to change the account label for testing? Type the code below.
                  <input
                    type="text"
                    value={codes[plan.id]}
                    onChange={(event) =>
                      setCodes((previous) => ({ ...previous, [plan.id]: event.target.value }))
                    }
                    placeholder={`Enter ${plan.id.toUpperCase()} code`}
                    disabled={!isAuthenticated || isSubmitting[plan.id]}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void redeem(plan.id)}
                  disabled={!isAuthenticated || isSubmitting[plan.id]}
                >
                  {isSubmitting[plan.id] ? "Applying..." : `Activate ${plan.id}`}
                </button>

                {status[plan.id] && (
                  <p className={status[plan.id].startsWith("Plan updated") ? "pricing-success" : "error-note"}>
                    {status[plan.id]}
                  </p>
                )}
              </article>
            );
          })}
        </div>

        <section className="rules-panel pricing-matrix-panel">
          <div className="rules-header">
            <p className="kicker">Feature Matrix</p>
            <h2>Current access state</h2>
          </div>
          <div className="pricing-matrix">
            <div className="pricing-matrix-row pricing-matrix-row--header">
              <span>Feature</span>
              <span>Guest</span>
              <span>Pro</span>
              <span>Ultimate</span>
            </div>
            {FEATURE_MATRIX.map((row) => (
              <div key={row.label} className="pricing-matrix-row">
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
