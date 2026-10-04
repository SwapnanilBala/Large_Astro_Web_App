"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n-context";

interface BackButtonProps {
  /** Explicit href to navigate to. If omitted, uses router.back() */
  href?: string;
  /** Button label, already in the visitor's language. Defaults to "Back" in it. */
  label?: string;
}

export default function BackButton({ href, label: givenLabel }: BackButtonProps) {
  const router = useRouter();
  const { t } = useTranslation();
  /* Looked up here rather than defaulted in the signature: most callers are
     server pages, which have no translator to pass one in with. */
  const label = givenLabel ?? t("home.back");

  if (href) {
    return (
      <Link href={href} className="back-btn">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <button type="button" className="back-btn" onClick={() => router.back()}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
