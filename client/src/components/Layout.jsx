import { useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  BriefcaseBusiness,
  CalendarCheck,
  Car,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDismiss } from '../lib/useDismiss';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { Avatar, Button, cx } from './ui';

const publicNav = [
  { to: '/facilities', label: 'Find parking' },
  { to: '/#how', label: 'How it works' },
];

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, () => setOpen(false), open);

  if (!user) return null;

  const items = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/bookings', label: 'My bookings', icon: CalendarCheck },
    { to: '/vehicles', label: 'My vehicles', icon: Car },
    { to: '/payments', label: 'Payments', icon: CreditCard },
    { to: '/profile', label: 'Profile', icon: User },
  ];
  if (user.role === 'staff' || user.role === 'admin') {
    items.push({ to: '/staff', label: 'Staff console', icon: BriefcaseBusiness });
  }
  if (user.role === 'admin') {
    items.push({ to: '/admin', label: 'Admin console', icon: ShieldCheck });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-xl border border-line bg-white py-1 pl-1 pr-2.5 transition hover:border-brand-400 dark:border-line-dark dark:bg-ink-850 dark:hover:border-brand-500"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={user.name} size={30} />
        <span className="hidden max-w-[110px] truncate text-sm font-medium sm:block">{user.name.split(' ')[0]}</span>
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-white shadow-2xl animate-fade-up dark:border-line-dark dark:bg-ink-900"
        >
          <div className="border-b border-line px-4 py-3 dark:border-line-dark">
            <p className="truncate font-display text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <div className="p-1.5">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink/80 transition hover:bg-paper hover:text-ink dark:text-paper/75 dark:hover:bg-ink-850 dark:hover:text-paper"
              >
                <item.icon size={15} /> {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-line p-1.5 dark:border-line-dark">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[999] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md dark:border-line-dark dark:bg-ink-950/80">
        <div className="page flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-7">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
              {publicNav.map((item) =>
                item.to.includes('#') ? (
                  <a
                    key={item.to}
                    href={item.to}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-ink/70 transition hover:bg-ink/5 hover:text-ink dark:text-paper/70 dark:hover:bg-white/5 dark:hover:text-paper"
                  >
                    {item.label}
                  </a>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cx(
                        'rounded-lg px-3 py-2 text-sm font-medium transition',
                        isActive
                          ? 'bg-brand-500/10 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                          : 'text-ink/70 hover:bg-ink/5 hover:text-ink dark:text-paper/70 dark:hover:bg-white/5 dark:hover:text-paper'
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                )
              )}
              {user?.role === 'admin' ? (
                <NavLink
                  to="/admin"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink/70 transition hover:bg-ink/5 hover:text-ink dark:text-paper/70 dark:hover:bg-white/5"
                >
                  Console
                </NavLink>
              ) : null}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            {user ? (
              <div className="hidden sm:block">
                <UserMenu />
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Get started</Button>
                </Link>
              </div>
            )}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-ink/70 md:hidden dark:border-line-dark dark:bg-ink-850 dark:text-paper/70"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-line bg-white px-4 pb-5 pt-3 md:hidden dark:border-line-dark dark:bg-ink-900">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-paper dark:hover:bg-ink-850"
              >
                Home
              </Link>
              {publicNav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-paper dark:hover:bg-ink-850"
                >
                  {item.label}
                </Link>
              ))}
              {user ? (
                <>
                  <div className="my-2 flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 dark:border-line-dark">
                    <Avatar name={user.name} size={34} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{user.name}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                    </div>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-paper dark:hover:bg-ink-850"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/bookings"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-paper dark:hover:bg-ink-850"
                  >
                    My bookings
                  </Link>
                  {user.role === 'admin' ? (
                    <Link
                      to="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-paper dark:hover:bg-ink-850"
                    >
                      Admin console
                    </Link>
                  ) : null}
                  {user.role === 'staff' || user.role === 'admin' ? (
                    <Link
                      to="/staff"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-paper dark:hover:bg-ink-850"
                    >
                      Staff console
                    </Link>
                  ) : null}
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-paper dark:hover:bg-ink-850"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                    className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Link to="/login" className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button variant="secondary" className="w-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/register" className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full">Get started</Button>
                  </Link>
                </div>
              )}
            </nav>
          </div>
        ) : null}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-line bg-white dark:border-line-dark dark:bg-ink-900">
        <div className="page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              Find your space. Book with confidence. Park with ease — reservations, digital passes and live facility
              operations in one platform.
            </p>
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              Demo environment · payments run in test mode
            </p>
          </div>
          <div>
            <p className="font-display text-sm font-semibold">Explore</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                <Link className="transition hover:text-brand-700 dark:hover:text-brand-300" to="/facilities">
                  Find parking
                </Link>
              </li>
              <li>
                <a className="transition hover:text-brand-700 dark:hover:text-brand-300" href="/#how">
                  How it works
                </a>
              </li>
              <li>
                <Link className="transition hover:text-brand-700 dark:hover:text-brand-300" to="/register">
                  Create an account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-display text-sm font-semibold">Your account</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                <Link className="transition hover:text-brand-700 dark:hover:text-brand-300" to="/dashboard">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-brand-700 dark:hover:text-brand-300" to="/bookings">
                  My bookings
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-brand-700 dark:hover:text-brand-300" to="/payments">
                  Payments & receipts
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-display text-sm font-semibold">Operations</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                <Link className="transition hover:text-brand-700 dark:hover:text-brand-300" to="/staff">
                  Staff console
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-brand-700 dark:hover:text-brand-300" to="/admin">
                  Admin console
                </Link>
              </li>
              <li>
                <a className="transition hover:text-brand-700 dark:hover:text-brand-300" href="/api/health">
                  API health
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line py-5 dark:border-line-dark">
          <div className="page flex flex-col items-center justify-between gap-2 text-xs text-muted sm:flex-row">
            <p>© {new Date().getFullYear()} ParkEase. All rights reserved.</p>
            <p className="font-mono">Emerald · Amber · Charcoal</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
