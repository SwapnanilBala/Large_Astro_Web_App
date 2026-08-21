import type { Metadata } from "next";
import { getDailySkyLine } from "@/app/(desktop)/login/dailySky";
import MobileLogin from "./mobile-login";

/* The desktop route is the canonical one; /m/login is the handset rendering. */
export const metadata: Metadata = {
  title: "Choose a profile · Lagna Atelier",
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
  return <MobileLogin returnTo={getSingle(params.returnTo)} skyLine={skyLine} />;
}
