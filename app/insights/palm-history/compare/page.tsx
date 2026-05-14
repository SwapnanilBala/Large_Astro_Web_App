import BackButton from "@/app/components/BackButton";
import PalmCompareClient from "./PalmCompareClient";

export const metadata = {
  title: "Compare Palm Readings — Lagna Atelier",
};

export default async function PalmComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  return (
    <main className="home-shell">
      <BackButton href="/insights/palm-history" />
      <PalmCompareClient ids={ids ?? ""} />
    </main>
  );
}
