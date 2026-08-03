"use client";

import type { FormEvent, KeyboardEvent } from "react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { GiCrystalBall, GiCompass } from "react-icons/gi";
import {
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
  HiOutlineChevronDown,
  HiOutlineClock,
  HiOutlineExclamationCircle,
  HiOutlineMapPin,
  HiOutlineSparkles,
  HiOutlineUser,
} from "react-icons/hi2";
import { profileInitialState, type ProfileQueryInput } from "@/lib/astro-types";
import {
  COARSE_TIME_OPTIONS,
  getBirthTimeFallback,
  hasCoarseTimeFallback,
} from "@/lib/birth-time";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import AutocompleteInput from "./components/AutocompleteInput";
import ChartHistory from "./components/ChartHistory";
import FormCelebration from "./components/FormCelebration";
import { hapticSuccess } from "@/lib/haptics";
import PremiumInput from "./components/PremiumInput";
import PremiumButton from "./components/PremiumButton";
import PremiumDatePicker from "./components/PremiumDatePicker";
import PremiumToggle from "./components/PremiumToggle";
import styles from "./page.module.css";


const CosmicBackground = dynamic(() => import("./components/CosmicBackground"), {
  ssr: false,
  loading: () => null,
});

const BirthChartTeaser = dynamic(() => import("./components/BirthChartTeaser"), {
  ssr: false,
  loading: () => null,
});

const requiredFields: Array<keyof ProfileQueryInput> = [
  "name",
  "birthDate",
  // "birthTime", // Will handle requiredness conditionally
  "timezoneOffsetMinutes",
  "latitude",
  "longitude",
  "country",
  "state",
  "city",
];
// Coarse time options for unknown birth time
const SMART_FILL_EXAMPLES = [
  {
    key: "home.smartFillExample1",
    fallback: "Aarya Patel, 14 Mar 1995, 3:45 PM, Mumbai, Maharashtra, India",
  },
  {
    key: "home.smartFillExample2",
    fallback: "Jordan Lee, 02 Aug 1989, 11:20 AM, Brooklyn, New York, United States",
  },
  {
    key: "home.smartFillExample3",
    fallback: "Maya, 8 Nov 2001, 8:15 AM, Paris, Ile-de-France, France",
  },
];

const INTAKE_DRAFT_STORAGE_KEY = "astro_intake_draft";
const BIRTH_DETAILS_HISTORY_STORAGE_KEY = "astro_birth_details_history";
const BIRTH_DETAILS_HISTORY_LIMIT = 5;

type StoredIntakeDraft = {
  draft: ProfileQueryInput;
  unknownTime: boolean;
  coarseTime: string;
};

type BirthDetailsHistoryEntry = StoredIntakeDraft & {
  id: string;
  savedAt: string;
};

type GeocodeApiResponse = {
  found?: boolean;
  lat?: number;
  lon?: number;
  timezoneOffsetMinutes?: number;
  timeZoneId?: string;
};

/* Annotated rather than inferred: only some steps carry meta/missing, and an
 * inferred union would make those properties unreachable at the call site. */
type IntakeStepState = {
  id: string;
  label: string;
  detail: string;
  complete: boolean;
  meta?: string;
  missing?: string;
};

const withClientTimezoneDefault = (): ProfileQueryInput => ({
  ...profileInitialState,
  timezoneOffsetMinutes: "0",
  timeZoneId: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""
});

const profileKeys = Object.keys(profileInitialState) as Array<keyof ProfileQueryInput>;

function normalizeProfileDraft(value: unknown): ProfileQueryInput | null {
  if (!value || typeof value !== "object") return null;

  const source = value as Record<string, unknown>;
  const isValid = profileKeys.every(
    (key) => source[key] === undefined || typeof source[key] === "string",
  );
  if (!isValid) return null;

  return { ...profileInitialState, ...source } as ProfileQueryInput;
}

function buildHistoryKey(entry: StoredIntakeDraft) {
  const birthTime = entry.unknownTime
    ? getBirthTimeFallback(entry.coarseTime || "unknown")
    : entry.draft.birthTime;

  return [
    entry.draft.name,
    entry.draft.birthDate,
    birthTime,
    entry.unknownTime ? entry.coarseTime : "exact",
    entry.draft.country,
    entry.draft.state,
    entry.draft.city,
    entry.draft.latitude,
    entry.draft.longitude,
  ]
    .map((value) => value.trim().toLowerCase())
    .join("|");
}

