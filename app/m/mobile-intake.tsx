"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { profileInitialState, type ProfileQueryInput } from "@/lib/astro-types";
import { COARSE_TIME_OPTIONS, hasCoarseTimeFallback } from "@/lib/birth-time";
import { buildChartQuery } from "@/lib/intake-query";
import { useTranslation } from "@/lib/i18n-context";
import { profileScopedKey } from "@/lib/local-profiles";
import { useProfile } from "@/lib/profile-context";
import styles from "./mobile.module.css";

/*
 * Mobile intake.
 *
 * Same two-step shape as the desktop form and the same output — it builds its
 * query with buildChartQuery, so identical answers produce an identical chart
 * on either tree.
 *
 * What differs is the input layer. Desktop uses react-datepicker, which on a
 * phone means a cramped calendar grid and a 15-minute time dropdown. Here the
 * fields are native date/time inputs, so the OS picker opens instead: the
 * scroll wheel people already know, correct for their locale, keyboard and
 * screen-reader support for free, and exact minutes without typing.
 */

const STORAGE_PREFIX = "astro_intake_draft";

type GeocodeApiResponse = {
  found?: boolean;
  lat?: number;
  lon?: number;
  timezoneOffsetMinutes?: number;
  timeZoneId?: string;
};

function initialDraft(): ProfileQueryInput {
  return {
    ...profileInitialState,
    timezoneOffsetMinutes: "0",
    timeZoneId: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "",
  };
}

