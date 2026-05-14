import BackButton from "@/app/components/BackButton";
import PalmReadingDetailClient from "./PalmReadingDetailClient";

export const metadata = {
  title: "Palm Reading — Lagna Atelier",
};

export default async function PalmReadingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="home-shell">
      <BackButton href="/insights/palm-history" />
      <PalmReadingDetailClient id={id} />
    </main>
  );
}
