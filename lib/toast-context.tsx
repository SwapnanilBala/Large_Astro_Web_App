"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type ToastVariant = "success" | "error" | "info" | "warning";

type ToastRecord = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  dismissing: boolean;
};

type ToastContextValue = {
  pushToast: (message: string, variant?: ToastVariant, duration?: number) => void;
};

const TOAST_ICONS: Record<ToastVariant, string> = {
  success: "✓",
  error: "✗",
  info: "ℹ",
  warning: "⚠",
};

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 4000;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Triggers the slide-out animation then removes from state after 300ms
  const dismissToast = useCallback((id: string) => {
    // Clear any pending auto-dismiss timer
    const existing = timers.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timers.current.delete(id);
    }

    // Mark as dismissing to play slide-out animation
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t))
    );

    // After animation completes, remove from DOM
    const removeTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 320);
    timers.current.set(`remove-${id}`, removeTimer);
  }, []);

  const pushToast = useCallback(
    (
      message: string,
      variant: ToastVariant = "info",
      duration: number = DEFAULT_DURATION
    ) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setToasts((prev) => {
        let next = [...prev, { id, message, variant, duration, dismissing: false }];
        // If over limit, mark the oldest (non-dismissing) toast for dismissal
        if (next.filter((t) => !t.dismissing).length > MAX_TOASTS) {
          const oldest = next.find((t) => !t.dismissing);
          if (oldest) {
            next = next.map((t) =>
              t.id === oldest.id ? { ...t, dismissing: true } : t
            );
            // Schedule DOM removal for overflowed toast
            const overflowTimer = setTimeout(() => {
              setToasts((s) => s.filter((t) => t.id !== oldest.id));
            }, 320);
            timers.current.set(`remove-${oldest.id}`, overflowTimer);
          }
        }
        return next;
      });

      // Auto-dismiss after duration
      const autoTimer = setTimeout(() => dismissToast(id), duration);
      timers.current.set(id, autoTimer);
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              "toast",
              `toast--${toast.variant}`,
              toast.dismissing ? "toast--dismissing" : "toast--entering",
            ].join(" ")}
            role="alert"
          >
            <span className="toast-icon" aria-hidden="true">
              {TOAST_ICONS[toast.variant]}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
            <div
              className="toast-progress"
              style={
                {
                  "--toast-duration": `${toast.duration}ms`,
                } as CSSProperties
              }
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
