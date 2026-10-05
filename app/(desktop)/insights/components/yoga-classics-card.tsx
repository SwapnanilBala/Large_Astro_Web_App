"use client";

import type { YogaDetectionResult } from "@/lib/astro-types";
import { useRouteMessages, useTranslation } from "@/lib/i18n-context";
import strengthMessages from "@/messages/en.strength.json";
import { ClassicalNote } from "./classical-note";
import { useYogaClassics } from "./use-yoga-classics";

/**
 * "From the classics" in the yoga section: what the Brihat Jataka says about
 * this chart's yogas. The card itself is ClassicalNote; this is what it asks
 * for and the strings it shows, under strength.yogas.classics.
 */
export function YogaClassicsCard({ yogas }: { yogas: YogaDetectionResult[] }) {
  const { language } = useTranslation();
  const tr = useRouteMessages(strengthMessages);
  const { state, reading } = useYogaClassics(yogas, language);

  return (
    <ClassicalNote
      state={state}
      reading={reading}
      tr={tr}
      prefix="strength.yogas.classics"
      headingId="yoga-classics-heading"
    />
  );
}
