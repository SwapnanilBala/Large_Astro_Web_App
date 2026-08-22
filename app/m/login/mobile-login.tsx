"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/profile-context";
import { useTranslation } from "@/lib/i18n-context";
import { resolveProfileDestination } from "@/lib/profile-redirect";
import { readChartHistory } from "@/lib/chart-history-store";
import styles from "./login.module.css";

type Props = { returnTo?: string; skyLine?: string };

type SheetState =
  | { kind: "add" }
  | { kind: "manage"; profileId: string }
  | { kind: "rename"; profileId: string }
  | { kind: "delete"; profileId: string }
  | null;

function Glyph({ d, label, size = 20 }: { d: string; label?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <path d={d} />
    </svg>
  );
}

function Ornament() {
  return (
    <svg className={styles.ornament} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="mobile-orbit-gold" x1="18" y1="16" x2="82" y2="86" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E8C89A" />
          <stop offset="1" stopColor="#C89B3C" />
        </linearGradient>
        <linearGradient id="mobile-orbit-teal" x1="26" y1="22" x2="74" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#46B6A7" />
          <stop offset="1" stopColor="#1A7B6E" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="#11111A" stroke="url(#mobile-orbit-gold)" strokeWidth="1" opacity="0.96" />
      <circle cx="50" cy="50" r="32" fill="none" stroke="url(#mobile-orbit-teal)" strokeWidth="0.9" opacity="0.5" />
      <path
        d="M50 12 L54 42 L84 50 L54 58 L50 88 L46 58 L16 50 L46 42 Z"
        fill="url(#mobile-orbit-gold)"
        opacity="0.96"
      />
      <circle cx="50" cy="50" r="4" fill="url(#mobile-orbit-teal)" />
      <circle cx="50" cy="5" r="1.8" fill="#D4A574" />
      <circle cx="95" cy="50" r="1.6" fill="#2DA89A" />
      <circle cx="50" cy="95" r="1.8" fill="#D4A574" />
      <circle cx="5" cy="50" r="1.6" fill="#2DA89A" />
    </svg>
  );
}

function AmbientWheel() {
  return (
    <svg className={styles.ambientWheel} viewBox="0 0 600 600" aria-hidden="true" focusable="false">
      <circle cx="300" cy="300" r="284" />
      <circle cx="300" cy="300" r="224" />
      <circle cx="300" cy="300" r="108" />
      <path d="M300 16V584 M16 300H584 M99 99L501 501 M501 99L99 501 M54 158L546 442 M158 54L442 546 M442 54L158 546 M546 158L54 442" />
    </svg>
  );
}

const ICON = {
  chevron: "m15 18-6-6 6-6",
  close: "M18 6 6 18 M6 6l12 12",
  lock: "M7 11V7a5 5 0 0 1 10 0v4 M5 11h14v10H5z",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  pencil: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  plus: "M12 5v14 M5 12h14",
  trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
};

