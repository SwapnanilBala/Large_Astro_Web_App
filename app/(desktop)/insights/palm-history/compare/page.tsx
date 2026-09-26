import BackButton from "@/app/components/BackButton";
import PalmCompareClient from "./PalmCompareClient";

export const metadata = {
  title: "Compare palm readings",
};

export default async function PalmComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  return (
    <div className="home-shell palm-page">
      <BackButton href="/insights/palm-history" />
      <PalmCompareClient ids={ids ?? ""} />
    </div>
  );
}
