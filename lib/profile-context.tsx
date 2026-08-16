"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  MAX_PROFILES,
  createProfile as createStoredProfile,
  deleteProfile as deleteStoredProfile,
  getProfilesSnapshot,
  getServerProfilesSnapshot,
  renameProfile as renameStoredProfile,
  setActiveProfile as setStoredActiveProfile,
  subscribeToProfiles,
  type LocalProfile,
  type ProfileMutationResult,
} from "@/lib/local-profiles";

type ProfileContextValue = {
  profiles: LocalProfile[];
  activeProfile: LocalProfile | null;
  /** Convenience alias — the id every scoped store keys off. */
  profileId: string | null;
  /** True until localStorage has been read; nothing is scoped yet. */
  isLoading: boolean;
  maxProfiles: number;
  canCreateProfile: boolean;
  createProfile: (name: string) => ProfileMutationResult;
  renameProfile: (profileId: string, name: string) => ProfileMutationResult;
  deleteProfile: (profileId: string) => ProfileMutationResult;
  switchProfile: (profileId: string) => ProfileMutationResult;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(
    subscribeToProfiles,
    getProfilesSnapshot,
    getServerProfilesSnapshot
  );

  const activeProfile = useMemo(
    () =>
      state.profiles.find(
        (profile) => profile.profile_id === state.active_profile_id
      ) ?? null,
    [state.active_profile_id, state.profiles]
  );

  const createProfile = useCallback((name: string) => createStoredProfile(name), []);

  const renameProfile = useCallback(
    (profileId: string, name: string) => renameStoredProfile(profileId, name),
    []
  );

  const deleteProfile = useCallback(
    (profileId: string) => deleteStoredProfile(profileId),
    []
  );

  const switchProfile = useCallback(
    (profileId: string) => setStoredActiveProfile(profileId),
    []
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      profiles: state.profiles,
      activeProfile,
      profileId: activeProfile?.profile_id ?? null,
      isLoading: !state.hydrated,
      maxProfiles: MAX_PROFILES,
      canCreateProfile: state.profiles.length < MAX_PROFILES,
      createProfile,
      renameProfile,
      deleteProfile,
      switchProfile,
    }),
    [
      activeProfile,
      createProfile,
      deleteProfile,
      renameProfile,
      state.hydrated,
      state.profiles,
      switchProfile,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
