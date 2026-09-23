/**
 * The site's absolute origin: the base for Open Graph, Twitter and canonical
 * URLs, and the host robots.txt and the sitemap name. Lives here rather than in
 * app/layout.tsx so those three agree on one answer.
 *
 * The concrete effect today is on the four `/m` pages, which each declare an
 * `alternates.canonical` pointing at their desktop twin. Without a base those
 * emit relative — `<link rel="canonical" href="/login">` — and a canonical is
 * meant to name one absolute URL, which is the whole point of pointing a
 * handset page at its desktop equivalent. With a base they resolve to
 * `https://…/login`. It is also what any `openGraph.images` added later will
 * resolve against, and Next does warn about a missing base in that case.
 *
 * `APP_ORIGIN` is reused rather than given a sibling variable because it is
 * already defined as the canonical origin this app is reached on — the same
 * value the OAuth redirect URI is built from. One variable means the two cannot
 * drift into disagreeing about what this site is called.
 *
 * `VERCEL_URL` is the per-deployment fallback so a preview build describes
 * itself rather than production; it arrives without a scheme. A malformed value
 * falls back rather than throwing: this is cosmetic metadata, and it should not
 * be able to take every route down when a canonical URL would merely be wrong.
 */
export function siteOrigin(): URL {
  const configured =
    process.env.APP_ORIGIN ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  try {
    return new URL((configured || "http://localhost:7001").replace(/\/+$/, ""));
  } catch {
    return new URL("http://localhost:7001");
  }
}

/**
 * The User-Agent every call to an OpenStreetMap service sends.
 *
 * Nominatim's usage policy asks for one "identifying the application" -- a
 * stock library agent is not enough -- and Photon's operators throttle by
 * client, so both are better able to reach a real person than to guess. The
 * site URL is the contact: it is where a maintainer would look first.
 */
export function outboundUserAgent(): string {
  return `LagnaAtelier/1.0 (+${siteOrigin().origin})`;
}
