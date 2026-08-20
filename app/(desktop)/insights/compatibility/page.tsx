import CompatibilityPageClient from "./page-client";

type CompatibilityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getSingle = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function CompatibilityPage({ searchParams }: CompatibilityPageProps) {
  const params = await searchParams;
  return (
    <CompatibilityPageClient
      initialSearchParams={Object.fromEntries(
        Object.entries(params).map(([key, value]) => [key, getSingle(value)])
      )}
    />
  );
}
