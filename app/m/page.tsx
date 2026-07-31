import type { Metadata } from "next";
import MobileIntake from "./mobile-intake";

/* The desktop route is the canonical one; /m is the handset rendering of it. */
export const metadata: Metadata = {
  title: "Lagna Atelier",
  alternates: { canonical: "/" },
};

export default function MobileHomePage() {
  return <MobileIntake />;
}
