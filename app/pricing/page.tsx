import PricingPageClient from "./page-client";

type PricingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getSingle = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const params = await searchParams;
  return <PricingPageClient returnTo={getSingle(params.returnTo)} />;
}
