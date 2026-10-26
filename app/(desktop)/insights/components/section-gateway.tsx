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
  /** Help for the section's terms, on the eyebrow's line: inside the card, so it cannot push one card's heading below its neighbour's. */
  help?: ReactNode;
  /** A second destination beside the main one, after it: the reading's doorway opens both every finding and the yogas. */
  secondary?: { href: string; label: string };
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
  help,
  secondary,
}: SectionGatewayProps) {
  return (
    <div className={styles.gateway} data-variant={variant}>
      <header className={styles.copy}>
        <div className={styles.eyebrowRow}>
          <p className={styles.eyebrow}>
            <span className={styles.icon} aria-hidden="true">{icon}</span>
            {eyebrow}
          </p>
          {help && <div className={styles.help}>{help}</div>}
        </div>
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
        <div className={styles.links}>
          <Link href={href} className={styles.openLink} prefetch={false}>
            {ctaLabel}
            <ArrowUpRight aria-hidden="true" />
          </Link>
          {secondary && (
            <Link href={secondary.href} className={styles.openLink} prefetch={false}>
              {secondary.label}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      <div className={styles.preview}>{children}</div>
    </div>
  );
}
