'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n-context';
import styles from './BottomNav.module.css';

const NAV_ITEMS = [
  { href: '/', labelKey: 'bottomNav.home', icon: '⊙' },
  { href: '/insights', labelKey: 'bottomNav.insights', icon: '✦' },
  { href: '/workspace', labelKey: 'bottomNav.saved', icon: '♡' },
  { href: '/pricing', labelKey: 'bottomNav.plans', icon: '◈' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      {NAV_ITEMS.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
          aria-current={pathname === item.href ? 'page' : undefined}
        >
          <span className={styles.icon}>{item.icon}</span>
          <span className={styles.label}>{t(item.labelKey)}</span>
        </Link>
      ))}
    </nav>
  );
}
