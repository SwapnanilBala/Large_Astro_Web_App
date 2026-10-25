"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { ArrowRight, Minimize2, Maximize2, X } from "lucide-react";
import { useRouteMessages } from "@/lib/i18n-context";
import { saveGuidance, type GuidancePreferences } from "@/lib/onboarding-store";
import messages from "@/messages/en.onboarding.json";
import styles from "./desktop-onboarding.module.css";

export type WalkthroughMode = "chart" | "intake" | "method";
type Step = {
  target: string;
  key: string;
  legacy?: boolean;
  expand?: string;
  action?: {
    selector: string;
    label: string;
    kind: "focus" | "link" | "click";
  };
};

const CHART_STEPS: Step[] = [
  { target: "#top-takeaways", key: "Summary", legacy: true },
  {
    target: "#birth-chart-guide, #chart-map",
    key: "Chart",
    legacy: true,
    action: {
      selector: '[data-guide-chart-style] button[aria-pressed="false"]',
      label: "tryChart",
      kind: "click",
    },
  },
  {
    target: "#ultimate",
    key: "LifeAreas",
    action: {
      selector: '#ultimate a[href*="/insights/life-areas"]',
      label: "openArea",
      kind: "link",
    },
  },
  {
    target: "#vimshottari-dashas",
    key: "Timing",
    legacy: true,
    expand: '#vimshottari-dashas > button[aria-expanded="false"]',
    action: {
      selector: "[data-guide-current-period] button",
      label: "choosePeriod",
      kind: "focus",
    },
  },
  {
    target: "#timing",
    key: "Forecast",
    action: {
      selector: '#timing a[href*="/insights/timing"]',
      label: "openTiming",
      kind: "link",
    },
  },
  {
    target: "#core",
    key: "Explore",
    legacy: true,
    action: {
      selector: '#core a[href*="/insights/full-reading"]',
      label: "openReading",
      kind: "link",
    },
  },
  {
    target: "#divisional-charts",
    key: "Atlas",
    action: {
      selector: '#divisional-charts a[href*="/insights/divisional-charts"]',
      label: "openAtlas",
      kind: "link",
    },
  },
];
const METHOD_STEPS: Step[] = [
  {
    target: "[data-guide-default]",
    key: "Default",
    action: {
      selector: "[data-guide-default] button",
      label: "useDefault",
      kind: "click",
    },
  },
  {
    target: "[data-guide-tradition]",
    key: "Tradition",
    action: {
      selector: '[data-guide-tradition] [aria-checked="true"]',
      label: "chooseTradition",
      kind: "focus",
    },
  },
  {
    target: "[data-guide-houses]",
    key: "Houses",
    action: {
      selector: '[data-guide-houses] [aria-checked="true"]',
      label: "chooseHouses",
      kind: "focus",
    },
  },
];

function subscribeToPage(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "data-chart-ready",
      "data-guide-question",
      "data-guide-title",
      "data-guide-helper",
      "aria-modal",
      "aria-expanded",
      "aria-selected",
      "aria-pressed",
      "disabled",
      "href",
      "open",
      "aria-hidden",
    ],
  });
  return () => observer.disconnect();
}

function readIntake() {
  const node = document.querySelector<HTMLElement>("[data-guide-intake]");
  return JSON.stringify({
    question: node?.dataset.guideQuestion ?? "name",
    title: node?.dataset.guideTitle ?? "",
    helper: node?.dataset.guideHelper ?? "",
  });
}

function preferredTarget(selector: string) {
  return selector
    .split(", ")
    .find((candidate) => document.querySelector(candidate));
}

