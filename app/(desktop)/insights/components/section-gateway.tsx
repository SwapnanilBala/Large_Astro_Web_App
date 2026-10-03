import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import styles from "./section-gateway.module.css";

/* Shared typography and navigation; each section supplies its own chart preview. */

type SectionGatewayProps = {
  href: string;
  icon: ReactNode;
  eyebrow: string;
  variant: "timing" | "atlas" | "reading";
  heading: string;
  blurb: string;
  children: ReactNode;
  /** Small print beside the call to action. */
  footnote?: string;
  ctaLabel: string;
};

export default function SectionGateway({
  href,
  icon,
  eyebrow,
  variant,
  heading,
  blurb,
  children,
  footnote,
  ctaLabel,
}: SectionGatewayProps) {
  return (
    <div className={styles.gateway} data-variant={variant}>
      <header className={styles.copy}>
        <p className={styles.eyebrow}>
          <span className={styles.icon} aria-hidden="true">{icon}</span>
          {eyebrow}
        </p>
        <h3>{heading}</h3>
        <p className={styles.blurb}>{blurb}</p>
      </header>

      <div className={styles.footer}>
        {footnote ? (
          <p>
            {footnote}
          </p>
        ) : (
          <span />
        )}
        <Link href={href} className={styles.openLink} prefetch={false}>
          {ctaLabel}
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>

      <div className={styles.preview}>{children}</div>
    </div>
  );
}
