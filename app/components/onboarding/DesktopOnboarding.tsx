"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, BookOpen, CircleHelp, Compass, X } from "lucide-react";
import { readChartHistory } from "@/lib/chart-history-store";
import {
  parseGuidance,
  readGuidanceSnapshot,
  saveGuidance,
  subscribeToGuidance,
  type GuidancePreferences,
} from "@/lib/onboarding-store";
import { useHydrated } from "@/lib/use-hydrated";
import { useRouteMessages } from "@/lib/i18n-context";
import messages from "@/messages/en.onboarding.json";
import styles from "./desktop-onboarding.module.css";

const TERMS = [
  "chart",
  "lagna",
  "house",
  "dasha",
  "transit",
  "nakshatra",
  "yoga",
  "divisional",
  "ayanamsha",
  "strength",
] as const;
type Term = (typeof TERMS)[number];
type HelpTab = "intro" | "basics";
type Session = {
  path: string;
  mode: "help" | "tour";
  tab: HelpTab;
  term?: Term;
};
type GuidanceContext = {
  preferences: GuidancePreferences;
  returning: boolean;
  openHelp: (tab?: HelpTab, term?: Term) => void;
  startTour: () => void;
};
const Context = createContext<GuidanceContext | null>(null);
const serverSnapshot = () => null;

function useGuidance() {
  return useContext(Context);
}
function useCopy() {
  return useRouteMessages(messages);
}

// Stable page anchors, independent of layout class names and translated text.
const TOUR = [
  { target: "#top-takeaways", key: "Summary" },
  { target: "#birth-chart-guide, #chart-map", key: "Chart" },
  { target: "#vimshottari-dashas, #timing", key: "Timing" },
  { target: "#core", key: "Explore" },
] as const;

const SECTION_KEYS: Record<string, string> = {
  "life-areas": "lifeAreas",
  timing: "timing",
  "full-reading": "fullReading",
  "divisional-charts": "divisional",
  advanced: "advanced",
  compatibility: "compatibility",
  "house-support": "houseSupport",
  "life-shifts": "lifeShifts",
  "palm-history": "palm",
};

export function DesktopOnboardingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const path = usePathname();
  const raw = useSyncExternalStore(
    subscribeToGuidance,
    readGuidanceSnapshot,
    serverSnapshot,
  );
  const preferences = useMemo(() => parseGuidance(raw), [raw]);
  // Captured before this visit's chart is added to history; never infer that a
  // returning reader needs onboarding just because the feature is new.
  const [returning] = useState(() => readChartHistory().length > 0);
  const [session, setSession] = useState<Session | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const active = session?.path === path ? session : null;
  // Discard the session on navigation so Back cannot resurrect an old tour.
  if (session && session.path !== path) setSession(null);

  function open(mode: Session["mode"], tab: HelpTab = "intro", term?: Term) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (mode === "tour")
      saveGuidance({ welcomeDismissed: true, chartDismissed: true });
    setSession({ path, mode, tab, term });
  }
  const close = useCallback(() => {
    setSession(null);
    const target = returnFocus.current;
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus({ preventScroll: true });
      else
        document
          .querySelector<HTMLElement>("[data-desktop-help]")
          ?.focus({ preventScroll: true });
    });
  }, []);

  return (
    <Context.Provider
      value={{
        preferences,
        returning,
        openHelp: (tab, term) => open("help", tab, term),
        startTour: () => open("tour"),
      }}
    >
      {children}
      {active?.mode === "help" && (
        <HelpPanel
          key={`${path}:${active.tab}:${active.term ?? ""}`}
          tab={active.tab}
          term={active.term}
          close={close}
          startTour={() => open("tour")}
        />
      )}
      {active?.mode === "tour" && (
        <ChartTour key={path} close={close} audience={preferences.audience} />
      )}
    </Context.Provider>
  );
}

export function DesktopHelpButton() {
  const context = useGuidance();
  const t = useCopy();
  return (
    context && (
      <button
        type="button"
        className={styles.helpButton}
        data-desktop-help
        onClick={() => context.openHelp()}
      >
        <CircleHelp size={17} aria-hidden="true" />
        {t("onboarding.help")}
      </button>
    )
  );
}

