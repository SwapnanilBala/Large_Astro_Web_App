"use client";

import type { ChangeEvent, FormEvent } from "react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GiCrystalBall, GiSunrise, GiCompass, GiStarSattelites } from "react-icons/gi";
import { HiOutlineSparkles } from "react-icons/hi2";
import { profileInitialState, type ProfileQueryInput } from "@/lib/astro-types";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import PageTransition from "./components/PageTransition";
import FloatingQuotes from "./components/FloatingQuotes";
import AutocompleteInput from "./components/AutocompleteInput";
import ChartHistory from "./components/ChartHistory";
import ZodiacWheel from "./components/ZodiacWheel";
import { useTextScramble } from "./components/TextScramble";
import FormCelebration from "./components/FormCelebration";
import styles from "./page.module.css";

const requiredFields: Array<keyof ProfileQueryInput> = [
  "name",
  "birthDate",
  "birthTime",
  "timezoneOffsetMinutes",
  "latitude",
  "longitude",
  "country",
  "state",
  "city",
];

const withClientTimezoneDefault = (): ProfileQueryInput => ({
  ...profileInitialState,
  timezoneOffsetMinutes: "0",
  timeZoneId: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""
});

export default function Home() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProfileQueryInput>(withClientTimezoneDefault);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latLonExpanded, setLatLonExpanded] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSavedDisplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  /* ── Scroll-reveal & validation shimmer ── */
  const formRef = useRef<HTMLFormElement>(null);
  const prevDraftRef = useRef<ProfileQueryInput>(withClientTimezoneDefault());
  const [validatedFields, setValidatedFields] = useState<Set<string>>(new Set());
  const shimmerTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /* ── Mystical tagline rotation ── */
  const mysticalPhrases = useMemo(() => {
    const phrases: string[] = [];
    for (let i = 1; ; i++) {
      const key = `home.mysticalPhrase${i}`;
      const val = t(key);
      if (val === key) break;   // t() returns the key when missing
      phrases.push(val);
    }
    return phrases.length > 0 ? phrases : ["Written in the Stars"];
  }, [t]);
  const [taglineIndex, setTaglineIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % mysticalPhrases.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [mysticalPhrases.length]);

  /* ── Split-text hero animation ── */
  const [heroReady, setHeroReady] = useState(false);
  const [cursorPhase, setCursorPhase] = useState<"hidden" | "blinking" | "done">("hidden");
  const headingText = t("home.heading");
  const headingWords = useMemo(() => headingText.split(/\s+/), [headingText]);
  const WORD_STAGGER = 80;
  const WORD_DURATION = 500;
  const KICKER_LEAD = 300;

  useEffect(() => {
    const kickerTimer = setTimeout(() => setHeroReady(true), KICKER_LEAD);
    const totalHeadingTime = KICKER_LEAD + headingWords.length * WORD_STAGGER + WORD_DURATION;
    const cursorTimer = setTimeout(() => setCursorPhase("blinking"), totalHeadingTime + 200);
    const cursorEndTimer = setTimeout(() => setCursorPhase("done"), totalHeadingTime + 200 + 2000);
    return () => {
      clearTimeout(kickerTimer);
      clearTimeout(cursorTimer);
      clearTimeout(cursorEndTimer);
    };
  }, [headingWords.length]);

  const leadDelay = (KICKER_LEAD + headingWords.length * WORD_STAGGER + WORD_DURATION + 200) / 1000;

  /* ── Text scramble effect on hero heading ── */
  const scrambledHeading = useTextScramble(headingText, heroReady, { duration: 1500, staggerPerChar: 50 });

  /* ── 3D tilt on intake panel ── */
  const panelTilt = useRef({ x: 0, y: 0 });
  const panelTiltTarget = useRef({ x: 0, y: 0 });

  const handlePanelMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxTilt = 3; // degrees
    panelTiltTarget.current = {
      x: -((e.clientY - cy) / (rect.height / 2)) * maxTilt,
      y: ((e.clientX - cx) / (rect.width / 2)) * maxTilt,
    };
  }, []);

  const handlePanelMouseLeave = useCallback(() => {
    panelTiltTarget.current = { x: 0, y: 0 };
  }, []);

  /* ── Parallax refs ── */
  const wheelRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const ambientLeftRef = useRef<HTMLDivElement>(null);
  const ambientRightRef = useRef<HTMLDivElement>(null);
  const ambientCenterRef = useRef<HTMLDivElement>(null);

  /* ── Cursor-reactive orb state ── */
  const mouseTarget = useRef({ x: 0, y: 0 });
  const mouseCurrent = useRef({ x: 0, y: 0 });
  const cursorRafId = useRef<number>(0);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const animateOrbs = useCallback(() => {
    const cur = mouseCurrent.current;
    const tgt = mouseTarget.current;
    cur.x = lerp(cur.x, tgt.x, 0.08);
    cur.y = lerp(cur.y, tgt.y, 0.08);

    const scrollY = window.scrollY;

    // Left orb: moves AWAY from cursor (parallax depth)
    if (ambientLeftRef.current) {
      const ox = -cur.x * 0.02;
      const oy = -cur.y * 0.02 + scrollY * 0.15;
      ambientLeftRef.current.style.transform = `translate(${ox}px, ${oy}px)`;
    }
    // Right orb: moves TOWARD cursor slightly
    if (ambientRightRef.current) {
      const ox = cur.x * 0.015;
      const oy = cur.y * 0.015 + scrollY * 0.15;
      ambientRightRef.current.style.transform = `translate(${ox}px, ${oy}px)`;
    }
    // Center orb: moves perpendicular to cursor direction
    if (ambientCenterRef.current) {
      const ox = cur.y * 0.012;
      const oy = -cur.x * 0.012 + scrollY * 0.15;
      ambientCenterRef.current.style.transform = `translate(${ox}px, ${oy}px)`;
    }

    if (wheelRef.current) {
      wheelRef.current.style.transform = `translateY(${scrollY * 0.3}px)`;
    }

    // 3D tilt on intake panel
    const tilt = panelTilt.current;
    const tiltTgt = panelTiltTarget.current;
    tilt.x = lerp(tilt.x, tiltTgt.x, 0.08);
    tilt.y = lerp(tilt.y, tiltTgt.y, 0.08);

    if (panelRef.current) {
      panelRef.current.style.transform = `translateY(${scrollY * 0.1}px) perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`;
    }

    cursorRafId.current = requestAnimationFrame(animateOrbs);
  }, []);

  useEffect(() => {
    cursorRafId.current = requestAnimationFrame(animateOrbs);
    return () => cancelAnimationFrame(cursorRafId.current);
  }, [animateOrbs]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mouseTarget.current = { x: e.clientX - cx, y: e.clientY - cy };
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  /* ── Scroll-triggered field reveal (IntersectionObserver) ── */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const fields = form.querySelectorAll<HTMLElement>("[data-field-reveal]");
    fields.forEach((el) => el.classList.add("field-hidden"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const idx = Number(el.dataset.fieldReveal ?? 0);
            setTimeout(() => {
              el.classList.remove("field-hidden");
              el.classList.add("field-revealed");
            }, idx * 80);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    fields.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  /* ── Validation shimmer: detect empty -> non-empty transitions ── */
  useEffect(() => {
    const prev = prevDraftRef.current;
    const fieldsToCheck: Array<keyof ProfileQueryInput> = [
      "name", "birthDate", "birthTime", "country", "state", "city",
    ];

    const newlyValid: string[] = [];
    for (const f of fieldsToCheck) {
      if (prev[f].trim() === "" && draft[f].trim() !== "") {
        newlyValid.push(f);
      }
    }

    if (newlyValid.length > 0) {
      setValidatedFields((s) => {
        const next = new Set(s);
        newlyValid.forEach((f) => next.add(f));
        return next;
      });

      // Remove shimmer class after animation completes
      for (const f of newlyValid) {
        const existing = shimmerTimers.current.get(f);
        if (existing) clearTimeout(existing);
        shimmerTimers.current.set(
          f,
          setTimeout(() => {
            setValidatedFields((s) => {
              const next = new Set(s);
              next.delete(f);
              return next;
            });
            shimmerTimers.current.delete(f);
          }, 650)
        );
      }
    }

    prevDraftRef.current = { ...draft };
  }, [draft]);

  useEffect(() => {
    const clientOffset = String(-new Date().getTimezoneOffset());
    setDraft((previous) => ({ ...previous, timezoneOffsetMinutes: clientOffset }));
  }, []);

  /* ── Restore draft from localStorage on mount (runs after timezone default) ── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("astro_intake_draft");
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      // Validate shape: every key in profileInitialState must be a string
      const keys = Object.keys(profileInitialState) as Array<keyof ProfileQueryInput>;
      const isValid = keys.every((k) => typeof parsed[k] === "string");
      if (!isValid) return;
      setDraft(parsed as unknown as ProfileQueryInput);
    } catch {
      // localStorage may throw in private browsing or if data is corrupt
    }
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
          localStorage.removeItem("astro_intake_draft");
          return;
        }
        localStorage.setItem("astro_intake_draft", JSON.stringify(draft));
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
  }, [draft]);

  const draftCountry = draft.country;
  const draftState = draft.state;
  const draftCity = draft.city;
  const draftBirthDate = draft.birthDate;
  const draftBirthTime = draft.birthTime;

  useEffect(() => {
    if (!draftCountry.trim() && !draftCity.trim()) return;

    if (geoTimer.current) clearTimeout(geoTimer.current);

    geoTimer.current = setTimeout(async () => {
      setGeoStatus("loading");
      try {
        const params = new URLSearchParams();
        if (draftCity.trim()) params.set("city", draftCity.trim());
        if (draftState.trim()) params.set("state", draftState.trim());
        if (draftCountry.trim()) params.set("country", draftCountry.trim());
        if (draftBirthDate.trim()) params.set("birthDate", draftBirthDate.trim());
        if (draftBirthTime.trim()) params.set("birthTime", draftBirthTime.trim());

        const res = await fetch(`/api/geocode?${params.toString()}`);
        const data = await res.json();

        if (data.found) {
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
      } catch {
        setGeoStatus("not-found");
      }
    }, 800);

    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
  }, [draftBirthDate, draftBirthTime, draftCity, draftCountry, draftState]);

  const canSubmit = useMemo(() => {
    return requiredFields.every((field) => draft[field].trim().length > 0);
  }, [draft]);

  /* ── Cosmic charge level (0-1) based on visible form fields ── */
  const chargeLevel = useMemo(() => {
    const chargeKeys: Array<keyof ProfileQueryInput> = ["name", "birthDate", "birthTime", "country", "state", "city"];
    const filled = chargeKeys.filter((f) => draft[f].trim().length > 0).length;
    return filled / chargeKeys.length;
  }, [draft]);

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
      spawnParticles(e.clientX, e.clientY);
      spawnRipple(e.clientX, e.clientY);
    },
    [spawnParticles, spawnRipple],
  );

  const updateField =
    (field: keyof ProfileQueryInput) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setDraft((previous) => ({
        ...previous,
        [field]: event.target.value
      }));
    };

  const setField = (field: keyof ProfileQueryInput) => (value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
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

  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const params = new URLSearchParams();

    Object.entries(draft).forEach(([key, value]) => {
      params.set(key, value.trim());
    });

    try {
      localStorage.removeItem("astro_intake_draft");
    } catch {
      // localStorage may throw in private browsing
    }

    router.push(`/engine-select?${params.toString()}`);
  };

  return (
    <PageTransition>
    <div className="home-shell">
      <FormCelebration isComplete={canSubmit} />
      {/* ── Aurora Effect (top of page) ── */}
      <div className={styles.auroraEffect}>
        <div className={styles.auroraLayer} />
        <div className={styles.auroraLayer} />
        <div className={styles.auroraLayer} />
      </div>

      <div ref={ambientLeftRef} className="ambient ambient-left" />
      <div ref={ambientRightRef} className="ambient ambient-right" />
      <div ref={ambientCenterRef} className="ambient ambient-center" />

      {/* ── Floating Cosmic Particles ── */}
      <div className={styles.cosmicParticles}>
        {Array.from({ length: 24 }, (_, i) => {
          const size = 1.5 + (i % 3) * 1;
          const left = ((i * 17 + 7) % 100);
          const bottom = -((i * 13) % 20);
          const duration = 12 + (i % 7) * 3;
          const delay = (i * 1.3) % 14;
          const isGold = i % 3 === 0;
          const color = isGold
            ? "rgba(242, 194, 108, 0.6)"
            : i % 3 === 1
            ? "rgba(108, 225, 212, 0.5)"
            : "rgba(255, 255, 255, 0.4)";
          return (
            <span
              key={i}
              className={styles.cosmicParticle}
              style={{
                width: `${size}px`,
                height: `${size}px`,
                left: `${left}%`,
                bottom: `${bottom}%`,
                background: color,
                boxShadow: `0 0 ${size * 2}px ${color}`,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
              }}
            />
          );
        })}
      </div>

      <FloatingQuotes />

      <ChartHistory userName={user?.display_name} />

      {/* ── Hero wrapper: positions wheel behind the panel ── */}
      <div className={styles.heroWrapper}>
        {/* ── Animated Constellation Background ── */}
        <div className={styles.constellationBg}>
          <svg viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            {/* Constellation lines */}
            <line x1="120" y1="150" x2="250" y2="200" />
            <line x1="250" y1="200" x2="310" y2="120" />
            <line x1="310" y1="120" x2="420" y2="180" />
            <line x1="420" y1="180" x2="380" y2="300" />
            <line x1="250" y1="200" x2="380" y2="300" />
            <line x1="500" y1="100" x2="600" y2="170" />
            <line x1="600" y1="170" x2="650" y2="280" />
            <line x1="650" y1="280" x2="550" y2="340" />
            <line x1="550" y1="340" x2="500" y2="100" />
            <line x1="200" y1="450" x2="300" y2="500" />
            <line x1="300" y1="500" x2="280" y2="620" />
            <line x1="280" y1="620" x2="150" y2="580" />
            <line x1="150" y1="580" x2="200" y2="450" />
            <line x1="500" y1="480" x2="620" y2="520" />
            <line x1="620" y1="520" x2="680" y2="450" />
            <line x1="680" y1="450" x2="720" y2="580" />
            <line x1="620" y1="520" x2="720" y2="580" />
            <line x1="100" y1="350" x2="180" y2="400" />
            <line x1="180" y1="400" x2="200" y2="450" />
            <line x1="650" y1="280" x2="680" y2="450" />
            <line x1="380" y1="300" x2="350" y2="420" />
            <line x1="350" y1="420" x2="500" y2="480" />
            <line x1="420" y1="650" x2="500" y2="700" />
            <line x1="500" y1="700" x2="580" y2="680" />
            <line x1="420" y1="650" x2="280" y2="620" />
            {/* Constellation nodes */}
            <circle className={styles.constellationNode} cx="120" cy="150" r="2" />
            <circle className={styles.constellationNode} cx="250" cy="200" r="1.5" />
            <circle className={styles.constellationNode} cx="310" cy="120" r="2" />
            <circle className={styles.constellationNode} cx="420" cy="180" r="1.5" />
            <circle className={styles.constellationNode} cx="380" cy="300" r="2" />
            <circle className={styles.constellationNode} cx="500" cy="100" r="1.5" />
            <circle className={styles.constellationNode} cx="600" cy="170" r="2" />
            <circle className={styles.constellationNode} cx="650" cy="280" r="1.5" />
            <circle className={styles.constellationNode} cx="550" cy="340" r="2" />
            <circle className={styles.constellationNode} cx="200" cy="450" r="1.5" />
            <circle className={styles.constellationNode} cx="300" cy="500" r="2" />
            <circle className={styles.constellationNode} cx="280" cy="620" r="1.5" />
            <circle className={styles.constellationNode} cx="150" cy="580" r="2" />
            <circle className={styles.constellationNode} cx="500" cy="480" r="1.5" />
            <circle className={styles.constellationNode} cx="620" cy="520" r="2" />
            <circle className={styles.constellationNode} cx="680" cy="450" r="1.5" />
            <circle className={styles.constellationNode} cx="720" cy="580" r="2" />
            <circle className={styles.constellationNode} cx="100" cy="350" r="1.5" />
            <circle className={styles.constellationNode} cx="180" cy="400" r="2" />
            <circle className={styles.constellationNode} cx="350" cy="420" r="1.5" />
            <circle className={styles.constellationNode} cx="420" cy="650" r="2" />
            <circle className={styles.constellationNode} cx="500" cy="700" r="1.5" />
            <circle className={styles.constellationNode} cx="580" cy="680" r="2" />
          </svg>
        </div>

        <div ref={wheelRef} className={styles.parallaxWheel}>
          <ZodiacWheel />
        </div>

      <section ref={panelRef} className={`intake-panel anim-rise-in ${styles.panel}`} onMouseMove={handlePanelMouseMove} onMouseLeave={handlePanelMouseLeave}>
        <p className={`kicker anim-slide-in-left ${heroReady ? "" : "hero-pre"}`} style={{ animationDelay: "0s" }}>
          <HiOutlineSparkles className="section-icon" />
          {t("home.kicker")}
        </p>
        {/* ── Mystical Rotating Tagline ── */}
        <div className={styles.mysticalTagline}>
          <span key={taglineIndex} className={styles.mysticalTaglineInner}>
            {mysticalPhrases[taglineIndex]}
          </span>
        </div>
        <h1 className={styles.heroHeading}>
          {scrambledHeading.split(/\s+/).map((word, i) => (
            <span
              key={i}
              className={`hero-word ${heroReady ? "hero-word-in" : ""}`}
              style={{ transitionDelay: `${i * WORD_STAGGER}ms` }}
            >
              {word}
            </span>
          ))}
          {cursorPhase === "blinking" && (
            <span className="hero-cursor" aria-hidden="true" />
          )}
          {cursorPhase === "done" && (
            <span className="hero-cursor hero-cursor-out" aria-hidden="true" />
          )}
        </h1>
        {/* ── Zodiac Elemental Groups ── */}
        <div
          className={`${styles.zodiacStrip} ${heroReady ? "anim-fade-in" : "hero-pre"}`}
          style={{ animationDelay: `${leadDelay}s` }}
          aria-hidden="true"
        >
          {[
            {
              elementKey: "zodiacElements.fire",
              color: "#F07068",
              glow: "rgba(240, 112, 104, 0.25)",
              signs: [
                { src: "/zodiac/aries.jpg", name: "Aries", symbol: "♈" },
                { src: "/zodiac/leo.jpg", name: "Leo", symbol: "♌" },
                { src: "/zodiac/sagittarius.jpg", name: "Sagittarius", symbol: "♐" },
              ],
            },
            {
              elementKey: "zodiacElements.earth",
              color: "#3ECDA5",
              glow: "rgba(62, 205, 165, 0.25)",
              signs: [
                { src: "/zodiac/taurus.jpg", name: "Taurus", symbol: "♉" },
                { src: "/zodiac/virgo.jpg", name: "Virgo", symbol: "♍" },
                { src: "/zodiac/capricorn.png", name: "Capricorn", symbol: "♑" },
              ],
            },
            {
              elementKey: "zodiacElements.air",
              color: "#8B8FA3",
              glow: "rgba(139, 143, 163, 0.25)",
              signs: [
                { src: "/zodiac/gemini.jpg", name: "Gemini", symbol: "♊" },
                { src: "/zodiac/libra.jpg", name: "Libra", symbol: "♎" },
                { src: "/zodiac/aquarius.png", name: "Aquarius", symbol: "♒" },
              ],
            },
            {
              elementKey: "zodiacElements.water",
              color: "#5B9BD5",
              glow: "rgba(91, 155, 213, 0.25)",
              signs: [
                { src: "/zodiac/cancer.jpg", name: "Cancer", symbol: "♋" },
                { src: "/zodiac/scorpio.jpg", name: "Scorpio", symbol: "♏" },
                { src: "/zodiac/pisces.jpg", name: "Pisces", symbol: "♓" },
              ],
            },
          ].map((group, gi) => (
            <div
              key={group.elementKey}
              className={styles.elementGroup}
              style={{
                "--element-color": group.color,
                "--element-glow": group.glow,
                animationDelay: `${leadDelay + 0.15 * gi}s`,
              } as React.CSSProperties}
            >
              <div className={styles.elementBackdrop} />
              <span className={styles.elementLabel}>{t(group.elementKey)}</span>
              <div className={styles.elementSigns}>
                {group.signs.map((sign, si) => (
                  <div key={sign.name} className={styles.zodiacStripItem} style={{ animationDelay: `${leadDelay + 0.15 * gi + 0.08 * si}s` }}>
                    <img src={sign.src} alt={sign.name} className={styles.zodiacStripImg} loading="lazy" />
                    <span className={styles.zodiacStripSymbol}>{sign.symbol}</span>
                    <span className={styles.zodiacStripName}>{sign.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="cosmic-divider anim-fade-in" style={{ animationDelay: "0.55s" }}>
          <span className="cosmic-divider-icon"><GiStarSattelites /></span>
        </div>

        <form ref={formRef} className={`intake-form anim-fade-up ${styles.form}`} onSubmit={submitProfile} style={{ animationDelay: "0.5s" }}>
          <span
            className={styles.draftSavedIndicator}
            style={{ opacity: draftSaved ? 1 : 0 }}
            aria-live="polite"
          >
            Draft saved
          </span>
          <div className={styles.bentoGrid}>
          {/* ── Name Card ── */}
          <div className={styles.bentoHero}>
          <div data-field-reveal="0" className={`${styles.fieldCard} ${styles.fieldCardGold}`}>
            <span className={styles.orbitNumber}>1</span>
            <label className={`${styles.fieldLabel} input-glow-gold${validatedFields.has("name") ? " input-validated" : ""}`}>
              <GiCrystalBall className="section-icon" style={{ fontSize: "1.2rem" }} />
              <span className={styles.fieldLabelText}>{t("home.formName")}</span>
              <input
                type="text"
                value={draft.name}
                onChange={updateField("name")}
                placeholder={t("home.formNamePlaceholder")}
                className={styles.fieldInput}
                required
              />
            </label>
          </div>
          </div>

          {/* ── Birth Date Card ── */}
          <div data-field-reveal="1" className={`${styles.fieldCard} ${styles.fieldCardAqua}`}>
            <span className={styles.orbitNumber}>2</span>
            <div className={styles.fieldCardAccent}>
              <img src="/zodiac/cancer.jpg" alt="" className={styles.fieldCardAccentImg} />
            </div>
            <label className={`${styles.fieldLabel} input-glow-aqua${validatedFields.has("birthDate") ? " input-validated" : ""}`}>
              <GiSunrise className="section-icon" style={{ fontSize: "1.2rem" }} />
              <span className={styles.fieldLabelText}>{t("home.formBirthDate")}</span>
              <input
                type="date"
                value={draft.birthDate}
                onChange={updateField("birthDate")}
                className={styles.fieldInput}
                required
              />
            </label>
          </div>

          {/* ── Birth Time Card ── */}
          <div data-field-reveal="2" className={`${styles.fieldCard} ${styles.fieldCardCoral}`}>
            <span className={styles.orbitNumber}>3</span>
            <div className={styles.fieldCardAccent}>
              <img src="/zodiac/leo.jpg" alt="" className={styles.fieldCardAccentImg} />
            </div>
            <label className={`${styles.fieldLabel} input-glow-coral${validatedFields.has("birthTime") ? " input-validated" : ""}`}>
              <GiSunrise className="section-icon" style={{ fontSize: "1.2rem" }} />
              <span className={styles.fieldLabelText}>{t("home.formBirthTime")}</span>
              <input
                type="time"
                value={draft.birthTime}
                onChange={updateField("birthTime")}
                className={styles.fieldInput}
                required
              />
            </label>
          </div>

          {/* ── Country Card ── */}
          <div className={styles.bentoWide}>
          <div data-field-reveal="3" className={`${styles.fieldCard} ${styles.fieldCardViolet}`}>
            <span className={styles.orbitNumber}>4</span>
            <div className={styles.fieldCardAccent}>
              <img src="/zodiac/sagittarius.jpg" alt="" className={styles.fieldCardAccentImg} />
            </div>
            <label className={`${styles.fieldLabel} input-glow-violet${validatedFields.has("country") ? " input-validated" : ""}`}>
              <GiCompass className="section-icon" style={{ fontSize: "1.2rem" }} />
              <span className={styles.fieldLabelText}>{t("home.formCountry")}</span>
              <AutocompleteInput
                value={draft.country}
                onChange={handleCountryChange}
                onSelect={handleCountrySelect}
                placeholder={t("home.formCountryPlaceholder")}
                suggestType="country"
                required
              />
            </label>
          </div>
          </div>

          {/* ── State Card ── */}
          <div data-field-reveal="4" className={`${styles.fieldCard} ${styles.fieldCardRose}`}>
            <span className={styles.orbitNumber}>5</span>
            <div className={styles.fieldCardAccent}>
              <img src="/zodiac/capricorn.png" alt="" className={styles.fieldCardAccentImg} />
            </div>
            <label className={`${styles.fieldLabel} input-glow-rose${validatedFields.has("state") ? " input-validated" : ""}`}>
              <GiCompass className="section-icon" style={{ fontSize: "1.2rem" }} />
              <span className={styles.fieldLabelText}>{t("home.formState")}</span>
              <AutocompleteInput
                value={draft.state}
                onChange={handleStateChange}
                onSelect={handleStateSelect}
                placeholder={t("home.formStatePlaceholder")}
                suggestType="state"
                contextCountry={draft.country}
                required
              />
            </label>
          </div>

          {/* ── City Card ── */}
          <div data-field-reveal="5" className={`${styles.fieldCard} ${styles.fieldCardGold}`}>
            <span className={styles.orbitNumber}>6</span>
            <div className={styles.fieldCardAccent}>
              <img src="/zodiac/pisces.jpg" alt="" className={styles.fieldCardAccentImg} />
            </div>
            <label className={`${styles.fieldLabel} input-glow-gold${validatedFields.has("city") ? " input-validated" : ""}`}>
              <GiCompass className="section-icon" style={{ fontSize: "1.2rem" }} />
              <span className={styles.fieldLabelText}>{t("home.formCity")}</span>
              <AutocompleteInput
                value={draft.city}
                onChange={setField("city")}
                onSelect={setField("city")}
                placeholder={t("home.formCityPlaceholder")}
                suggestType="city"
                contextCountry={draft.country}
                contextState={draft.state}
                required
              />
            </label>
          </div>
          </div>{/* end bentoGrid */}

          {geoStatus !== "idle" && (
            <p className={`geo-status ${geoStatus}`}>
              {geoStatus === "loading" && t("home.geoLoading")}
              {geoStatus === "found" && t("home.geoFound", { lat: Number(draft.latitude).toFixed(4), lon: Number(draft.longitude).toFixed(4) })}
              {geoStatus === "not-found" && t("home.geoNotFound")}
            </p>
          )}

          <div data-field-reveal="6" className="collapsible-section">
            <button
              type="button"
              className="collapsible-toggle"
              onClick={() => setLatLonExpanded((prev) => !prev)}
            >
              {latLonExpanded ? t("home.hideLatLon") : t("home.showLatLon")}
              <span className={`toggle-arrow ${latLonExpanded ? "expanded" : ""}`}>&#9662;</span>
            </button>

            {latLonExpanded && (
              <div className="input-grid three-col" style={{ marginTop: "0.6rem" }}>
                <label className="input-glow-aqua">
                  {t("home.formTimezone")}
                  <input
                    type="number"
                    value={draft.timezoneOffsetMinutes}
                    onChange={updateField("timezoneOffsetMinutes")}
                    placeholder="e.g. 330, -300"
                    min={-720}
                    max={840}
                    required
                  />
                  {draft.timeZoneId && (
                    <small style={{ display: "block", marginTop: "0.35rem", opacity: 0.78 }}>
                      {draft.timeZoneId}
                    </small>
                  )}
                </label>
                <label className="input-glow-coral">
                  {t("home.formLatitude")}
                  <input
                    type="number"
                    value={draft.latitude}
                    onChange={updateField("latitude")}
                    placeholder="e.g. 28.6139"
                    min={-90}
                    max={90}
                    step="0.0001"
                    required
                  />
                </label>
                <label className="input-glow-violet">
                  {t("home.formLongitude")}
                  <input
                    type="number"
                    value={draft.longitude}
                    onChange={updateField("longitude")}
                    placeholder="e.g. 77.2090"
                    min={-180}
                    max={180}
                    step="0.0001"
                    required
                  />
                </label>
              </div>
            )}
            </div>

          {/* ── Cosmic Charge Submit Button ── */}
          <div
            ref={submitWrapperRef}
            data-field-reveal="7"
            className={styles.submitChargeWrapper}
            onClick={handleSubmitClick}
            style={{ "--charge-level": chargeLevel } as React.CSSProperties}
          >
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className={chargeLevel >= 1 ? styles.fullyCharged : undefined}
            >
              {isSubmitting ? t("home.submitting") : t("home.submit")}
            </button>
          </div>
        </form>
      </section>
      </div>{/* /heroWrapper */}
    </div>
    </PageTransition>
  );
}
