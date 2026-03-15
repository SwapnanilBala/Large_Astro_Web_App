"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type User = {
  user_id: string;
  email: string;
  display_name: string;
  subscription_tier: string;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isPremium: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ ok: boolean; error?: string }>;
  redeemPlanCode: (
    code: string,
    expectedPlan?: "basic" | "pro" | "ultimate"
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PREMIUM_TIERS = new Set(["pro", "ultimate", "admin", "premium", "premium_trial"]);

function toAppUser(user: SupabaseUser | null): User | null {
  if (!user?.email) {
    return null;
  }

  const metadata = user.user_metadata ?? {};
  const displayName =
    typeof metadata.display_name === "string" && metadata.display_name.trim().length > 0
      ? metadata.display_name
      : user.email.split("@")[0] ?? "Guest";
  const subscriptionTier =
    typeof metadata.subscription_tier === "string" && metadata.subscription_tier.trim().length > 0
      ? metadata.subscription_tier
      : "guest";

  return {
    user_id: user.id,
    email: user.email,
    display_name: displayName,
    subscription_tier: subscriptionTier,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const applySession = (session: Session | null) => {
      if (!isMounted) {
        return;
      }
      setToken(session?.access_token ?? null);
      setUser(toAppUser(session?.user ?? null));
      setIsLoading(false);
    };

    void supabase.auth.getSession().then(({ data }: { data: { session: Session } }) => {
      applySession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session) => {
      applySession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { ok: false, error: "Supabase is not configured yet." };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { ok: false, error: error.message };
      }
      setToken(data.session?.access_token ?? null);
      setUser(toAppUser(data.user));
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not reach Supabase authentication." };
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { ok: false, error: "Supabase is not configured yet." };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            subscription_tier: "guest",
          },
        },
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      setToken(data.session?.access_token ?? null);
      setUser(toAppUser(data.user));
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not reach Supabase authentication." };
    }
  }, []);

  const redeemPlanCode = useCallback(
    async (code: string, expectedPlan?: "basic" | "pro" | "ultimate") => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        return { ok: false, error: "Supabase is not configured yet." };
      }

      if (!token) {
        return { ok: false, error: "Sign in before changing the account label." };
      }

      if (!code.trim() || !expectedPlan) {
        return { ok: false, error: "Plan-code flows were removed in Supabase mode." };
      }

      const { data, error } = await supabase.auth.updateUser({
        data: {
          subscription_tier: expectedPlan,
        },
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      setUser(toAppUser(data.user));
      return { ok: true };
    },
    [token]
  );

  const logout = useCallback(() => {
    const supabase = getSupabaseBrowserClient();
    setUser(null);
    setToken(null);
    if (supabase) {
      void supabase.auth.signOut();
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isPremium: !!user && PREMIUM_TIERS.has(user.subscription_tier),
        isLoading,
        login,
        register,
        redeemPlanCode,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
