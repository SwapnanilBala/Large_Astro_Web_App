import AuthCallbackClient from "./callback-client";

type AuthCallbackPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getSingle = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function AuthCallbackPage({ searchParams }: AuthCallbackPageProps) {
  const params = await searchParams;
  return <AuthCallbackClient nextPath={getSingle(params.next)} />;
}
