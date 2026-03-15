"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GiCrystalBall, GiSunrise, GiCompass, GiStarSattelites } from "react-icons/gi";
import { HiOutlineSparkles, HiOutlineCalendarDays, HiOutlineClock } from "react-icons/hi2";
import { profileInitialState, type ProfileQueryInput } from "@/lib/astro-types";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import FloatingQuotes from "./components/FloatingQuotes";
import AutocompleteInput from "./components/AutocompleteInput";
import ChartHistory from "./components/ChartHistory";

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
  const router = useRouter();

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

    router.push(`/insights?${params.toString()}`);
  };

  return (
    <main className="home-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <FloatingQuotes />

      <ChartHistory userName={user?.display_name} />

      <section className="intake-panel anim-rise-in">
        <p className="kicker anim-slide-in-left" style={{ animationDelay: "0.15s" }}>
          <HiOutlineSparkles className="section-icon" />
          {t("home.kicker")}
        </p>
        <h1 style={{ animationDelay: "0.3s" }}>
          {t("home.heading")}
        </h1>
        <p className="lead anim-fade-in" style={{ animationDelay: "0.45s" }}>
          {t("home.lead")}
        </p>

        <div className="cosmic-divider anim-fade-in" style={{ animationDelay: "0.55s" }}>
          <span className="cosmic-divider-icon"><GiStarSattelites /></span>
        </div>

        <form className="intake-form anim-fade-up" onSubmit={submitProfile} style={{ animationDelay: "0.5s" }}>
          <label className="input-glow-gold">
            <GiCrystalBall className="section-icon" style={{ fontSize: "0.9rem" }} /> {t("home.formName")}
            <input
              type="text"
              value={draft.name}
              onChange={updateField("name")}
              placeholder={t("home.formNamePlaceholder")}
              required
            />
          </label>

          <h2 className="form-section-heading">
            <GiSunrise className="section-icon" style={{ fontSize: "1.1rem" }} /> {t("home.birthDetails")}
          </h2>

          <div className="input-grid">
            <label className="input-glow-aqua">
              {t("home.formBirthDate")}
              <div className="datetime-field">
                <input
                  type="date"
                  value={draft.birthDate}
                  onChange={updateField("birthDate")}
                  required
                />
                <HiOutlineCalendarDays className="datetime-icon datetime-icon-aqua" />
              </div>
            </label>
            <label className="input-glow-coral">
              {t("home.formBirthTime")}
              <div className="datetime-field">
                <input
                  type="time"
                  value={draft.birthTime}
                  onChange={updateField("birthTime")}
                  required
                />
                <HiOutlineClock className="datetime-icon datetime-icon-coral" />
              </div>
            </label>
          </div>

          <label className="input-glow-gold">
            Calculation Engine
            <select value={draft.engineId} onChange={updateField("engineId")}>
              <option value="lahiri_classic">Lahiri Classic</option>
              <option value="raman_classic">Raman Classic</option>
              <option value="krishnamurti_classic">Krishnamurti Classic</option>
            </select>
          </label>

          <h2 className="form-section-heading">
            <GiCompass className="section-icon" style={{ fontSize: "1.1rem" }} /> {t("home.birthLocation")}
          </h2>

          <div className="input-grid two-col">
            <label className="input-glow-violet">
              {t("home.formCountry")}
              <AutocompleteInput
                value={draft.country}
                onChange={setField("country")}
                onSelect={setField("country")}
                placeholder={t("home.formCountryPlaceholder")}
                suggestType="country"
                required
              />
            </label>
            <label className="input-glow-rose">
              {t("home.formState")}
              <AutocompleteInput
                value={draft.state}
                onChange={setField("state")}
                onSelect={setField("state")}
                placeholder={t("home.formStatePlaceholder")}
                suggestType="state"
                required
              />
            </label>
          </div>

          <label className="input-glow-gold">
            {t("home.formCity")}
            <AutocompleteInput
              value={draft.city}
              onChange={setField("city")}
              onSelect={setField("city")}
              placeholder={t("home.formCityPlaceholder")}
              suggestType="city"
              required
            />
          </label>

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

          <button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? t("home.submitting") : t("home.submit")}
          </button>
        </form>
      </section>
    </main>
  );
}
