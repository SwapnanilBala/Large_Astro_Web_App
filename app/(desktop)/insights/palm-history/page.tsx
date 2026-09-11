import { Suspense } from "react";

import BackToReadingButton from "@/app/components/BackToReadingButton";
import PalmHistoryClient from "./PalmHistoryClient";

export const metadata = {
  title: "Your Palm Readings — Lagna Atelier",
};

/**
 * The archive is a static route, and PalmHistoryClient reads `compareWith`
 * through useSearchParams — which suspends during the prerender. Without a
 * boundary here that suspension escapes to the /insights loading.tsx, and the
 * shell it renders is the whole dashboard skeleton: the wrong fallback, and
 * one whose boundary the client never resolves, so the archive stays behind a
 * "Calculating your birth chart…" that has nothing to do with this page.
 */
export default function PalmHistoryPage() {
  return (
    <div className="home-shell">
      <BackToReadingButton path="/insights/advanced" label="Back to advanced" />
      <Suspense fallback={null}>
        <PalmHistoryClient />
      </Suspense>
    </div>
  );
}
