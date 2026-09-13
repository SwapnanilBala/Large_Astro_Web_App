"use client";

import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { HiOutlineCalendarDays, HiOutlineClock } from "react-icons/hi2";
import AutocompleteInput from "@/app/components/AutocompleteInput";
import BackToReadingButton from "@/app/components/BackToReadingButton";
import ZodiacSignImage from "@/app/components/ZodiacSignImage";
import type { CompatibilityApiResponse, ProfileQueryInput } from "@/lib/astro-types";
import { buildBirthDetailsPayload, parseProfileQueryString } from "@/lib/chart-query";
import {
  applyPlaceSuggestion,
  formatBirthDateDisplay,
  formatClockDisplay,
  normalizeBirthDate,
  normalizeBirthTime,
  normalizeCoordinate,
  normalizeCoordinatePair,
  normalizePersonName,
  normalizePlaceName,
  normalizeUtcOffsetMinutes,
  type IntakeFieldResult,
} from "@/lib/intake-normalize";
import { useTranslation } from "@/lib/i18n-context";
import { profileInitialState } from "@/lib/astro-types";
import { useToast } from "@/lib/toast-context";

/** Derives the Western (Tropical) sun sign from a YYYY-MM-DD birth date string. */
function sunSignFromDate(birthDate: string): string {
  if (!birthDate) return "";
  const parts = birthDate.split("-");
  if (parts.length < 3) return "";
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day)) return "";

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
  return "Pisces";
}

function CompatibilityRing({ score }: { score: number }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // Trigger animation on mount after a brief delay so the transition fires
    const id = setTimeout(() => setAnimated(true), 60);
    return () => clearTimeout(id);
  }, []);

  const radius = 54;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = animated ? circumference - (score / 100) * circumference : circumference;

  const color = score >= 70 ? '#4ade80' : score >= 45 ? '#fbbf24' : '#f87171';

  const label =
    score >= 70 ? 'Harmonious' :
    score >= 45 ? 'Compatible' :
    'Challenging';

  const labelColor =
    score >= 70 ? '#4ade80' :
    score >= 45 ? '#fbbf24' :
    '#f87171';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={1} />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          {/* Progress arc */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '1.75rem', fontWeight: 700, color, lineHeight: 1 }}>
            {Math.round(score)}
          </span>
          <span style={{
            fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.2rem',
          }}>
            Score
          </span>
        </div>
      </div>
      <span style={{
        fontSize: '0.85rem', fontWeight: 600, color: labelColor,
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  );
}

const ASTRO_API = "";

/*
 * What a profile needs before it can be submitted.
 *
 * Deliberately no `country` or `state`. BirthInputSchema declares both as
 * `z.string().default("")` and refines on `city || state || country`, so the
 * server is happy with a city alone -- and this list being stricter than the
 * server is a trap once the form asks for a place rather than three fields:
 * Nominatim returns no state for a city-state like Singapore, which would
 * leave the button inert with no visible field to fix and no message saying
 * why. The place picker fills city, and the geocoder fills the coordinates and
 * the offset, so everything here is either typed or derived.
 */
const requiredFields: Array<keyof ProfileQueryInput> = [
  "name",
  "birthDate",
  "birthTime",
  "timezoneOffsetMinutes",
  "latitude",
  "longitude",
  "city",
];

type CompatibilityPageClientProps = {
  initialSearchParams: Record<string, string>;
};

type ProfileCardProps = {
  title: string;
  profile: ProfileQueryInput;
  setProfile: Dispatch<SetStateAction<ProfileQueryInput>>;
  accentColor: "aqua" | "coral";
  /**
   * `summary` collapses a complete profile to an identity card with a Change
   * button. You arrive on this page from your own reading, so your own details
   * are already known and asking for them again is most of what made this form
   * feel like paperwork.
   */
  variant?: "summary" | "form";
};

