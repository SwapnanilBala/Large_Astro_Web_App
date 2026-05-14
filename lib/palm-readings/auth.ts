/**
 * Shared authentication helper for palm-reading API routes.
 *
 * Validates a Supabase JWT against /auth/v1/user and confirms the caller
 * has a premium subscription tier. Mirrors the inline implementation in
 * `app/api/palm-reading/route.ts` so the new persistence routes can be
 * authenticated with the same rules.
 */

const PREMIUM_TIERS = new Set([
  "pro",
  "ultimate",
  "admin",
  "premium",
  "premium_trial",
]);

type SupabaseUserResponse = {
  id?: unknown;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export type AuthSuccess = {
  ok: true;
  userId: string;
  tier: string;
};

export type AuthFailure = {
  ok: false;
  status: number;
  error: string;
};

export type AuthResult = AuthSuccess | AuthFailure;

/** Parse `Authorization: Bearer <token>` header into the bare token string. */
export function getBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/**
 * Verify the caller is signed in via Supabase and on a premium tier.
 *
 * @param token Bearer access token (without the "Bearer " prefix), or null.
 */
export async function authenticatePalmRequest(
  token: string | null,
): Promise<AuthResult> {
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Sign in to use palm reading.",
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      status: 503,
      error: "Palm reading service is temporarily unavailable.",
    };
  }

  let userResponse: Response;
  try {
    userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Palm reading service is temporarily unavailable.",
    };
  }

  if (!userResponse.ok) {
    return {
      ok: false,
      status: 401,
      error: "Your session expired. Please sign in again.",
    };
  }

  let data: SupabaseUserResponse;
  try {
    data = (await userResponse.json()) as SupabaseUserResponse;
  } catch {
    return {
      ok: false,
      status: 401,
      error: "Your session expired. Please sign in again.",
    };
  }

  if (typeof data.id !== "string" || !data.id) {
    return {
      ok: false,
      status: 401,
      error: "Your session expired. Please sign in again.",
    };
  }

  const tier =
    typeof data.app_metadata?.subscription_tier === "string"
      ? (data.app_metadata.subscription_tier as string)
      : "guest";

  if (!PREMIUM_TIERS.has(tier)) {
    return {
      ok: false,
      status: 403,
      error: "Palm reading requires an active premium plan.",
    };
  }

  return { ok: true, userId: data.id, tier };
}
