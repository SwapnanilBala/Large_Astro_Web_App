"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

interface BackButtonProps {
  /** Explicit href to navigate to. If omitted, uses router.back() */
  href?: string;
  /** Button label. Defaults to "Back" */
  label?: string;
}

export default function BackButton({ href, label = "Back" }: BackButtonProps) {
  const router = useRouter();

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
