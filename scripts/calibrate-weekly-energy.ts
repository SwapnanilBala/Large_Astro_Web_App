/**
 * Weekly-energy band calibration harness.
 *
 *   npm run weekly-energy:calibrate
 *   npm run weekly-energy:calibrate -- --weeks=52
 *
 * Runs the real engine over a spread of real charts and histograms the result,
 * because ENERGY_BAND_THRESHOLDS cannot be reasoned about from the weight
 * tables. The first attempt tried: it derived 62/45 from the reachable range of
 * the panchanga weights and measured at 67.6% of all days landing in the top
 * band, because those weights are not symmetric around zero -- twelve of the
 * fifteen tithi numbers score +12 or better and sixteen of twenty-seven yogas
 * are auspicious, so an ordinary day scores well above nothing. A "High" band
 * covering two thirds of all days is a panel telling every reader that most of
 * their days are exceptional.
 *
 * The fix was in two parts, and this script is how both were checked: centre
 * each term on its analytic mean so 50 means an average day, then read the
 * thresholds off the measured distribution rather than guessing them.
 *
 * Run this after changing ANY weight in weekly-energy-engine.ts or
 * weekly-energy-copy.ts, and move the thresholds if the shape has moved. The
 * distribution is also pinned by lib/__tests__/weekly-energy-engine.test.ts,
 * with tolerances wide enough for an ordinary re-tune -- so that test failing
 * means the shape has changed enough to need a look, not that it is wrong.
 */

import { readChartParams, getChartPayload } from "../lib/chart-params";
import {
  computeWeeklyEnergy,
  ENERGY_BAND_THRESHOLDS,
  PEAK_SIGNIFICANCE_SPREAD,
} from "../lib/engines/weekly-energy-engine";
import { addWeeks } from "../lib/format-week";

/*
 * Eight charts spanning 1946-2010, both hemispheres, latitudes 19-52, and
 * timezones -420 to +600. Breadth matters more than realism here: the point is
 * to see the distribution the model produces for people unlike each other, not
 * to model a user base.
 */
const CHARTS = [
  { name: "Chart A", birthDate: "1992-02-20", birthTime: "08:30", timezoneOffsetMinutes: "-300", latitude: "40.7128", longitude: "-74.0060" },
  { name: "Chart B", birthDate: "1975-11-03", birthTime: "23:45", timezoneOffsetMinutes: "330", latitude: "19.0760", longitude: "72.8777" },
  { name: "Chart C", birthDate: "2001-07-14", birthTime: "05:05", timezoneOffsetMinutes: "60", latitude: "48.8566", longitude: "2.3522" },
  { name: "Chart D", birthDate: "1960-01-01", birthTime: "12:00", timezoneOffsetMinutes: "-180", latitude: "-23.5505", longitude: "-46.6333" },
  { name: "Chart E", birthDate: "1988-09-09", birthTime: "17:20", timezoneOffsetMinutes: "600", latitude: "-33.8688", longitude: "151.2093" },
  { name: "Chart F", birthDate: "1946-04-27", birthTime: "02:10", timezoneOffsetMinutes: "480", latitude: "35.6762", longitude: "139.6503" },
  { name: "Chart G", birthDate: "2010-12-25", birthTime: "19:55", timezoneOffsetMinutes: "0", latitude: "51.5072", longitude: "-0.1276" },
  { name: "Chart H", birthDate: "1983-06-30", birthTime: "10:15", timezoneOffsetMinutes: "-420", latitude: "34.0522", longitude: "-118.2437" },
];

/** A Saturday. Fixed rather than "today", so two runs are comparable. */
const START_WEEK = "2024-01-06";

