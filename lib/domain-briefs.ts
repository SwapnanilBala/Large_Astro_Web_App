import type { LifeDomainKey } from "@/lib/astro-types";

export const DOMAIN_BRIEF_KEYS = [
  "love_life",
  "career",
  "family",
  "inheritance",
  "influence",
  "life_cycle",
  "travel_destinations",
] as const satisfies readonly LifeDomainKey[];

export type DomainBriefs = Partial<Record<LifeDomainKey, string>>;
export type DomainBriefResponse = {
  brief: string;
  briefs: DomainBriefs;
  cached: boolean;
};
