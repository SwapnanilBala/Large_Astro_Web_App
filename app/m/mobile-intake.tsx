"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { profileInitialState, type ProfileQueryInput } from "@/lib/astro-types";
import { COARSE_TIME_OPTIONS, hasCoarseTimeFallback } from "@/lib/birth-time";
import { buildChartQuery } from "@/lib/intake-query";
import {
  formatBirthDateDisplay,
  formatClockDisplay,
  normalizeBirthDate,
  normalizeBirthTime,
  normalizeCoordinate,
  normalizeCoordinatePair,
  normalizePersonName,
  normalizePlaceName,
  type IntakeFieldResult,
} from "@/lib/intake-normalize";
import AutocompleteInput from "@/app/components/AutocompleteInput";
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
 *
 * The typed-entry normalisers still run on blur. Two reasons: a browser
 * without native date/time support degrades the field to plain text, where
 * "2:30 pm" would otherwise be submitted verbatim; and a 24-hour locale shows
 * the birth time back as "14:30", so the read-out under the field is the only
 * place the visitor sees which half of the day the chart will be built for.
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
  const [fieldNotes, setFieldNotes] = useState<
    Partial<Record<keyof ProfileQueryInput, IntakeFieldResult | undefined>>
  >({});
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const [coordsExpanded, setCoordsExpanded] = useState(false);
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

  /* Typing replaces the answer a note was written about, so the note goes with
   * it — the next blur produces a fresh one. */
  const edit = (key: keyof ProfileQueryInput, value: string) => {
    set(key, value);
    setFieldNotes((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  /* Tidy a field once the visitor moves on, and keep whatever the normaliser
   * had to say about it. Blur rather than keystroke: rewriting text under a
   * moving cursor is hostile, and half a date is not a wrong date. */
  const commit =
    (key: keyof ProfileQueryInput, normalize: (value: string) => IntakeFieldResult) => () => {
      const result = normalize(draft[key]);
      setFieldNotes((prev) => ({
        ...prev,
        [key]: result.status === "ok" || result.status === "empty" ? undefined : result,
      }));
      if (result.value && result.value !== draft[key]) set(key, result.value);
    };

  const applySuggestion = (key: keyof ProfileQueryInput, value: string, label: string) => {
    set(key, value);
    setFieldNotes((prev) => ({
      ...prev,
      [key]: { status: "corrected", value, display: label, message: `Set to ${label}.` },
    }));
  };

  /* Same shape as `commit`, but driven by AutocompleteInput, which hands back
   * the whole result rather than firing a blur we could hang off. */
  const commitPlace = (key: keyof ProfileQueryInput) => (result: IntakeFieldResult) => {
    setFieldNotes((prev) => ({
      ...prev,
      [key]: result.status === "ok" || result.status === "empty" ? undefined : result,
    }));
    if (result.value && result.value !== draft[key]) set(key, result.value);
  };

  /* A resolved location belongs to the place that was named. Change the place
   * and the coordinates are stale, so they go rather than quietly describing
   * somewhere the visitor has moved on from. */
  const clearResolvedLocation = () => {
    setDraft((prev) => ({ ...prev, latitude: "", longitude: "" }));
    setGeoStatus("idle");
  };

  const changeCountry = (value: string) => {
    setDraft((prev) => ({ ...prev, country: value, state: "", city: "" }));
    setFieldNotes((prev) => ({ ...prev, country: undefined, state: undefined, city: undefined }));
    clearResolvedLocation();
  };

  const changeState = (value: string) => {
    setDraft((prev) => ({ ...prev, state: value, city: "" }));
    setFieldNotes((prev) => ({ ...prev, state: undefined, city: undefined }));
    clearResolvedLocation();
  };

  /* A pasted "12.9716, 77.5946" fills both boxes rather than only the one it
   * landed in — the likeliest way a coordinate reaches this form is a paste
   * from a map app. */
  const editCoordinate = (axis: "latitude" | "longitude", value: string) => {
    const pair = normalizeCoordinatePair(value);
    if (pair) {
      setDraft((prev) => ({
        ...prev,
        latitude: pair.latitude.value,
        longitude: pair.longitude.value,
      }));
      setFieldNotes((prev) => ({ ...prev, latitude: undefined, longitude: undefined }));
      return;
    }
    edit(axis, value);
  };

  const renderNote = (key: keyof ProfileQueryInput) => {
    const note = fieldNotes[key];
    if (!note) return null;

    return (
      <>
        <p
          className={`${styles.fieldNote} ${note.status === "invalid" ? styles.fieldNoteError : ""}`}
          role={note.status === "invalid" ? "alert" : undefined}
          aria-live={note.status === "invalid" ? undefined : "polite"}
        >
          {note.message ?? `Read as ${note.display}`}
        </p>
        {note.suggestions?.length ? (
          <div className={styles.noteChips}>
            {note.suggestions.map((suggestion) => (
              <button
                key={suggestion.value}
                type="button"
                className={styles.noteChip}
                onClick={() => applySuggestion(key, suggestion.value, suggestion.label)}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        ) : null}
      </>
    );
  };

  const hasName = draft.name.trim().length > 0;
  const hasDate = draft.birthDate.trim().length > 0;
  /* Ticking "I don't know my birth time" hides the input, it does not throw
   * the answer away — a mistaken tap would otherwise wipe a time the visitor
   * typed (or one restored from the shared draft) with no way back. The value
   * stays in the draft and every reader goes through here instead, so nothing
   * downstream mistakes a parked time for a claimed one. */
  const exactBirthTime = unknownTime ? "" : draft.birthTime;
  const hasTime = unknownTime ? hasCoarseTimeFallback(coarseTime) : exactBirthTime.trim().length > 0;
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
      birthTime: exactBirthTime.trim() || "12:00",
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
  }, [step, hasPlace, draft.city, draft.state, draft.country, draft.birthDate, exactBirthTime]);

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

  /* Step 1's fields unmount when step 2 opens, and an unmounted input never
   * fires the blur its normaliser hangs off — so the whole draft goes through
   * the normalisers here as well. Idempotent, so anything already canonical
   * comes back untouched. */
  const normalizedDraft = (source: ProfileQueryInput): ProfileQueryInput => {
    const keep = (raw: string, result: IntakeFieldResult) => result.value || raw;

    return {
      ...source,
      name: keep(source.name, normalizePersonName(source.name)),
      birthDate: keep(source.birthDate, normalizeBirthDate(source.birthDate)),
      birthTime: keep(source.birthTime, normalizeBirthTime(source.birthTime)),
      country: keep(source.country, normalizePlaceName(source.country)),
      state: keep(source.state, normalizePlaceName(source.state)),
      city: keep(source.city, normalizePlaceName(source.city)),
      latitude: keep(source.latitude, normalizeCoordinate(source.latitude, "latitude")),
      longitude: keep(source.longitude, normalizeCoordinate(source.longitude, "longitude")),
    };
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const tidied = normalizedDraft(draft);
    setDraft(tidied);

    if (step === 1) {
      if (canContinue) setStep(2);
      return;
    }
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    const params = buildChartQuery(tidied, { unknownTime, coarseTime });
    router.push(`/engine-select?${params.toString()}`);
  };

  return (
    <form className={styles.page} onSubmit={onSubmit} noValidate>
      <header className={styles.header}>
        <span className={styles.step}>Step {step} of 2</span>
        <h1 className={`${styles.title} mGold`}>
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
              onChange={(e) => edit("name", e.target.value)}
              onBlur={commit("name", normalizePersonName)}
              placeholder={t("home.formNamePlaceholder")}
              autoComplete="name"
              enterKeyHint="next"
              required
            />
            {renderNote("name")}
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
              onChange={(e) => edit("birthDate", e.target.value)}
              onBlur={commit("birthDate", (value) => normalizeBirthDate(value))}
              max={new Date().toISOString().slice(0, 10)}
              min="1900-01-01"
              autoComplete="bday"
              required
            />
            {fieldNotes.birthDate ? (
              renderNote("birthDate")
            ) : hasDate ? (
              <p className={styles.fieldNote}>{formatBirthDateDisplay(draft.birthDate)}</p>
            ) : null}
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
                onChange={(e) => edit("birthTime", e.target.value)}
                onBlur={commit("birthTime", normalizeBirthTime)}
                required
              />
              {fieldNotes.birthTime ? (
                renderNote("birthTime")
              ) : draft.birthTime ? (
                <p className={styles.fieldNote}>{formatClockDisplay(draft.birthTime)}</p>
              ) : null}
            </div>
          )}

          <div className={styles.toggleRow}>
            <input
              id="m-unknown-time"
              className={styles.checkbox}
              type="checkbox"
              checked={unknownTime}
              onChange={(e) => {
                /* The typed time is left in the draft on the way in, so
                 * unticking this brings it straight back. */
                setUnknownTime(e.target.checked);
                if (!e.target.checked) setCoarseTime("");
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
          {/* One cascading answer, same as the desktop tree: the country
              narrows the state list, the state narrows the city list, and the
              city fixes the coordinates. Typing a place name on a phone is the
              slowest thing in this form, so the suggestion list earns its keep
              more here than anywhere else. */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="m-country">
              {t("home.formCountry")}
              <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <AutocompleteInput
              id="m-country"
              className={styles.input}
              value={draft.country}
              onChange={changeCountry}
              onSelect={changeCountry}
              normalize={normalizePlaceName}
              onNormalized={commitPlace("country")}
              placeholder={t("home.formCountryPlaceholder")}
              suggestType="country"
              required
            />
            {renderNote("country")}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="m-state">
              {t("home.formState")}
              <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <AutocompleteInput
              id="m-state"
              className={styles.input}
              value={draft.state}
              onChange={changeState}
              onSelect={changeState}
              normalize={normalizePlaceName}
              onNormalized={commitPlace("state")}
              placeholder={t("home.formStatePlaceholder")}
              suggestType="state"
              contextCountry={draft.country}
              required
            />
            {renderNote("state")}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="m-city">
              {t("home.formCity")}
              <span className={styles.required} aria-hidden="true">*</span>
            </label>
            <AutocompleteInput
              id="m-city"
              className={styles.input}
              value={draft.city}
              onChange={(value) => edit("city", value)}
              onSelect={(value) => edit("city", value)}
              normalize={normalizePlaceName}
              onNormalized={commitPlace("city")}
              placeholder={t("home.formCityPlaceholder")}
              suggestType="city"
              contextCountry={draft.country}
              contextState={draft.state}
              required
            />
            {renderNote("city")}
          </div>

          <p className={styles.status} role="status" aria-live="polite">
            {geoStatus === "loading" && "Finding coordinates…"}
            {geoStatus === "found" &&
              `Located — ${Number(draft.latitude).toFixed(3)}, ${Number(draft.longitude).toFixed(3)}`}
            {geoStatus === "not-found" && "Could not find that place. Check the spelling."}
          </p>

          {/* Without this the mobile tree dead-ends: submitting needs
              coordinates, so a place the geocoder cannot find leaves no way
              forward at all. Opened for the visitor when the lookup fails. */}
          <div className={styles.field}>
            <button
              type="button"
              className={styles.disclosure}
              onClick={() => setCoordsExpanded((expanded) => !expanded)}
              aria-expanded={coordsExpanded || geoStatus === "not-found"}
              aria-controls="m-coordinate-fields"
            >
              {t("home.enterCoordinates")}
            </button>

            {(coordsExpanded || geoStatus === "not-found") && (
              <div id="m-coordinate-fields" className={styles.fields}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="m-latitude">
                    {t("home.formLatitude")}
                  </label>
                  <input
                    id="m-latitude"
                    className={styles.input}
                    value={draft.latitude}
                    onChange={(e) => editCoordinate("latitude", e.target.value)}
                    onBlur={commit("latitude", (value) => normalizeCoordinate(value, "latitude"))}
                    inputMode="text"
                    placeholder="12.9716"
                  />
                  {renderNote("latitude")}
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="m-longitude">
                    {t("home.formLongitude")}
                  </label>
                  <input
                    id="m-longitude"
                    className={styles.input}
                    value={draft.longitude}
                    onChange={(e) => editCoordinate("longitude", e.target.value)}
                    onBlur={commit("longitude", (value) => normalizeCoordinate(value, "longitude"))}
                    inputMode="text"
                    placeholder="77.5946"
                  />
                  {renderNote("longitude")}
                </div>
              </div>
            )}
          </div>
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
