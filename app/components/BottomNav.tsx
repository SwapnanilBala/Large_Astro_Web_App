'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, CalendarDays, House, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n-context';
import { listSavedCharts } from '@/lib/workspace-store';
import styles from './BottomNav.module.css';

const NAV_ITEMS = [
  { href: '/', labelKey: 'bottomNav.home', Icon: House },
  { href: '/insights', labelKey: 'bottomNav.insights', Icon: Sparkles },
  { href: '/workspace', labelKey: 'bottomNav.saved', Icon: Bookmark },
  { href: '/calendar', labelKey: 'bottomNav.calendar', Icon: CalendarDays },
];

type StoredChartHistoryEntry = {
  queryString?: unknown;
  savedAt?: unknown;
};

function insightsUrl(queryString: unknown) {
  if (typeof queryString !== 'string') return null;
  const query = queryString.trim().replace(/^\?/, '');
  return query ? `/insights?${query}` : null;
}

function latestLocalChartUrl() {
  try {
    const raw = window.localStorage.getItem('astro_chart_history');
    if (!raw) return null;

    const entries = JSON.parse(raw) as StoredChartHistoryEntry[];
    if (!Array.isArray(entries)) return null;

    const latest = [...entries].sort((left, right) => {
      const leftTime = typeof left.savedAt === 'string' ? Date.parse(left.savedAt) : 0;
      const rightTime = typeof right.savedAt === 'string' ? Date.parse(right.savedAt) : 0;
      return rightTime - leftTime;
    })[0];

    return insightsUrl(latest?.queryString);
  } catch {
    return null;
  }
}

export default function BottomNav() {
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();
  const [lastChartUrl, setLastChartUrl] = useState<string | null>(null);
  const isHidden = ["/login", "/register", "/auth", "/engine-select"].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  useEffect(() => {
    document.documentElement.toggleAttribute("data-bottom-nav-hidden", isHidden);
    return () => {
      document.documentElement.removeAttribute("data-bottom-nav-hidden");
    };
  }, [isHidden]);

  useEffect(() => {
    let cancelled = false;

    const resolveLatestChart = async () => {
      const localUrl = latestLocalChartUrl();
      if (!cancelled) {
        setLastChartUrl(localUrl);
      }

      if (localUrl || !isAuthenticated || !user) return;

      try {
        const savedCharts = await listSavedCharts(user.user_id);
        if (!cancelled) {
          setLastChartUrl(
            latestLocalChartUrl() ?? insightsUrl(savedCharts[0]?.query_string)
          );
        }
      } catch {
        /* Keep the local fallback when the account workspace is unavailable. */
      }
    };

    void resolveLatestChart();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'astro_chart_history') {
        setLastChartUrl(latestLocalChartUrl());
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
    };
  }, [isAuthenticated, pathname, user]);

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
