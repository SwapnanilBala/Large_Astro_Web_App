"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

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

const AUTH_API =
  process.env.NEXT_PUBLIC_ASTRO_API_BASE_URL ?? "http://127.0.0.1:8000";
const PREMIUM_TIERS = new Set(["pro", "ultimate", "admin", "premium", "premium_trial"]);

function syncTokenCookie(token: string | null) {
  if (typeof document === "undefined") return;
  if (!token) {
    document.cookie = "astro_token=; Path=/; Max-Age=0; SameSite=Lax";
    return;
  }
  document.cookie = `astro_token=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

function persistAuth(nextUser: User, nextToken: string) {
  localStorage.setItem("astro_token", nextToken);
  localStorage.setItem("astro_user", JSON.stringify(nextUser));
  syncTokenCookie(nextToken);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("astro_token");
      const storedUser = localStorage.getItem("astro_user");
      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser) as Partial<User>;
        setToken(storedToken);
        setUser({
          user_id: parsedUser.user_id ?? "",
          email: parsedUser.email ?? "",
          display_name: parsedUser.display_name ?? "",
          subscription_tier: parsedUser.subscription_tier ?? "basic",
        });
        syncTokenCookie(storedToken);
      }
    } catch {
      // Ignore corrupt storage
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${AUTH_API}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Login failed" }));
        return { ok: false, error: err.detail ?? "Login failed" };
      }
      const data = await res.json();
      const nextUser: User = {
        user_id: data.user_id,
        email: data.email,
        display_name: data.display_name,
        subscription_tier: data.subscription_tier ?? "basic",
      };
      setUser(nextUser);
      setToken(data.token);
      persistAuth(nextUser, data.token);
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error - is the backend running?" };
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    try {
      const res = await fetch(`${AUTH_API}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, display_name: displayName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Registration failed" }));
        return { ok: false, error: err.detail ?? "Registration failed" };
      }
      const data = await res.json();
      const nextUser: User = {
        user_id: data.user_id,
        email: data.email,
        display_name: data.display_name,
        subscription_tier: data.subscription_tier ?? "basic",
      };
      setUser(nextUser);
      setToken(data.token);
      persistAuth(nextUser, data.token);
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error - is the backend running?" };
    }
  }, []);

  const redeemPlanCode = useCallback(
    async (code: string, expectedPlan?: "basic" | "pro" | "ultimate") => {
      if (!token) {
        return { ok: false, error: "Sign in before redeeming a plan code." };
      }

      try {
        const res = await fetch(`${AUTH_API}/api/v1/auth/redeem-plan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            code,
            expected_plan: expectedPlan,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Plan redemption failed" }));
          return { ok: false, error: err.detail ?? "Plan redemption failed" };
        }

        const data = await res.json();
        const nextUser: User = {
          user_id: data.user_id,
          email: data.email,
          display_name: data.display_name,
          subscription_tier: data.subscription_tier ?? "basic",
        };
        setUser(nextUser);
        setToken(data.token);
        persistAuth(nextUser, data.token);
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error - is the backend running?" };
      }
    },
    [token]
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("astro_token");
    localStorage.removeItem("astro_user");
    syncTokenCookie(null);
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