export function WelcomeGuidance() {
  const context = useGuidance();
  const hydrated = useHydrated();
  const t = useCopy();
  if (
    !context ||
    !hydrated ||
    context.returning ||
    context.preferences.welcomeDismissed
  )
    return null;
  return (
    <aside
      className={styles.invitation}
      aria-labelledby="desktop-welcome-title"
    >
      <Compass className={styles.invitationIcon} size={23} aria-hidden="true" />
      <div>
        <h2 id="desktop-welcome-title">{t("onboarding.welcomeTitle")}</h2>
        <p>{t("onboarding.welcomeBody")}</p>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => {
            saveGuidance({ welcomeDismissed: true });
            context.openHelp();
          }}
        >
          {t("onboarding.showAround")}
        </button>
        <button
          type="button"
          className={styles.quiet}
          onClick={() =>
            saveGuidance({ welcomeDismissed: true, chartDismissed: true })
          }
        >
          {t("onboarding.dismiss")}
        </button>
      </div>
    </aside>
  );
}

export function ChartGuidance({
  chartKey,
  uncertainTime,
}: {
  chartKey: string;
  uncertainTime: boolean;
}) {
  const context = useGuidance();
  const hydrated = useHydrated();
  const t = useCopy();
  const invite =
    context &&
    hydrated &&
    !context.returning &&
    !context.preferences.chartDismissed &&
    !context.preferences.tourCompleted;
  // The marker stays present after dismissal, so Help can replay the tour.
  return (
    <div className={styles.desktopOnly} data-chart-ready={chartKey}>
      {invite && (
        <aside
          className={styles.invitation}
          aria-labelledby="desktop-chart-guide-title"
        >
          <BookOpen
            className={styles.invitationIcon}
            size={23}
            aria-hidden="true"
          />
          <div>
            <h2 id="desktop-chart-guide-title">{t("onboarding.chartTitle")}</h2>
            <p>{t("onboarding.chartBody")}</p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={context.startTour}
            >
              {t("onboarding.startTour")}
            </button>
            <button
              type="button"
              className={styles.quiet}
              onClick={() => saveGuidance({ chartDismissed: true })}
            >
              {t("onboarding.dismiss")}
            </button>
          </div>
        </aside>
      )}
      {uncertainTime && (
        <p className={styles.note}>{t("onboarding.uncertainTime")}</p>
      )}
    </div>
  );
}

export function BirthDetailsHelp() {
  const t = useCopy();
  return (
    <details className={styles.inlineHelp}>
      <summary>{t("onboarding.whyDetails")}</summary>
      <p>{t("onboarding.detailsBody")}</p>
    </details>
  );
}

export function DefaultMethodGuidance({
  onContinue,
  disabled,
}: {
  onContinue: () => void;
  disabled: boolean;
}) {
  const t = useCopy();
  const [comparing, setComparing] = useState(false);
  return (
    <aside className={styles.method} aria-labelledby="default-method-title">
      <h2 id="default-method-title">{t("onboarding.defaultTitle")}</h2>
      <p>{t("onboarding.defaultBody")}</p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={disabled}
          onClick={onContinue}
        >
          {t("onboarding.useDefault")}
        </button>
        <button
          type="button"
          className={styles.quiet}
          aria-expanded={comparing}
          onClick={() => {
            setComparing(!comparing);
            if (!comparing)
              document
                .getElementById("calculation-methods")
                ?.scrollIntoView({ block: "center", behavior: "instant" });
          }}
        >
          {t("onboarding.compare")}
        </button>
      </div>
      {comparing && <p>{t("onboarding.methodExplain")}</p>}
    </aside>
  );
}

export function TermHelp({ terms }: { terms: Term[] }) {
  const context = useGuidance();
  const t = useCopy();
  if (!context) return null;
  return (
    <span className={styles.terms}>
      <CircleHelp size={15} aria-hidden="true" />
      <span>{t("onboarding.termsLabel")}:</span>
      {terms.map((term) => (
        <button
          key={term}
          type="button"
          aria-label={t("onboarding.termHelp", {
            term: t(`onboarding.terms.${term}.name`),
          })}
          onClick={() => context.openHelp("basics", term)}
        >
          {t(`onboarding.terms.${term}.name`)}
        </button>
      ))}
    </span>
  );
}

