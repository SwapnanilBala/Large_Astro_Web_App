"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";

type RegisterPageClientProps = {
  returnTo?: string;
};

export default function RegisterPageClient({ returnTo }: RegisterPageClientProps) {
  const { register, isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const destination = returnTo ? decodeURIComponent(returnTo) : "/";

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setRedirecting(true);
      router.push(destination);
    }
  }, [isAuthenticated, isLoading, destination, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("register.passwordMismatch"));
      return;
    }

    setLoading(true);
    const result = await register(email, password, displayName);
    setLoading(false);
    if (result.ok) {
      setRedirecting(true);
      router.push(destination);
    } else {
      setError(result.error ?? "Registration failed");
    }
  };

  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";

  if (isLoading || redirecting) {
    return (
      <main className="home-shell">
        <div className="ambient ambient-left" />
        <div className="ambient ambient-right" />
        <section className="auth-panel" style={{ textAlign: "center" }}>
          <p className="kicker">{t("register.redirecting")}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="home-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <section className="auth-panel">
        <p className="kicker">{t("register.kicker")}</p>
        <h1>{t("register.heading")}</h1>
        <p className="lead">{t("register.lead")}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="input-glow-gold">
            {t("register.displayName")}
            <input
              type="text"
              placeholder={t("register.displayNamePlaceholder")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              minLength={2}
            />
          </label>
          <label className="input-glow-aqua">
            {t("register.email")}
            <input
              type="email"
              placeholder={t("register.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="input-glow-coral">
            {t("register.password")}
            <input
              type="password"
              placeholder={t("register.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <label className="input-glow-violet">
            {t("register.confirmPassword")}
            <input
              type="password"
              placeholder={t("register.confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? t("register.submitting") : t("register.submit")}
          </button>
        </form>

        <p className="auth-switch">
          {t("register.switchText")}{" "}
          <Link href={loginHref} className="ghost-link">
            {t("register.switchLink")}
          </Link>
        </p>
      </section>
    </main>
  );
}
