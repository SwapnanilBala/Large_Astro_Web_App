import LoginPageClient from "./page-client";
import { getDailySkyLine } from "./dailySky";
import { missingGoogleConfig } from "@/lib/identity/google-oauth";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getSingle = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const skyLine = await getDailySkyLine();

  /* Decided on the server so a deployment without Google credentials shows no
     button at all, rather than one that fails when pressed. The check reuses
     the same variable list the route reads, so the two cannot disagree. */
  const googleEnabled = missingGoogleConfig().length === 0;

  return (
    <LoginPageClient
      returnTo={getSingle(params.returnTo)}
      skyLine={skyLine}
      googleEnabled={googleEnabled}
      signInError={getSingle(params.error)}
    />
  );
}
