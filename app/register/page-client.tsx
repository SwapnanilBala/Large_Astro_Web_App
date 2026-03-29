"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import PageTransition from "../components/PageTransition";
import BackButton from "../components/BackButton";
import styles from "../login/login.module.css";

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
      <PageTransition>
      <main className="home-shell">
        <div className="ambient ambient-left" />
        <div className="ambient ambient-right" />
        <section className={styles.panel} style={{ textAlign: "center" }}>
          <p className="kicker">{t("register.redirecting")}</p>
        </section>
      </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
    <main className="home-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <BackButton href="/" />
      <section className={styles.panel}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <p className="kicker">{t("register.kicker")}</p>
          <h1 className={styles.heading}>{t("register.heading")}</h1>
          <p className={styles.lead}>{t("register.lead")}</p>
        </div>

        {/* ── Form ── */}
        <form className={styles.form} onSubmit={handleSubmit}>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              <span className={styles.labelText}>{t("register.displayName")}</span>
            </label>
            <input
              type="text"
              placeholder={t("register.displayNamePlaceholder")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={`${styles.fieldInput} input-glow-gold`}
              required
              minLength={2}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              <span className={styles.labelText}>{t("register.email")}</span>
            </label>
            <input
              type="email"
              placeholder={t("register.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${styles.fieldInput} input-glow-aqua`}
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              <span className={styles.labelText}>{t("register.password")}</span>
            </label>
            <input
              type="password"
              placeholder={t("register.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${styles.fieldInput} input-glow-coral`}
              required
              minLength={6}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              <span className={styles.labelText}>{t("register.confirmPassword")}</span>
            </label>
            <input
              type="password"
              placeholder={t("register.confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`${styles.fieldInput} input-glow-violet`}
              required
              minLength={6}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? t("register.submitting") : t("register.submit")}
          </button>

        </form>

        {/* ── Switch to Sign In ── */}
        <p className={styles.switchText}>
          {t("register.switchText")}{" "}
          <Link href={loginHref} className={styles.switchLink}>
            {t("register.switchLink")}
          </Link>
        </p>

      </section>
    </main>
    </PageTransition>
  );
}