export default function MobileLogin({ returnTo, skyLine }: Props) {
  const {
    profiles,
    activeProfile,
    isLoading,
    maxProfiles,
    canCreateProfile,
    createProfile,
    renameProfile,
    deleteProfile,
    switchProfile,
  } = useProfile();
  const { t } = useTranslation();
  const router = useRouter();

  const [newName, setNewName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const addTriggerRef = useRef<HTMLButtonElement | null>(null);
  const manageTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const railRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);

  const destination = returnTo || "/";
  const isSheetOpen = sheet !== null;
  const sheetProfile =
    sheet && "profileId" in sheet
      ? profiles.find((profile) => profile.profile_id === sheet.profileId) ?? null
      : null;

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const profile of profiles) {
      next[profile.profile_id] = readChartHistory(profile.profile_id).length;
    }
    // Counts come from browser storage and must be populated after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCounts(next);
  }, [profiles]);

  useEffect(() => {
    if (sheet && "profileId" in sheet && !profiles.some((profile) => profile.profile_id === sheet.profileId)) {
      // A profile can disappear through another mounted profile switcher.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSheet(null);
      setError("");
      window.setTimeout(() => addTriggerRef.current?.focus(), 0);
    }
  }, [profiles, sheet]);

  useEffect(() => {
    if (!isSheetOpen) return;
    const root = document.documentElement;
    const body = document.body;
    const rail = railRef.current;
    const viewport = window.visualViewport;
    const previousRootOverflow = root.style.overflow;
    const previousRootOverscroll = root.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;

    rail?.setAttribute("inert", "");
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";

    const syncVisualViewport = () => {
      root.style.setProperty(
        "--mobile-sheet-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`
      );
      root.style.setProperty("--mobile-sheet-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSheet(null);
        setError("");
        window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !sheetRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !sheetRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    syncVisualViewport();
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", syncVisualViewport);
    viewport?.addEventListener("resize", syncVisualViewport);
    viewport?.addEventListener("scroll", syncVisualViewport);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", syncVisualViewport);
      viewport?.removeEventListener("resize", syncVisualViewport);
      viewport?.removeEventListener("scroll", syncVisualViewport);
      rail?.removeAttribute("inert");
      root.style.overflow = previousRootOverflow;
      root.style.overscrollBehavior = previousRootOverscroll;
      body.style.overflow = previousBodyOverflow;
      root.style.removeProperty("--mobile-sheet-viewport-height");
      root.style.removeProperty("--mobile-sheet-viewport-top");
    };
  }, [isSheetOpen]);

  const closeSheet = () => {
    setSheet(null);
    setError("");
    window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
  };

  const openAddSheet = (event: React.MouseEvent<HTMLButtonElement>) => {
    lastTriggerRef.current = event.currentTarget;
    setNewName("");
    setError("");
    setSheet({ kind: "add" });
  };

  const openManageSheet = (event: React.MouseEvent<HTMLButtonElement>, profileId: string) => {
    lastTriggerRef.current = event.currentTarget;
    setError("");
    setSheet({ kind: "manage", profileId });
  };

  const goToProfile = async (profileId: string) => {
    setBusyId(profileId);
    const resolved = await resolveProfileDestination(profileId, destination);
    router.push(resolved);
  };

  const handleUse = async (profileId: string) => {
    setError("");
    const result = switchProfile(profileId);
    if (!result.ok) {
      setError(result.error ?? t("profiles.switchFailed"));
      return;
    }
    await goToProfile(profileId);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const result = createProfile(newName);
    if (!result.ok || !result.profile) {
      setError(result.error ?? t("profiles.createFailed"));
      return;
    }
    setNewName("");
    setSheet(null);
    await goToProfile(result.profile.profile_id);
  };

  const handleRename = (event: React.FormEvent, profileId: string) => {
    event.preventDefault();
    setError("");
    const result = renameProfile(profileId, renameValue);
    if (!result.ok) {
      setError(result.error ?? t("profiles.renameFailed"));
      return;
    }
    setRenameValue("");
    closeSheet();
  };

  const handleDelete = (profileId: string) => {
    setError("");
    const profileIndex = profiles.findIndex((profile) => profile.profile_id === profileId);
    const nextFocusId =
      profiles[profileIndex + 1]?.profile_id ?? profiles[profileIndex - 1]?.profile_id ?? null;
    const result = deleteProfile(profileId);
    if (!result.ok) {
      setError(result.error ?? t("profiles.deleteFailed"));
      return;
    }
    setSheet(null);
    window.setTimeout(() => {
      if (nextFocusId) manageTriggerRefs.current[nextFocusId]?.focus();
      else addTriggerRef.current?.focus();
    }, 0);
  };

  if (isLoading) {
    return (
      <div className={styles.page}>
        <AmbientWheel />
        <div className={styles.loadingCard} role="status">
          <Ornament />
          <p className={styles.loading}>{t("profiles.opening")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <AmbientWheel />
      <div ref={railRef} className={styles.rail}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.back}>
            <Glyph d={ICON.chevron} size={18} />
            {t("home.back")}
          </Link>
          <span className={styles.wordmark}>Lagna Atelier</span>
          <span className={styles.topBarSpacer} aria-hidden="true" />
        </header>

        <div className={styles.mainLayout}>
          <section className={styles.hero} aria-labelledby="mobile-profile-heading">
            {skyLine && <span className={styles.sky}>{skyLine}</span>}
            <div className={styles.markHalo}>
              <Ornament />
            </div>
            <p className={styles.eyebrow}>{t("profiles.kicker")}</p>
            <h1 id="mobile-profile-heading" className={`${styles.heading} mGold`}>
              {t("profiles.heading")}
            </h1>
            <p className={styles.lead}>{t("profiles.lead")}</p>
          </section>

          <div className={styles.profileArea}>
            <section className={styles.profilePanel} aria-label={t("profiles.heading")} aria-busy={busyId !== null}>
              <ul className={styles.list}>
                {profiles.map((profile) => {
                  const isActive = profile.profile_id === activeProfile?.profile_id;
                  const count = counts[profile.profile_id] ?? 0;

                  return (
                    <li key={profile.profile_id} className={styles.row}>
                      <div className={`${styles.rowMain} ${isActive ? styles.rowActive : ""}`}>
                        <button
                          type="button"
                          className={styles.pick}
                          onClick={() => void handleUse(profile.profile_id)}
                          disabled={busyId !== null}
                        >
                          <span className={styles.avatar} aria-hidden="true">
                            {profile.display_name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className={styles.pickText}>
                            <span className={styles.nameLine}>
                              <span className={styles.name}>{profile.display_name}</span>
                              {isActive && <span className={styles.activeBadge}>{t("profiles.active")}</span>}
                            </span>
                            <span className={styles.meta} aria-live="polite">
                              {busyId === profile.profile_id
                                ? t("profiles.opening")
                                : `${count} ${count === 1 ? "chart" : "charts"}`}
                            </span>
                          </span>
                        </button>
                        <button
                          ref={(node) => {
                            manageTriggerRefs.current[profile.profile_id] = node;
                          }}
                          type="button"
                          className={styles.iconBtn}
                          onClick={(event) => openManageSheet(event, profile.profile_id)}
                          disabled={busyId !== null}
                          aria-label={`${t("profiles.manage")} ${profile.display_name}`}
                          aria-haspopup="dialog"
                        >
                          <Glyph d={ICON.more} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {canCreateProfile ? (
                <button
                  ref={addTriggerRef}
                  type="button"
                  className={styles.addRow}
                  onClick={openAddSheet}
                  disabled={busyId !== null}
                  aria-haspopup="dialog"
                >
                  <span className={styles.addIcon} aria-hidden="true">
                    <Glyph d={ICON.plus} />
                  </span>
                  <span>{t("profiles.addDivider")}</span>
                </button>
              ) : (
                <p className={styles.fine}>{t("profiles.full").replace("{max}", String(maxProfiles))}</p>
              )}
            </section>

            {error && !sheet && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <p className={styles.footNote}>
              <span className={styles.lockIcon} aria-hidden="true">
                <Glyph d={ICON.lock} size={18} />
              </span>
              <span>{t("profiles.storageNote").replace("{max}", String(maxProfiles))}</span>
            </p>
          </div>
        </div>
      </div>

      {sheet && (
        <div
          className={styles.sheetOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSheet();
          }}
        >
          <section
            ref={sheetRef}
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-sheet-title"
          >
            <div className={styles.sheetHandle} aria-hidden="true" />
            <header className={styles.sheetHeader}>
              <div className={styles.sheetHeading}>
                <p className={styles.sheetEyebrow}>{t("profiles.kicker")}</p>
                <h2 id="mobile-sheet-title" className={styles.sheetTitle}>
                  {sheet.kind === "add" && t("profiles.create")}
                  {sheet.kind === "manage" && sheetProfile?.display_name}
                  {sheet.kind === "rename" && t("profiles.rename")}
                  {sheet.kind === "delete" && `${t("profiles.confirmDelete")}: ${sheetProfile?.display_name ?? ""}`}
                </h2>
              </div>
              <button type="button" className={styles.sheetClose} onClick={closeSheet} aria-label={t("profiles.cancel")}>
                <Glyph d={ICON.close} />
              </button>
            </header>

            {sheet.kind === "add" && (
              <form className={styles.sheetForm} onSubmit={handleCreate}>
                <label className={styles.fieldLabel} htmlFor="m-profile-name">
                  {t("profiles.nameLabel")}
                </label>
                <input
                  id="m-profile-name"
                  className={styles.sheetInput}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  maxLength={40}
                  required
                  autoFocus
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "mobile-sheet-error" : undefined}
                />
                {error && (
                  <p id="mobile-sheet-error" className={styles.sheetError} role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" className={styles.primaryAction}>
                  {t("profiles.create")}
                </button>
              </form>
            )}

            {sheet.kind === "manage" && sheetProfile && (
              <div className={styles.sheetActions}>
                <button
                  type="button"
                  className={styles.sheetAction}
                  autoFocus
                  onClick={() => {
                    setRenameValue(sheetProfile.display_name);
                    setError("");
                    setSheet({ kind: "rename", profileId: sheetProfile.profile_id });
                  }}
                >
                  <span className={styles.sheetActionIcon} aria-hidden="true">
                    <Glyph d={ICON.pencil} />
                  </span>
                  <span>{t("profiles.rename")}</span>
                </button>
                {profiles.length > 1 && (
                  <button
                    type="button"
                    className={`${styles.sheetAction} ${styles.dangerAction}`}
                    onClick={() => {
                      setError("");
                      setSheet({ kind: "delete", profileId: sheetProfile.profile_id });
                    }}
                  >
                    <span className={styles.sheetActionIcon} aria-hidden="true">
                      <Glyph d={ICON.trash} />
                    </span>
                    <span>{t("profiles.delete")}</span>
                  </button>
                )}
                <button type="button" className={styles.secondaryAction} onClick={closeSheet}>
                  {t("profiles.cancel")}
                </button>
              </div>
            )}

            {sheet.kind === "rename" && sheetProfile && (
              <form className={styles.sheetForm} onSubmit={(event) => handleRename(event, sheetProfile.profile_id)}>
                <label className={styles.fieldLabel} htmlFor="m-profile-rename">
                  {t("profiles.renameLabel")}
                </label>
                <input
                  id="m-profile-rename"
                  className={styles.sheetInput}
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  maxLength={40}
                  autoFocus
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "mobile-sheet-error" : undefined}
                />
                {error && (
                  <p id="mobile-sheet-error" className={styles.sheetError} role="alert">
                    {error}
                  </p>
                )}
                <div className={styles.actionRow}>
                  <button type="button" className={styles.secondaryAction} onClick={closeSheet}>
                    {t("profiles.cancel")}
                  </button>
                  <button type="submit" className={styles.primaryAction}>
                    {t("profiles.saveName")}
                  </button>
                </div>
              </form>
            )}

            {sheet.kind === "delete" && sheetProfile && (
              <div className={styles.deleteConfirm}>
                <div className={styles.deleteMark} aria-hidden="true">
                  <Glyph d={ICON.trash} size={24} />
                </div>
                <p id="mobile-delete-warning" className={styles.deleteWarning}>
                  {t("profiles.deleteWarning")}
                </p>
                {error && (
                  <p className={styles.sheetError} role="alert">
                    {error}
                  </p>
                )}
                <div className={styles.actionRow}>
                  <button type="button" className={styles.secondaryAction} autoFocus onClick={closeSheet}>
                    {t("profiles.cancel")}
                  </button>
                  <button
                    type="button"
                    className={styles.deleteAction}
                    onClick={() => handleDelete(sheetProfile.profile_id)}
                    aria-describedby="mobile-delete-warning"
                    aria-label={`${t("profiles.delete")} ${sheetProfile.display_name}`}
                  >
                    {t("profiles.delete")}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
