/**
 * Device detection and mobile-route mapping.
 *
 * The mobile experience lives on its own `/m` routes rather than branching
 * inside shared components, so this module owns the whole contract: how a
 * device is classified, how a path maps between the two trees, and how a
 * visitor overrides the guess.
 *
 * Used by the middleware (server, from the User-Agent header) and by
 * useDeviceType (client, from navigator). Keep it dependency-free so both
 * runtimes can import it.
 */

export const MOBILE_PREFIX = "/m";

/**
 * Master switch for device-based redirecting.
 *
 * On now that app/m/page.tsx and app/m/insights exist. Turning it off is the
 * one-line rollback if the mobile tree misbehaves in production — every route
 * keeps working, phones just get the shared tree again.
 *
 * resolveRoute deliberately ignores this flag so it stays a pure, testable
 * mapping; the middleware is what consults it.
 */
export const MOBILE_ROUTING_ENABLED = true;

/** Query parameter and cookie a visitor uses to override device detection. */
export const VIEW_OVERRIDE_PARAM = "view";
export const VIEW_OVERRIDE_COOKIE = "astro_view";

export type ViewPreference = "mobile" | "desktop";

/**
 * Routes that have a mobile counterpart. Anything not listed here is served
 * from the shared tree on both devices, so adding a mobile route is a matter
 * of building it and adding its path here.
 */
export const MOBILE_ROUTES = ["/", "/insights", "/login"] as const;

/*
 * Deliberately narrow. A UA string cannot reliably tell us screen size, and
 * over-matching sends tablets and desktop browsers with unusual UAs into a
 * layout built for a 375px viewport.
 *
 * `Android` alone is not enough — Android tablets send it too — so we require
 * `Mobile`, which Chrome on Android phones sends and Android tablets do not.
 * iPad is excluded on purpose: it reports a desktop-class viewport and iPadOS
 * 13+ presents a macOS UA anyway, so it belongs on the desktop tree.
 */
const MOBILE_UA = /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|BB10|Opera Mini|IEMobile/i;

/** True when the User-Agent looks like a handset (not a tablet or desktop). */
export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return MOBILE_UA.test(userAgent);
}

/** Normalise a path for comparison: strip trailing slash, keep the root as "/". */
function normalise(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname || "/";
}

/** True when the path already lives under the mobile tree. */
export function isMobilePath(pathname: string): boolean {
  const path = normalise(pathname);
  return path === MOBILE_PREFIX || path.startsWith(`${MOBILE_PREFIX}/`);
}

/** True when this path has a mobile counterpart worth redirecting to. */
export function hasMobileRoute(pathname: string): boolean {
  const path = normalise(pathname);
  return (MOBILE_ROUTES as readonly string[]).includes(path);
}

/** `/insights` -> `/m/insights`, `/` -> `/m`. */
export function toMobilePath(pathname: string): string {
  const path = normalise(pathname);
  if (isMobilePath(path)) return path;
  return path === "/" ? MOBILE_PREFIX : `${MOBILE_PREFIX}${path}`;
}

/** `/m/insights` -> `/insights`, `/m` -> `/`. */
export function toDesktopPath(pathname: string): string {
  const path = normalise(pathname);
  if (!isMobilePath(path)) return path;
  const stripped = path.slice(MOBILE_PREFIX.length);
  return stripped === "" ? "/" : stripped;
}

/** Read an explicit preference, param taking precedence over cookie. */
export function readViewPreference(
  param: string | null | undefined,
  cookie: string | null | undefined,
): ViewPreference | null {
  const candidate = param ?? cookie;
  return candidate === "mobile" || candidate === "desktop" ? candidate : null;
}

export type RouteDecision =
  | { action: "pass" }
  | { action: "redirect"; pathname: string };

/**
 * Decide where a request belongs.
 *
 * An explicit preference always wins over the User-Agent guess, so a visitor
 * who asks for the desktop layout on a phone keeps it, and is not bounced back
 * on the next navigation.
 */
export function resolveRoute(input: {
  pathname: string;
  userAgent: string | null | undefined;
  preference: ViewPreference | null;
}): RouteDecision {
  const { pathname, userAgent, preference } = input;
  const onMobileTree = isMobilePath(pathname);
  const wantsMobile = preference ? preference === "mobile" : isMobileUserAgent(userAgent);

  if (wantsMobile && !onMobileTree && hasMobileRoute(pathname)) {
    return { action: "redirect", pathname: toMobilePath(pathname) };
  }

  if (!wantsMobile && onMobileTree) {
    return { action: "redirect", pathname: toDesktopPath(pathname) };
  }

  return { action: "pass" };
}
