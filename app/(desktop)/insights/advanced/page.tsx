import Link from "next/link";
import { cookies } from "next/headers";
import dynamic from "next/dynamic";
import { sessionFromCookieStore } from "@/lib/identity/require-session";
import BackButton from "@/app/components/BackButton";
import BackToReadingButton from "@/app/components/BackToReadingButton";
import { buildChartHistoryQuery } from "@/lib/chart-params";
import PageTransition from "@/app/components/PageTransition";
import { getAdvancedFocusView } from "./advanced-views";
import { chartPageMetadata } from "@/lib/page-metadata";

export const maxDuration = 60;

/* Imported through next/dynamic, not statically, because a page downloads
   the JavaScript of every client component its file imports whether or not
   it renders one. Statically, the members-only gate below shipped the
   advanced reading's loader to every signed-out visitor who reached it.
   Server rendering is unchanged; the chunk now loads only for a member. */
const AdvancedLoader = dynamic(() => import("./advanced-loader"));

type AdvancedPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const requiredParams = [
  "name",
  "birthDate",
  "birthTime",
  "timezoneOffsetMinutes",
  "latitude",
  "longitude",
  "country",
  "state",
  "city"
] as const;

const getSingle = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export const generateMetadata = chartPageMetadata("Advanced reading");

export default async function AdvancedPage({ searchParams }: AdvancedPageProps) {
  const rawParams = await searchParams;
  const params: Record<(typeof requiredParams)[number], string> = {
    name: getSingle(rawParams.name),
    birthDate: getSingle(rawParams.birthDate),
    birthTime: getSingle(rawParams.birthTime),
    timezoneOffsetMinutes: getSingle(rawParams.timezoneOffsetMinutes),
    latitude: getSingle(rawParams.latitude),
    longitude: getSingle(rawParams.longitude),
    country: getSingle(rawParams.country),
    state: getSingle(rawParams.state),
    city: getSingle(rawParams.city)
  };

  const town = getSingle(rawParams.town);
  const timeZoneId = getSingle(rawParams.timeZoneId);
  const engineId = getSingle(rawParams.engineId) || "lahiri_classic";
  const birthTimeAccuracy = getSingle(rawParams.birthTimeAccuracy);
  const birthTimeSource = getSingle(rawParams.birthTimeSource);
  const birthTimeFallback = getSingle(rawParams.birthTimeFallback);
  const focusView = getAdvancedFocusView(getSingle(rawParams.view));

  const hasAllInputs = requiredParams.every((param) => params[param].trim().length > 0);

  if (!hasAllInputs) {
    return (
      <PageTransition>
      <div className="insights-shell below-navbar">
        <BackButton href="/" />
        <section className="dashboard-shell">
          <p className="kicker">Missing Input</p>
          <h1>Chart details are incomplete.</h1>
          <p className="lead">
            Please return to intake and provide complete birth metadata.
          </p>
          <Link href="/" className="ghost-link">
            Back to Intake
          </Link>
        </section>
      </div>
      </PageTransition>
    );
  }

  const chartParams = {
    ...params,
    town,
    timeZoneId,
    engineId,
    birthTimeAccuracy,
    birthTimeSource,
    birthTimeFallback,
  };

  /*
   * Signed in, or a gate.
   *
   * Checked after the parameters, so somebody arriving with a broken link is
   * told the link is broken rather than told to sign in and then told the link
   * is broken. /api/chart/advanced-story enforces the same rule on its own --
   * this is the part a visitor sees, not the part that holds.
   */
  const session = await sessionFromCookieStore(await cookies());
  if (!session) {
    /* Rebuilt from the parameters rather than read off the request, so the
       sign-in round trip returns to this exact chart. Only a path is sent, and
       the start route refuses anything that is not one. */
    const returnTo = `/insights/advanced?${new URLSearchParams(
      Object.entries({ ...chartParams, view: getSingle(rawParams.view) }).filter(
        ([, value]) => typeof value === "string" && value.length > 0,
      ) as [string, string][],
    ).toString()}`;

    return (
      <PageTransition>
        <div className="insights-shell below-navbar">
          <BackToReadingButton
            queryString={buildChartHistoryQuery(chartParams)}
            label="Back"
          />
          <section className="dashboard-shell advanced-gate">
            <p className="kicker">Members only</p>
            <h1>The advanced reading needs an account</h1>
            <p className="lead">
              This section writes a full reading of your chart -- the timing, the
              aspects, the harmonics and the strengths -- and keeps every table
              behind it. It is the most expensive thing the app does, so it is
              kept for people who have signed in.
            </p>
            <div className="advanced-gate-actions">
              <Link
                href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
                className="ghost-link advanced-gate-primary"
              >
                Sign in to continue
              </Link>
              <Link
                href={`/insights?${buildChartHistoryQuery(chartParams)}`}
                className="ghost-link"
              >
                Back to your reading
              </Link>
            </div>
          </section>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
    <div className="insights-shell below-navbar">
      <BackToReadingButton queryString={buildChartHistoryQuery(chartParams)} label="Back" />
      <AdvancedLoader chartParams={chartParams} focusView={focusView} />
    </div>
    </PageTransition>
  );
}
