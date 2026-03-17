"use client";

import type { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GiCrystalBall, GiSunrise, GiCompass, GiStarSattelites } from "react-icons/gi";
import { HiOutlineSparkles } from "react-icons/hi2";
import { profileInitialState, type ProfileQueryInput } from "@/lib/astro-types";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import FloatingQuotes from "./components/FloatingQuotes";
import AutocompleteInput from "./components/AutocompleteInput";
import ChartHistory from "./components/ChartHistory";
import ZodiacWheel from "./components/ZodiacWheel";
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

const REVEAL_STAGGER_MS = 80;

const withClientTimezoneDefault = (): ProfileQueryInput => ({
  ...profileInitialState,
  timezoneOffsetMinutes: "0",
  timeZoneId: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""
});

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function Home() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProfileQueryInput>(withClientTimezoneDefault);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latLonExpanded, setLatLonExpanded] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // ── Validation shimmer: track previous draft to detect empty->filled ──
  const prevDraftRef = useRef<ProfileQueryInput>(withClientTimezoneDefault());
  const [validatedFields, setValidatedFields] = useState<Set<string>>(new Set());
  const shimmerTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const prev = prevDraftRef.current;
    const fieldsToCheck: Array<keyof ProfileQueryInput> = [
      "name", "birthDate", "birthTime", "country", "state", "city",
      "timezoneOffsetMinutes", "latitude", "longitude",
    ];
    for (const field of fieldsToCheck) {
      const wasEmpty = !prev[field].trim();
      const nowFilled = !!draft[field].trim();
      if (wasEmpty && nowFilled) {
        setValidatedFields((s) => new Set(s).add(field));
        const existingTimer = shimmerTimers.current.get(field);
        if (existingTimer) clearTimeout(existingTimer);
        const timer = setTimeout(() => {
          setValidatedFields((s) => {
            const next = new Set(s);
            next.delete(field);
            return next;
          });
          shimmerTimers.current.delete(field);
        }, 650);
        shimmerTimers.current.set(field, timer);
      }
    }
    prevDraftRef.current = { ...draft };
  }, [draft]);

  useEffect(() => {
    const timers = shimmerTimers.current;
    return () => {
      timers.forEach((tmr) => clearTimeout(tmr));
    };
  }, []);

  // ── IntersectionObserver for scroll-triggered reveal ──
  const formRef = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const sections = form.querySelectorAll<HTMLElement>("[data-field-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const idx = Number(el.dataset.fieldReveal ?? 0);
            setTimeout(() => {
              el.classList.remove("field-hidden");
              el.classList.add("field-revealed");
            }, idx * REVEAL_STAGGER_MS);
            observer.unobserve(el);
          }
        }
      },
      { threshold: 0.1 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const shimmerClass = useCallback(
    (field: keyof ProfileQueryInput) => (validatedFields.has(field) ? "input-validated" : ""),
    [validatedFields]
  );

  // ── Feature 1: Parallax refs ──
  const shellRef = useRef<HTMLElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const orbLeftRef = useRef<HTMLDivElement>(null);
  const orbRightRef = useRef<HTMLDivElement>(null);
  const orbCenterRef = useRef<HTMLDivElement>(null);

  // ── Feature 2: Mouse tracking state for ambient orbs ──
  const mousePos = useRef({ x: 0, y: 0 });
  const smoothOrbLeft = useRef({ x: 0, y: 0 });
  const smoothOrbRight = useRef({ x: 0, y: 0 });
  const smoothOrbCenter = useRef({ x: 0, y: 0 });

  // ── Feature 3: Hero text animation state ──
  const [heroReady, setHeroReady] = useState(false);
  const [cursorPhase, setCursorPhase] = useState<"hidden" | "blinking" | "out">("hidden");

  const headingText = t("home.heading");
  const headingWords = useMemo(() => headingText.split(/\s+/), [headingText]);

  const kickerDelay = 300;
  const headingStartDelay = kickerDelay + 300;
  const wordCount = headingWords.length;
  const headingTotalDuration = headingStartDelay + wordCount * 80 + 500;
  const leadDelay = headingTotalDuration + 200;

  // ── Combined rAF loop for parallax + orb mouse tracking (Features 1 & 2) ──
  useEffect(() => {
    let rafId: number;
    let scrollY = 0;

    const onScroll = () => {
      scrollY = window.scrollY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const shell = shellRef.current;
      if (!shell) return;
      const rect = shell.getBoundingClientRect();
      mousePos.current.x = (e.clientX - rect.left) / rect.width - 0.5;
      mousePos.current.y = (e.clientY - rect.top) / rect.height - 0.5;
    };

    const loop = () => {
      // Parallax transforms
      if (wheelRef.current) {
        wheelRef.current.style.transform = `translateY(${scrollY * 0.3}px)`;
      }
      if (panelRef.current) {
        panelRef.current.style.transform = `translateY(${scrollY * 0.1}px)`;
      }

      // Orb lerp-based cursor reactivity
      const mx = mousePos.current.x;
      const my = mousePos.current.y;
      const lf = 0.06;

      // Left orb: moves AWAY from cursor (multiplier 0.02)
      smoothOrbLeft.current.x = lerp(smoothOrbLeft.current.x, -mx * 0.02 * window.innerWidth, lf);
      smoothOrbLeft.current.y = lerp(smoothOrbLeft.current.y, -my * 0.02 * window.innerHeight, lf);

      // Right orb: moves TOWARD cursor (multiplier 0.015)
      smoothOrbRight.current.x = lerp(smoothOrbRight.current.x, mx * 0.015 * window.innerWidth, lf);
      smoothOrbRight.current.y = lerp(smoothOrbRight.current.y, my * 0.015 * window.innerHeight, lf);

      // Center orb: moves perpendicular to cursor
      smoothOrbCenter.current.x = lerp(smoothOrbCenter.current.x, my * 0.018 * window.innerWidth, lf);
      smoothOrbCenter.current.y = lerp(smoothOrbCenter.current.y, -mx * 0.018 * window.innerHeight, lf);

      const pY = scrollY * 0.15;
      if (orbLeftRef.current) {
        orbLeftRef.current.style.transform = `translate(${smoothOrbLeft.current.x}px, ${smoothOrbLeft.current.y + pY}px)`;
      }
      if (orbRightRef.current) {
        orbRightRef.current.style.transform = `translate(${smoothOrbRight.current.x}px, ${smoothOrbRight.current.y + pY}px)`;
      }
      if (orbCenterRef.current) {
        orbCenterRef.current.style.transform = `translate(${smoothOrbCenter.current.x}px, ${smoothOrbCenter.current.y + pY}px)`;
      }

      rafId = requestAnimationFrame(loop);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    const shell = shellRef.current;
    if (shell) {
      shell.addEventListener("mousemove", onMouseMove, { passive: true });
    }
    scrollY = window.scrollY;
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      if (shell) {
        shell.removeEventListener("mousemove", onMouseMove);
      }
    };
  }, []);

  // ── Feature 3: Hero text reveal timing ──
  useEffect(() => {
    const t1 = setTimeout(() => setHeroReady(true), kickerDelay);
    const t2 = setTimeout(() => setCursorPhase("blinking"), headingTotalDuration);
    const t3 = setTimeout(() => setCursorPhase("out"), headingTotalDuration + 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [headingTotalDuration, kickerDelay]);

  useEffect(() => {
    const clientOffset = String(-new Date().getTimezoneOffset());
    setDraft((previous) => ({ ...previous, timezoneOffsetMinutes: clientOffset }));
  }, []);

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

  // ── Cosmic charge: tracks form completion ratio ──
  const chargeFields: Array<keyof ProfileQueryInput> = ["name", "birthDate", "birthTime", "country", "state", "city"];
  const chargeLevel = useMemo(() => {
    const filled = chargeFields.filter((f) => draft[f].trim().length > 0).length;
    return filled / chargeFields.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const submitWrapperRef = useRef<HTMLDivElement>(null);

  const spawnParticleBurst = useCallback((clientX: number, clientY: number) => {
    const wrapper = submitWrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const originX = clientX - rect.left;
    const originY = clientY - rect.top;

    const ripple = document.createElement("div");
    ripple.className = "cosmic-ripple";
    ripple.style.left = `${originX}px`;
    ripple.style.top = `${originY}px`;
    wrapper.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);

    const count = 12 + Math.floor(Math.random() * 5);
    const colors = [
      "rgba(242, 194, 108, 0.9)",
      "rgba(255, 215, 100, 0.9)",
      "rgba(108, 225, 212, 0.9)",
      "rgba(140, 230, 220, 0.9)",
    ];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const dist = 40 + Math.random() * 60;
      const bx = Math.cos(angle) * dist;
      const by = Math.sin(angle) * dist;

      const particle = document.createElement("div");
      particle.className = "cosmic-particle";
      particle.style.left = `${originX}px`;
      particle.style.top = `${originY}px`;
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      particle.style.setProperty("--burst-x", `${bx}px`);
      particle.style.setProperty("--burst-y", `${by}px`);
      particle.style.width = `${3 + Math.random() * 5}px`;
      particle.style.height = particle.style.width;
      wrapper.appendChild(particle);
      setTimeout(() => particle.remove(), 600);
    }
  }, []);

  const handleSubmitClick = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    spawnParticleBurst(e.clientX, e.clientY);
  }, [spawnParticleBurst]);

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

    router.push(`/engine-select?${params.toString()}`);
  };

  return (
    <main className="home-shell" ref={shellRef}>
      <div className="ambient ambient-left" ref={orbLeftRef} />
      <div className="ambient ambient-right" ref={orbRightRef} />
      <div className="ambient ambient-center" ref={orbCenterRef} />
      <FloatingQuotes />

      <ChartHistory userName={user?.display_name} />

      {/* ── Hero wrapper: positions wheel behind the panel ── */}
      <div className={styles.heroWrapper} ref={wheelRef}>
        <ZodiacWheel />

      <section className={`intake-panel anim-rise-in ${styles.panel}`} ref={panelRef}>
        <p
          className={`kicker anim-slide-in-left ${heroReady ? "" : "hero-pre"}`}
          style={{
            animationDelay: "0.15s",
            opacity: heroReady ? undefined : 0,
            transition: "opacity 400ms ease-out",
          }}
        >
          <HiOutlineSparkles className="section-icon" />
          {t("home.kicker")}
        </p>
        <h1
          className={styles.heroHeading}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0 0.3em",
            animationDelay: "0.3s",
          }}
        >
          {headingWords.map((word, i) => {
            const wordDelay = headingStartDelay + i * 80;
            return (
              <span
                key={i}
                className={`hero-word ${heroReady ? "hero-word-in" : ""}`}
                style={{
                  display: "inline-block",
                  transitionDelay: `${wordDelay}ms`,
                }}
              >
                {word}
              </span>
            );
          })}
          {cursorPhase !== "hidden" && (
            <span
              className={`hero-cursor ${cursorPhase === "out" ? "hero-cursor-out" : ""}`}
            >
              |
            </span>
          )}
        </h1>
        <p
          className={`lead anim-fade-in ${heroReady ? "" : "hero-pre"}`}
          style={{
            animationDelay: `${leadDelay}ms`,
            opacity: heroReady ? undefined : 0,
            transition: `opacity 500ms ease-out ${leadDelay}ms`,
          }}
        >
          {t("home.lead")}
        </p>

        <div className="cosmic-divider anim-fade-in" style={{ animationDelay: "0.55s" }}>
          <span className="cosmic-divider-icon"><GiStarSattelites /></span>
        </div>

        <form ref={formRef} className={`intake-form anim-fade-up ${styles.form}`} onSubmit={submitProfile} style={{ animationDelay: "0.5s" }}>
          {/* ── Section 0: Name ── */}
          <div className="glass-section glass-section--aqua field-hidden" data-field-reveal="0">
            <label className={`input-glow-gold ${shimmerClass("name")}`}>
              <GiCrystalBall className="section-icon" style={{ fontSize: "0.9rem" }} /> {t("home.formName")}
              <input
                type="text"
                value={draft.name}
                onChange={updateField("name")}
                placeholder={t("home.formNamePlaceholder")}
                required
              />
            </label>
          </div>

          {/* ── Section 1: Birth Details heading ── */}
          <div className="glass-section glass-section--aqua field-hidden" data-field-reveal="1">
            <h2 className={styles.sectionHeading}>
              <GiSunrise className="section-icon" style={{ fontSize: "1.1rem" }} /> {t("home.birthDetails")}
            </h2>
          </div>

          {/* ── Section 2: Birth date & time ── */}
          <div className="glass-section glass-section--aqua field-hidden" data-field-reveal="2">
            <div className="input-grid">
              <label className={`input-glow-aqua ${shimmerClass("birthDate")}`}>
                {t("home.formBirthDate")}
                <input
                  type="date"
                  value={draft.birthDate}
                  onChange={updateField("birthDate")}
                  required
                />
              </label>
              <label className={`input-glow-coral ${shimmerClass("birthTime")}`}>
                {t("home.formBirthTime")}
                <input
                  type="time"
                  value={draft.birthTime}
                  onChange={updateField("birthTime")}
                  required
                />
              </label>
            </div>
          </div>

          {/* ── Section 3: Birth Location heading ── */}
          <div className="glass-section glass-section--gold field-hidden" data-field-reveal="3">
            <h2 className={styles.sectionHeading}>
              <GiCompass className="section-icon" style={{ fontSize: "1.1rem" }} /> {t("home.birthLocation")}
            </h2>
          </div>

          {/* ── Section 4: Country / State / City ── */}
          <div className="glass-section glass-section--gold field-hidden" data-field-reveal="4">
            <div className="input-grid three-col location-row">
              <label className={`input-glow-violet ${shimmerClass("country")}`}>
                {t("home.formCountry")}
                <AutocompleteInput
                  value={draft.country}
                  onChange={handleCountryChange}
                  onSelect={handleCountrySelect}
                  placeholder={t("home.formCountryPlaceholder")}
                  suggestType="country"
                  required
                />
              </label>
              <label className={`input-glow-rose ${shimmerClass("state")}`}>
                {t("home.formState")}
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
              <label className={`input-glow-gold ${shimmerClass("city")}`}>
                {t("home.formCity")}
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
          </div>

          {/* ── Section 5: Geo status ── */}
          <div className="glass-section glass-section--gold field-hidden" data-field-reveal="5">
            {geoStatus !== "idle" && (
              <p className={`geo-status ${geoStatus}`}>
                {geoStatus === "loading" && t("home.geoLoading")}
                {geoStatus === "found" && t("home.geoFound", { lat: Number(draft.latitude).toFixed(4), lon: Number(draft.longitude).toFixed(4) })}
                {geoStatus === "not-found" && t("home.geoNotFound")}
              </p>
            )}

            <div className="collapsible-section">
              <button
                type="button"
                className="collapsible-toggle"
                onClick={() => setLatLonExpanded((prev) => !prev)}
              >
                {latLonExpanded ? t("home.hideLatLon") : t("home.showLatLon")}
                <span className={`toggle-arrow ${latLonExpanded ? "expanded" : ""}`}>&#9662;</span>
              </button>

              {latLonExpanded && (
                <div className="glass-section glass-section--violet" style={{ marginTop: "0.6rem" }}>
                  <div className="input-grid three-col">
                    <label className={`input-glow-aqua ${shimmerClass("timezoneOffsetMinutes")}`}>
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
                    <label className={`input-glow-coral ${shimmerClass("latitude")}`}>
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
                    <label className={`input-glow-violet ${shimmerClass("longitude")}`}>
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
                </div>
              )}
            </div>
          </div>

          {/* ── Section 6: Submit with Cosmic Charge ── */}
          <div className="glass-section field-hidden" data-field-reveal="6">
            <div
              ref={submitWrapperRef}
              className="cosmic-submit-wrapper"
              onClick={handleSubmitClick}
            >
              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                style={{
                  ["--charge-level" as string]: chargeLevel,
                  opacity: 0.6 + chargeLevel * 0.4,
                  filter: `saturate(${0.5 + chargeLevel * 0.5})`,
                  boxShadow: chargeLevel >= 1
                    ? undefined
                    : `0 0 ${chargeLevel * 30}px rgba(242, 194, 108, ${chargeLevel * 0.3}), 0 0 ${chargeLevel * 60}px rgba(108, 225, 212, ${chargeLevel * 0.15})`,
                  animation: chargeLevel >= 1
                    ? "chargeGlow 2s ease-in-out infinite, submitGradientShift 4s ease infinite"
                    : undefined,
                }}
              >
                {isSubmitting ? t("home.submitting") : t("home.submit")}
              </button>
            </div>
          </div>
        </form>
      </section>
      </div>{/* /heroWrapper */}
    </main>
  );
}
