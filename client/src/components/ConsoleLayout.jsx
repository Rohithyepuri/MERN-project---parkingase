import { useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarCheck,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDismiss } from '../lib/useDismiss';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { Avatar, cx } from './ui';

export const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/facilities', label: 'Facilities', icon: Building2 },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarCheck },
  { to: '/admin/users', label: 'Users & staff', icon: Users },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/audit', label: 'Audit logs', icon: ScrollText },
  { to: '/admin/moderation', label: 'Moderation', icon: ShieldCheck },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
];

function NavItems({ nav, onNavigate }) {
  return (
    <nav className="space-y-1 px-3" aria-label="Console">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive
                ? 'bg-brand-500/10 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                : 'text-ink/65 hover:bg-ink/[0.04] hover:text-ink dark:text-paper/60 dark:hover:bg-white/[0.04] dark:hover:text-paper'
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon size={17} className={isActive ? 'text-brand-600 dark:text-brand-300' : 'text-muted group-hover:text-ink/70 dark:group-hover:text-paper/70'} />
              <span className="flex-1">{item.label}</span>
              {isActive ? <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function UserBlock({ user, logout }) {
  return (
    <div className="border-t border-line p-3 dark:border-line-dark">
      <Link
        to="/dashboard"
        className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-paper dark:hover:bg-ink-850"
      >
        <Avatar name={user?.name} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user?.name}</span>
          <span className="block truncate text-[11px] uppercase tracking-wider text-muted">{user?.role}</span>
        </span>
      </Link>
      <div className="mt-1 flex items-center justify-between gap-1">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted transition hover:text-brand-700 dark:hover:text-brand-300"
        >
          <ArrowLeft size={13} /> Back to site
        </Link>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </div>
  );
}

export default function ConsoleLayout({ nav = ADMIN_NAV, workspace = 'Admin console' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, () => setMobileOpen(false), mobileOpen);

  return (
    <div className="min-h-screen bg-paper dark:bg-ink-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-white dark:border-line-dark dark:bg-ink-900 lg:flex">
        <div className="flex h-16 items-center border-b border-line px-5 dark:border-line-dark">
          <Logo />
        </div>
        <div className="px-5 pb-3 pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{workspace}</p>
          <p className="mt-1 font-display text-sm font-medium text-ink dark:text-paper">Operations</p>
        </div>
        <div className="flex-1 overflow-y-auto pb-4">
          <NavItems nav={nav} />
        </div>
        <UserBlock user={user} logout={() => { logout(); navigate('/'); }} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink-950/50"
            onClick={() => setMobileOpen(false)}
          />
          <div ref={ref} className="relative flex h-full w-72 flex-col border-r border-line bg-white animate-fade-up dark:border-line-dark dark:bg-ink-900">
            <div className="flex h-16 items-center justify-between border-b border-line px-4 dark:border-line-dark">
              <Logo />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-muted">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              <NavItems nav={nav} onNavigate={() => setMobileOpen(false)} />
            </div>
            <UserBlock user={user} logout={() => { logout(); navigate('/'); }} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur-md dark:border-line-dark dark:bg-ink-950/85 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-ink/70 lg:hidden dark:border-line-dark dark:bg-ink-850 dark:text-paper/70"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold">{workspace}</p>
              <p className="truncate text-[11px] text-muted">
                {user?.name} · {user?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <Link to="/profile" aria-label="Profile" className="hidden sm:block">
              <Avatar name={user?.name} size={34} />
            </Link>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
