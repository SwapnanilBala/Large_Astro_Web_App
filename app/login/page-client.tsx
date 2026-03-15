"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";

type LoginPageClientProps = {
  returnTo?: string;
};

export default function LoginPageClient({ returnTo }: LoginPageClientProps) {
  const { login, isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.ok) {
      setRedirecting(true);
      router.push(destination);
    } else {
      setError(result.error ?? "Login failed");
    }
  };

  const registerHref = returnTo ? `/register?returnTo=${encodeURIComponent(returnTo)}` : "/register";

  if (isLoading || redirecting) {
    return (
      <main className="home-shell">
        <div className="ambient ambient-left" />
        <div className="ambient ambient-right" />
        <section className="auth-panel" style={{ textAlign: "center" }}>
          <p className="kicker">{t("login.redirecting")}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="home-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <section className="auth-panel">
        <p className="kicker">{t("login.kicker")}</p>
        <h1>{t("login.heading")}</h1>
        <p className="lead">{t("login.lead")}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="input-glow-aqua">
            {t("login.email")}
            <input
              type="email"
              placeholder={t("login.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="input-glow-coral">
            {t("login.password")}
            <input
              type="password"
              placeholder={t("login.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? t("login.submitting") : t("login.submit")}
          </button>
        </form>

        <p className="auth-switch">
          {t("login.switchText")}{" "}
          <Link href={registerHref} className="ghost-link">
            {t("login.switchLink")}
          </Link>
        </p>
      </section>
    </main>
  );
}
