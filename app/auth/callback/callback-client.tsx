"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import PageTransition from "@/app/components/PageTransition";
import { useAuth } from "@/lib/auth-context";
import { resolvePostAuthDestination } from "@/lib/post-auth-redirect";

type AuthCallbackClientProps = {
  nextPath?: string;
};

export default function AuthCallbackClient({ nextPath = "/" }: AuthCallbackClientProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoading || hasRedirected.current) return;

    if (!isAuthenticated) {
      const fallbackTimer = window.setTimeout(() => {
        if (hasRedirected.current) return;
        hasRedirected.current = true;
        router.replace("/");
      }, 2500);

      return () => window.clearTimeout(fallbackTimer);
    }

    hasRedirected.current = true;
    void resolvePostAuthDestination(user?.user_id, nextPath).then((destination) => {
      router.replace(destination);
    });
  }, [isAuthenticated, isLoading, nextPath, router, user?.user_id]);

  return (
    <PageTransition>
      <main className="home-shell">
        <div className="ambient ambient-left" />
        <div className="ambient ambient-right" />
        <section className="dashboard-shell" style={{ textAlign: "center" }}>
          <p className="kicker">Signing You In</p>
          <h1>Preparing your astrology workspace...</h1>
          <p className="lead">We are checking whether you already have a chart ready to continue.</p>
        </section>
      </main>
    </PageTransition>
  );
}
