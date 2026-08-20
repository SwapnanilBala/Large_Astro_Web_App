import LoginPageClient from "./page-client";
import { getDailySkyLine } from "./dailySky";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getSingle = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const skyLine = await getDailySkyLine();
  return <LoginPageClient returnTo={getSingle(params.returnTo)} skyLine={skyLine} />;
}
