"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import { resolvePostAuthDestination } from "@/lib/post-auth-redirect";
import PageTransition from "../components/PageTransition";
import BackButton from "../components/BackButton";
import styles from "../login/login.module.css";

type RegisterPageClientProps = {
  returnTo?: string;
};

export default function RegisterPageClient({ returnTo }: RegisterPageClientProps) {
  const { register, loginWithGoogle, isAuthenticated, isLoading, user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

    if (password !== confirmPassword) {
      setError(t("register.passwordMismatch"));
      return;
    }

    setLoading(true);
    const result = await register(email, password, displayName);
    setLoading(false);
    if (result.ok) {
      setRedirecting(true);
      const resolvedDestination = await resolvePostAuthDestination(result.userId, destination);
      router.push(resolvedDestination);
    } else {
      setError(result.error ?? "Registration failed");
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    setGoogleLoading(true);
    const result = await loginWithGoogle(destination);
    if (!result.ok) {
      setGoogleLoading(false);
      setError(result.error ?? "Google sign-up failed");
    }
  };

  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";

  if (isLoading || redirecting) {
    return (
      <PageTransition>
      <div className="home-shell">
        <div className="ambient ambient-left" />
        <div className="ambient ambient-right" />
        <section className={styles.panel} style={{ textAlign: "center" }}>
          <p className="kicker">{t("register.redirecting")}</p>
        </section>
      </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
    <div className="home-shell">
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
            <div className={styles.fieldWrap}>
              <User className={styles.fieldIcon} size={18} aria-hidden="true" />
              <input
                id="register-display-name"
                type="text"
                placeholder=" "
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={`${styles.fieldInput} input-glow-gold`}
                required
                minLength={2}
              />
              <label htmlFor="register-display-name" className={styles.floatingLabel}>
                {t("register.displayName")}
              </label>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldWrap}>
              <Mail className={styles.fieldIcon} size={18} aria-hidden="true" />
              <input
                id="register-email"
                type="email"
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${styles.fieldInput} input-glow-aqua`}
                required
              />
              <label htmlFor="register-email" className={styles.floatingLabel}>
                {t("register.email")}
              </label>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldWrap}>
              <Lock className={styles.fieldIcon} size={18} aria-hidden="true" />
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${styles.fieldInput} ${styles.fieldInputWithToggle} input-glow-coral`}
                required
                minLength={6}
              />
              <label htmlFor="register-password" className={styles.floatingLabel}>
                {t("register.password")}
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
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldWrap}>
              <Lock className={styles.fieldIcon} size={18} aria-hidden="true" />
              <input
                id="register-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder=" "
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${styles.fieldInput} ${styles.fieldInputWithToggle} input-glow-violet`}
                required
                minLength={6}
              />
              <label htmlFor="register-confirm-password" className={styles.floatingLabel}>
                {t("register.confirmPassword")}
              </label>
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading || googleLoading}>
            {loading ? t("register.submitting") : t("register.submit")}
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
          onClick={handleGoogleSignup}
          disabled={loading || googleLoading}
        >
          <FcGoogle className={styles.googleIcon} aria-hidden="true" />
          <span>{googleLoading ? "Opening Google..." : "Continue with Google"}</span>
        </button>

        {/* ── Switch to Sign In ── */}
        <p className={styles.switchText}>
          {t("register.switchText")}{" "}
          <Link href={loginHref} className={styles.switchLink}>
            {t("register.switchLink")}
          </Link>
        </p>

      </section>
    </div>
    </PageTransition>
  );
}
