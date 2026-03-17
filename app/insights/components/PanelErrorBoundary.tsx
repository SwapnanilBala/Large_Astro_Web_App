"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type PanelErrorBoundaryProps = {
  children: ReactNode;
  panelName?: string;
};

type PanelErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  collapsed: boolean;
};

/**
 * Lightweight error boundary for individual insight panels.
 *
 * Catches errors within a single panel so other panels on the insights
 * page remain functional.  Shows a compact message with collapse / retry
 * controls.
 */
export default class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, collapsed: false };
  }

  static getDerivedStateFromError(error: Error): Partial<PanelErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const label = this.props.panelName ?? "Unknown panel";
    console.error(`[PanelErrorBoundary:${label}] Caught error:`, error);
    console.error(`[PanelErrorBoundary:${label}] Component stack:`, errorInfo.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, collapsed: false });
  };

  handleToggleCollapse = (): void => {
    this.setState((prev) => ({ collapsed: !prev.collapsed }));
  };

  render(): ReactNode {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    const label = this.props.panelName ?? "This panel";

    return (
      <section
        role="alert"
        style={{
          margin: "1rem 0",
          padding: "1rem 1.25rem",
          borderRadius: "0.75rem",
          background: "rgba(30, 20, 50, 0.6)",
          border: "1px solid rgba(212, 175, 55, 0.15)",
          color: "#a9a4b8",
          fontSize: "0.85rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <span>
            <span style={{ color: "#d4af37", marginRight: "0.5rem" }}>&#x26A0;</span>
            <strong style={{ color: "#c9c3d4" }}>{label}</strong> encountered an error
          </span>
          <span style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
            <button
              type="button"
              onClick={this.handleToggleCollapse}
              style={{
                padding: "0.3rem 0.65rem",
                borderRadius: "0.35rem",
                border: "1px solid rgba(169, 164, 184, 0.3)",
                background: "transparent",
                color: "#a9a4b8",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              {this.state.collapsed ? "Show details" : "Hide details"}
            </button>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                padding: "0.3rem 0.65rem",
                borderRadius: "0.35rem",
                border: "1px solid rgba(212, 175, 55, 0.4)",
                background: "transparent",
                color: "#d4af37",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              &#x21BB; Retry
            </button>
          </span>
        </div>

        {!this.state.collapsed && (
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.75rem",
              color: "#6b6580",
              wordBreak: "break-word",
            }}
          >
            {this.state.error.message}
          </p>
        )}
      </section>
    );
  }
}