export function SectionGuidance() {
  const path = usePathname();
  const t = useCopy();
  const section = SECTION_KEYS[path.split("/")[2]];
  if (!section) return null;
  return (
    <details className={styles.inlineHelp}>
      <summary>{t("onboarding.sectionHelp")}</summary>
      <p>{t(`onboarding.sections.${section}`)}</p>
      <p>{t("onboarding.interpretation")}</p>
      <TermHelp terms={["house", "dasha", "yoga", "divisional"]} />
    </details>
  );
}

function HelpPanel({
  tab: initialTab,
  term,
  close,
  startTour,
}: {
  tab: HelpTab;
  term?: Term;
  close: () => void;
  startTour: () => void;
}) {
  const t = useCopy();
  const context = useGuidance();
  const path = usePathname();
  const [tab, setTab] = useState(initialTab);
  const dialog = useRef<HTMLDialogElement>(null);
  const glossaryTarget = useRef<HTMLDetailsElement>(null);
  const titleId = useId();
  const section = SECTION_KEYS[path.split("/")[2]];
  const chartReady = !!document.querySelector("[data-chart-ready]");

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (term) glossaryTarget.current?.querySelector("summary")?.focus();
    const onResize = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) close();
    };
    window.addEventListener("resize", onResize);
    return () => {
      node?.close();
      document.body.style.overflow = previous;
      window.removeEventListener("resize", onResize);
    };
  }, [term, close]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      data-onboarding-ui
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            close();
        }
      }}
    >
      <header className={styles.panelHeader}>
        <h2 id={titleId}>{t("onboarding.title")}</h2>
        <button
          type="button"
          className={styles.iconButton}
          autoFocus={!term}
          aria-label={t("onboarding.close")}
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      <div className={styles.tabButtons}>
        <button
          type="button"
          aria-pressed={tab === "intro"}
          onClick={() => setTab("intro")}
        >
          {t("onboarding.introTab")}
        </button>
        <button
          type="button"
          aria-pressed={tab === "basics"}
          onClick={() => setTab("basics")}
        >
          {t("onboarding.basicsTab")}
        </button>
      </div>
      {tab === "intro" ? (
        <div className={styles.panelBody}>
          <p>{t("onboarding.introLead")}</p>
          <fieldset className={styles.audience}>
            <legend>{t("onboarding.audience")}</legend>
            {(["beginner", "experienced"] as const).map((audience) => (
              <label key={audience}>
                <input
                  type="radio"
                  name="guidance-audience"
                  value={audience}
                  checked={context?.preferences.audience === audience}
                  onChange={() => saveGuidance({ audience })}
                />
                {t(`onboarding.${audience}`)}
              </label>
            ))}
          </fieldset>
          <ol className={styles.introSteps}>
            {["intake", "method", "reading"].map((step) => (
              <li key={step}>
                <h3>{t(`onboarding.${step}Title`)}</h3>
                <p>{t(`onboarding.${step}Body`)}</p>
              </li>
            ))}
          </ol>
          {section && <SectionGuidance />}
          <p className={styles.note}>{t("onboarding.interpretation")}</p>
          <div className={styles.actions}>
            {chartReady ? (
              <button
                type="button"
                className={styles.primary}
                onClick={startTour}
              >
                {t(
                  context?.preferences.tourCompleted
                    ? "onboarding.replay"
                    : "onboarding.startTour",
                )}
              </button>
            ) : path === "/" ? (
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  close();
                  requestAnimationFrame(() =>
                    document.getElementById("birth-name")?.focus(),
                  );
                }}
              >
                {t("onboarding.startDetails")}
              </button>
            ) : path !== "/engine-select" ? (
              <Link href="/" className={styles.primary} onClick={close}>
                {t("onboarding.createChart")}
              </Link>
            ) : null}
          </div>
          {!chartReady && (
            <p className={styles.note}>{t("onboarding.tourUnavailable")}</p>
          )}
        </div>
      ) : (
        <div className={styles.panelBody}>
          <p className={styles.note}>{t("onboarding.interpretation")}</p>
          <div className={styles.glossary}>
            {TERMS.map((entry) => (
              <details
                key={entry}
                open={entry === term || undefined}
                ref={entry === term ? glossaryTarget : undefined}
              >
                <summary>{t(`onboarding.terms.${entry}.name`)}</summary>
                <p>{t(`onboarding.terms.${entry}.body`)}</p>
              </details>
            ))}
          </div>
        </div>
      )}
    </dialog>
  );
}

