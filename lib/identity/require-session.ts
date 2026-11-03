import { SESSION_COOKIE, resolveSession, type SessionUser } from "@/lib/identity/session";

/**
 * Reading the signed-in visitor, from either side of the app.
 *
 * Two callers need this and they hold the cookie differently: a route handler
 * has a `Request`, a server component has `next/headers`. Both resolve through
 * the same function here so a page can never disagree with the route behind it
 * about whether somebody is signed in.
 *
 * Extracted from lib/llm-budget.ts, which had the cookie parser inline. That
 * copy now imports this one -- two parsers for one cookie is exactly the sort
 * of thing that drifts silently and then locks the wrong people out.
 */

/** The session cookie out of a raw `Cookie` header, or null. */
export function sessionTokenFromCookieHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === SESSION_COOKIE) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim()) || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * A session token as the app sends it: `Authorization: Bearer <token>`.
 *
 * Only the shape createSession mints (base64url, 43 characters for 32 bytes,
 * with room to grow) is accepted, so nothing odd reaches the hash and the
 * query. Anything else is "no token", never an error.
 */
const BEARER = /^Bearer[ ]+([A-Za-z0-9_-]{20,128})[ ]*$/i;

export function sessionTokenFromAuthorizationHeader(header: string | null): string | null {
  if (!header) return null;
  return BEARER.exec(header)?.[1] ?? null;
}

/**
 * The session token a request carries: the Android app's bearer header, or
 * the browser's cookie.
 *
 * Every reader of the session goes through this one function, so a route
 * cannot accept the header while its neighbour ignores it. A bearer header
 * wins when one is present: it is never attached by a browser on its own, so
 * it adds no cross-site exposure, and a request that names its session
 * explicitly should not quietly fall back to a different one. Any other
 * Authorization scheme is not ours and leaves the cookie to answer.
 */
export function sessionTokenFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization && /^bearer\b/i.test(authorization.trim())) {
    return sessionTokenFromAuthorizationHeader(authorization.trim());
  }
  return sessionTokenFromCookieHeader(request.headers.get("cookie"));
}

/**
 * The signed-in user behind a request, or null.
 *
 * Swallows a lookup failure and reports "not signed in". That is the cautious
 * direction for a gate: a database blip must not hand out a paid feature, and
 * the alternative -- failing open -- makes the gate decorative the moment Neon
 * hiccups. It does mean an outage locks out people who are genuinely signed in,
 * which is the trade being made deliberately rather than by accident.
 */
export async function sessionFromRequest(request: Request): Promise<SessionUser | null> {
  const token = sessionTokenFromRequest(request);
  if (!token) return null;
  try {
    return await resolveSession(token);
  } catch {
    return null;
  }
}

/** The same question, asked from a server component's cookie store. */
export async function sessionFromCookieStore(
  cookieStore: { get(name: string): { value: string } | undefined },
): Promise<SessionUser | null> {
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await resolveSession(token);
  } catch {
    return null;
  }
}
