"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, User, X } from "lucide-react";
import { useProfile } from "@/lib/profile-context";
import { useTranslation } from "@/lib/i18n-context";
import { resolveProfileDestination } from "@/lib/profile-redirect";
import PageTransition from "../components/PageTransition";
import BackButton from "../components/BackButton";
import AuthAmbient from "./AuthAmbient";
import ZodiacFloater from "./ZodiacFloater";
import styles from "./login.module.css";

type ProfilePickerClientProps = {
  returnTo?: string;
  skyLine?: string;
};

export default function ProfilePickerClient({ returnTo, skyLine }: ProfilePickerClientProps) {
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
  const [error, setError] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const destination = returnTo ?? "/";

  useEffect(() => {
    // A rename or delete elsewhere can invalidate the row being edited.
    if (renamingId && !profiles.some((profile) => profile.profile_id === renamingId)) {
      setRenamingId(null);
    }
    if (pendingDeleteId && !profiles.some((profile) => profile.profile_id === pendingDeleteId)) {
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, profiles, renamingId]);

  const goToProfile = async (profileId: string) => {
    setSettling(true);
    const resolved = await resolveProfileDestination(profileId, destination);
    // Brief shimmer choreography before navigating away
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRedirecting(true);
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
    await goToProfile(result.profile.profile_id);
  };

  const handleRenameSubmit = (event: React.FormEvent, profileId: string) => {
    event.preventDefault();
    setError("");
    const result = renameProfile(profileId, renameValue);
    if (!result.ok) {
      setError(result.error ?? t("profiles.renameFailed"));
      return;
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const handleDelete = (profileId: string) => {
    setError("");
    const result = deleteProfile(profileId);
    if (!result.ok) {
      setError(result.error ?? t("profiles.deleteFailed"));
    }
    setPendingDeleteId(null);
  };

  if (isLoading || redirecting) {
    return (
      <PageTransition>
        <div className="home-shell" style={{ position: "relative" }}>
          <AuthAmbient />
          <section className={styles.panel} style={{ textAlign: "center" }}>
            <p className="kicker">{t("profiles.opening")}</p>
          </section>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="home-shell" style={{ position: "relative" }}>
        <AuthAmbient />
        <ZodiacFloater />
        <BackButton href="/" />
        <section className={`${styles.panel} ${settling ? styles.panelSettling : ""}`}>
          {settling && <span className={styles.shimmerSweep} aria-hidden="true" />}
          <div className={styles.header}>
            {skyLine && <p className={styles.skyLine}>✦ {skyLine} ✦</p>}
            <p className="kicker">{t("profiles.kicker")}</p>
            <h1 className={styles.heading}>{t("profiles.heading")}</h1>
            <p className={styles.lead}>{t("profiles.lead")}</p>
          </div>

          <ul className={styles.profileList}>
            {profiles.map((profile) => {
              const isActive = profile.profile_id === activeProfile?.profile_id;
              const isRenaming = renamingId === profile.profile_id;
              const isConfirmingDelete = pendingDeleteId === profile.profile_id;

              return (
                <li
                  key={profile.profile_id}
                  className={`${styles.profileRow} ${isActive ? styles.profileRowActive : ""}`}
                >
                  {isRenaming ? (
                    <form
                      className={styles.renameForm}
                      onSubmit={(event) => handleRenameSubmit(event, profile.profile_id)}
                    >
                      <input
                        className={styles.renameInput}
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        maxLength={40}
                        aria-label={t("profiles.renameLabel")}
                        autoFocus
                      />
                      <button
                        type="submit"
                        className={styles.profileIconBtn}
                        aria-label={t("profiles.saveName")}
                      >
                        <Check size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={styles.profileIconBtn}
                        onClick={() => setRenamingId(null)}
                        aria-label={t("profiles.cancel")}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.profilePick}
                        onClick={() => void handleUse(profile.profile_id)}
                      >
                        <span className={styles.profileAvatar} aria-hidden="true">
                          {profile.display_name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className={styles.profileName}>{profile.display_name}</span>
                        {isActive && (
                          <span className={styles.profileMeta}>{t("profiles.active")}</span>
                        )}
                      </button>

                      <span className={styles.profileRowActions}>
                        <button
                          type="button"
                          className={styles.profileIconBtn}
                          onClick={() => {
                            setRenamingId(profile.profile_id);
                            setRenameValue(profile.display_name);
                            setPendingDeleteId(null);
                          }}
                          aria-label={`${t("profiles.rename")} ${profile.display_name}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        {profiles.length > 1 &&
                          (isConfirmingDelete ? (
                            <>
                              <button
                                type="button"
                                className={`${styles.profileIconBtn} ${styles.profileIconBtnDanger}`}
                                onClick={() => handleDelete(profile.profile_id)}
                                aria-label={`${t("profiles.confirmDelete")} ${profile.display_name}`}
                              >
                                <Check size={16} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className={styles.profileIconBtn}
                                onClick={() => setPendingDeleteId(null)}
                                aria-label={t("profiles.cancel")}
                              >
                                <X size={16} aria-hidden="true" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={styles.profileIconBtn}
                              onClick={() => {
                                setPendingDeleteId(profile.profile_id);
                                setRenamingId(null);
                              }}
                              aria-label={`${t("profiles.delete")} ${profile.display_name}`}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          ))}
                      </span>
                    </>
                  )}

                  {isConfirmingDelete && !isRenaming && (
                    <p className={styles.profileWarning}>{t("profiles.deleteWarning")}</p>
                  )}
                </li>
              );
            })}
          </ul>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>{t("profiles.addDivider")}</span>
            <span className={styles.dividerLine} />
          </div>

          {canCreateProfile ? (
            <form className={styles.form} onSubmit={handleCreate}>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldWrap}>
                  <User className={styles.fieldIcon} size={18} aria-hidden="true" />
                  <input
                    id="profile-name"
                    type="text"
                    placeholder=" "
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    className={styles.fieldInput}
                    maxLength={40}
                    required
                  />
                  <label htmlFor="profile-name" className={styles.floatingLabel}>
                    {t("profiles.nameLabel")}
                  </label>
                </div>
              </div>

              <button type="submit" className={styles.submitBtn}>
                <Plus size={16} aria-hidden="true" style={{ marginInlineEnd: 8 }} />
                {t("profiles.create")}
              </button>
            </form>
          ) : (
            <p className={styles.profileCount}>
              {t("profiles.full").replace("{max}", String(maxProfiles))}
            </p>
          )}

          <p className={styles.switchText}>
            {t("profiles.storageNote").replace("{max}", String(maxProfiles))}
          </p>
        </section>
      </div>
    </PageTransition>
  );
}