function argNumber(flag: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${flag}=`));
  if (!raw) return fallback;
  const value = Number(raw.split("=")[1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function main() {
  const weeks = argNumber("weeks", 52);
  const started = Date.now();

  const scores: number[] = [];
  const bandCounts: Record<string, number> = { high: 0, balanced: 0, low: 0 };
  const spreads: number[] = [];
  const headlines = new Map<string, number>();
  const cardTitles = new Map<string, number>();
  let flatWeeks = 0;

  for (const chart of CHARTS) {
    const payload = getChartPayload(
      readChartParams({
        ...chart,
        country: "X",
        state: "Y",
        city: "Z",
        engineId: "lahiri_classic",
        birthTimeAccuracy: "exact",
      })
    );

    let weekStart = START_WEEK;
    for (let i = 0; i < weeks; i += 1) {
      const week = computeWeeklyEnergy({
        weekStart,
        latitude: Number(chart.latitude),
        longitude: Number(chart.longitude),
        timezoneOffsetMinutes: Number(chart.timezoneOffsetMinutes),
        engineId: "lahiri_classic",
        natalPlanets: payload.chart.planets,
        ascendantSign: payload.chart.ascendant.sign,
      });

      for (const day of week.days) {
        scores.push(day.score);
        bandCounts[day.band] += 1;
      }
      const dayScores = week.days.map((d) => d.score);
      spreads.push(Math.max(...dayScores) - Math.min(...dayScores));
      if (!week.peak.is_significant) flatWeeks += 1;
      headlines.set(week.headline.title, (headlines.get(week.headline.title) ?? 0) + 1);
      for (const card of week.cards) {
        cardTitles.set(card.title, (cardTitles.get(card.title) ?? 0) + 1);
      }

      weekStart = addWeeks(weekStart, 1);
    }
  }

  scores.sort((a, b) => a - b);
  spreads.sort((a, b) => a - b);
  const total = scores.length;
  const quantile = (p: number) => scores[Math.floor((total - 1) * p)];
  const mean = scores.reduce((a, b) => a + b, 0) / total;
  const pct = (n: number) => `${((100 * n) / total).toFixed(1)}%`;

  console.log(
    `\nsamples ${total}  (${CHARTS.length} charts x ${weeks} weeks x 7 days)  ${Date.now() - started}ms`
  );
  console.log("\nscore distribution");
  console.log(
    `  min ${scores[0]}  p05 ${quantile(0.05)}  p25 ${quantile(0.25)}  median ${quantile(
      0.5
    )}  p75 ${quantile(0.75)}  p95 ${quantile(0.95)}  max ${scores[total - 1]}`
  );
  console.log(`  mean ${mean.toFixed(1)}   (50 is the target: it means an average day)`);

  console.log(
    `\nbands at high>=${ENERGY_BAND_THRESHOLDS.high} low<=${ENERGY_BAND_THRESHOLDS.low}`
  );
  for (const band of ["high", "balanced", "low"] as const) {
    console.log(`  ${band.padEnd(9)} ${String(bandCounts[band]).padStart(5)}  ${pct(bandCounts[band])}`);
  }

  console.log("\nthreshold sweep");
  for (const high of [62, 64, 66, 68, 70]) {
    for (const low of [44, 46, 48]) {
      let h = 0;
      let b = 0;
      let l = 0;
      for (const score of scores) {
        if (score >= high) h += 1;
        else if (score <= low) l += 1;
        else b += 1;
      }
      console.log(
        `  high>=${String(high).padEnd(3)} low<=${String(low).padEnd(3)}  high ${pct(h).padStart(6)}  balanced ${pct(b).padStart(6)}  low ${pct(l).padStart(6)}`
      );
    }
  }

  console.log(
    `\nweek spread: min ${spreads[0]}  median ${spreads[Math.floor(spreads.length / 2)]}  max ${spreads[spreads.length - 1]}`
  );
  console.log(
    `flat weeks (spread < ${PEAK_SIGNIFICANCE_SPREAD}, peak not named): ${flatWeeks}/${spreads.length}`
  );

  console.log(`\ndistinct headlines: ${headlines.size}`);
  for (const [title, count] of [...headlines].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${title.padEnd(20)} ${count}`);
  }

  console.log(`\ncard appearances (of ${spreads.length * 4}):`);
  for (const [title, count] of [...cardTitles].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${title.padEnd(20)} ${count}`);
  }
  console.log();
}

main();
