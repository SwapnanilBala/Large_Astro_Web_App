import type { Metadata } from "next";
import { getDailySkyLine } from "@/app/(desktop)/login/dailySky";
import { missingGoogleConfig } from "@/lib/identity/google-oauth";
import MobileLogin from "./mobile-login";

/* The desktop route is the canonical one; /m/login is the handset rendering. */
export const metadata: Metadata = {
  title: "Your account · Lagna Atelier",
  alternates: { canonical: "/login" },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getSingle = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function MobileLoginPage({ searchParams }: Props) {
  const params = await searchParams;
  /* Shared with the desktop page rather than reimplemented — it is a pure
     server helper, so importing it across trees costs the client nothing. */
  const skyLine = await getDailySkyLine();

  /* Decided on the server so a deployment without Google credentials shows no
     button at all, rather than one that fails when pressed. Same check the
     desktop route makes, and the same one the start route reads. */
  const googleEnabled = missingGoogleConfig().length === 0;

  return (
    <MobileLogin
      returnTo={getSingle(params.returnTo)}
      skyLine={skyLine}
      googleEnabled={googleEnabled}
      signInError={getSingle(params.error)}
    />
  );
}
