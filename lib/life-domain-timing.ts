import type {
  DashaInfo,
  DashaPeriodInfo,
  LifeDomainInsight,
} from "@/lib/astro-types";

export type LifeDomainTimingWindow = {
  label: string;
  value: string;
};

function yearRange(period: DashaPeriodInfo): string {
  const startYear = Number(period.start_date.slice(0, 4));
  const endYear = Number(period.end_date.slice(0, 4));
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
    return `${period.start_date} to ${period.end_date}`;
  }
  return startYear === endYear ? String(startYear) : `${startYear}–${endYear}`;
}

function nextActivationPeriod(
  dasha: DashaInfo,
  activationPlanets: Set<string>,
  today: string
): DashaPeriodInfo | undefined {
  return [...dasha.periods]
    .filter(
      (period) =>
        activationPlanets.has(period.planet) && period.start_date > today
    )
    .sort((left, right) => left.start_date.localeCompare(right.start_date))[0];
}

export function getLifeDomainTimingWindows(
  domain: LifeDomainInsight,
  dasha?: DashaInfo | null,
  now: Date = new Date()
): LifeDomainTimingWindow[] {
  const caution = domain.display.watchouts[0];
  const activationPlanets = new Set(
    domain.signal_profile?.activation_planets ?? []
  );

  if (!dasha || activationPlanets.size === 0) {
    return [
      {
        label: "Current activation",
        value:
          domain.display.timing[0] ??
          "Watch for repeated signals before treating this domain as active.",
      },
      {
        label: "Next stronger cycle",
        value:
          domain.display.timing[1] ??
          "The next clean opening comes when support and practical evidence repeat the same theme.",
      },
      {
        label: "Caution condition",
        value:
          caution ??
          "Avoid forcing outcomes when the evidence is mixed or the timing is noisy.",
      },
    ];
  }

  const majorIsDirect = activationPlanets.has(dasha.current_dasha);
  const subPeriodIsDirect = activationPlanets.has(dasha.current_antardasha);
  const activeNames = [
    majorIsDirect ? `${dasha.current_dasha} major period` : undefined,
    subPeriodIsDirect ? `${dasha.current_antardasha} sub-period` : undefined,
  ].filter((value): value is string => Boolean(value));

  const currentValue = activeNames.length > 0
    ? `${activeNames.join(" and ")} directly activate this domain. ${domain.display.timing[0] ?? "Use repeated real-world evidence to judge the result."}`
    : `${dasha.current_dasha} / ${dasha.current_antardasha} does not directly match this domain's three activation planets, so treat it as a background phase. ${domain.display.timing[0] ?? "Let present behavior carry more weight than anticipation."}`;

  const today = now.toISOString().slice(0, 10);
  const nextPeriod = nextActivationPeriod(dasha, activationPlanets, today);
  const nextValue = nextPeriod
    ? `${nextPeriod.planet} is the next major activation period (${yearRange(nextPeriod)}). Use the rule support and watchouts together before calling it favorable.`
    : domain.display.timing[1] ??
      "No later major activation period is present in the available timeline; use the current evidence rather than inventing a date.";

  return [
    { label: "Current activation", value: currentValue },
    { label: "Next stronger cycle", value: nextValue },
    {
      label: "Caution condition",
      value:
        caution ??
        "Avoid forcing outcomes when the evidence is mixed or the timing is noisy.",
    },
  ];
}
