'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: '⊙' },
  { href: '/insights', label: 'Insights', icon: '✦' },
  { href: '/workspace', label: 'Saved', icon: '♡' },
  { href: '/pricing', label: 'Plans', icon: '◈' },
];

export default function BottomNav() {
  const pathname = usePathname();
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
          <span className={styles.label}>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
