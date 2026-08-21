"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/profile-context";
import { useTranslation } from "@/lib/i18n-context";
import { resolveProfileDestination } from "@/lib/profile-redirect";
import { readChartHistory } from "@/lib/chart-history-store";
import styles from "./login.module.css";

/*
 * Handset profile picker.
 *
 * Same state machine as app/(desktop)/login/page-client.tsx and the same
 * lib/profile-context calls — this is presentation only. What differs is what a
 * 375px screen can carry:
 *
 * - No lucide-react. Four inline glyphs weigh less than pulling an icon package
 *   into a tree whose entire stylesheet is under 2KB.
 * - No AuthAmbient or ZodiacFloater. The desktop astrolabe renders 338px wide
 *   on a phone, directly behind the profile list; here it is a 56px ornament in
 *   the header, and the surfaces underneath it are opaque.
 * - Rows are the content. A row is one tap: pick the profile and go, matching
 *   desktop rather than adding a select-then-confirm step. Rename and delete
 *   move behind a per-row edit toggle instead of sitting always-visible.
 * - Each row says how many charts the profile has, which is the question you
 *   are actually answering when you pick one.
 */

type Props = { returnTo?: string; skyLine?: string };

function Glyph({ d, label }: { d: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
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

const ICON = {
  pencil: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
  check: "M20 6 9 17l-5-5",
  close: "M18 6 6 18 M6 6l12 12",
  plus: "M12 5v14 M5 12h14",
  chevron: "m15 18-6-6 6-6",
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
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /* Chart counts read from localStorage, so only after mount — rendering them
     during SSR would mismatch on hydration. */
  const [counts, setCounts] = useState<Record<string, number>>({});

  const destination = returnTo || "/";

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const profile of profiles) {
      next[profile.profile_id] = readChartHistory(profile.profile_id).length;
    }
    setCounts(next);
  }, [profiles]);

  useEffect(() => {
    // A rename or delete elsewhere can invalidate the row being edited.
    if (editingId && !profiles.some((p) => p.profile_id === editingId)) setEditingId(null);
    if (pendingDeleteId && !profiles.some((p) => p.profile_id === pendingDeleteId)) {
      setPendingDeleteId(null);
    }
  }, [editingId, pendingDeleteId, profiles]);

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
    setAdding(false);
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
    setEditingId(null);
    setRenameValue("");
  };

  const handleDelete = (profileId: string) => {
    setError("");
    const result = deleteProfile(profileId);
    if (!result.ok) setError(result.error ?? t("profiles.deleteFailed"));
    setPendingDeleteId(null);
    setEditingId(null);
  };

  if (isLoading) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>{t("profiles.opening")}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <a href="/" className={styles.back}>
          <Glyph d={ICON.chevron} />
          {t("home.back")}
        </a>
        {skyLine && <span className={styles.sky}>{skyLine}</span>}
      </div>

      <div className={styles.ornament} aria-hidden="true" />
      <h1 className={styles.heading}>{t("profiles.heading")}</h1>
      <p className={styles.lead}>{t("profiles.lead")}</p>

      <p className={styles.sectionLabel}>{t("profiles.kicker")}</p>

      <ul className={styles.list}>
        {profiles.map((profile) => {
          const isActive = profile.profile_id === activeProfile?.profile_id;
          const isEditing = editingId === profile.profile_id;
          const isConfirming = pendingDeleteId === profile.profile_id;
          const count = counts[profile.profile_id] ?? 0;

          if (isEditing) {
            return (
              <li key={profile.profile_id} className={styles.row}>
                <form className={styles.editForm} onSubmit={(e) => handleRename(e, profile.profile_id)}>
                  <input
                    className={styles.editInput}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={40}
                    aria-label={t("profiles.renameLabel")}
                    autoFocus
                  />
                  <button type="submit" className={styles.iconBtn} aria-label={t("profiles.saveName")}>
                    <Glyph d={ICON.check} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => setEditingId(null)}
                    aria-label={t("profiles.cancel")}
                  >
                    <Glyph d={ICON.close} />
                  </button>
                </form>
              </li>
            );
          }

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
                    <span className={styles.name}>{profile.display_name}</span>
                    <span className={styles.meta}>
                      {busyId === profile.profile_id
                        ? t("profiles.opening")
                        : `${count} ${count === 1 ? "chart" : "charts"}${isActive ? ` · ${t("profiles.active")}` : ""}`}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => {
                    setEditingId(profile.profile_id);
                    setRenameValue(profile.display_name);
                    setPendingDeleteId(null);
                  }}
                  aria-label={`${t("profiles.rename")} ${profile.display_name}`}
                >
                  <Glyph d={ICON.pencil} />
                </button>
                {profiles.length > 1 && (
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${isConfirming ? styles.iconBtnDanger : ""}`}
                    onClick={() =>
                      isConfirming
                        ? handleDelete(profile.profile_id)
                        : setPendingDeleteId(profile.profile_id)
                    }
                    aria-label={
                      isConfirming
                        ? `${t("profiles.confirmDelete")} ${profile.display_name}`
                        : `${t("profiles.delete")} ${profile.display_name}`
                    }
                  >
                    <Glyph d={isConfirming ? ICON.check : ICON.trash} />
                  </button>
                )}
              </div>
              {isConfirming && <p className={styles.warning}>{t("profiles.deleteWarning")}</p>}
            </li>
          );
        })}
      </ul>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {canCreateProfile ? (
        adding ? (
          <form className={styles.addForm} onSubmit={handleCreate}>
            <input
              id="m-profile-name"
              className={styles.addInput}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("profiles.nameLabel")}
              aria-label={t("profiles.nameLabel")}
              maxLength={40}
              required
              autoFocus
            />
            <button type="submit" className={styles.addSubmit}>
              {t("profiles.create")}
            </button>
          </form>
        ) : (
          <button type="button" className={styles.addRow} onClick={() => setAdding(true)}>
            <span className={styles.addIcon} aria-hidden="true">
              <Glyph d={ICON.plus} />
            </span>
            {t("profiles.addDivider")}
          </button>
        )
      ) : (
        <p className={styles.fine}>{t("profiles.full").replace("{max}", String(maxProfiles))}</p>
      )}

      <p className={styles.fine}>
        {t("profiles.storageNote").replace("{max}", String(maxProfiles))}
      </p>
    </div>
  );
}
