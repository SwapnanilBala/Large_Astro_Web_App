/**
 * Lightweight local error telemetry system.
 *
 * - Collects errors with context (component, route, timestamp, user agent, stack).
 * - Stores them in a circular buffer (max 50 entries) persisted to localStorage.
 * - Deduplicates: same message within 5 seconds increments a count.
 * - SSR-safe: all browser API access is guarded.
 *
 * No external services — data stays in the browser for debugging.
 */

const MAX_ENTRIES = 50;
const STORAGE_KEY = "astro_error_log";
const DEDUP_WINDOW_MS = 5_000;
const MAX_STACK_LENGTH = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorEntry {
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Error message */
  message: string;
  /** First 500 chars of the stack trace (if available) */
  stack: string | null;
  /** Arbitrary context supplied by the caller */
  context: Record<string, unknown>;
  /** window.location.href at the time of the error */
  url: string | null;
  /** Number of times this exact message was seen within the dedup window */
  count: number;
}

export interface ErrorSummary {
  total: number;
  last24h: number;
  topErrors: { message: string; count: number }[];
}

// ---------------------------------------------------------------------------
// In-memory buffer
// ---------------------------------------------------------------------------

let buffer: ErrorEntry[] = [];
let initialised = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Load persisted log into memory (once). */
function ensureInitialised(): void {
  if (initialised) return;
  initialised = true;

  if (!isBrowser()) return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        buffer = parsed as ErrorEntry[];
      }
    }
  } catch {
    // Corrupted data — start fresh.
    buffer = [];
  }
}

/** Persist the current buffer to localStorage. */
function persist(): void {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
  } catch {
    // localStorage full or unavailable — silently degrade.
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record an error. Deduplicates identical messages that occur within 5 s.
 *
 * @param error  An Error instance or a plain string message.
 * @param context  Optional bag of key/value context (component name, route, etc.).
 */
export function trackError(
  error: Error | string,
  context: Record<string, unknown> = {},
): void {
  ensureInitialised();

  const message = typeof error === "string" ? error : error.message;
  const stack =
    typeof error === "object" && error.stack
      ? error.stack.slice(0, MAX_STACK_LENGTH)
      : null;
  const now = new Date();
  const url = isBrowser() ? window.location.href : null;

  // --- Deduplication ---
  const lastEntry = buffer[buffer.length - 1];
  if (lastEntry && lastEntry.message === message) {
    const lastTime = new Date(lastEntry.timestamp).getTime();
    if (now.getTime() - lastTime < DEDUP_WINDOW_MS) {
      lastEntry.count += 1;
      lastEntry.timestamp = now.toISOString();
      persist();
      return;
    }
  }

  // --- New entry ---
  const entry: ErrorEntry = {
    timestamp: now.toISOString(),
    message,
    stack,
    context,
    url,
    count: 1,
  };

  buffer.push(entry);

  // Trim to circular-buffer max size.
  if (buffer.length > MAX_ENTRIES) {
    buffer = buffer.slice(buffer.length - MAX_ENTRIES);
  }

  persist();

  // Also log to console for immediate visibility in devtools.
  console.error("[ErrorTelemetry]", message, context);
}

/**
 * Return a copy of the full error log (oldest first).
 */
export function getErrorLog(): ErrorEntry[] {
  ensureInitialised();
  return [...buffer];
}

/**
 * Clear all stored errors from memory and localStorage.
 */
export function clearErrorLog(): void {
  buffer = [];
  initialised = true;

  if (isBrowser()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore.
    }
  }
}

/**
 * Return a high-level summary useful for quick triage.
 */
export function getErrorSummary(): ErrorSummary {
  ensureInitialised();

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  let total = 0;
  let last24h = 0;
  const counts = new Map<string, number>();

  for (const entry of buffer) {
    total += entry.count;

    const entryTime = new Date(entry.timestamp).getTime();
    if (now - entryTime < oneDayMs) {
      last24h += entry.count;
    }

    counts.set(
      entry.message,
      (counts.get(entry.message) ?? 0) + entry.count,
    );
  }

  const topErrors = [...counts.entries()]
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { total, last24h, topErrors };
}
