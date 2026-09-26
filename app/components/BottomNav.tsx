'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Sparkles } from 'lucide-react';
import { useTranslation } from '@/lib/i18n-context';
import { useLatestChartQuery } from '@/lib/use-latest-chart-query';
import styles from './BottomNav.module.css';

const NAV_ITEMS = [
  { href: '/', labelKey: 'bottomNav.home', Icon: House },
  { href: '/insights', labelKey: 'bottomNav.insights', Icon: Sparkles },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const lastChartQuery = useLatestChartQuery();
  const lastChartUrl = lastChartQuery ? `/insights?${lastChartQuery}` : null;
  const isHidden = ["/login", "/engine-select"].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  useEffect(() => {
    document.documentElement.toggleAttribute("data-bottom-nav-hidden", isHidden);
    return () => {
      document.documentElement.removeAttribute("data-bottom-nav-hidden");
    };
  }, [isHidden]);

  if (isHidden) return null;

  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      {NAV_ITEMS.map(item => {
        const isActive = item.href === '/'
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const href = item.href === '/insights' && lastChartUrl
          ? lastChartUrl
          : item.href;
        const Icon = item.Icon;

        return (
          <Link
            key={item.href}
            href={href}
            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className={styles.icon} aria-hidden="true" strokeWidth={1.8} />
            <span className={styles.label}>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
