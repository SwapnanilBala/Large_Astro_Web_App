/** Desktop guidance preferences only. No chart or birth information is stored here. */
export const ONBOARDING_KEY = "astro_desktop_guidance";
const CHANGED = "astro:desktop-guidance-changed";

export type GuidancePreferences = {
  welcomeDismissed: boolean;
  chartDismissed: boolean;
  tourCompleted: boolean;
  audience: "beginner" | "experienced";
};

const defaults: GuidancePreferences = {
  welcomeDismissed: false,
  chartDismissed: false,
  tourCompleted: false,
  audience: "beginner",
};

// Keep dismissals for this tab even when browser storage is unavailable.
let memory: string | null = null;

export function readGuidanceSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) ?? memory;
  } catch {
    return memory;
  }
}

export function parseGuidance(raw: string | null): GuidancePreferences {
  try {
    const saved: unknown = raw ? JSON.parse(raw) : null;
    if (!saved || typeof saved !== "object") return { ...defaults };
    const source = saved as Record<string, unknown>;
    return {
      welcomeDismissed: source.welcomeDismissed === true,
      chartDismissed: source.chartDismissed === true,
      tourCompleted: source.tourCompleted === true,
      audience: source.audience === "experienced" ? "experienced" : "beginner",
    };
  } catch {
    return { ...defaults };
  }
}

export function saveGuidance(patch: Partial<GuidancePreferences>) {
  if (typeof window === "undefined") return;
  memory = JSON.stringify({
    ...parseGuidance(readGuidanceSnapshot()),
    ...patch,
  });
  try {
    window.localStorage.setItem(ONBOARDING_KEY, memory);
  } catch {
    // In-memory preferences still apply for this visit.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function subscribeToGuidance(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === ONBOARDING_KEY || event.key === null) {
      memory = null;
      listener();
    }
  };
  window.addEventListener(CHANGED, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGED, listener);
    window.removeEventListener("storage", onStorage);
  };
}
