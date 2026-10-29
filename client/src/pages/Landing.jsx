import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Gauge,
  KeyRound,
  LayoutDashboard,
  MapPin,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Timer,
  Wallet,
} from 'lucide-react';
import { api } from '../api/client';
import MapView from '../components/MapView';
import { Badge, Button, Skeleton } from '../components/ui';
import FacilityCard from '../components/FacilityCard';
import { currency } from '../lib/format';

const FEATURES = [
  {
    icon: KeyRound,
    title: 'Reservations that hold',
    body: 'Every bay is locked in 30-minute buckets with a unique database index, so two drivers can never win the same slot.',
  },
  {
    icon: QrCode,
    title: 'Signed digital passes',
    body: 'Tickets carry an HMAC signature and no personal data. Forged or reused passes are rejected at the gate.',
  },
  {
    icon: Wallet,
    title: 'Transparent money',
    body: 'Itemised quotes, server-side pricing snapshots, tiered refunds and a receipt for every rupee.',
  },
  {
    icon: ScanLine,
    title: 'A gate console that works',
    body: 'Staff scan a pass, record entry, and bill overstays beyond a configurable grace period in one screen.',
  },
  {
    icon: Gauge,
    title: 'Operations, measured',
    body: 'Live occupancy, utilisation, revenue, cancellations and CSV exports built from real database records.',
  },
  {
    icon: ShieldCheck,
    title: 'Guarded by design',
    body: 'Role-based access on the server, audit trails for admin actions and rate limits on authentication.',
  },
];

const STEPS = [
  {
    icon: MapPin,
    title: 'Find a bay',
    body: 'Search by area, compare live availability and pick the exact bay on the floor plan.',
  },
  {
    icon: CreditCard,
    title: 'Reserve & pay',
    body: 'See the full price before you commit. Pay in demo or Razorpay test mode — the slot is held while you do.',
  },
  {
    icon: CalendarClock,
    title: 'Drive in',
    body: 'Show your signed pass at the gate. Staff scan it once, your session starts, and exit billing is automatic.',
  },
];