export default function GuidedWalkthrough({
  mode,
  close,
  audience,
}: {
  mode: WalkthroughMode;
  close: () => void;
  audience: GuidancePreferences["audience"];
}) {
  const t = useRouteMessages(messages);
  const status = useSyncExternalStore(
    subscribeToPage,
    () => {
      if (
        document.querySelector(
          mode === "chart"
            ? "[data-chart-ready]"
            : mode === "intake"
              ? "[data-guide-intake]"
              : "[data-guide-default]",
        )
      )
        return "ready";
      return document.querySelector("[data-guide-error]") ? "error" : "loading";
    },
    () => "loading",
  );
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setSlow(true), 20_000);
    return () => window.clearTimeout(timeout);
  }, []);
  if (status === "ready")
    return <Walkthrough mode={mode} close={close} audience={audience} />;
  return (
    <section
      className={styles.tourPanel}
      data-onboarding-ui
      role="region"
      aria-label={t("onboarding.tourLabel")}
    >
      <button
        type="button"
        className={styles.iconButton}
        aria-label={t("onboarding.exit")}
        onClick={close}
      >
        <X size={19} />
      </button>
      <p role="status">
        {t(
          status === "error" || slow
            ? "onboarding.walkthrough.unavailable"
            : "onboarding.walkthrough.loading",
        )}
      </p>
      {(status === "error" || slow) && (
        <Link className={styles.readingLink} href="/" onClick={close}>
          {t("onboarding.createChart")}
        </Link>
      )}
    </section>
  );
}

