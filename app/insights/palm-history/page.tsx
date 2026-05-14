import BackButton from "@/app/components/BackButton";
import PalmHistoryClient from "./PalmHistoryClient";

export const metadata = {
  title: "Your Palm Readings — Lagna Atelier",
};

export default function PalmHistoryPage() {
  return (
    <main className="home-shell">
      <BackButton href="/insights/advanced" />
      <PalmHistoryClient />
    </main>
  );
}
