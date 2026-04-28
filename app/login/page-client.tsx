"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import PageTransition from "../components/PageTransition";
import BackButton from "../components/BackButton";
import styles from "./login.module.css";

type LoginPageClientProps = {
  returnTo?: string;
};

export default function LoginPageClient({ returnTo }: LoginPageClientProps) {
  const { login, loginWithGoogle, isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    const result = await loginWithGoogle(destination);
    if (!result.ok) {
      setGoogleLoading(false);
      setError(result.error ?? "Google sign-in failed");
    }
  };

  const registerHref = returnTo ? `/register?returnTo=${encodeURIComponent(returnTo)}` : "/register";

  if (isLoading || redirecting) {
    return (
      <PageTransition>
      <main className="home-shell">
        <div className="ambient ambient-left" />
        <div className="ambient ambient-right" />
        <section className={styles.panel} style={{ textAlign: "center" }}>
          <p className="kicker">{t("login.redirecting")}</p>
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
        <div className={styles.header}>
          <p className="kicker">{t("login.kicker")}</p>
          <h1 className={styles.heading}>{t("login.heading")}</h1>
          <p className={styles.lead}>{t("login.lead")}</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              <span className={styles.labelIcon}>✉</span>
              <span className={styles.labelText}>{t("login.email")}</span>
            </label>
            <input
              type="email"
              placeholder={t("login.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.fieldInput}
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              <span className={styles.labelIcon}>🔒</span>
              <span className={styles.labelText}>{t("login.password")}</span>
            </label>
            <input
              type="password"
              placeholder={t("login.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.fieldInput}
              required
              minLength={6}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading || googleLoading}>
            {loading ? t("login.submitting") : t("login.submit")}
          </button>
        </form>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>or</span>
          <span className={styles.dividerLine} />
        </div>

        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleGoogleLogin}
          disabled={loading || googleLoading}
        >
          <FcGoogle className={styles.googleIcon} aria-hidden="true" />
          <span>{googleLoading ? "Opening Google..." : "Continue with Google"}</span>
        </button>

        <p className={styles.switchText}>
          {t("login.switchText")}{" "}
          <Link href={registerHref} className={styles.switchLink}>
            {t("login.switchLink")}
          </Link>
        </p>
      </section>
    </main>
    </PageTransition>
  );
}
