import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-url";

/*
 * Crawl everything a person could land on; skip the API, which has nothing to
 * index and every route of which is rate limited.
 *
 * /insights is deliberately not disallowed. Those pages carry noindex (see
 * app/(desktop)/insights/layout.tsx), and a crawler has to be allowed to fetch
 * a page to read that -- a Disallow would stop the fetch and leave a publicly
 * linked chart URL indexable from its link alone.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: new URL("/sitemap.xml", siteOrigin()).toString(),
  };
}
