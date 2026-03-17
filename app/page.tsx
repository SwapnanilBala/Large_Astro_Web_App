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

export default function Home() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProfileQueryInput>(withClientTimezoneDefault);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latLonExpanded, setLatLonExpanded] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // ── Validation shimmer: track previous draft to detect empty→filled ──
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
        // Clear any existing timer for this field
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

  // Cleanup shimmer timers on unmount
  useEffect(() => {
    const timers = shimmerTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
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

  // Helper: returns "input-validated" class if a field is shimmer-active
  const shimmerClass = useCallback(
    (field: keyof ProfileQueryInput) => (validatedFields.has(field) ? "input-validated" : ""),
    [validatedFields]
  );

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

    router.push(`/engine-select?${params.toString()}`);
  };

  return (
    <main className="home-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <FloatingQuotes />

      <ChartHistory userName={user?.display_name} />

      {/* ── Hero wrapper: positions wheel behind the panel ── */}
      <div className={styles.heroWrapper}>
        <ZodiacWheel />

      <section className={`intake-panel anim-rise-in ${styles.panel}`}>
        <p className="kicker anim-slide-in-left" style={{ animationDelay: "0.15s" }}>
          <HiOutlineSparkles className="section-icon" />
          {t("home.kicker")}
        </p>
        <h1 className={styles.heroHeading} style={{ animationDelay: "0.3s" }}>
          {t("home.heading")}
        </h1>
        <p className="lead anim-fade-in" style={{ animationDelay: "0.45s" }}>
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

          {/* ── Section 6: Submit ── */}
          <div className="glass-section field-hidden" data-field-reveal="6">
            <button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? t("home.submitting") : t("home.submit")}
            </button>
          </div>
        </form>
      </section>
      </div>{/* /heroWrapper */}
    </main>
  );
}