function ChartTour({
  close,
  audience,
}: {
  close: () => void;
  audience: GuidancePreferences["audience"];
}) {
  const t = useCopy();
  const [steps] = useState(() =>
    TOUR.map((step) => {
      // Prefer the specific target even when its fallback is a parent element.
      const target = step.target
        .split(", ")
        .find((selector) => document.querySelector(selector));
      return target ? { ...step, target } : null;
    }).filter((step) => step !== null),
  );
  const [position, setPosition] = useState(0);
  const [paused, setPaused] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [chartKey] = useState(
    () =>
      document.querySelector<HTMLElement>("[data-chart-ready]")?.dataset
        .chartReady,
  );
  const step = steps[position];

  useEffect(() => {
    const check = () => {
      const otherDialog = [
        ...document.querySelectorAll<HTMLElement>(
          '[aria-modal="true"], dialog[open]',
        ),
      ].some(
        (node) =>
          !node.hasAttribute("data-onboarding-ui") &&
          !node.hidden &&
          node.getAttribute("aria-hidden") !== "true",
      );
      setPaused(
        otherDialog || !window.matchMedia("(min-width: 1024px)").matches,
      );
      const marker = document.querySelector<HTMLElement>("[data-chart-ready]");
      if (
        !marker ||
        marker.dataset.chartReady !== chartKey ||
        !step ||
        !document.querySelector(step.target)
      )
        close();
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "aria-modal",
        "open",
        "aria-hidden",
        "data-chart-ready",
      ],
    });
    window.addEventListener("resize", check);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [chartKey, step, close]);

  useEffect(() => {
    if (!step || paused) return;
    const target = document.querySelector<HTMLElement>(step.target);
    if (!target) return;
    target.classList.add(styles.tourTarget);
    target.scrollIntoView({ block: "start", behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      target.classList.remove(styles.tourTarget);
      document.removeEventListener("keydown", onKey);
    };
  }, [step, paused, close]);

  if (!step || paused) return null;
  const last = position === steps.length - 1;
  const readingLink = document
    .querySelector<HTMLAnchorElement>('#core a[href*="/insights/full-reading"]')
    ?.getAttribute("href");
  const finish = () => {
    saveGuidance({
      tourCompleted: true,
      chartDismissed: true,
      welcomeDismissed: true,
    });
    close();
  };
  return (
    <section
      className={styles.tourPanel}
      data-onboarding-ui
      role="region"
      aria-label={t("onboarding.tourLabel")}
    >
      <div className={styles.tourTop}>
        <span>
          {t("onboarding.progress", {
            position: String(position + 1),
            total: String(steps.length),
          })}
        </span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t("onboarding.exit")}
          onClick={close}
        >
          <X size={19} />
        </button>
      </div>
      <h2 tabIndex={-1} ref={heading}>
        {t(`onboarding.tour${step.key}Title`)}
      </h2>
      <p>
        {t(
          `onboarding.tour${step.key}${audience === "experienced" ? "Expert" : "Body"}`,
        )}
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.quiet}
          disabled={position === 0}
          onClick={() => setPosition(position - 1)}
        >
          {t("onboarding.previous")}
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={() => (last ? finish() : setPosition(position + 1))}
        >
          {t(last ? "onboarding.finish" : "onboarding.next")}
          {!last && <ArrowRight size={15} aria-hidden="true" />}
        </button>
      </div>
      {last && readingLink && (
        <Link
          className={styles.readingLink}
          href={readingLink}
          onClick={finish}
        >
          {t("onboarding.exploreReading")}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