function createHistoryId() {
  return globalThis.crypto?.randomUUID?.() ?? `history-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseBirthDetailsHistory(): BirthDetailsHistoryEntry[] {
  try {
    const stored = localStorage.getItem(BIRTH_DETAILS_HISTORY_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): BirthDetailsHistoryEntry | null => {
        if (!item || typeof item !== "object") return null;

        const source = item as Record<string, unknown>;
        const draft = normalizeProfileDraft(source.draft);
        if (!draft) return null;

        return {
          id: typeof source.id === "string" ? source.id : createHistoryId(),
          savedAt: typeof source.savedAt === "string" ? source.savedAt : new Date().toISOString(),
          draft,
          unknownTime: typeof source.unknownTime === "boolean" ? source.unknownTime : false,
          coarseTime: typeof source.coarseTime === "string" ? source.coarseTime : "",
        };
      })
      .filter((entry): entry is BirthDetailsHistoryEntry => entry !== null)
      .slice(0, BIRTH_DETAILS_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function Home() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [unknownTime, setUnknownTime] = useState(false);
  const [coarseTime, setCoarseTime] = useState("");
  const { user } = useAuth();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProfileQueryInput>(withClientTimezoneDefault);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latLonExpanded, setLatLonExpanded] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const [birthDetailsHistory, setBirthDetailsHistory] = useState<BirthDetailsHistoryEntry[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geoAbortController = useRef<AbortController | null>(null);
  const geocodeCache = useRef(new Map<string, GeocodeApiResponse>());
  const [draftSaved, setDraftSaved] = useState(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSavedDisplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Smart fill state
  const [smartFillText, setSmartFillText] = useState("");
  const [smartFillExpanded, setSmartFillExpanded] = useState(false);


  useEffect(() => {
    const clientOffset = String(-new Date().getTimezoneOffset());
    setDraft((previous) => ({ ...previous, timezoneOffsetMinutes: clientOffset }));
  }, []);

  /* ── Restore draft from localStorage on mount (runs after timezone default) ── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(INTAKE_DRAFT_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      const savedDraft =
        parsed.draft && typeof parsed.draft === "object"
          ? (parsed.draft as Record<string, unknown>)
          : parsed;
      // Merge with current defaults so older saved drafts survive new metadata fields.
      const keys = Object.keys(profileInitialState) as Array<keyof ProfileQueryInput>;
      const isValid = keys.every((k) => savedDraft[k] === undefined || typeof savedDraft[k] === "string");
      if (!isValid) return;
      setDraft({ ...profileInitialState, ...savedDraft } as ProfileQueryInput);
      if (typeof parsed.unknownTime === "boolean") setUnknownTime(parsed.unknownTime);
      if (typeof parsed.coarseTime === "string") setCoarseTime(parsed.coarseTime);
    } catch {
      // localStorage may throw in private browsing or if data is corrupt
    }
  }, []);

  useEffect(() => {
    setBirthDetailsHistory(parseBirthDetailsHistory());
  }, []);

  /* ── Auto-save draft to localStorage (debounced 500ms) ── */
  useEffect(() => {
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);

    draftSaveTimer.current = setTimeout(() => {
      try {
        // Only save if user has entered something meaningful
        const userFields: Array<keyof ProfileQueryInput> = [
          "name", "birthDate", "birthTime", "country", "state", "city",
        ];
        const hasContent = userFields.some((f) => draft[f].trim().length > 0);
        if (!hasContent) {
          localStorage.removeItem(INTAKE_DRAFT_STORAGE_KEY);
          return;
        }
        const storedDraft: StoredIntakeDraft = {
          draft,
          unknownTime,
          coarseTime,
        };
        localStorage.setItem(INTAKE_DRAFT_STORAGE_KEY, JSON.stringify(storedDraft));
        setDraftSaved(true);
        if (draftSavedDisplayTimer.current) clearTimeout(draftSavedDisplayTimer.current);
        draftSavedDisplayTimer.current = setTimeout(() => setDraftSaved(false), 1500);
      } catch {
        // localStorage may throw in private browsing
      }
    }, 500);

    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [coarseTime, draft, unknownTime]);

  const draftCountry = draft.country;
  const draftState = draft.state;
  const draftCity = draft.city;
  const draftBirthDate = draft.birthDate;
  const draftBirthTime = draft.birthTime;
  const effectiveBirthTime =
    unknownTime && hasCoarseTimeFallback(coarseTime)
      ? getBirthTimeFallback(coarseTime)
      : draftBirthTime;

  useEffect(() => {
    if (!draftCountry.trim() && !draftCity.trim()) return;

    if (geoTimer.current) clearTimeout(geoTimer.current);

    geoTimer.current = setTimeout(async () => {
      const params = new URLSearchParams();
      if (draftCity.trim()) params.set("city", draftCity.trim());
      if (draftState.trim()) params.set("state", draftState.trim());
      if (draftCountry.trim()) params.set("country", draftCountry.trim());
      if (draftBirthDate.trim()) params.set("birthDate", draftBirthDate.trim());
      if (effectiveBirthTime.trim()) params.set("birthTime", effectiveBirthTime.trim());

      const cacheKey = params.toString();
      const applyGeocodeResult = (data: GeocodeApiResponse) => {
        if (data.found && typeof data.lat === "number" && typeof data.lon === "number") {
          setDraft((prev) => ({
            ...prev,
            latitude: String(data.lat),
            longitude: String(data.lon),
            timezoneOffsetMinutes:
              typeof data.timezoneOffsetMinutes === "number"
                ? String(data.timezoneOffsetMinutes)
                : prev.timezoneOffsetMinutes,
            timeZoneId: typeof data.timeZoneId === "string" ? data.timeZoneId : prev.timeZoneId,
          }));
          setGeoStatus("found");
        } else {
          setGeoStatus("not-found");
        }
      };

      const cached = geocodeCache.current.get(cacheKey);
      if (cached) {
        applyGeocodeResult(cached);
        return;
      }

      geoAbortController.current?.abort();
      const controller = new AbortController();
      geoAbortController.current = controller;
      setGeoStatus("loading");

      try {
        const res = await fetch(`/api/geocode?${cacheKey}`, { signal: controller.signal });
        const data = await res.json() as GeocodeApiResponse;

        if (controller.signal.aborted) return;

        geocodeCache.current.set(cacheKey, data);
        if (geocodeCache.current.size > 20) {
          const oldestKey = geocodeCache.current.keys().next().value;
          if (oldestKey) geocodeCache.current.delete(oldestKey);
        }

        applyGeocodeResult(data);
      } catch {
        if (controller.signal.aborted) return;
        setGeoStatus("not-found");
      }
    }, 800);

    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
      geoAbortController.current?.abort();
    };
  }, [draftBirthDate, draftCity, draftCountry, draftState, effectiveBirthTime]);

  const canSubmit = useMemo(() => {
    const hasRequiredProfile = requiredFields.every((field) => draft[field].trim().length > 0);
    const hasUsableBirthTime = unknownTime
      ? hasCoarseTimeFallback(coarseTime)
      : draft.birthTime.trim().length > 0;
    return hasRequiredProfile && hasUsableBirthTime;
  }, [coarseTime, draft, unknownTime]);

  /* Preview completion follows the teaser fields without changing submit validation. */
  const previewCompletion = useMemo(() => {
    const locationFilled = ["country", "state", "city"].filter(
      (field) => draft[field as keyof ProfileQueryInput].trim().length > 0,
    ).length;
    const timeFilled = draft.birthTime.trim().length > 0 || (unknownTime && hasCoarseTimeFallback(coarseTime));
    const filled =
      Number(draft.name.trim().length > 0) +
      Number(draft.birthDate.trim().length > 0) +
      Number(timeFilled) +
      locationFilled;

    return {
      filled,
      total: 6,
      percent: Math.round((filled / 6) * 100),
    };
  }, [coarseTime, draft, unknownTime]);

  const previewStatus = useMemo(() => {
    if (canSubmit) return t("home.previewStatusReady");
    if (geoStatus === "found") return t("home.previewStatusCoordinates");
    if (unknownTime && hasCoarseTimeFallback(coarseTime)) return t("home.previewStatusEstimate");
    if (previewCompletion.filled === 0) return t("home.previewStatusAwaiting");
    return t("home.previewStatusBuilding");
  }, [canSubmit, coarseTime, geoStatus, previewCompletion.filled, t, unknownTime]);

  const tWithFallback = useCallback(
    (key: string, fallback: string, params?: Record<string, string>) => {
      const translated = t(key, params);
      return translated === key ? fallback : translated;
    },
    [t],
  );

  const hasName = draft.name.trim().length > 0;
  const hasBirthDate = draft.birthDate.trim().length > 0;
  const hasBirthTimeSignal = unknownTime
    ? hasCoarseTimeFallback(coarseTime)
    : draft.birthTime.trim().length > 0;
  const hasCountry = draft.country.trim().length > 0;
  const hasState = draft.state.trim().length > 0;
  const hasCity = draft.city.trim().length > 0;
  const hasLatitude = draft.latitude.trim().length > 0;
  const hasLongitude = draft.longitude.trim().length > 0;
  const hasLocation = hasCountry && hasState && hasCity && hasLatitude && hasLongitude;

  const missingFieldLabels = useMemo(() => {
    const missing: string[] = [];
    if (!hasName) missing.push(t("home.formName"));
    if (!hasBirthDate) missing.push(t("home.formBirthDate"));
    if (!hasBirthTimeSignal) missing.push(t("home.formBirthTime"));
    if (!hasCountry) missing.push(t("home.formCountry"));
    if (!hasState) missing.push(t("home.formState"));
    if (!hasCity) missing.push(t("home.formCity"));
    if (!hasLatitude) missing.push(t("home.formLatitude"));
    if (!hasLongitude) missing.push(t("home.formLongitude"));
    return missing;
  }, [
    hasBirthDate,
    hasBirthTimeSignal,
    hasCity,
    hasCountry,
    hasLatitude,
    hasLongitude,
    hasName,
    hasState,
    t,
  ]);

  const actionHintText = useMemo(() => {
    if (canSubmit) return "";
    const nextMissing = missingFieldLabels.slice(0, 2).join(", ");
    return nextMissing
      ? tWithFallback("home.actionHintMissing", `Add ${nextMissing} to continue.`, { fields: nextMissing })
      : t("home.actionHint");
  }, [canSubmit, missingFieldLabels, t, tWithFallback]);

  const smartFillExamples = useMemo(
    () => SMART_FILL_EXAMPLES.map((example) => tWithFallback(example.key, example.fallback)),
    [tWithFallback],
  );

  /* ── One question at a time ──
   * The chart needs six answers, asked in the order the sky gets assembled:
   * who, when, where. Only one is on screen at a time, so nothing competes
   * with the question actually being asked. Enter advances, Escape steps back.
   */
  const questions = useMemo(
    () => [
      {
        id: "name" as const,
        answered: hasName,
        label: t("home.formName"),
        heading: tWithFallback("home.askName", "What should we call you?"),
        helper: tWithFallback("home.askNameHelper", "The name this reading is written for."),
      },
      {
        id: "birthDate" as const,
        answered: hasBirthDate,
        label: t("home.formBirthDate"),
        heading: tWithFallback("home.askBirthDate", "When were you born?"),
        helper: tWithFallback(
          "home.askBirthDateHelper",
          "The calendar date, as it was where you were born.",
        ),
      },
      {
        id: "birthTime" as const,
        answered: hasBirthTimeSignal,
        label: t("home.formBirthTime"),
        heading: tWithFallback("home.askBirthTime", "What time of day?"),
        helper: tWithFallback(
          "home.askBirthTimeHelper",
          "An exact time sets the houses. If you do not know it, give a rough part of the day instead.",
        ),
      },
      {
        id: "country" as const,
        answered: hasCountry,
        label: t("home.formCountry"),
        heading: tWithFallback("home.askCountry", "Which country?"),
        helper: tWithFallback("home.askCountryHelper", "Where the birth happened, not where you live now."),
      },
      {
        id: "state" as const,
        answered: hasState,
        label: t("home.formState"),
        heading: tWithFallback("home.askState", "Which state or region?"),
        helper: tWithFallback("home.askStateHelper", "This narrows the search for the city."),
      },
      {
        id: "city" as const,
        answered: hasCity,
        label: t("home.formCity"),
        heading: tWithFallback("home.askCity", "Which city or town?"),
        helper: tWithFallback(
          "home.askCityHelper",
          "This is what locks the coordinates and the time zone.",
        ),
      },
    ],
    [hasBirthDate, hasBirthTimeSignal, hasCity, hasCountry, hasName, hasState, t, tWithFallback],
  );

  const activeQuestion = questions[questionIndex] ?? questions[0];
  const isLastQuestion = questionIndex === questions.length - 1;

  /* A dot is reachable once every question before it has an answer, so the
   * flow can be re-entered anywhere already satisfied without letting anyone
   * skip past a blank. */
  const isQuestionReachable = useCallback(
    (index: number) =>
      index <= questionIndex || questions.slice(0, index).every((question) => question.answered),
    [questionIndex, questions],
  );

  const goToQuestion = useCallback(
    (index: number) => {
      if (index < 0 || index >= questions.length || !isQuestionReachable(index)) return;
      setQuestionIndex(index);
    },
    [isQuestionReachable, questions.length],
  );

  const formRef = useRef<HTMLFormElement>(null);

  const goBack = useCallback(() => {
    setQuestionIndex((index) => Math.max(index - 1, 0));
  }, []);

  /* Move focus to the new question's field so the keyboard path never needs a
   * mouse. Skipped on first paint: stealing focus on load scrolls the page out
   * from under anyone who arrived reading rather than typing. */
  const questionBodyRef = useRef<HTMLDivElement>(null);
  const hasNavigated = useRef(false);
  useEffect(() => {
    if (!hasNavigated.current) {
      hasNavigated.current = true;
      return;
    }
    questionBodyRef.current?.querySelector<HTMLElement>("input, textarea, button")?.focus();
  }, [questionIndex]);

  const intakeSteps = useMemo(() => {
    const birthMomentComplete = hasBirthDate && hasBirthTimeSignal;
    const stepStates: IntakeStepState[] = [
      {
        id: "identity",
        label: tWithFallback("home.stepIdentityLabel", "Identity"),
        detail: tWithFallback("home.stepIdentityDetail", "Name anchors the reading"),
        complete: hasName,
        missing: !hasName ? t("home.formName") : undefined,
      },
      {
        id: "birth",
        label: tWithFallback("home.stepBirthMomentLabel", "Birth moment"),
        detail: tWithFallback("home.stepBirthMomentDetail", "Date and time tune the sky"),
        complete: birthMomentComplete,
        missing: !birthMomentComplete
          ? [!hasBirthDate ? t("home.formBirthDate") : "", !hasBirthTimeSignal ? t("home.formBirthTime") : ""]
              .filter(Boolean)
              .join(", ")
          : undefined,
      },
      {
        id: "location",
        label: tWithFallback("home.stepLocationLabel", "Location"),
        detail: tWithFallback("home.stepLocationDetail", "Place locks coordinates"),
        complete: hasLocation,
        meta: geoStatus === "found" ? t("home.previewStatusCoordinates") : undefined,
        missing: !hasLocation
          ? [
              !hasCountry ? t("home.formCountry") : "",
              !hasState ? t("home.formState") : "",
              !hasCity ? t("home.formCity") : "",
              !hasLatitude || !hasLongitude ? t("home.enterCoordinates") : "",
            ]
              .filter(Boolean)
              .join(", ")
          : undefined,
      },
      {
        id: "ready",
        label: tWithFallback("home.stepChartReadyLabel", "Chart ready"),
        detail: tWithFallback("home.stepChartReadyDetail", "All signals aligned"),
        complete: canSubmit,
        meta: `${previewCompletion.filled}/${previewCompletion.total}`,
        missing: !canSubmit ? t("home.previewStatusBuilding") : undefined,
      },
    ];
    const activeIndex = stepStates.findIndex((step) => !step.complete);
    return stepStates.map((step, index) => ({
      ...step,
      active: activeIndex === -1 ? index === stepStates.length - 1 : index === activeIndex,
    }));
  }, [
    canSubmit,
    geoStatus,
    hasBirthDate,
    hasBirthTimeSignal,
    hasCity,
    hasCountry,
    hasLatitude,
    hasLocation,
    hasLongitude,
    hasName,
    hasState,
    previewCompletion.filled,
    previewCompletion.total,
    t,
    tWithFallback,
  ]);

  const submitWrapperRef = useRef<HTMLDivElement>(null);

  /* ── Particle burst on click ── */
  const spawnParticles = useCallback((originX: number, originY: number) => {
    const wrapper = submitWrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const cx = originX - rect.left;
    const cy = originY - rect.top;
    const count = 12 + Math.floor(Math.random() * 5);

    for (let i = 0; i < count; i++) {
      const particle = document.createElement("span");
      const size = 3 + Math.random() * 2;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const dist = 40 + Math.random() * 60;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const isGold = Math.random() > 0.5;
      const color = isGold ? "rgba(242,194,108,0.9)" : "rgba(108,225,212,0.9)";

      particle.style.cssText = [
        "position:absolute",
        `left:${cx}px`,
        `top:${cy}px`,
        `width:${size}px`,
        `height:${size}px`,
        "border-radius:50%",
        `background:${color}`,
        "pointer-events:none",
        "z-index:10",
        `--dx:${dx}px`,
        `--dy:${dy}px`,
        "animation:cosmicParticleBurst 600ms ease-out forwards",
      ].join(";");
      wrapper.appendChild(particle);
      setTimeout(() => particle.remove(), 650);
    }
  }, []);

  /* ── Ripple effect on click ── */
  const spawnRipple = useCallback((originX: number, originY: number) => {
    const wrapper = submitWrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const cx = originX - rect.left;
    const cy = originY - rect.top;

    const ripple = document.createElement("span");
    ripple.style.cssText = [
      "position:absolute",
      `left:${cx}px`,
      `top:${cy}px`,
      "width:0",
      "height:0",
      "border-radius:50%",
      "background:rgba(242,194,108,0.3)",
      "transform:translate(-50%,-50%)",
      "pointer-events:none",
      "z-index:9",
      "animation:cosmicRippleExpand 500ms ease-out forwards",
    ].join(";");
    wrapper.appendChild(ripple);
    setTimeout(() => ripple.remove(), 550);
  }, []);

  const handleSubmitClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      hapticSuccess();
      spawnParticles(e.clientX, e.clientY);
      spawnRipple(e.clientX, e.clientY);
    },
    [spawnParticles, spawnRipple],
  );

  const setField = (field: keyof ProfileQueryInput) => (value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const saveBirthDetailsHistory = useCallback((entry: StoredIntakeDraft) => {
    try {
      const currentHistory = parseBirthDetailsHistory();
      const entryKey = buildHistoryKey(entry);
      const nextEntry: BirthDetailsHistoryEntry = {
        ...entry,
        id: createHistoryId(),
        savedAt: new Date().toISOString(),
      };
      const nextHistory = [
        nextEntry,
        ...currentHistory.filter((item) => buildHistoryKey(item) !== entryKey),
      ].slice(0, BIRTH_DETAILS_HISTORY_LIMIT);

      localStorage.setItem(BIRTH_DETAILS_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
      setBirthDetailsHistory(nextHistory);
    } catch {
      // History is a convenience; chart generation should still continue.
    }
  }, []);

  const restoreBirthDetailsHistory = useCallback((entry: BirthDetailsHistoryEntry) => {
    setDraft({ ...profileInitialState, ...entry.draft });
    setUnknownTime(entry.unknownTime);
    setCoarseTime(entry.coarseTime);
    setHistoryExpanded(false);
    setDraftSaved(true);
    if (draftSavedDisplayTimer.current) clearTimeout(draftSavedDisplayTimer.current);
    draftSavedDisplayTimer.current = setTimeout(() => setDraftSaved(false), 1500);
  }, []);

  // Smart fill parser - handles various formats
  const parseSmartFill = (text: string) => {
    const parts = text.split(',').map(p => p.trim());
    if (parts.length < 3) return null;

    const parsed: Partial<ProfileQueryInput> = {};
    let partIndex = 0;

    // Extract name (first part)
    if (parts[partIndex]) {
      parsed.name = parts[partIndex];
      partIndex++;
    }

    // Extract date (various formats: "14 Mar 1995", "March 14 1995", "1995-03-14")
    if (parts[partIndex]) {
      const dateStr = parts[partIndex];
      const dateMatch = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/) || 
                       dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/) ||
                       dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      
      if (dateMatch) {
        const months: Record<string, string> = {
          jan: '01', january: '01',
          feb: '02', february: '02',
          mar: '03', march: '03',
          apr: '04', april: '04',
          may: '05',
          jun: '06', june: '06',
          jul: '07', july: '07',
          aug: '08', august: '08',
          sep: '09', september: '09',
          oct: '10', october: '10',
          nov: '11', november: '11',
          dec: '12', december: '12'
        };
        
        let year, month, day;
        if (dateStr.match(/\d{4}-\d{1,2}-\d{1,2}/)) {
          [year, month, day] = [dateMatch[1], dateMatch[2].padStart(2, '0'), dateMatch[3].padStart(2, '0')];
        } else {
          const [, dOrM, mOrD, y] = dateMatch;
          if (parseInt(dOrM) > 31) {
            // First part is month name
            const monthNum = months[mOrD.toLowerCase()] || mOrD.padStart(2, '0');
            [year, month, day] = [y, monthNum, dOrM.padStart(2, '0')];
          } else {
            // First part is day
            const monthNum = months[mOrD.toLowerCase()] || mOrD.padStart(2, '0');
            [year, month, day] = [y, monthNum, dOrM.padStart(2, '0')];
          }
        }
        parsed.birthDate = `${year}-${month}-${day}`;
        partIndex++;
      }
    }

    // Extract time (various formats: "3:45 PM", "15:45", "3.45pm")
    if (parts[partIndex]) {
      const timeStr = parts[partIndex];
      const timeMatch = timeStr.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
      
      if (timeMatch) {
        const [, hours, minutes, meridiem] = timeMatch;
        let h = parseInt(hours);
        const m = minutes;
        
        if (meridiem?.toLowerCase() === 'pm' && h !== 12) {
          h += 12;
        } else if (meridiem?.toLowerCase() === 'am' && h === 12) {
          h = 0;
        }
        
        parsed.birthTime = `${String(h).padStart(2, '0')}:${m}`;
        partIndex++;
      }
    }

    // Extract location (remaining parts combined)
    if (parts[partIndex]) {
      const locationParts = parts.slice(partIndex);
      // Try to parse as "City, State Country" or "City, Country"
      if (locationParts.length >= 2) {
        parsed.city = locationParts[0];
        parsed.state = locationParts[1];
        if (locationParts[2]) {
          parsed.country = locationParts[2];
        } else {
          parsed.country = locationParts[1];
          parsed.state = "";
        }
      } else {
        parsed.city = locationParts[0];
      }
    }

    return parsed;
  };

  const handleSmartFill = () => {
    const parsed = parseSmartFill(smartFillText);
    if (parsed) {
      setDraft(prev => ({ ...prev, ...parsed }));
      setSmartFillText("");
      setSmartFillExpanded(false);
    }
  };

  const clearGeoResults = () => {
    setDraft((prev) => ({
      ...prev,
      latitude: "",
      longitude: "",
      timezoneOffsetMinutes: String(-new Date().getTimezoneOffset()),
      timeZoneId: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "",
    }));
    setGeoStatus("idle");
  };

  // Cascading handlers: changing a parent clears its children
  const handleCountryChange = (value: string) => {
    setDraft((prev) => ({ ...prev, country: value, state: "", city: "" }));
    clearGeoResults();
  };

  const handleCountrySelect = (value: string) => {
    setDraft((prev) => ({ ...prev, country: value, state: "", city: "" }));
    clearGeoResults();
  };

  const handleStateChange = (value: string) => {
    setDraft((prev) => ({ ...prev, state: value, city: "" }));
    clearGeoResults();
  };

  const handleStateSelect = (value: string) => {
    setDraft((prev) => ({ ...prev, state: value, city: "" }));
    clearGeoResults();
  };

  /* The Next button, the final submit, and the Enter key all land here: every
   * question but the last advances instead of submitting. */
  const advanceOrSubmit = () => {
    if (!isLastQuestion) {
      if (activeQuestion.answered) setQuestionIndex((index) => index + 1);
      return;
    }

    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const params = new URLSearchParams();

    const birthTimeAccuracy = unknownTime
      ? hasCoarseTimeFallback(coarseTime)
        ? coarseTime
        : "unknown"
      : "exact";
    const birthTimeForSubmit = unknownTime ? getBirthTimeFallback(birthTimeAccuracy) : draft.birthTime.trim();

    Object.entries(draft).forEach(([key, value]) => {
      params.set(key, value.trim());
    });

    params.set("birthTime", birthTimeForSubmit);
    params.set("birthTimeAccuracy", birthTimeAccuracy);
    params.set("birthTimeSource", unknownTime ? "fallback" : "exact");
    params.set("birthTimeFallback", unknownTime ? "true" : "false");

    saveBirthDetailsHistory({
      draft: {
        ...draft,
        birthTime: unknownTime ? "" : draft.birthTime,
      },
      unknownTime,
      coarseTime,
    });

    router.push(`/engine-select?${params.toString()}`);
  };

  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    advanceOrSubmit();
  };

  /* Keyboard navigation is driven explicitly rather than left to implicit form
   * submission, and it listens on the document rather than the form.
   *
   * Two reasons. The date and time pickers call preventDefault on Enter to
   * commit their own selection, which swallows the browser's implicit submit.
   * And once they commit they drop focus to <body> — outside the form — so a
   * form-scoped listener never sees the next keystroke and the flow dead-ends
   * on exactly the two questions a keyboard user most wants to fly through.
   *
   * While a picker or suggestion list is open it keeps Enter for itself; once
   * closed, Enter drives the flow. Shift+Enter steps back.
   *
   * Escape is deliberately not a back key. Pickers, suggestion lists and the
   * browser all want it, and binding it here made one press both close the
   * suggestion list and skip back a question. */
  const keyHandlerRef = useRef<(event: globalThis.KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandlerRef.current = (event) => {
      if (event.key !== "Enter") return;

      const form = formRef.current;
      const target = event.target as HTMLElement | null;
      if (!form) return;

      /* Buttons, textareas and links keep their own Enter. Anything outside the
       * intake is none of our business; a bare <body> target is the picker
       * having just handed focus back.
       *
       * The exception is a toggle button already in its pressed state — the
       * coarse birth-time options. Re-pressing one is a no-op, so a second
       * Enter there means "continue", which is what the on-screen hint
       * promises. */
      if (target) {
        const tagName = target.tagName;
        const isSettledToggle = target.getAttribute("aria-pressed") === "true";
        if (tagName === "TEXTAREA" || tagName === "A" || target.isContentEditable) return;
        if (tagName === "BUTTON" && !isSettledToggle) return;
        if (target !== document.body && !form.contains(target)) return;
      }

      /* Defer only to a control that will genuinely consume Enter. An open
       * picker always will. A suggestion list only does so while an option is
       * highlighted — and it reopens right after a selection, so treating "list
       * visible" as "list owns Enter" would strand the location questions with
       * no keyboard way forward. */
      const overlayOwnsEnter = Boolean(
        document.querySelector('.react-datepicker') ||
          document.querySelector('[role="option"][aria-selected="true"]'),
      );

      if (event.shiftKey) {
        event.preventDefault();
        goBack();
        return;
      }

      if (overlayOwnsEnter) return;
      event.preventDefault();
      advanceOrSubmit();
    };
  });

  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent) => keyHandlerRef.current(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  return (
    <div className={styles.professionalIntake}>
      <CosmicBackground />
      <FormCelebration isComplete={canSubmit} />

      {/* ── Floating Cosmic Particles ── */}



      {/* ── Hero wrapper: positions wheel behind the panel ── */}

      <header className={styles.streamlinedHeader}>
        <span className={styles.stepLabel}>
          {tWithFallback("home.questionCounter", `Question ${questionIndex + 1} of ${questions.length}`, {
            current: String(questionIndex + 1),
            total: String(questions.length),
          })}
        </span>
        <h1>{t("home.intakeHeadingDetails")}</h1>
        <p>
          {tWithFallback(
            "home.intakeLeadStepped",
            "One question at a time. Press Enter to continue, Escape to step back.",
          )}
        </p>
      </header>

      {/* === MAIN CONTENT === */}
      <div className={styles.mainContent}>
        <form ref={formRef} className={styles.intakeForm} onSubmit={submitProfile}>
          <div className={styles.formLayout}>
            {/* LEFT COLUMN: one question */}
            <div className={styles.formColumn}>
              <div className={styles.formSectionCard}>
                <div className={styles.cardAura} aria-hidden="true" />

                {/* ── Progress dots ── */}
                <ol className={styles.questionDots}>
                  {questions.map((question, index) => {
                    const reachable = isQuestionReachable(index);
                    return (
                      <li key={question.id} className={styles.questionDotItem}>
                        <button
                          type="button"
                          className={[
                            styles.questionDot,
                            question.answered ? styles.questionDotAnswered : "",
                            index === questionIndex ? styles.questionDotCurrent : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => goToQuestion(index)}
                          disabled={!reachable}
                          aria-current={index === questionIndex ? "step" : undefined}
                          aria-label={`${index + 1}. ${question.label}`}
                        />
                      </li>
                    );
                  })}
                </ol>

                <div className={styles.questionHead} aria-live="polite">
                  <span className={styles.cardKicker}>{t("home.birthChartIntake")}</span>
                  <h2 className={styles.questionHeading}>{activeQuestion.heading}</h2>
                  <p className={styles.questionHelper}>{activeQuestion.helper}</p>
                </div>

                <div className={styles.questionBody} ref={questionBodyRef}>
                  {activeQuestion.id === "name" && (
                    <div className={styles.premiumField}>
                      <PremiumInput
                        id="birth-name"
                        name="name"
                        label={t("home.formName")}
                        value={draft.name}
                        onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))}
                        placeholder={t("home.formNamePlaceholder")}
                        icon={<HiOutlineUser />}
                        completed={hasName}
                        required
                        autoComplete="name"
                      />
                    </div>
                  )}

                  {activeQuestion.id === "birthDate" && (
                    <div className={styles.premiumField}>
                      <PremiumDatePicker
                        id="birth-date"
                        name="birthDate"
                        label={t("home.formBirthDate")}
                        value={draft.birthDate ? new Date(draft.birthDate + "T00:00:00") : null}
                        onChange={(date: Date | null) => {
                          if (date) {
                            const yyyy = date.getFullYear();
                            const mm = String(date.getMonth() + 1).padStart(2, "0");
                            const dd = String(date.getDate()).padStart(2, "0");
                            setDraft((prev) => ({ ...prev, birthDate: `${yyyy}-${mm}-${dd}` }));
                          }
                        }}
                        placeholder={t("home.birthDatePlaceholder")}
                        formatHint={tWithFallback(
                          "home.birthDateFormatHint",
                          "Enter a date like 15/05/1990, 1990-05-15, or 15 May 1990.",
                        )}
                        dateFormat="dd MMM yyyy"
                        icon={<HiOutlineCalendarDays />}
                        completed={hasBirthDate}
                        required
                        preventOpenOnFocus
                        autoComplete="bday"
                        maxDate={new Date()}
                        minDate={new Date(1900, 0, 1)}
                        showYearDropdown
                        showMonthDropdown
                        yearDropdownItemNumber={100}
                      />
                    </div>
                  )}

                  {activeQuestion.id === "birthTime" && (
                    <>
                      <div className={styles.premiumField}>
                        {!unknownTime ? (
                          <PremiumDatePicker
                            id="birth-time"
                            name="birthTime"
                            label={t("home.formBirthTime")}
                            value={
                              draft.birthTime
                                ? (() => {
                                    const [h, m] = draft.birthTime.split(":");
                                    const d = new Date();
                                    d.setHours(Number(h), Number(m), 0, 0);
                                    return d;
                                  })()
                                : null
                            }
                            onChange={(date: Date | null) => {
                              if (date) {
                                const hh = String(date.getHours()).padStart(2, "0");
                                const mm = String(date.getMinutes()).padStart(2, "0");
                                setDraft((prev) => ({ ...prev, birthTime: `${hh}:${mm}` }));
                              }
                            }}
                            placeholder={t("home.birthTimePlaceholder")}
                            formatHint={tWithFallback(
                              "home.birthTimeFormatHint",
                              "Enter a time like 14:30 or 2:30 PM.",
                            )}
                            showTimeSelect
                            showTimeSelectOnly
                            timeIntervals={5}
                            timeCaption={t("home.timeCaption")}
                            dateFormat="h:mm aa"
                            icon={<HiOutlineClock />}
                            completed={hasBirthTimeSignal}
                            required={!unknownTime}
                            preventOpenOnFocus
                          />
                        ) : (
                          <div className={styles.approxTimePanel}>
                            <div className={styles.approxTimeHeader}>
                              <span className={styles.approxTimeLabel}>{t("home.approxTimeLabel")}</span>
                              <span className={styles.approxTimeHint}>{t("home.approxTimeHint")}</span>
                            </div>
                            <div className={styles.approxTimeOptions}>
                              {COARSE_TIME_OPTIONS.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  className={`${styles.approxTimeOption} ${
                                    coarseTime === option.value ? styles.approxTimeOptionSelected : ""
                                  }`}
                                  onClick={() => setCoarseTime(option.value)}
                                  aria-pressed={coarseTime === option.value}
                                >
                                  {t(option.labelKey)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className={styles.unknownTimeOption}>
                        <PremiumToggle
                          label={t("home.unknownTimeLabel")}
                          checked={unknownTime}
                          onChange={(checked) => {
                            setUnknownTime(checked);
                            if (!checked) setCoarseTime("");
                            setDraft((prev) => ({ ...prev, birthTime: checked ? "" : prev.birthTime }));
                          }}
                        />
                      </div>
                    </>
                  )}

                  {activeQuestion.id === "country" && (
                    <div className={styles.premiumField}>
                      <div className={styles.autocompleteWrapper}>
                        <label id="birth-country-label" htmlFor="birth-country">
                          {t("home.formCountry")}
                        </label>
                        <div
                          className={`${styles.autocompleteFrame} ${hasCountry ? styles.autocompleteFrameComplete : ""}`}
                        >
                          <span className={styles.fieldLeadingIcon} aria-hidden="true">
                            <HiOutlineMapPin />
                          </span>
                          <AutocompleteInput
                            id="birth-country"
                            name="country"
                            ariaLabelledBy="birth-country-label"
                            value={draft.country}
                            onChange={handleCountryChange}
                            onSelect={handleCountrySelect}
                            placeholder={t("home.formCountryPlaceholder")}
                            suggestType="country"
                            required
                          />
                          {hasCountry && (
                            <span
                              className={styles.fieldCompleteBadge}
                              aria-label={t("home.fieldComplete", { field: t("home.formCountry") })}
                              role="status"
                            >
                              <HiOutlineCheckCircle />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeQuestion.id === "state" && (
                    <div className={styles.premiumField}>
                      <div className={styles.autocompleteWrapper}>
                        <label id="birth-state-label" htmlFor="birth-state">
                          {t("home.formState")}
                        </label>
                        <div
                          className={`${styles.autocompleteFrame} ${hasState ? styles.autocompleteFrameComplete : ""}`}
                        >
                          <span className={styles.fieldLeadingIcon} aria-hidden="true">
                            <HiOutlineMapPin />
                          </span>
                          <AutocompleteInput
                            id="birth-state"
                            name="state"
                            ariaLabelledBy="birth-state-label"
                            value={draft.state}
                            onChange={handleStateChange}
                            onSelect={handleStateSelect}
                            placeholder={t("home.formStatePlaceholder")}
                            suggestType="state"
                            contextCountry={draft.country}
                            required
                          />
                          {hasState && (
                            <span
                              className={styles.fieldCompleteBadge}
                              aria-label={t("home.fieldComplete", { field: t("home.formState") })}
                              role="status"
                            >
                              <HiOutlineCheckCircle />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeQuestion.id === "city" && (
                    <>
                      <div className={styles.premiumField}>
                        <div className={styles.autocompleteWrapper}>
                          <label id="birth-city-label" htmlFor="birth-city">
                            {t("home.formCity")}
                          </label>
                          <div
                            className={`${styles.autocompleteFrame} ${hasCity ? styles.autocompleteFrameComplete : ""}`}
                          >
                            <span className={styles.fieldLeadingIcon} aria-hidden="true">
                              <HiOutlineMapPin />
                            </span>
                            <AutocompleteInput
                              id="birth-city"
                              name="city"
                              ariaLabelledBy="birth-city-label"
                              value={draft.city}
                              onChange={setField("city")}
                              onSelect={setField("city")}
                              placeholder={t("home.formCityPlaceholder")}
                              suggestType="city"
                              contextCountry={draft.country}
                              contextState={draft.state}
                              required
                            />
                            {hasCity && (
                              <span
                                className={styles.fieldCompleteBadge}
                                aria-label={t("home.fieldComplete", { field: t("home.formCity") })}
                                role="status"
                              >
                                <HiOutlineCheckCircle />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ── Lat/Lon escape hatch: only the last question needs it ── */}
                      <button
                        type="button"
                        className={styles.coordsToggleWrapper}
                        onClick={() => setLatLonExpanded(!latLonExpanded)}
                        aria-expanded={latLonExpanded}
                        aria-controls="manual-coordinate-fields"
                      >
                        <span className={styles.coordsToggleText}>
                          <GiCompass aria-hidden="true" />
                          {t("home.enterCoordinates")}
                        </span>
                        <span
                          className={`${styles.coordsToggleArrow} ${latLonExpanded ? styles.expanded : ""}`}
                          aria-hidden="true"
                        >
                          &#9662;
                        </span>
                      </button>

                      {latLonExpanded && (
                        <div id="manual-coordinate-fields" className={styles.latLonFields}>
                          <PremiumInput
                            id="birth-latitude"
                            name="latitude"
                            label={t("home.formLatitude")}
                            value={draft.latitude}
                            onChange={(value) => setField("latitude")(value)}
                            placeholder="e.g. 40.7128"
                            icon={<GiCompass />}
                            completed={hasLatitude}
                            required
                            inputMode="decimal"
                          />
                          <PremiumInput
                            id="birth-longitude"
                            name="longitude"
                            label={t("home.formLongitude")}
                            value={draft.longitude}
                            onChange={(value) => setField("longitude")(value)}
                            placeholder="e.g. -74.0060"
                            icon={<GiCompass />}
                            completed={hasLongitude}
                            required
                            inputMode="decimal"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>{/* /questionBody */}

                {/* ── Quick actions: whole-form shortcuts, so only the first question offers them ── */}
                {questionIndex === 0 && (
                  <div className={styles.quickActionsRow}>
                    <div className={styles.smartFillWrapper}>
                      <button
                        type="button"
                        className={styles.smartFillToggle}
                        onClick={() => setSmartFillExpanded(!smartFillExpanded)}
                        aria-expanded={smartFillExpanded}
                        aria-controls="smart-fill-panel"
                      >
                        <HiOutlineSparkles aria-hidden="true" />
                        <span>{t("home.smartFillToggle")}</span>
                        <HiOutlineChevronDown
                          className={`${styles.smartFillArrow} ${smartFillExpanded ? styles.expanded : ""}`}
                          aria-hidden="true"
                        />
                      </button>

                      {smartFillExpanded && (
                        <div id="smart-fill-panel" className={styles.smartFillContent}>
                          <textarea
                            value={smartFillText}
                            onChange={(e) => setSmartFillText(e.target.value)}
                            placeholder={t("home.smartFillPlaceholder")}
                            className={styles.smartFillTextarea}
                            rows={2}
                            aria-label={t("home.smartFillToggle")}
                          />
                          <div className={styles.smartFillHint}>{t("home.smartFillHint")}</div>
                          <div className={styles.smartFillExamples}>
                            {smartFillExamples.map((example) => (
                              <button
                                key={example}
                                type="button"
                                className={styles.smartFillExampleChip}
                                onClick={() => setSmartFillText(example)}
                              >
                                {example}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handleSmartFill}
                            className={styles.smartFillButton}
                            disabled={smartFillText.trim().length < 10}
                          >
                            {t("home.smartFillButton")}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className={styles.birthHistoryWrapper}>
                      <button
                        type="button"
                        className={styles.birthHistoryToggle}
                        onClick={() => setHistoryExpanded((expanded) => !expanded)}
                        aria-expanded={historyExpanded}
                        aria-controls="birth-details-history-panel"
                      >
                        <HiOutlineClock />
                        <span>{t("home.birthHistoryToggle")}</span>
                        {birthDetailsHistory.length > 0 && (
                          <span className={styles.birthHistoryCount}>
                            {t("home.birthHistoryCount", { count: String(birthDetailsHistory.length) })}
                          </span>
                        )}
                        <HiOutlineChevronDown
                          className={`${styles.birthHistoryArrow} ${historyExpanded ? styles.expanded : ""}`}
                        />
                      </button>

                      {historyExpanded && (
                        <div id="birth-details-history-panel" className={styles.birthHistoryPanel}>
                          {birthDetailsHistory.length > 0 ? (
                            <div className={styles.birthHistoryList}>
                              {birthDetailsHistory.map((entry) => {
                                const location = [entry.draft.city, entry.draft.state, entry.draft.country]
                                  .filter((part) => part.trim().length > 0)
                                  .join(", ");
                                const coarseTimeKey = entry.coarseTime
                                  ? `home.coarse${entry.coarseTime.charAt(0).toUpperCase()}${entry.coarseTime.slice(1)}`
                                  : "home.coarseUnknown";
                                const timeLabel = entry.unknownTime
                                  ? t("home.birthHistoryApproxTime", { time: t(coarseTimeKey) })
                                  : entry.draft.birthTime;

                                return (
                                  <button
                                    key={entry.id}
                                    type="button"
                                    className={styles.birthHistoryItem}
                                    onClick={() => restoreBirthDetailsHistory(entry)}
                                  >
                                    <span className={styles.birthHistoryName}>
                                      {entry.draft.name || t("home.birthHistoryUnnamed")}
                                    </span>
                                    <span className={styles.birthHistoryMeta}>
                                      {[entry.draft.birthDate, timeLabel, location].filter(Boolean).join(" - ")}
                                    </span>
                                    <span className={styles.birthHistorySavedAt}>
                                      {formatHistoryDate(entry.savedAt)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className={styles.birthHistoryEmpty}>{t("home.birthHistoryEmpty")}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>{/* /formSectionCard */}

              {/* PRIMARY CTA */}
              <div className={styles.primaryAction}>
                <div className={styles.stepActions}>
                  <button
                    type="button"
                    className={styles.backButton}
                    onClick={goBack}
                    disabled={questionIndex === 0}
                  >
                    {t("home.back")}
                  </button>
                  {isLastQuestion ? (
                    <div
                      ref={submitWrapperRef}
                      className={styles.submitWrapper}
                      onClick={canSubmit ? handleSubmitClick : undefined}
                    >
                      <PremiumButton
                        type="submit"
                        variant="primary"
                        size="lg"
                        fullWidth
                        loading={isSubmitting}
                        loadingLabel={t("home.ctaLoading")}
                        disabled={!canSubmit}
                        describedBy={!canSubmit ? "intake-action-hint" : undefined}
                        icon={<GiCrystalBall />}
                      >
                        {t("home.cta")}
                      </PremiumButton>
                    </div>
                  ) : (
                    <PremiumButton
                      type="submit"
                      variant="primary"
                      size="lg"
                      fullWidth
                      disabled={!activeQuestion.answered}
                      describedBy={!activeQuestion.answered ? "intake-action-hint" : undefined}
                    >
                      {tWithFallback("home.next", "Next")}
                    </PremiumButton>
                  )}
                </div>

                {((isLastQuestion && !canSubmit) || (!isLastQuestion && !activeQuestion.answered)) && (
                  <p id="intake-action-hint" className={styles.actionHint} aria-live="polite">
                    <HiOutlineExclamationCircle aria-hidden="true" />
                    {isLastQuestion
                      ? actionHintText
                      : tWithFallback("home.actionHintMissing", `Add ${activeQuestion.label} to continue.`, {
                          fields: activeQuestion.label,
                        })}
                  </p>
                )}

                <div className={styles.keyHintRow}>
                  <span className={styles.keyHint}>
                    <kbd>&crarr;</kbd> {tWithFallback("home.keyboardHintNext", "Press Enter")}
                  </span>
                  {questionIndex > 0 && (
                    <span className={styles.keyHint}>
                      <kbd>&#8679;</kbd>
                      <kbd>&crarr;</kbd> {tWithFallback("home.keyboardHintBack", "Shift + Enter to go back")}
                    </span>
                  )}
                  {draftSaved && (
                    <span className={styles.draftIndicator} role="status">
                      <HiOutlineCheckCircle aria-hidden="true" />
                      {t("home.draftSaved")}
                    </span>
                  )}
                </div>

                <p className={styles.trustMicrocopy}>{t("home.trustMicrocopy")}</p>
              </div>
            </div>{/* /formColumn */}

            {/* RIGHT COLUMN: Chart Preview */}
            <aside className={styles.previewColumn} aria-label={t("home.chartPreview")}>
              <div className={styles.previewCard}>
                <div className={styles.previewHeader}>
                  <span className={styles.previewKicker}>{t("home.previewKicker")}</span>
                  <span className={styles.previewStatus}>{previewStatus}</span>
                </div>

                <div
                  className={styles.previewMeter}
                  role="progressbar"
                  aria-label={t("home.previewProgressAria")}
                  aria-valuenow={previewCompletion.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span
                    className={styles.previewMeterFill}
                    style={{ width: `${previewCompletion.percent}%` }}
                  />
                </div>
                <p className={styles.previewCount}>
                  {t("home.stickyComplete", {
                    count: String(previewCompletion.filled),
                    total: String(previewCompletion.total),
                  })}
                </p>

                <BirthChartTeaser
                  name={draft.name}
                  birthDate={draft.birthDate}
                  birthTime={draft.birthTime}
                  timezoneOffsetMinutes={draft.timezoneOffsetMinutes}
                  country={draft.country}
                  state={draft.state}
                  city={draft.city}
                  unknownTime={unknownTime}
                  coarseTime={coarseTime}
                />

                <ol className={styles.progressRail}>
                  {intakeSteps.map((step) => (
                    <li
                      key={step.id}
                      className={[
                        styles.railStep,
                        step.complete ? styles.railStepComplete : "",
                        step.active ? styles.railStepActive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-current={step.active ? "step" : undefined}
                    >
                      <span className={styles.railMarker} aria-hidden="true">
                        {step.complete ? <HiOutlineCheckCircle /> : null}
                      </span>
                      <span className={styles.railBody}>
                        <span className={styles.railLabel}>
                          {step.label}
                          {step.meta ? <span className={styles.railMeta}>{step.meta}</span> : null}
                        </span>
                        <span className={styles.railDetail}>{step.missing ?? step.detail}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>{/* /formLayout */}

        </form>
      </div>

      {/* === FOOTER === */}
      <footer className={styles.intakeFooter}>
        <ChartHistory userName={user?.display_name} />
      </footer>

    </div>
  );
}
