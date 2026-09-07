import type { ReactNode } from "react";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import styles from "./detail-page-shell.module.css";

/*
 * The frame every "opened from the results page" page sits in.
 *
 * Background, back button top and bottom, centred hero. The body is whatever
 * the page is actually for. Server component on purpose: none of this needs
 * state, so a page whose body is static stays static.
 */

type DetailPageShellProps = {
  /** Where "Back to your reading" goes, anchor included. */
  backHref: string;
  kicker: string;
  title: ReactNode;
  lead: ReactNode;
  icon: ReactNode;
  children: ReactNode;
};

export default function DetailPageShell({
  backHref,
  kicker,
  title,
  lead,
  icon,
  children,
}: DetailPageShellProps) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href={backHref} className={styles.backButton}>
          <FiArrowLeft aria-hidden="true" />
          Back to your reading
        </Link>

        <header className={styles.hero}>
          <div className={styles.heroIcon} aria-hidden="true">
            {icon}
          </div>
          <p className={styles.kicker}>{kicker}</p>
          <h1>{title}</h1>
          <p className={styles.lead}>{lead}</p>
        </header>

        {children}

        <Link href={backHref} className={styles.backButtonBottom}>
          <FiArrowLeft aria-hidden="true" />
          Back to your reading
        </Link>
      </div>
    </main>
  );
}
