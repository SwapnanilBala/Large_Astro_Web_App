'use client';
import { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n-context';
import styles from './BottomNav.module.css';

const NAV_ITEMS = [
  { href: '/', labelKey: 'bottomNav.home', icon: '\u2299' },
  { href: '/insights', labelKey: 'bottomNav.insights', icon: '\u2726' },
  { href: '/workspace', labelKey: 'bottomNav.saved', icon: '\u2661' },
  { href: '/calendar', labelKey: 'bottomNav.calendar', icon: '\u25C8' },
];

/** Minimum horizontal swipe distance (px) to trigger navigation */
const SWIPE_THRESHOLD = 60;
/** Maximum vertical drift allowed during a horizontal swipe */
const SWIPE_VERTICAL_LIMIT = 80;

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const currentIndex = NAV_ITEMS.findIndex(item => item.href === pathname);

  const navigateBySwipe = useCallback((direction: 'left' | 'right') => {
    if (currentIndex === -1) return;
    const nextIndex = direction === 'left'
      ? Math.min(currentIndex + 1, NAV_ITEMS.length - 1)
      : Math.max(currentIndex - 1, 0);
    if (nextIndex !== currentIndex) {
      // Trigger haptic feedback if available
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(8);
      }
      router.push(NAV_ITEMS[nextIndex].href);
    }
  }, [currentIndex, router]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const elapsed = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;

      // Must be fast enough (<500ms), horizontal enough, and long enough
      if (elapsed > 500) return;
      if (Math.abs(dy) > SWIPE_VERTICAL_LIMIT) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;

      navigateBySwipe(dx < 0 ? 'left' : 'right');
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [navigateBySwipe]);

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
