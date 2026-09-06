import Link from "next/link";
import AdvancedLoader from "./advanced-loader";
import BackButton from "@/app/components/BackButton";
import PageTransition from "@/app/components/PageTransition";
import { getAdvancedFocusView } from "./advanced-views";

export const maxDuration = 60;

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

  return (
    <PageTransition>
    <div className="insights-shell below-navbar">
      <BackButton href="/" />
      <AdvancedLoader chartParams={chartParams} focusView={focusView} />
    </div>
    </PageTransition>
  );
}
