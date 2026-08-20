/*
 * What the service worker is allowed to put in Cache Storage.
 *
 * Split out of sw.js so it can be unit tested: this file is the security
 * boundary, and it is the one part of the worker worth pinning against
 * regression. sw.js pulls it in with importScripts(), and
 * lib/__tests__/sw-cache-policy.test.ts evaluates these exact bytes.
 *
 * The rule that matters: birth details travel as query parameters. A request
 * for /insights?name=...&birthDate=...&birthTime=...&latitude=... carries
 * somebody's full birth identity in the URL, and Cache Storage has no eviction
 * and no expiry — an entry written there outlives the profile switch that a
 * person would reasonably expect to end it. Local device profiles mean one
 * browser is shared by design, so that entry is readable by whoever uses the
 * device next.
 *
 * Navigations are therefore an allowlist, not a denylist. A route missing from
 * it loses offline support, which is a feature regression; a route wrongly
 * absent from a denylist retains someone's birth data, which is not. Add to
 * NAVIGATION_ALLOWLIST only after checking the route is prerendered (a "○" in
 * the `next build` route table) and reads its personal data from localStorage
 * on the client rather than embedding it in the HTML.
 */

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== "undefined" ? self : globalThis, function () {
  /*
   * Paths whose response depends on the User-Agent or the astro_view cookie.
   * Cache Storage keys on URL alone and cannot tell the variants apart, so a
   * phone that stored one of these would keep serving it after switching to
   * ?view=desktop — and offline there is no proxy to correct the choice.
   *
   * These mirror the matcher in proxy.ts, including its exact/prefix split:
   * "/insights" is listed there without a wildcard, so /insights/palm-history
   * never reaches the proxy and is not device-dependent. "/m/:path*" is a
   * wildcard, so the whole mobile tree is.
   */
  const DEVICE_DEPENDENT_EXACT = ["/", "/insights"];
  const DEVICE_DEPENDENT_PREFIX = ["/m"];
  const DEVICE_DEPENDENT_PATHS = DEVICE_DEPENDENT_EXACT.concat(DEVICE_DEPENDENT_PREFIX);

  /*
   * Routes whose HTML is a generic shell once the query string is gone.
   *
   * That is the actual test for membership, and it is narrower than "is it
   * prerendered". Three of these are prerendered (a "○" in the `next build`
   * route table) and read their personal data from localStorage on the client.
   * /login is marked dynamic ("ƒ") only because it awaits searchParams to read
   * returnTo — and since nothing with a query string is ever cached, the copy
   * that reaches Cache Storage always has returnTo empty. Its profile list is
   * client-side like the others.
   *
   * So before adding a route here, do not check the build table. Check what is
   * in the server-rendered HTML when the URL has no query: if any of it came
   * from a database, a cookie, or the request, it does not belong on this list.
   *
   * Known wart, not a leak: /login also embeds getDailySkyLine(), which changes
   * daily, so an offline visitor can see a stale line. Navigation is
   * network-first, so this only shows with no connection.
   */
  const NAVIGATION_ALLOWLIST = [
    "/calendar",
    "/workspace",
    "/login",
    "/insights/palm-history",
  ];

  function normalise(pathname) {
    if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
    return pathname || "/";
  }

  function isDeviceDependent(pathname) {
    const path = normalise(pathname);
    if (DEVICE_DEPENDENT_EXACT.indexOf(path) !== -1) return true;
    return DEVICE_DEPENDENT_PREFIX.some(
      (candidate) => path === candidate || path.startsWith(`${candidate}/`),
    );
  }

  /** Content-hashed build output. Safe to keep indefinitely; the name changes when the bytes do. */
  function isImmutableAsset(url) {
    return url.pathname.startsWith("/_next/static/");
  }

  /**
   * May this response be written to Cache Storage?
   *
   * @param {{url: string, method?: string, mode?: string, destination?: string}} request
   * @param {string} origin  the worker's own origin
   */
  function isCacheable(request, origin) {
    const method = request.method || "GET";
    if (method !== "GET") return false;

    let url;
    try {
      url = new URL(request.url);
    } catch {
      return false;
    }

    /* Cross-origin responses are often opaque, so their status cannot be read
       and a failure would be cached as though it succeeded. */
    if (url.origin !== origin) return false;

    /* API responses are chart data keyed by birth details. Never stored. */
    if (url.pathname.startsWith("/api/")) return false;

    if (isImmutableAsset(url)) return true;

    /* Everything past this point is personal until proven otherwise. */
    if (url.search) return false;
    if (isDeviceDependent(url.pathname)) return false;

    if (request.mode === "navigate") {
      return NAVIGATION_ALLOWLIST.includes(normalise(url.pathname));
    }

    /* Static files served from public/ — icons, zodiac art, the offline page. */
    const destination = request.destination;
    return (
      destination === "style" ||
      destination === "script" ||
      destination === "image" ||
      destination === "font"
    );
  }

  /** Cache-first is only ever right for content-hashed output. */
  function isCacheFirst(request, origin) {
    if ((request.method || "GET") !== "GET") return false;
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return false;
    }
    return url.origin === origin && isImmutableAsset(url);
  }

  return {
    DEVICE_DEPENDENT_PATHS,
    NAVIGATION_ALLOWLIST,
    isCacheable,
    isCacheFirst,
    isImmutableAsset,
  };
});
