"use client";

import { useRouteMessages } from "@/lib/i18n-context";
import lifeAreasMessages from "@/messages/en.life-areas.json";

/*
 * The hero copy of /insights/life-areas and /insights/life-shifts.
 *
 * Both pages await searchParams and build the chart, so they stay server
 * components and have no translator. They name the text by key, and this
 * reads it in the visitor's language -- the same split house-support makes
 * with house-support-page-copy.tsx. Both routes' keys sit in the life-areas
 * catalog, as their notices' do.
 */
export const LIFE_AREAS_TEXT_KEYS = [
  "lifeAreas.hero.kicker",
  "lifeAreas.hero.title",
  "lifeAreas.hero.lead",
  "lifeAreas.lifeShifts.heroKicker",
  "lifeAreas.lifeShifts.heroTitle",
  "lifeAreas.lifeShifts.heroLead",
] as const;

export default function LifeAreasText({
  k,
  name,
}: {
  k: (typeof LIFE_AREAS_TEXT_KEYS)[number];
  /** The chart's name, for the titles. */
  name?: string;
}) {
  const tr = useRouteMessages(lifeAreasMessages);
  return <>{tr(k, name === undefined ? undefined : { name })}</>;
}