function Walkthrough({
  mode,
  close,
  audience,
}: {
  mode: WalkthroughMode;
  close: () => void;
  audience: GuidancePreferences["audience"];
}) {
  const t = useRouteMessages(messages);
  const [steps] = useState(() =>
    (mode === "chart"
      ? CHART_STEPS
      : mode === "method"
        ? METHOD_STEPS
        : [{ target: "[data-guide-intake]", key: "Intake" }]
    )
      .map((step) => {
        const target = preferredTarget(step.target);
        return target ? { ...step, target } : null;
      })
      .filter((step) => step !== null),
  );
  const [position, setPosition] = useState(0);
  const [paused, setPaused] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [placement, setPlacement] = useState<CSSProperties>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [chartKey] = useState(
    () =>
      document.querySelector<HTMLElement>("[data-chart-ready]")?.dataset
        .chartReady,
  );
  const step = steps[position];
  const intake = JSON.parse(
    useSyncExternalStore(subscribeToPage, readIntake, () => "{}"),
  ) as { question?: string; title?: string; helper?: string };
  const actionState = useSyncExternalStore(
    subscribeToPage,
    () => {
      const control = step?.action
        ? document.querySelector<HTMLElement>(step.action.selector)
        : null;
      return JSON.stringify({
        available: !!control && !control.hasAttribute("disabled"),
        href: control?.getAttribute("href"),
      });
    },
    () => "{}",
  );
  const action = JSON.parse(actionState) as {
    available?: boolean;
    href?: string;
  };

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
      // The old page can disappear before Next commits the new pathname.
      // Keep form/method guidance alive through that loading boundary.
      if (
        !step ||
        (mode === "chart" &&
          marker &&
          (marker.dataset.chartReady !== chartKey ||
            !document.querySelector(step.target)))
      )
        close();
    };
    check();
    const unsubscribe = subscribeToPage(check);
    window.addEventListener("resize", check);
    return () => {
      unsubscribe();
      window.removeEventListener("resize", check);
    };
  }, [mode, chartKey, step, close]);

  useEffect(() => {
    if (!step || paused) return;
    const target = document.querySelector<HTMLElement>(step.target);
    if (!target) return;
    if (step.expand)
      document.querySelector<HTMLButtonElement>(step.expand)?.click();
    target.classList.add(styles.tourTarget);
    target.setAttribute("data-guide-stop", String(position + 1));
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
      target.removeAttribute("data-guide-stop");
      document.removeEventListener("keydown", onKey);
    };
  }, [step, position, paused, close]);

  // Keep the explanation alongside the highlighted section where space allows.
  useEffect(() => {
    if (!step || paused) return;
    const target = document.querySelector<HTMLElement>(step.target);
    const card = panel.current;
    if (!target || !card) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const width = card.offsetWidth;
        const height = card.offsetHeight;
        const gap = 20;
        const minTop = 180;
        const maxTop = Math.max(minTop, window.innerHeight - height - gap);
        let left = window.innerWidth - width - gap;
        let top = maxTop;
        if (rect.right + gap + width <= window.innerWidth - gap) {
          left = rect.right + gap;
          top = Math.min(maxTop, Math.max(minTop, rect.top));
        } else if (rect.left - gap - width >= gap) {
          left = rect.left - gap - width;
          top = Math.min(maxTop, Math.max(minTop, rect.top));
        } else if (rect.bottom + gap + height <= window.innerHeight - gap)
          top = Math.max(minTop, rect.bottom + gap);
        setPlacement({ left, top, right: "auto", bottom: "auto" });
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(target);
    observer.observe(card);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step, paused, actionState, intake.question, minimized]);

  if (!step || paused) return null;
  const isIntake = mode === "intake";
  const last = position === steps.length - 1;
  const finish = () => {
    if (mode === "chart")
      saveGuidance({
        tourCompleted: true,
        chartDismissed: true,
        welcomeDismissed: true,
      });
    close();
  };
  const title = isIntake
    ? intake.title
    : t(
        step.legacy
          ? `onboarding.tour${step.key}Title`
          : `onboarding.walkthrough.${step.key}.title`,
      );
  const body = isIntake
    ? intake.helper
    : t(
        step.legacy
          ? `onboarding.tour${step.key}${audience === "experienced" ? "Expert" : "Body"}`
          : `onboarding.walkthrough.${step.key}.body`,
      );
  const questionIndex = ["name", "birthDate", "birthTime", "place"].indexOf(
    intake.question ?? "name",
  );

  return (
    <section
      ref={panel}
      className={`${styles.tourPanel} ${minimized ? styles.tourMinimized : ""}`}
      style={placement}
      data-onboarding-ui
      role="region"
      aria-label={t("onboarding.tourLabel")}
    >
      <div className={styles.tourTop}>
        <span>
          {t("onboarding.progress", {
            position: String(isIntake ? questionIndex + 1 : position + 1),
            total: String(isIntake ? 4 : steps.length),
          })}
        </span>
        <div className={styles.tourControls}>
          <button
            type="button"
            className={styles.iconButton}
            aria-expanded={!minimized}
            aria-label={t(
              minimized
                ? "onboarding.walkthrough.restore"
                : "onboarding.walkthrough.minimize",
            )}
            onClick={() => setMinimized(!minimized)}
          >
            {minimized ? <Maximize2 size={17} /> : <Minimize2 size={17} />}
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t("onboarding.exit")}
            onClick={close}
          >
            <X size={19} />
          </button>
        </div>
      </div>
      <h2 tabIndex={-1} ref={heading}>
        {title}
      </h2>
      {!minimized && (
        <>
          <p>{body}</p>
          <div className={styles.tryTask}>
            <strong>{t("onboarding.walkthrough.tryThis")}</strong>
            <p aria-live={isIntake ? "polite" : undefined}>
              {t(
                isIntake
                  ? `onboarding.walkthrough.intake.${intake.question}`
                  : `onboarding.walkthrough.${step.key}.task`,
              )}
            </p>
          </div>
          {isIntake ? (
            <button
              type="button"
              className={styles.primary}
              onClick={() =>
                document
                  .querySelector<HTMLElement>(
                    '[data-guide-intake] input:not([type="hidden"]):not([disabled])',
                  )
                  ?.focus()
              }
            >
              {t("onboarding.walkthrough.focusField")}
            </button>
          ) : (
            <>
              {step.action &&
                action.available &&
                (step.action.kind === "link" && action.href ? (
                  <Link
                    className={styles.stepAction}
                    href={action.href}
                    onClick={close}
                  >
                    {t(`onboarding.walkthrough.${step.action.label}`)}
                    <ArrowRight size={15} />
                  </Link>
                ) : (
                  <button
                    className={styles.stepAction}
                    type="button"
                    onClick={() => {
                      const control = document.querySelector<HTMLElement>(
                        step.action!.selector,
                      );
                      if (step.action!.kind === "click") control?.click();
                      else control?.focus();
                    }}
                  >
                    {t(`onboarding.walkthrough.${step.action.label}`)}
                  </button>
                ))}
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
              <details className={styles.tourContents}>
                <summary>{t("onboarding.walkthrough.jumpTo")}</summary>
                <ol>
                  {steps.map((item, index) => (
                    <li key={item.key}>
                      <button
                        type="button"
                        aria-current={index === position ? "step" : undefined}
                        onClick={() => setPosition(index)}
                      >
                        {t(
                          item.legacy
                            ? `onboarding.tour${item.key}Title`
                            : `onboarding.walkthrough.${item.key}.title`,
                        )}
                      </button>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
}
