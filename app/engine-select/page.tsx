import Link from "next/link";
import BackButton from "@/app/components/BackButton";
import EngineSelectClient from "@/app/engine-select/engine-select-client";
import styles from "./engine-select.module.css";

export const maxDuration = 60;

type EngineSelectPageProps = {
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
  "city",
] as const;

const getSingle = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function EngineSelectPage({
  searchParams,
}: EngineSelectPageProps) {
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
    city: getSingle(rawParams.city),
  };

  const town = getSingle(rawParams.town);
  const timeZoneId = getSingle(rawParams.timeZoneId);
  const defaultEngineId = getSingle(rawParams.engineId) || "lahiri_classic";

  const hasAllInputs = requiredParams.every(
    (param) => params[param].trim().length > 0
  );

  if (!hasAllInputs) {
    return (
      <div className={styles.shell}>
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
    );
  }

  /* Build the query string that will be forwarded to /insights */
  const forwardParams: Record<string, string> = { ...params };
  if (town) forwardParams.town = town;
  if (timeZoneId) forwardParams.timeZoneId = timeZoneId;

  return (
    <div className={styles.shell}>
      <BackButton href="/" />
      <EngineSelectClient
        profileParams={forwardParams}
        defaultEngineId={defaultEngineId}
      />
    </div>
  );
}
