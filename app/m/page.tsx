import type { Metadata } from "next";
import MobileIntake from "./mobile-intake";

/* The desktop route is the canonical one; /m is the handset rendering of it. */
export const metadata: Metadata = {
  /* No title: the root default is the home page's, and a plain "Lagna Atelier"
     would come back from the template as "Lagna Atelier · Lagna Atelier". */
  alternates: { canonical: "/" },
};

export default function MobileHomePage() {
  return <MobileIntake />;
}
