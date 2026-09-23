import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-url";

/*
 * One URL, because it is the only page meant to be found by search. Every
 * chart page is one person's reading and is noindex; the /m tree canonicalises
 * to its desktop twins; sign-in has nothing on it to rank.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: new URL("/", siteOrigin()).toString(), changeFrequency: "monthly", priority: 1 }];
}