/** "330" or "-300" as the UTC offset a person would recognise. */
function formatUtcOffset(minutes: string): string {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? "-" : "+";
  const abs = Math.abs(value);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

function profileFromParams(
  params: Record<string, string>,
  prefix: "" | "partner"
): ProfileQueryInput {
  const defaultOffset = String(-new Date().getTimezoneOffset());

  if (!prefix) {
    const primaryQuery = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (!key.startsWith("partner")) {
        primaryQuery.set(key, value);
      }
    }
    const profile = parseProfileQueryString(primaryQuery.toString());
    return {
      ...profile,
      timezoneOffsetMinutes: profile.timezoneOffsetMinutes || defaultOffset,
    };
  }

  return {
    ...profileInitialState,
    name: params.partnerName ?? "",
    birthDate: params.partnerBirthDate ?? "",
    birthTime: params.partnerBirthTime ?? "",
    timezoneOffsetMinutes: params.partnerTimezoneOffsetMinutes || defaultOffset,
    latitude: params.partnerLatitude ?? "",
    longitude: params.partnerLongitude ?? "",
    country: params.partnerCountry ?? "",
    state: params.partnerState ?? "",
    city: params.partnerCity ?? "",
    town: params.partnerTown ?? "",
    timeZoneId: params.partnerTimeZoneId ?? "",
  };
}

