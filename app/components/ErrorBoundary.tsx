"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
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
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
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
            fontSize: "2.5rem",
            marginBottom: "0.75rem",
            opacity: 0.8,
          }}
          aria-hidden="true"
        >
          &#x2604;
        </div>
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "#d4af37",
            marginBottom: "0.5rem",
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            fontSize: "0.9rem",
            lineHeight: 1.5,
            color: "#a9a4b8",
            marginBottom: "1.25rem",
          }}
        >
          An unexpected error disrupted the cosmic flow. You can try again or
          return to the previous page.
        </p>
        <p
          style={{
            fontSize: "0.75rem",
            color: "#6b6580",
            marginBottom: "1.5rem",
            wordBreak: "break-word",
          }}
        >
          {this.state.error.message}
        </p>
        <button
          type="button"
          onClick={this.handleReset}
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
          &#x21BB; Try again
        </button>
      </div>
    );
  }
}
