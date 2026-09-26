import BackButton from "@/app/components/BackButton";
import PalmReadingDetailClient from "./PalmReadingDetailClient";

export const metadata = {
  title: "Palm reading",
};

export default async function PalmReadingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="home-shell palm-page">
      <BackButton href="/insights/palm-history" />
      <PalmReadingDetailClient id={id} />
    </div>
  );
}
