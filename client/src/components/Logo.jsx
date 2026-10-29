import { Link } from 'react-router-dom';
import { cx } from './ui';

export function Logo({ compact = false, className, to = '/' }) {
  return (
    <Link to={to} className={cx('group inline-flex items-center gap-2.5', className)} aria-label="ParkEase home">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-ink-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] dark:bg-brand-500">
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
          <path
            d="M8 19V5h5.2a4.4 4.4 0 0 1 0 8.8H10"
            fill="none"
            stroke="#F7F8F5"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="17.6" cy="17.6" r="1.6" fill="#D97706" />
        </svg>
      </span>
      {!compact ? (
        <span className="font-display text-lg font-semibold tracking-tight text-ink dark:text-paper">
          Park<span className="text-brand-600 dark:text-brand-300">Ease</span>
        </span>
      ) : null}
    </Link>
  );
}
