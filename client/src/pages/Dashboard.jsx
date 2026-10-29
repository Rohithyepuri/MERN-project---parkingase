import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  Car,
  CreditCard,
  Heart,
  MapPinned,
  Plus,
  Search,
  Ticket,
  Wallet,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import BookingCard from '../components/BookingCard';
import TicketModal from '../components/TicketModal';
import { Badge, Button, ErrorState, SectionHeading, Skeleton, StatCard } from '../components/ui';
import { currency, dateTime, timeOnly } from '../lib/format';

export default function Dashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [payments, setPayments] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [bookingData, vehicleData, paymentData, facilityData] = await Promise.all([
        api('/api/bookings/mine?limit=12'),
        api('/api/vehicles'),
        api('/api/payments/mine'),
        api('/api/facilities?sort=recommended'),
      ]);
      setBookings(bookingData.bookings || []);
      setVehicles(vehicleData.vehicles || []);
      setPayments(paymentData.payments || []);
      const favIds = new Set((user?.favorites || []).map(String));
      setFavorites((facilityData.facilities || []).filter((facility) => favIds.has(String(facility.id))));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.favorites]);

  useEffect(() => {
    load();
  }, [load]);

  const openTicket = async (booking) => {
    try {
      const data = await api(`/api/bookings/${booking.id}/ticket`);
      setTicket({ booking, ticket: data.ticket });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const now = new Date();
  const upcoming = bookings
    .filter((booking) => ['confirmed', 'checked_in', 'pending'].includes(booking.status) && new Date(booking.endTime) > now)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const completed = bookings.filter((booking) => booking.status === 'completed');
  const next = upcoming[0];
  const recent = bookings.slice(0, 3);
  const spent = payments
    .filter((payment) => ['captured', 'refunded', 'partially_refunded'].includes(payment.status))
    .reduce((sum, payment) => sum + Math.max(0, payment.amount - (payment.refundedAmount || 0)), 0);

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="page pb-20 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Hello, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted">Your reservations, passes and parking history at a glance.</p>
        </div>
        <Link to="/facilities">
          <Button icon={Search}>Find parking</Button>
        </Link>
      </div>

      {error ? (
        <div className="surface mt-6">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Upcoming bookings"
              value={loading ? '—' : upcoming.length}
              hint={upcoming.length ? `Next: ${dateTime(next?.startTime)}` : 'Nothing scheduled yet'}
              icon={CalendarClock}
            />
            <StatCard
              label="Completed stays"
              value={loading ? '—' : completed.length}
              hint="Sessions billed end to end"
              icon={CalendarCheck}
              tone="amber"
            />
            <StatCard
              label="Net spend"
              value={loading ? '—' : currency(spent)}
              hint="Captured payments minus refunds"
              icon={Wallet}
              tone="slate"
            />
            <StatCard
              label="Saved vehicles"
              value={loading ? '—' : vehicles.length}
              hint={vehicles.find((vehicle) => vehicle.isDefault)?.plate || 'Add a vehicle'}
              icon={Car}
              tone="brand"
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-6">
              <section>
                <SectionHeading
                  eyebrow="Next up"
                  title="Your next reservation"
                  actions={
                    <Link to="/bookings" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                      All bookings
                    </Link>
                  }
                />
                <div className="mt-4">
                  {loading ? (
                    <Skeleton className="h-52 w-full rounded-2xl" />
                  ) : next ? (
                    <div className="surface overflow-hidden">
                      <div className="relative border-b border-line bg-gradient-to-br from-ink-950 to-brand-900 px-6 py-5 text-paper dark:border-line-dark">
                        <div className="absolute inset-0 opacity-20" aria-hidden>
                          <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-brand-500 blur-3xl" />
                        </div>
                        <div className="relative flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge tone={next.status === 'checked_in' ? 'emerald' : 'amberSolid'}>
                                {next.status === 'checked_in' ? 'Parked now' : next.status === 'pending' ? 'Awaiting payment' : 'Confirmed'}
                              </Badge>
                              <span className="font-mono text-[11px] text-white/50">{next.ref}</span>
                            </div>
                            <h3 className="mt-2 font-display text-2xl font-semibold">{next.facility?.name}</h3>
                            <p className="mt-1 text-sm text-white/60">
                              {next.zone?.name} · Slot <span className="font-mono text-brand-300">{next.slot?.code}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-2xl font-semibold text-brand-300">{currency(next.amountPaid || next.quote?.total)}</p>
                            <p className="text-[10px] uppercase tracking-wider text-white/40">paid</p>
                          </div>
                        </div>
                        <div className="relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/65">
                          <span className="flex items-center gap-1.5">
                            <CalendarClock size={13} /> {dateTime(next.startTime)} → {timeOnly(next.endTime)}
                          </span>
                          <span className="flex items-center gap-1.5 font-mono">
                            <Car size={13} /> {next.vehicle?.plate}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                        <p className="text-xs text-muted">
                          {next.status === 'checked_in'
                            ? 'Your vehicle is inside. Process exit at the gate when you leave.'
                            : 'Entry opens 1 hour before the start time. Carry your digital pass.'}
                        </p>
                        <div className="flex gap-2">
                          {['confirmed', 'checked_in'].includes(next.status) ? (
                            <Button size="sm" icon={Ticket} onClick={() => openTicket(next)}>
                              Show entry pass
                            </Button>
                          ) : (
                            <Link to={`/bookings/${next.id}`}>
                              <Button size="sm" iconRight={ArrowRight}>
                                Complete booking
                              </Button>
                            </Link>
                          )}
                          <Link to={`/bookings/${next.id}`}>
                            <Button size="sm" variant="secondary">
                              Details
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="surface p-8 text-center">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                        <MapPinned size={22} />
                      </span>
                      <h3 className="mt-3 font-display text-lg font-semibold">No reservation booked yet</h3>
                      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                        Compare live availability and reserve a bay in under a minute.
                      </p>
                      <Link to="/facilities" className="mt-4 inline-block">
                        <Button size="sm" icon={Search}>
                          Find parking
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <SectionHeading
                  eyebrow="Recent"
                  title="Booking history"
                  actions={
                    <Link to="/bookings" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                      View all
                    </Link>
                  }
                />
                <div className="mt-4 space-y-3">
                  {loading ? (
                    [0, 1, 2].map((index) => <Skeleton key={index} className="h-28 w-full rounded-2xl" />)
                  ) : recent.length ? (
                    recent.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} compact onTicket={openTicket} />
                    ))
                  ) : (
                    <p className="surface-muted px-4 py-6 text-center text-sm text-muted">
                      Bookings will appear here once you reserve a bay.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <div className="surface p-5">
                <h2 className="font-display text-base font-semibold">Quick actions</h2>
                <div className="mt-3 space-y-2">
                  {[
                    { to: '/facilities', icon: Search, label: 'Find a parking bay', hint: 'Live availability & map' },
                    { to: '/vehicles', icon: Plus, label: 'Manage vehicles', hint: `${vehicles.length} saved` },
                    { to: '/payments', icon: CreditCard, label: 'Payments & receipts', hint: 'Test-mode ledger' },
                    { to: '/favorites', icon: Heart, label: 'Saved facilities', hint: `${favorites.length} saved` },
                  ].map((action) => (
                    <Link
                      key={action.to}
                      to={action.to}
                      className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:border-brand-400 hover:bg-brand-500/[0.04] dark:border-line-dark dark:hover:border-brand-500"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-700 dark:text-brand-300">
                        <action.icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{action.label}</span>
                        <span className="block text-[11px] text-muted">{action.hint}</span>
                      </span>
                      <ArrowRight size={14} className="text-muted" />
                    </Link>
                  ))}
                </div>
              </div>

              <div className="surface p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold">Saved facilities</h2>
                  <Link to="/favorites" className="text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-300">
                    View all
                  </Link>
                </div>
                {loading ? (
                  <Skeleton className="mt-3 h-20 w-full" />
                ) : favorites.length ? (
                  <ul className="mt-3 space-y-2">
                    {favorites.slice(0, 3).map((facility) => (
                      <li key={facility.id}>
                        <Link
                          to={`/facilities/${facility.id}`}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition hover:bg-paper dark:hover:bg-ink-850"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium">{facility.name}</span>
                            <span className="block text-[10px] text-muted">{facility.availableSlots} free now</span>
                          </span>
                          <span className="font-mono text-[11px] text-amber-700 dark:text-amber-300">{currency(facility.minPrice)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs leading-relaxed text-muted">
                    Tap the heart on a facility to pin it here for faster booking.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-5">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Test environment</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800/80 dark:text-amber-200/70">
                  Payments run in DEMO or Razorpay test mode. No real money is charged and refunds are simulated unless
                  live keys are configured.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <TicketModal open={Boolean(ticket)} onClose={() => setTicket(null)} booking={ticket?.booking} ticket={ticket?.ticket} />
    </div>
  );
}
