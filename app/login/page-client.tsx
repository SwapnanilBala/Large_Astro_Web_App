"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import { resolvePostAuthDestination } from "@/lib/post-auth-redirect";
import PageTransition from "../components/PageTransition";
import BackButton from "../components/BackButton";
import styles from "./login.module.css";

type LoginPageClientProps = {
  returnTo?: string;
};

export default function LoginPageClient({ returnTo }: LoginPageClientProps) {
  const { login, loginWithGoogle, isAuthenticated, isLoading, user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const destination = returnTo ?? "/";

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setRedirecting(true);
      void resolvePostAuthDestination(user?.user_id, destination).then((resolvedDestination) => {
        router.push(resolvedDestination);
      });
    }
  }, [isAuthenticated, isLoading, destination, router, user?.user_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.ok) {
      setRedirecting(true);
      const resolvedDestination = await resolvePostAuthDestination(result.userId, destination);
      router.push(resolvedDestination);
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
            <div className={styles.fieldWrap}>
              <Mail className={styles.fieldIcon} size={18} aria-hidden="true" />
              <input
                id="login-email"
                type="email"
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.fieldInput}
                required
              />
              <label htmlFor="login-email" className={styles.floatingLabel}>
                {t("login.email")}
              </label>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldWrap}>
              <Lock className={styles.fieldIcon} size={18} aria-hidden="true" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${styles.fieldInput} ${styles.fieldInputWithToggle}`}
                required
                minLength={6}
              />
              <label htmlFor="login-password" className={styles.floatingLabel}>
                {t("login.password")}
              </label>
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
            <Link href="/forgot-password" className={styles.forgotLink}>
              Forgot password?
            </Link>
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