export default function Landing() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { hash } = useLocation();

  useEffect(() => {
    let cancelled = false;
    api('/api/facilities?sort=availability')
      .then((data) => {
        if (!cancelled) setFacilities(data.facilities || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hash === '#how') {
      const element = document.getElementById('how');
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [hash]);

  const totals = useMemo(() => {
    const bays = facilities.reduce((sum, facility) => sum + (facility.totalSlots || 0), 0);
    const free = facilities.reduce((sum, facility) => sum + (facility.availableSlots || 0), 0);
    const prices = facilities.map((facility) => facility.minPrice).filter((value) => value != null);
    return {
      bays,
      free,
      from: prices.length ? Math.min(...prices) : null,
    };
  }, [facilities]);

  const featured = facilities.slice(0, 3);

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-500/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-32 top-40 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.15]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(24,33,27,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(24,33,27,0.05) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse at 50% 0%, black 40%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 40%, transparent 75%)',
          }}
          aria-hidden
        />

        <div className="page relative grid items-center gap-12 pb-16 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-20">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/[0.07] px-3 py-1.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
              <Sparkles size={13} /> Smart parking for campuses & city blocks
            </p>
            <h1 className="mt-5 font-display text-[42px] font-semibold leading-[1.04] tracking-[-0.03em] text-ink dark:text-paper sm:text-6xl">
              Find your space.
              <br />
              Book with confidence.
              <br />
              <span className="relative inline-block">
                <span className="relative z-10 text-brand-600 dark:text-brand-300">Park with ease.</span>
                <span className="absolute inset-x-0 bottom-1.5 z-0 h-3 rounded bg-amber-400/25 -rotate-1" aria-hidden />
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              ParkEase turns a frantic search into a reserved bay, a signed entry pass and a fair bill. Live availability,
              honest pricing and a gate console your staff will actually use.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/facilities">
                <Button size="lg" iconRight={ArrowRight}>
                  Find parking
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="secondary">
                  Create an account
                </Button>
              </Link>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6 dark:border-line-dark">
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-muted">Facilities</dt>
                <dd className="mt-1 font-display text-2xl font-semibold">{loading ? '—' : facilities.length}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-muted">Bays managed</dt>
                <dd className="mt-1 font-display text-2xl font-semibold">
                  {loading ? '—' : totals.bays || '—'}
                  <span className="ml-1 align-middle text-xs font-normal text-muted">
                    {!loading && totals.free ? `${totals.free} free now` : ''}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-muted">Starting at</dt>
                <dd className="mt-1 font-display text-2xl font-semibold">
                  {loading || totals.from == null ? '—' : currency(totals.from)}
                  <span className="ml-1 align-middle text-xs font-normal text-muted">/h</span>
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-brand-600" /> No double bookings
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-brand-600" /> Signed QR passes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-brand-600" /> Test-mode payments
              </span>
            </div>
          </div>

          <div className="relative animate-fade-up">
            <div className="surface relative overflow-hidden p-2 shadow-[0_30px_80px_-40px_rgba(9,13,10,0.5)]">
              {loading ? (
                <Skeleton className="h-[380px] w-full rounded-xl" />
              ) : (
                <MapView facilities={facilities} className="h-[380px] rounded-xl border-0" zoom={12} showAttribution={false} />
              )}
              <div className="pointer-events-none absolute inset-x-2 bottom-2 h-20 rounded-b-xl bg-gradient-to-t from-ink-950/25 to-transparent" />
            </div>

            {!loading && facilities.length ? (
              <div className="surface absolute -bottom-8 left-4 right-4 z-[450] p-4 shadow-xl sm:left-6 sm:right-auto sm:w-[290px]">
                <div className="flex items-center justify-between">
                  <Badge tone="emerald" dot>
                    Live now
                  </Badge>
                  <span className="font-mono text-[10px] text-muted">{facilities[0].city}</span>
                </div>
                <p className="mt-2 truncate font-display text-sm font-semibold">{facilities[0].name}</p>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-muted">
                    {facilities[0].availableSlots} of {facilities[0].totalSlots} bays free
                  </span>
                  <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">
                    {currency(facilities[0].minPrice)}/h
                  </span>
                </div>
                <Link
                  to={`/facilities/${facilities[0].id}`}
                  className="mt-3 flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-xs font-medium text-brand-700 transition hover:bg-brand-500/10 dark:bg-ink-850 dark:text-brand-300"
                >
                  Reserve a bay <ChevronRight size={14} />
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="page pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">Nearby</p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">Parking that is ready when you are</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Real inventory from the database — each card reflects bays free in the next hour.
            </p>
          </div>
          <Link to="/facilities" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            Explore all facilities <ArrowRight size={15} />
          </Link>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="surface overflow-hidden">
                  <Skeleton className="h-36 w-full rounded-none" />
                  <div className="space-y-3 p-5">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>
              ))
            : featured.map((facility, index) => <FacilityCard key={facility.id} facility={facility} index={index} />)}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
            {error} — make sure the API is running.
          </p>
        ) : null}
      </section>

      <section className="page mt-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="surface p-6 transition hover:-translate-y-1 hover:shadow-lift">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                <feature.icon size={19} />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="page mt-20 scroll-mt-24">
        <div className="surface overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-line p-8 dark:border-line-dark lg:border-b-0 lg:border-r lg:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">How it works</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">Three steps between you and a clear bay</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                The whole loop is implemented on the server — reservations, payments, passes and billing. Nothing here is a
                decorative mock-up.
              </p>
              <div className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
                  <Timer size={14} /> 10-minute checkout hold
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800/80 dark:text-amber-200/70">
                  Abandoned checkouts release themselves, so inventory never gets stuck behind an unpaid reservation.
                </p>
              </div>
            </div>
            <div className="divide-y divide-line dark:divide-line-dark">
              {STEPS.map((step, index) => (
                <div key={step.title} className="flex gap-5 p-6 sm:p-8">
                  <div className="flex flex-col items-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-950 font-mono text-xs font-semibold text-brand-300 dark:bg-brand-500 dark:text-ink-950">
                      0{index + 1}
                    </span>
                    {index < STEPS.length - 1 ? <span className="mt-2 w-px flex-1 bg-line dark:bg-line-dark" /> : null}
                  </div>
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                      <step.icon size={16} className="text-brand-600 dark:text-brand-300" /> {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="page mt-20">
        <div className="relative overflow-hidden rounded-4xl bg-ink-950 p-8 text-paper sm:p-12">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-600/25 blur-3xl" aria-hidden />
          <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" aria-hidden />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-brand-300">
                <LayoutDashboard size={12} /> For operators
              </p>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Run the lot, not the spreadsheet
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
                A gate console for staff and a full admin workspace: facilities, floors, zones, bays, pricing, refunds,
                audit logs and CSV reports — all backed by real records.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/login">
                  <Button size="md" iconRight={ArrowRight}>
                    Open a console
                  </Button>
                </Link>
                <Link to="/facilities">
                  <Button size="md" variant="secondary" className="border-white/15 bg-white/5 text-white hover:border-brand-400 hover:bg-white/10 hover:text-white">
                    Browse as a driver
                  </Button>
                </Link>
              </div>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
                admin@parkease.dev · staff@parkease.dev
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <p className="text-xs font-medium text-white/80">Gate console · live</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/20 px-2 py-0.5 text-[10px] font-semibold text-brand-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Connected
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ['Active', '12'],
                  ['Arrivals', '28'],
                  ['Overstay', '2'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-ink-900 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
                    <p className="mt-1 font-display text-xl font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {[
                  ['KA-01-MJ-4821', 'GA-014', 'Inside · 42 min'],
                  ['KA-05-EV-2210', 'GE-003', 'Inside · 1 h 12 min'],
                  ['KA-02-AB-7788', 'GB-021', 'Checkout ready'],
                ].map(([plate, slot, meta]) => (
                  <div key={plate} className="flex items-center justify-between rounded-lg border border-white/5 bg-ink-900 px-3 py-2">
                    <span className="font-mono text-[11px] text-white/80">{plate}</span>
                    <span className="font-mono text-[10px] text-brand-300">{slot}</span>
                    <span className="text-[10px] text-white/40">{meta}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-[10px] text-white/30">Illustrative snapshot · live data inside the console</p>
            </div>
          </div>
        </div>
      </section>

      <section className="page mt-20">
        <div className="surface flex flex-col items-center justify-between gap-5 p-8 text-center sm:flex-row sm:text-left">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Your next bay is already waiting</h2>
            <p className="mt-1 text-sm text-muted">Create an account, reserve a slot and carry your pass on your phone.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/register">
              <Button size="lg">Get started free</Button>
            </Link>
            <Link to="/facilities">
              <Button size="lg" variant="secondary">
                Browse parking
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
