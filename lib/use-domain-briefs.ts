"use client";

import { useEffect, useState } from "react";
import type { LifeDomainKey } from "@/lib/astro-types";
import { DOMAIN_BRIEF_KEYS, type DomainBriefs, type DomainBriefResponse } from "@/lib/domain-briefs";
import { announceIfFreeUsageExhausted } from "@/lib/free-usage-store";
import { useAccount } from "@/lib/use-account";

type BriefState = {
  key: string | null;
  briefs: DomainBriefs;
  failedFor: LifeDomainKey | null;
  offline: boolean;
};

const EMPTY_STATE: BriefState = { key: null, briefs: {}, failedFor: null, offline: false };

export function useDomainBriefs(historyQs: string, domain: LifeDomainKey, enabled = true) {
  const { account, status } = useAccount();
  // This scopes browser state only; the endpoint writes every brief at one effort.
  const key = status === "loading" ? null : JSON.stringify([
    historyQs, status === "signed-in" ? account?.email : "guest",
  ]);
  const [state, setState] = useState<BriefState>(EMPTY_STATE);
  const current = state.key === key ? state : EMPTY_STATE;
  const pending = enabled && key !== null && !current.offline &&
    !current.briefs[domain] && current.failedFor !== domain;

  useEffect(() => {
    if (!pending || key === null) return;
    const controller = new AbortController();
    const update = (change: (previous: BriefState) => BriefState) => {
      if (controller.signal.aborted) return;
      setState((previous) => ({
        ...change(previous.key === key ? previous : EMPTY_STATE), key,
      }));
    };

    const load = async () => {
      try {
        const response = await fetch(`/api/chart/domain-brief?${historyQs}&domain=${domain}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 503) {
          update((previous) => ({ ...previous, offline: true }));
          return;
        }
        if (!response.ok) {
          await announceIfFreeUsageExhausted(response, "domainBrief");
          throw new Error("Life-area briefs are unavailable.");
        }

        const data = await response.json() as Partial<DomainBriefResponse>;
        const briefs: DomainBriefs = {};
        for (const area of DOMAIN_BRIEF_KEYS) {
          const brief = data.briefs?.[area];
          if (typeof brief === "string" && brief.trim()) briefs[area] = brief;
        }
        // Keep compatibility with an older endpoint during a rolling deploy.
        if (!briefs[domain] && typeof data.brief === "string" && data.brief.trim()) {
          briefs[domain] = data.brief;
        }
        if (!briefs[domain]) throw new Error("No life-area brief was returned.");
        update((previous) => ({
          ...previous, briefs: { ...previous.briefs, ...briefs }, failedFor: null,
        }));
      } catch {
        // Keep the engine's reading visible on provider or budget failures.
        update((previous) => ({ ...previous, failedFor: domain }));
      }
    };
    void load();
    return () => controller.abort();
  }, [domain, historyQs, key, pending]);

  return { briefs: current.briefs, pending };
}
