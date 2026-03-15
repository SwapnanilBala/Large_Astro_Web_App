"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";

type AuthGateProps = {
  children: ReactNode;
  featureLabel?: string;
  isLocked?: boolean;
  requiredTier?: "premium" | "ultimate";
};

export default function AuthGate({
  children,
  featureLabel = "advanced insights",
  isLocked = false,
  requiredTier = "premium",
}: AuthGateProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (isLoading) {
    return (
      <div className="auth-gate-wrapper">
        <div className="auth-gate-loading">
          <p>{t("authGate.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isLocked) {
    return <>{children}</>;
  }

  const currentUrl = `${pathname}?${searchParams.toString()}`;
  const returnTo = encodeURIComponent(currentUrl);
  const requiredLabel = requiredTier === "ultimate" ? "ultimate" : "premium";
  const showTierMessage = isAuthenticated;
  const currentTier = user?.subscription_tier ?? "guest";

  return (
    <div className="auth-gate-wrapper">
      <div className="auth-gate-blur">{children}</div>
      <div className="auth-gate-overlay">
        <div className="auth-gate-content">
          <p className="auth-gate-lock">&#x1f512;</p>
          <h3>
            {showTierMessage
              ? `${featureLabel} requires ${requiredLabel} access`
              : t("authGate.unlock", { feature: featureLabel })}
          </h3>
          <p className="auth-gate-desc">
            {showTierMessage
              ? `This chart was intentionally trimmed on the server because your current account tier is ${currentTier}. Upgrade to ${requiredLabel} to unlock this module.`
              : t("authGate.description")}
          </p>
          <div className="auth-gate-actions">
            {showTierMessage ? (
              <Link href={`/pricing?returnTo=${returnTo}`} className="auth-gate-btn auth-gate-btn-primary">
                View Pricing
              </Link>
            ) : (
              <>
                <Link href={`/register?returnTo=${returnTo}`} className="auth-gate-btn auth-gate-btn-primary">
                  {t("authGate.createAccount")}
                </Link>
                <Link href={`/login?returnTo=${returnTo}`} className="auth-gate-btn auth-gate-btn-secondary">
                  {t("authGate.signIn")}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
