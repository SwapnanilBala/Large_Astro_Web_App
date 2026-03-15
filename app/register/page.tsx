import RegisterPageClient from "./page-client";

type RegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getSingle = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  return <RegisterPageClient returnTo={getSingle(params.returnTo)} />;
}