function ProfileCard({
  title,
  profile,
  setProfile,
  accentColor,
  variant = "form",
}: ProfileCardProps) {
  const { t } = useTranslation();
  const signBorderColor = accentColor === "aqua"
    ? "rgba(100,200,255,0.5)"
    : "rgba(255,100,150,0.5)";
  const signShadowColor = accentColor === "aqua"
    ? "rgba(100,200,255,0.25)"
    : "rgba(255,100,150,0.25)";
  const profileSign = sunSignFromDate(profile.birthDate);
  const [fieldNotes, setFieldNotes] = useState<
    Partial<Record<keyof ProfileQueryInput, IntakeFieldResult | undefined>>
  >({});
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  /* The summary card opens into the full form on request; a profile that
     arrived incomplete has nothing to summarise, so it starts open. */
  const isComplete = Boolean(
    profile.name.trim() && profile.birthDate.trim() && profile.birthTime.trim() && profile.city.trim(),
  );
  const [isEditing, setIsEditing] = useState(false);
  /* The geocoder's own output -- coordinates, offset, time zone id. Shown as a
     line of text, editable only for the visitor who has to override it. */
  const [showDerived, setShowDerived] = useState(false);
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!profile.country.trim() && !profile.city.trim()) {
      return;
    }

    if (geoTimer.current) {
      clearTimeout(geoTimer.current);
    }

    geoTimer.current = setTimeout(async () => {
      setGeoStatus("loading");

      try {
        const params = new URLSearchParams();
        if (profile.city.trim()) params.set("city", profile.city.trim());
        if (profile.state.trim()) params.set("state", profile.state.trim());
        if (profile.country.trim()) params.set("country", profile.country.trim());
        if (profile.birthDate.trim()) params.set("birthDate", profile.birthDate.trim());
        if (profile.birthTime.trim()) params.set("birthTime", profile.birthTime.trim());

        const response = await fetch(`/api/geocode?${params.toString()}`);
        const data = await response.json();

        if (!data.found) {
          setGeoStatus("not-found");
          return;
        }

        setProfile((previous) => ({
          ...previous,
          latitude: String(data.lat),
          longitude: String(data.lon),
          timezoneOffsetMinutes:
            typeof data.timezoneOffsetMinutes === "number"
              ? String(data.timezoneOffsetMinutes)
              : previous.timezoneOffsetMinutes,
          timeZoneId: typeof data.timeZoneId === "string" ? data.timeZoneId : previous.timeZoneId,
        }));
        setGeoStatus("found");
      } catch {
        setGeoStatus("not-found");
      }
    }, 700);

    return () => {
      if (geoTimer.current) {
        clearTimeout(geoTimer.current);
      }
    };
  }, [
    profile.birthDate,
    profile.birthTime,
    profile.city,
    profile.country,
    profile.state,
    setProfile,
  ]);

  const updateField =
    (field: keyof ProfileQueryInput) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setProfile((previous) => ({ ...previous, [field]: value }));
      if (fieldNotes[field]) setFieldNotes((previous) => ({ ...previous, [field]: undefined }));
    };

  const setField = (field: keyof ProfileQueryInput) => (value: string) => {
    setProfile((previous) => ({ ...previous, [field]: value }));
  };

  /* Same typed-entry rules as the main intake, so a birth moment entered here
   * is read the way it is read there. This form matters more than it looks:
   * its coordinate and offset boxes used to be type="number", which throws
   * away "40° 42' 46\" N" and "+05:30" without saying anything. */
  const commit =
    (field: keyof ProfileQueryInput, normalize: (value: string) => IntakeFieldResult) => () => {
      const result = normalize(profile[field]);
      setFieldNotes((previous) => ({
        ...previous,
        [field]: result.status === "ok" || result.status === "empty" ? undefined : result,
      }));
      if (result.value && result.value !== profile[field]) {
        setProfile((previous) => ({ ...previous, [field]: result.value }));
      }
    };

  const applySuggestion = (field: keyof ProfileQueryInput, value: string, label: string) => {
    setProfile((previous) => ({ ...previous, [field]: value }));
    setFieldNotes((previous) => ({
      ...previous,
      [field]: { status: "corrected", value, display: label, message: `Set to ${label}.` },
    }));
  };

  /* A pasted "12.9716, 77.5946" fills both boxes rather than only the one it
   * landed in. */
  const updateCoordinate =
    (field: "latitude" | "longitude") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const pair = normalizeCoordinatePair(event.target.value);
      if (pair) {
        setProfile((previous) => ({
          ...previous,
          latitude: pair.latitude.value,
          longitude: pair.longitude.value,
        }));
        setFieldNotes((previous) => ({ ...previous, latitude: undefined, longitude: undefined }));
        return;
      }
      updateField(field)(event);
    };

  const renderNote = (field: keyof ProfileQueryInput) => {
    const note = fieldNotes[field];
    if (!note) return null;

    return (
      <>
        <span
          className={`field-note${note.status === "invalid" ? " field-note-error" : ""}`}
          role={note.status === "invalid" ? "alert" : undefined}
          aria-live={note.status === "invalid" ? undefined : "polite"}
        >
          {note.message ?? `Read as ${note.display}`}
        </span>
        {note.suggestions?.length ? (
          <span className="field-note-chips">
            {note.suggestions.map((suggestion) => (
              <button
                key={suggestion.value}
                type="button"
                className="field-note-chip"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applySuggestion(field, suggestion.value, suggestion.label)}
              >
                {suggestion.label}
              </button>
            ))}
          </span>
        ) : null}
      </>
    );
  };

  /* Consecutive repeats dropped: a city and its state often share a name, and
     "New York, New York, United States" reads like a mistake. */
  const placeLine = [profile.city, profile.state, profile.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, parts) => part.toLowerCase() !== parts[index - 1]?.toLowerCase())
    .join(", ");

  const zodiacBadge = profileSign ? (
    <ZodiacSignImage
      sign={profileSign}
      size={40}
      style={{
        border: `2px solid ${signBorderColor}`,
        boxShadow: `0 0 12px ${signShadowColor}`,
        flexShrink: 0,
      }}
    />
  ) : null;

  /* Your own chart, already known. A card, not a form. */
  if (variant === "summary" && isComplete && !isEditing) {
    return (
      <section className="rules-panel compatibility-profile-card compat-summary">
        <p className="kicker">{title}</p>
        <div className="compat-summary-identity">
          {zodiacBadge}
          <div className="compat-summary-text">
            <h2 className="compat-summary-name">{profile.name}</h2>
            <p className="compat-summary-meta">
              {formatBirthDateDisplay(profile.birthDate)}
              {profile.birthTime ? ` · ${formatClockDisplay(profile.birthTime)}` : ""}
            </p>
            {placeLine && <p className="compat-summary-meta">{placeLine}</p>}
          </div>
        </div>
        <button
          type="button"
          className="compat-inline-link"
          onClick={() => setIsEditing(true)}
        >
          Change
        </button>
      </section>
    );
  }

  return (
    <section className="rules-panel compatibility-profile-card">
      <div className="compat-form-head">
        <p className="kicker">{title}</p>
        {/* Only once there is a name to show. Before that the heading was the
            kicker again, one line below the kicker. */}
        {profile.name.trim() && (
          <h2 className="compat-form-title">
            {zodiacBadge}
            {profile.name}
          </h2>
        )}
      </div>

      <div className="compat-fields">
        <label className="input-glow-gold">
          Name
          <input
            type="text"
            value={profile.name}
            onChange={updateField("name")}
            onBlur={commit("name", normalizePersonName)}
            placeholder="Their name"
          />
          {renderNote("name")}
        </label>

        <div className="compat-row-2">
          <label className="input-glow-aqua">
            Birth date
            <div className="datetime-field">
              <input
                type="date"
                value={profile.birthDate}
                onChange={updateField("birthDate")}
                onBlur={commit("birthDate", (value) => normalizeBirthDate(value))}
              />
              <HiOutlineCalendarDays className="datetime-icon datetime-icon-aqua" />
            </div>
            {fieldNotes.birthDate ? (
              renderNote("birthDate")
            ) : profile.birthDate ? (
              <span className="field-note">{formatBirthDateDisplay(profile.birthDate)}</span>
            ) : null}
          </label>
          <label className="input-glow-aqua">
            Birth time
            <div className="datetime-field">
              <input
                type="time"
                value={profile.birthTime}
                onChange={updateField("birthTime")}
                onBlur={commit("birthTime", normalizeBirthTime)}
              />
              <HiOutlineClock className="datetime-icon datetime-icon-aqua" />
            </div>
            {fieldNotes.birthTime ? (
              renderNote("birthTime")
            ) : profile.birthTime ? (
              <span className="field-note">{formatClockDisplay(profile.birthTime)}</span>
            ) : null}
          </label>
        </div>

        {/* One question, because a birth place is one fact. Choosing a city
            fills the state and the country from the same result, which is why
            /api/suggest now returns them. */}
        <label className="input-glow-aqua">
          Birth place
          <AutocompleteInput
            value={profile.city}
            onChange={setField("city")}
            onSelect={setField("city")}
            onSelectSuggestion={(suggestion) =>
              setProfile((previous) => ({ ...previous, ...applyPlaceSuggestion(previous, suggestion) }))
            }
            normalize={normalizePlaceName}
            placeholder="City of birth"
            suggestType="city"
            required
          />
        </label>

        {/* The geocoder's answer as a sentence rather than four text boxes.
            Everything here is derived from the place above. */}
        <div className="compat-derived" aria-live="polite">
          {geoStatus === "loading" && (
            <p className="compat-derived-line">{t("compatibility.resolving")}</p>
          )}
          {geoStatus === "not-found" && (
            <p className="compat-derived-line compat-derived-warn">
              {t("compatibility.locationError")}
            </p>
          )}
          {geoStatus === "found" && (
            <p className="compat-derived-line">
              {placeLine}
              {profile.timezoneOffsetMinutes
                ? ` · ${formatUtcOffset(profile.timezoneOffsetMinutes)}`
                : ""}
              {profile.latitude && profile.longitude
                ? ` · ${Number(profile.latitude).toFixed(2)}, ${Number(profile.longitude).toFixed(2)}`
                : ""}
            </p>
          )}
          <button
            type="button"
            className="compat-inline-link"
            aria-expanded={showDerived}
            onClick={() => setShowDerived((open) => !open)}
          >
            {showDerived ? "Hide details" : "Adjust"}
          </button>
        </div>

        {showDerived && (
          <div className="compat-derived-fields">
            <div className="compat-row-2">
              <label className="input-glow-gold">
                Country
                <AutocompleteInput
                  value={profile.country}
                  onChange={setField("country")}
                  onSelect={setField("country")}
                  normalize={normalizePlaceName}
                  placeholder="Country"
                  suggestType="country"
                />
              </label>
              <label className="input-glow-gold">
                State
                <AutocompleteInput
                  value={profile.state}
                  onChange={setField("state")}
                  onSelect={setField("state")}
                  normalize={normalizePlaceName}
                  placeholder="State or province"
                  suggestType="state"
                />
              </label>
            </div>
            <div className="compat-row-2">
              <label className="input-glow-gold">
                Latitude
                <input
                  type="text"
                  inputMode="text"
                  value={profile.latitude}
                  onChange={updateCoordinate("latitude")}
                  onBlur={commit("latitude", (value) => normalizeCoordinate(value, "latitude"))}
                  placeholder="12.9716"
                />
                {renderNote("latitude")}
              </label>
              <label className="input-glow-gold">
                Longitude
                <input
                  type="text"
                  inputMode="text"
                  value={profile.longitude}
                  onChange={updateCoordinate("longitude")}
                  onBlur={commit("longitude", (value) => normalizeCoordinate(value, "longitude"))}
                  placeholder="77.5946"
                />
                {renderNote("longitude")}
              </label>
            </div>
            <div className="compat-row-2">
              <label className="input-glow-gold">
                UTC offset (minutes)
                {/* Text, not number: half the world writes this offset as
                    "+05:30", and a number field discards that keystroke by
                    keystroke. */}
                <input
                  type="text"
                  inputMode="text"
                  value={profile.timezoneOffsetMinutes}
                  onChange={updateField("timezoneOffsetMinutes")}
                  onBlur={commit("timezoneOffsetMinutes", normalizeUtcOffsetMinutes)}
                  placeholder="330 or +05:30"
                />
                {renderNote("timezoneOffsetMinutes")}
              </label>
              <label className="input-glow-gold">
                Time zone ID
                <input
                  type="text"
                  value={profile.timeZoneId}
                  onChange={updateField("timeZoneId")}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function buildCompatibilityQueryString(primary: ProfileQueryInput, partner: ProfileQueryInput) {
  return new URLSearchParams({
    name: primary.name,
    birthDate: primary.birthDate,
    birthTime: primary.birthTime,
    timezoneOffsetMinutes: primary.timezoneOffsetMinutes,
    latitude: primary.latitude,
    longitude: primary.longitude,
    country: primary.country,
    state: primary.state,
    city: primary.city,
    town: primary.town,
    timeZoneId: primary.timeZoneId,
    partnerName: partner.name,
    partnerBirthDate: partner.birthDate,
    partnerBirthTime: partner.birthTime,
    partnerTimezoneOffsetMinutes: partner.timezoneOffsetMinutes,
    partnerLatitude: partner.latitude,
    partnerLongitude: partner.longitude,
    partnerCountry: partner.country,
    partnerState: partner.state,
    partnerCity: partner.city,
    partnerTown: partner.town,
    partnerTimeZoneId: partner.timeZoneId,
  }).toString();
}

export default function CompatibilityPageClient({
  initialSearchParams,
}: CompatibilityPageClientProps) {
  const { t } = useTranslation();
  const { pushToast } = useToast();
  const [primary, setPrimary] = useState<ProfileQueryInput>(() =>
    profileFromParams(initialSearchParams, "")
  );
  const [partner, setPartner] = useState<ProfileQueryInput>(() =>
    profileFromParams(initialSearchParams, "partner")
  );
  const [result, setResult] = useState<CompatibilityApiResponse | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSubmittedRef = useRef(false);

  const canSubmit = useMemo(() => {
    return [primary, partner].every((profile) =>
      requiredFields.every((field) => profile[field].trim().length > 0)
    );
  }, [partner, primary]);

  const submitCompatibility = useCallback(async () => {
    if (!canSubmit) {
      setError(t("compatibility.incompleteProfiles"));
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const response = await fetch(`${ASTRO_API}/api/compatibility`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primary: buildBirthDetailsPayload(primary),
          partner: buildBirthDetailsPayload(partner),
          save_result: false,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ detail: "Compatibility request failed." }));
        throw new Error(payload.detail ?? "Compatibility request failed.");
      }

      const payload = (await response.json()) as CompatibilityApiResponse;
      setResult(payload);
      pushToast("Compatibility report ready.", "success");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Compatibility request failed.");
      pushToast("Compatibility request failed.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, partner, primary, pushToast]);

  const shareCompatibility = async () => {
    const url = `${window.location.origin}/insights/compatibility?${buildCompatibilityQueryString(primary, partner)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${primary.name} + ${partner.name} compatibility`,
          url,
        });
        pushToast("Share sheet opened.", "info");
        return;
      }
      await navigator.clipboard.writeText(url);
      pushToast("Compatibility link copied.", "success");
    } catch {
      pushToast("Could not share the compatibility link.", "error");
    }
  };

  useEffect(() => {
    if (!canSubmit || result || autoSubmittedRef.current) {
      return;
    }

    const hasPartnerSeed =
      partner.name.trim() &&
      partner.birthDate.trim() &&
      partner.birthTime.trim() &&
      partner.city.trim();

    if (!hasPartnerSeed) {
      return;
    }

    autoSubmittedRef.current = true;
    void submitCompatibility();
  }, [canSubmit, partner, result, submitCompatibility]);

  return (
    <div className="insights-shell below-navbar">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <BackToReadingButton />

      <section className="dashboard-shell">
        <p className="kicker">Synastry Analysis</p>
        <h1>Compatibility</h1>
        <p className="lead">
          Your chart is already here. Add theirs and see how the two read together.
        </p>

        <div className="compatibility-grid">
          <ProfileCard
            title="Your chart"
            profile={primary}
            setProfile={setPrimary}
            accentColor="aqua"
            variant="summary"
          />
          <ProfileCard
            title="Their chart"
            profile={partner}
            setProfile={setPartner}
            accentColor="coral"
          />
        </div>

        <div className="compatibility-actions">
          <button
            type="button"
            className="compat-primary-action"
            onClick={() => void submitCompatibility()}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Comparing…" : "Compare charts"}
          </button>
          {/* Only once there is something to share. Before that it was a
              second button of equal weight that could not do anything. */}
          {result && (
            <button type="button" onClick={() => void shareCompatibility()} disabled={isSubmitting}>
              Share this reading
            </button>
          )}
        </div>

        {error && <p className="error-note">{error}</p>}

        {result && (
          <>
            <div className="compatibility-summary-grid">
              <article className="metric-card metric-card--score-ring">
                <h3>Compatibility score</h3>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                }}>
                  <div style={{ textAlign: "center" }}>
                    <ZodiacSignImage
                      sign={sunSignFromDate(primary.birthDate)}
                      size={72}
                      style={{
                        border: "2px solid rgba(100,200,255,0.5)",
                        boxShadow: "0 0 20px rgba(100,200,255,0.25)",
                      }}
                    />
                    <p style={{ margin: "0.4rem 0 0", fontSize: "0.75rem", opacity: 0.7 }}>
                      {result.primary_client.name}
                    </p>
                  </div>
                  <span style={{ fontSize: "1.5rem", opacity: 0.4 }}>✦</span>
                  <div style={{ textAlign: "center" }}>
                    <ZodiacSignImage
                      sign={sunSignFromDate(partner.birthDate)}
                      size={72}
                      style={{
                        border: "2px solid rgba(255,100,150,0.5)",
                        boxShadow: "0 0 20px rgba(255,100,150,0.25)",
                      }}
                    />
                    <p style={{ margin: "0.4rem 0 0", fontSize: "0.75rem", opacity: 0.7 }}>
                      {result.partner_client.name}
                    </p>
                  </div>
                </div>
                <CompatibilityRing score={result.compatibility_score} />
                <small>Composite synastry score from aspects and elemental fit.</small>
              </article>
            </div>

            <section className="rules-panel">
              <div className="rules-header">
                <p className="kicker">Summary</p>
                <h2>Relationship themes</h2>
              </div>
              <p className="section-intro">{result.summary}</p>
              <div className="rules-list">
                {result.themes.map((theme) => {
                  const ZODIAC_SIGNS = [
                    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
                    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
                  ];
                  const signsInTitle = ZODIAC_SIGNS.filter((s) =>
                    theme.title.includes(s)
                  );
                  const signsInInsight = ZODIAC_SIGNS.filter((s) =>
                    theme.insight.includes(s)
                  );
                  return (
                    <article key={theme.title} className="rule-card rule-medium">
                      <header>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          {signsInTitle.map((s) => (
                            <ZodiacSignImage key={s} sign={s} size={24} style={{ flexShrink: 0 }} />
                          ))}
                          {theme.title}
                        </h3>
                        {/* The "86%" badge is gone. CompatibilityTheme.
                            confidence_score is a hardcoded constant in
                            compatibility-service.ts -- the same species of
                            number the rule engine just stopped asserting --
                            and rendering it as a percentage presented an
                            authored guess as a measurement. */}
                      </header>
                      <p style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                        {signsInInsight.length > 0 && signsInInsight.map((s) => (
                          <ZodiacSignImage key={s} sign={s} size={24} style={{ flexShrink: 0 }} />
                        ))}
                        {theme.insight}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* Between the themes and the raw aspect list on purpose: it is
                the same order of specificity, and the aspect grid below is the
                working that this section already summarises in prose. */}
            {result.kalatra_synastry && (
              <section className="rules-panel">
                <div className="rules-header">
                  <p className="kicker">Synastry</p>
                  <h2>Married life, across the two charts</h2>
                </div>
                <p className="section-intro">
                  The married-life read on each person&rsquo;s own page can only use one chart.
                  These are the parts that need both — including the Mangal cancellation a
                  single chart cannot evaluate.
                </p>
                <div className="kalatra-syn-grid">
                  {result.kalatra_synastry.facets.map((facet) => (
                    <article key={facet.key} className="kalatra-syn-card">
                      <header>
                        <h3>{facet.label}</h3>
                        <span className="kalatra-syn-verdict">{facet.verdict}</span>
                      </header>
                      {facet.findings.length > 0 && (
                        <ul className="kalatra-syn-findings">
                          {facet.findings.map((finding) => (
                            <li key={finding.basis} data-polarity={finding.polarity}>
                              <p>{finding.text}</p>
                              <cite>{finding.basis}</cite>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="kalatra-syn-sourcing">
                        <span>Read from</span> {facet.sourcing}
                      </p>
                    </article>
                  ))}
                </div>
                <details className="kalatra-syn-method">
                  <summary>How these were derived</summary>
                  <p>{result.kalatra_synastry.method}</p>
                </details>
              </section>
            )}

            <section className="rules-panel">
              <div className="rules-header">
                <p className="kicker">Synastry</p>
                <h2>Inter-chart aspects</h2>
              </div>
              <div className="synastry-card-grid">
                {result.synastry_aspects.map((aspect) => (
                  <article key={`${aspect.primary_planet}-${aspect.partner_planet}-${aspect.aspect_type}`} className="synastry-card">
                    <div className="synastry-card-header">
                      <div>
                        <h3>
                          {aspect.primary_planet} to {aspect.partner_planet}
                        </h3>
                        <p>{aspect.aspect_type}</p>
                      </div>
                      <span className={`access-pill ${aspect.harmonious ? "access-pill--premium" : "access-pill--limited"}`}>
                        {aspect.harmonious ? "Supportive" : "Friction"}
                      </span>
                    </div>
                    <p className="synastry-card-meta">Orb: {aspect.orb.toFixed(2)} degrees</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </div>
  );
}
