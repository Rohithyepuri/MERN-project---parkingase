import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarCheck,
  CheckCheck,
  Clock3,
  CreditCard,
  ParkingSquare,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { relative } from '../lib/format';
import { useDismiss } from '../lib/useDismiss';
import { cx, EmptyState, Spinner } from './ui';

const ICONS = {
  booking: CalendarCheck,
  payment: CreditCard,
  refund: Undo2,
  reminder: Clock3,
  session: ParkingSquare,
  system: ShieldCheck,
};

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, () => setOpen(false), open);

  const load = useCallback(async (silent = true) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const data = await api('/api/notifications?limit=12');
      setItems(data.notifications);
      setUnread(data.unreadCount);
    } catch {
      /* notifications are non-critical */
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return undefined;
    const timer = setInterval(() => load(), 90_000);
    return () => clearInterval(timer);
  }, [load, user]);

  useEffect(() => {
    if (open) load(false);
  }, [open, load]);

  const markAll = async () => {
    try {
      await api('/api/notifications/read-all', { method: 'POST' });
      setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  };

  const openItem = async (item) => {
    setOpen(false);
    if (!item.readAt) {
      setUnread((count) => Math.max(0, count - 1));
      api(`/api/notifications/${item.id}/read`, { method: 'PATCH' }).catch(() => {});
    }
    if (item.link) navigate(item.link);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-ink/70 transition hover:border-brand-400 hover:text-brand-700 dark:border-line-dark dark:bg-ink-850 dark:text-paper/70 dark:hover:border-brand-500 dark:hover:text-brand-300"
      >
        <Bell size={16} />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 font-mono text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[340px] overflow-hidden rounded-2xl border border-line bg-white shadow-2xl animate-fade-up dark:border-line-dark dark:bg-ink-900">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 dark:border-line-dark">
            <p className="font-display text-sm font-semibold">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                compact
                icon={Bell}
                title="No notifications yet"
                description="Booking updates and payment receipts will appear here."
              />
            ) : (
              items.map((item) => {
                const Icon = ICONS[item.type] || Bell;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    className={cx(
                      'flex w-full items-start gap-3 border-b border-line/70 px-4 py-3 text-left transition last:border-0 hover:bg-paper dark:border-line-dark/70 dark:hover:bg-ink-850',
                      !item.readAt && 'bg-brand-500/[0.04]'
                    )}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-700 dark:text-brand-300">
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={cx('text-[13px]', item.readAt ? 'font-medium text-ink/80 dark:text-paper/75' : 'font-semibold text-ink dark:text-paper')}>
                          {item.title}
                        </span>
                        {!item.readAt ? <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /> : null}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-muted">{item.body}</span>
                      <span className="mt-1 block font-mono text-[10px] text-muted/80">{relative(item.createdAt)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
