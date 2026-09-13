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
      return decodeURIComponent(part.slice(separator + 1).trim()) || null;
    }
  }
  return null;
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
  const token = sessionTokenFromCookieHeader(request.headers.get("cookie"));
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