export default function MobileIntake() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profileId } = useProfile();

  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<ProfileQueryInput>(initialDraft);
  const [unknownTime, setUnknownTime] = useState(false);
  const [coarseTime, setCoarseTime] = useState("");
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const [submitting, setSubmitting] = useState(false);
  const geoAbort = useRef<AbortController | null>(null);

  /* Share the desktop draft so switching trees mid-entry does not lose work. */
  useEffect(() => {
    if (!profileId) return;

    try {
      const stored = localStorage.getItem(profileScopedKey(STORAGE_PREFIX, profileId));
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        draft?: Partial<ProfileQueryInput>;
        unknownTime?: boolean;
        coarseTime?: string;
      };
      if (parsed.draft) setDraft((prev) => ({ ...prev, ...parsed.draft }));
      if (typeof parsed.unknownTime === "boolean") setUnknownTime(parsed.unknownTime);
      if (typeof parsed.coarseTime === "string") setCoarseTime(parsed.coarseTime);
    } catch {
      /* A corrupt draft is not worth failing the page over. */
    }
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;

    try {
      localStorage.setItem(
        profileScopedKey(STORAGE_PREFIX, profileId),
        JSON.stringify({ draft, unknownTime, coarseTime })
      );
    } catch {
      /* Private mode and quota errors are non-fatal here. */
    }
  }, [coarseTime, draft, profileId, unknownTime]);

  const set = (key: keyof ProfileQueryInput, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const hasName = draft.name.trim().length > 0;
  const hasDate = draft.birthDate.trim().length > 0;
  const hasTime = unknownTime ? hasCoarseTimeFallback(coarseTime) : draft.birthTime.trim().length > 0;
  const canContinue = hasName && hasDate && hasTime;

  const hasPlace =
    draft.country.trim().length > 0 &&
    draft.state.trim().length > 0 &&
    draft.city.trim().length > 0;
  const hasCoords = draft.latitude.trim().length > 0 && draft.longitude.trim().length > 0;
  const canSubmit = canContinue && hasPlace && hasCoords;

  /* Resolve coordinates and the historical UTC offset for the birth moment.
   * Debounced because it fires on every keystroke across three fields. */
  useEffect(() => {
    if (step !== 2 || !hasPlace) return;

    const params = new URLSearchParams({
      city: draft.city.trim(),
      state: draft.state.trim(),
      country: draft.country.trim(),
      birthDate: draft.birthDate.trim(),
      birthTime: draft.birthTime.trim() || "12:00",
    });

    const timer = setTimeout(async () => {
      geoAbort.current?.abort();
      const controller = new AbortController();
      geoAbort.current = controller;
      setGeoStatus("loading");

      try {
        const res = await fetch(`/api/geocode?${params}`, { signal: controller.signal });
        const data = (await res.json()) as GeocodeApiResponse;
        if (controller.signal.aborted) return;

        if (data.found && typeof data.lat === "number" && typeof data.lon === "number") {
          setDraft((prev) => ({
            ...prev,
            latitude: String(data.lat),
            longitude: String(data.lon),
            timezoneOffsetMinutes: String(data.timezoneOffsetMinutes ?? prev.timezoneOffsetMinutes),
            timeZoneId: data.timeZoneId ?? prev.timeZoneId,
          }));
          setGeoStatus("found");
        } else {
          setGeoStatus("not-found");
        }
      } catch {
        if (!controller.signal.aborted) setGeoStatus("not-found");
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      geoAbort.current?.abort();
    };
  }, [step, hasPlace, draft.city, draft.state, draft.country, draft.birthDate, draft.birthTime]);

  const missing = useMemo(() => {
    if (step === 1) {
      const gaps: string[] = [];
      if (!hasName) gaps.push(t("home.formName"));
      if (!hasDate) gaps.push(t("home.formBirthDate"));
      if (!hasTime) gaps.push(t("home.formBirthTime"));
      return gaps;
    }
    const gaps: string[] = [];
    if (!draft.country.trim()) gaps.push(t("home.formCountry"));
    if (!draft.state.trim()) gaps.push(t("home.formState"));
    if (!draft.city.trim()) gaps.push(t("home.formCity"));
    return gaps;
  }, [step, hasName, hasDate, hasTime, draft.country, draft.state, draft.city, t]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step === 1) {
      if (canContinue) setStep(2);
      return;
    }
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    const params = buildChartQuery(draft, { unknownTime, coarseTime });
    router.push(`/engine-select?${params.toString()}`);
  };

  return (
    <form className={styles.page} onSubmit={onSubmit} noValidate>
      <header className={styles.header}>
        <span className={styles.step}>Step {step} of 2</span>
        <h1 className={styles.title}>
          {step === 1 ? t("home.intakeHeadingDetails") : t("home.intakeHeadingLocation")}
        </h1>
        <p className={styles.lead}>
          {step === 1 ? t("home.intakeLeadDetails") : t("home.intakeLeadLocation")}
        </p>
        <div className={styles.progress} aria-hidden="true">
          <span className={`${styles.progressBar} ${styles.progressBarActive}`} />
          <span className={`${styles.progressBar} ${step === 2 ? styles.progressBarActive : ""}`} />
        </div>
      </header>

      {step === 1 ? (
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="m-name">
              {t("home.formName")}
              <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <input
              id="m-name"
              className={styles.input}
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("home.formNamePlaceholder")}
              autoComplete="name"
              enterKeyHint="next"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="m-birth-date">
              {t("home.formBirthDate")}
              <span className={styles.required} aria-hidden="true">*</span>
            </label>
            {/* Native date input: opens the OS picker, already localised,
                and needs no parsing on our side — the value is ISO. */}
            <input
              id="m-birth-date"
              className={styles.input}
              type="date"
              value={draft.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              min="1900-01-01"
              autoComplete="bday"
              required
            />
          </div>

          {!unknownTime && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="m-birth-time">
                {t("home.formBirthTime")}
                <span className={styles.required} aria-hidden="true">*</span>
              </label>
              {/* step=60 asks for minute precision rather than the desktop
                  picker's coarser steps — the ascendant moves about a degree
                  every four minutes, so rounding here is a real loss. */}
              <input
                id="m-birth-time"
                className={styles.input}
                type="time"
                step={60}
                value={draft.birthTime}
                onChange={(e) => set("birthTime", e.target.value)}
                required
              />
            </div>
          )}

          <div className={styles.toggleRow}>
            <input
              id="m-unknown-time"
              className={styles.checkbox}
              type="checkbox"
              checked={unknownTime}
              onChange={(e) => {
                setUnknownTime(e.target.checked);
                if (!e.target.checked) setCoarseTime("");
                else set("birthTime", "");
              }}
            />
            <label className={styles.toggleLabel} htmlFor="m-unknown-time">
              {t("home.unknownTimeLabel")}
            </label>
          </div>

          {unknownTime && (
            <fieldset className={styles.field}>
              <legend className={styles.label}>{t("home.timeCaption")}</legend>
              <div className={styles.chips}>
                {COARSE_TIME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.chip} ${coarseTime === option.value ? styles.chipActive : ""}`}
                    aria-pressed={coarseTime === option.value}
                    onClick={() => setCoarseTime(option.value)}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      ) : (
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="m-country">
              {t("home.formCountry")}
              <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <input
              id="m-country"
              className={styles.input}
              value={draft.country}
              onChange={(e) => set("country", e.target.value)}
              autoComplete="country-name"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="m-state">
              {t("home.formState")}
              <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <input
              id="m-state"
              className={styles.input}
              value={draft.state}
              onChange={(e) => set("state", e.target.value)}
              autoComplete="address-level1"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="m-city">
              {t("home.formCity")}
              <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <input
              id="m-city"
              className={styles.input}
              value={draft.city}
              onChange={(e) => set("city", e.target.value)}
              autoComplete="address-level2"
              required
            />
          </div>

          <p className={styles.status} role="status" aria-live="polite">
            {geoStatus === "loading" && "Finding coordinates…"}
            {geoStatus === "found" &&
              `Located — ${Number(draft.latitude).toFixed(3)}, ${Number(draft.longitude).toFixed(3)}`}
            {geoStatus === "not-found" && "Could not find that place. Check the spelling."}
          </p>
        </div>
      )}

      <div className={styles.actions}>
        <div className={styles.actionRow}>
          {step === 2 && (
            <button
              type="button"
              className={`${styles.button} ${styles.buttonGhost}`}
              onClick={() => setStep(1)}
            >
              {t("home.back")}
            </button>
          )}
          <button
            type="submit"
            className={styles.button}
            disabled={step === 1 ? !canContinue : !canSubmit || submitting}
            aria-describedby={missing.length ? "m-action-hint" : undefined}
          >
            {step === 1 ? t("home.continueToLocation") : t("home.cta")}
          </button>
        </div>
        {missing.length > 0 && (
          <p id="m-action-hint" className={styles.actionHint} aria-live="polite">
            Add {missing.join(", ")} to continue.
          </p>
        )}
        {step === 2 && missing.length === 0 && !hasCoords && (
          <p id="m-action-hint" className={styles.actionHint} aria-live="polite">
            Waiting for coordinates…
          </p>
        )}
      </div>
    </form>
  );
}
