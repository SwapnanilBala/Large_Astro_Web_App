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
      "Core natal chart reading",
      "Account workspace and saved charts",
      "Accurate location and timezone resolution",
    ],
  },
  {
    id: "pro",
    priceLabel: "$20",
    accentClass: "pricing-card--pro",
    fieldClass: "input-glow-gold",
    featureLines: [
      "Everything in Basic",
      "Nakshatra, dasha, aspects, and Navamsa",
      "Compatibility reports and saved comparisons",
    ],
  },
  {
    id: "ultimate",
    priceLabel: "$50",
    accentClass: "pricing-card--ultimate",
    fieldClass: "input-glow-coral",
    featureLines: [
      "Everything in Pro",
      "Live transits and workspace export",
      "Life-domain deep dives for love, family, influence, and more",
      "Reserved full-access credential for every feature",
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
    plans: { basic: "Included", pro: "Included", ultimate: "Included" },
  },
  {
    label: "Nakshatra and dasha",
    plans: { basic: "Locked", pro: "Included", ultimate: "Included" },
  },
  {
    label: "Aspects and Navamsa",
    plans: { basic: "Locked", pro: "Included", ultimate: "Included" },
  },
  {
    label: "Compatibility reports",
    plans: { basic: "Locked", pro: "Included", ultimate: "Included" },
  },
  {
    label: "Live transits",
    plans: { basic: "Locked", pro: "Locked", ultimate: "Included" },
  },
  {
    label: "Workspace export",
    plans: { basic: "Locked", pro: "Locked", ultimate: "Included" },
  },
  {
    label: "Life-domain deep dives",
    plans: { basic: "Locked", pro: "Locked", ultimate: "Included" },
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
        <h1>Mock pricing and code redemption</h1>
        <p className="lead">
          This is a temporary pricing screen. There is no real checkout yet. Each plan can be unlocked
          by entering the matching code under the card.
        </p>

        <div className="pricing-active-plan">
          <span className="access-pill access-pill--premium">Active plan</span>
          <p>
            {isAuthenticated
              ? `You are currently on ${currentPlan === "guest" ? "no active plan" : currentPlan}.`
              : "Sign in to activate a plan code."}
          </p>
        </div>

        {!isAuthenticated && (
          <p className="error-note">
            Sign in first, then redeem a plan code to update your account tier.
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
                  Already purchased? Type the code below.
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
            <h2>What each plan unlocks</h2>
          </div>
          <div className="pricing-matrix">
            <div className="pricing-matrix-row pricing-matrix-row--header">
              <span>Feature</span>
              <span>Basic</span>
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
