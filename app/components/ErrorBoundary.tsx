"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { trackError } from "@/lib/error-telemetry";
import { useTranslation } from "@/lib/i18n-context";

/*
 * The one component that has to render when the tree around it is broken.
 *
 * useTranslation throws outside a LanguageProvider, and a boundary cannot
 * assume it is inside one: both call sites (the two insights loaders) sit under
 * the desktop provider, but the fallback is also mounted bare in unit tests and
 * by anything that adopts this boundary above the provider. So the hook is
 * attempted and each call site carries the English wording as its default —
 * copy lives in messages/en.json under "errorBoundary" and this is only the
 * no-provider floor, not a second catalog to keep in step.
 */
function useErrorCopy(): (key: string, english: string) => string {
  let translate: ((key: string) => string) | null = null;
  try {
    /* rules-of-hooks reads the `try` as a branch, but there is no branch here:
       useTranslation is called exactly once on every render, and the only hook
       it calls -- useContext -- has already run by the time it decides to throw
       on a missing provider. The hook count is invariant either way, and this
       is the only hook the fallback uses. */
    // eslint-disable-next-line react-hooks/rules-of-hooks
    translate = useTranslation().t;
  } catch {
    /* No provider above us — fall through to the English defaults. */
  }
  return (key, english) => {
    const text = translate?.(key);
    /* `t` echoes the key back when it cannot resolve it. */
    return text === undefined || text === key ? english : text;
  };
}

type DefaultErrorFallbackProps = {
  error: Error;
  copied: boolean;
  onReset: () => void;
  onCopy: () => void;
};

/* Split out of the class so the copy can come from a hook. Everything it
   needs arrives as a prop; the boundary still owns the state. */
function DefaultErrorFallback({ error, copied, onReset, onCopy }: DefaultErrorFallbackProps) {
  const copy = useErrorCopy();

  return (
    <div
      role="alert"
      style={{
        margin: "2rem auto",
        maxWidth: "36rem",
        padding: "2.5rem 2rem",
        borderRadius: "1rem",
        background: "linear-gradient(135deg, #0d1130 0%, #1a1040 50%, #0d1130 100%)",
        border: "1px solid rgba(212, 175, 55, 0.25)",
        textAlign: "center",
        color: "#e0dce8",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          fontSize: "2.15rem",
          marginBottom: "0.75rem",
          opacity: 0.8,
        }}
        aria-hidden="true"
      >
        &#x2604;
      </div>
      <h2
        style={{
          fontSize: "1.1rem",
          fontWeight: 600,
          color: "#d4af37",
          marginBottom: "0.5rem",
        }}
      >
        {copy("errorBoundary.heading", "Something went wrong")}
      </h2>
      <p
        style={{
          fontSize: "0.9rem",
          lineHeight: 1.5,
          color: "#a9a4b8",
          marginBottom: "1.25rem",
        }}
      >
        {copy(
          "errorBoundary.description",
          "An unexpected error disrupted the cosmic flow. You can try again or return to the previous page."
        )}
      </p>
      <p
        style={{
          fontSize: "0.75rem",
          color: "#6b6580",
          marginBottom: "1.5rem",
          wordBreak: "break-word",
        }}
      >
        {error.message}
      </p>
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onReset}
          style={{
            padding: "0.6rem 1.5rem",
            borderRadius: "0.5rem",
            border: "1px solid #d4af37",
            background: "transparent",
            color: "#d4af37",
            fontSize: "0.9rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 0.2s, color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#d4af37";
            e.currentTarget.style.color = "#0d1130";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#d4af37";
          }}
        >
          &#x21BB; {copy("errorBoundary.tryAgain", "Try again")}
        </button>
        <button
          type="button"
          onClick={onCopy}
          style={{
            padding: "0.6rem 1.5rem",
            borderRadius: "0.5rem",
            border: "1px solid #6b6580",
            background: "transparent",
            color: "#a9a4b8",
            fontSize: "0.9rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 0.2s, color 0.2s, border-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(169, 164, 184, 0.1)";
            e.currentTarget.style.borderColor = "#a9a4b8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "#6b6580";
          }}
        >
          {copied
            ? `✓ ${copy("errorBoundary.copied", "Copied!")}`
            : `⎘ ${copy("errorBoundary.copyError", "Report this error")}`}
        </button>
      </div>
    </div>
  );
}

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
};

/**
 * Reusable error boundary with a cosmic-themed fallback UI.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 * Or with a custom fallback:
 *   <ErrorBoundary fallback={<p>Custom error</p>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={(error, reset) => <button onClick={reset}>Retry</button>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, copied: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
    trackError(error, {
      component: "ErrorBoundary",
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  handleCopyError = async (): Promise<void> => {
    const { error } = this.state;
    if (!error) return;

    const details = [
      `Error: ${error.message}`,
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${typeof window !== "undefined" ? window.location.href : "N/A"}`,
      `User Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "N/A"}`,
      error.stack ? `\nStack:\n${error.stack}` : "",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(details);
      this.setState({ copied: true } as Pick<ErrorBoundaryState, "copied">);
      setTimeout(() => this.setState({ copied: false } as Pick<ErrorBoundaryState, "copied">), 2000);
    } catch {
      // Clipboard API unavailable — fall back silently.
    }
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, copied: false });
  };

  render(): ReactNode {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    const { fallback } = this.props;

    if (typeof fallback === "function") {
      return fallback(this.state.error, this.handleReset);
    }

    if (fallback !== undefined) {
      return fallback;
    }

    return (
      <DefaultErrorFallback
        error={this.state.error}
        copied={this.state.copied}
        onReset={this.handleReset}
        onCopy={this.handleCopyError}
      />
    );
  }
}
