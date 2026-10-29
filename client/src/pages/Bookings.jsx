import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarX2, Filter, MapPin, Search } from 'lucide-react';
import { api } from '../api/client';
import BookingCard from '../components/BookingCard';
import TicketModal from '../components/TicketModal';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Skeleton,
  Tabs,
  cx,
} from '../components/ui';
import { currency } from '../lib/format';

const STATUS_FILTERS = [
  { key: 'all', label: 'All statuses' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'checked_in', label: 'Parked' },
  { key: 'pending', label: 'Awaiting payment' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const PAGE_SIZE = 9;

export default function Bookings() {
  const [scope, setScope] = useState('upcoming');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/bookings/mine?scope=all&limit=100');
      setBookings(data.bookings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [scope, status, query]);

  const now = Date.now();
  const upcoming = bookings
    .filter(
      (booking) =>
        ['pending', 'payment_failed', 'confirmed', 'checked_in'].includes(booking.status) &&
        new Date(booking.endTime).getTime() >= now
    )
    .sort((a, b) => {
      const priority = (status) => (status === 'checked_in' ? 0 : status === 'confirmed' ? 1 : 2);
      return priority(a.status) - priority(b.status) || new Date(a.startTime) - new Date(b.startTime);
    });
  const past = bookings.filter((booking) => !upcoming.some((item) => item.id === booking.id));

  const filtered = useMemo(() => {
    let list = scope === 'upcoming' ? upcoming : scope === 'past' ? past : bookings;
    if (status !== 'all') list = list.filter((booking) => booking.status === status);
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      list = list.filter((booking) =>
        [booking.ref, booking.facility?.name, booking.vehicle?.plate, booking.slot?.code]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      );
    }
    return list;
  }, [scope, status, query, bookings, upcoming, past]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openTicket = async (booking) => {
    try {
      const data = await api(`/api/bookings/${booking.id}/ticket`);
      setTicket({ booking, ticket: data.ticket });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const data = await api(`/api/bookings/${cancelTarget.id}/cancel`, {
        method: 'POST',
        body: { reason: 'Cancelled from bookings page' },
      });
      toast.success(
        data.refund ? `Cancelled · ${currency(data.refund.amount)} refund ${data.refund.status}` : 'Booking cancelled'
      );
      setCancelTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="page pb-20 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">Reservations</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">My bookings</h1>
          <p className="mt-1 text-sm text-muted">Entry passes, timelines and refund status for every reservation.</p>
        </div>
        <Link to="/facilities">
          <Button icon={MapPin}>Book another bay</Button>
        </Link>
      </div>

      <div className="mt-6 surface p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            className="border-0"
            value={scope}
            onChange={setScope}
            items={[
              { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
              { key: 'past', label: 'Past', count: past.length },
              { key: 'all', label: 'All', count: bookings.length },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[190px] flex-1 lg:flex-none">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ref, facility, plate"
                className="h-9 pl-8 text-xs"
                aria-label="Search bookings"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter size={13} className="shrink-0 text-muted" />
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setStatus(filter.key)}
                  className={cx('chip whitespace-nowrap', status === filter.key && 'chip-active')}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="surface">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : visible.length === 0 ? (
          <div className="surface">
            <EmptyState
              icon={CalendarX2}
              title={query || status !== 'all' ? 'No bookings match those filters' : scope === 'upcoming' ? 'No upcoming bookings' : 'Nothing in your history yet'}
              description={
                query || status !== 'all'
                  ? 'Try clearing the search or status filter.'
                  : 'Reserve a bay and your digital pass will show up here instantly.'
              }
              action={
                query || status !== 'all' ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('');
                      setStatus('all');
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Link to="/facilities">
                    <Button>Find parking</Button>
                  </Link>
                )
              }
            />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {visible.map((booking) => (
                <BookingCard key={booking.id} booking={booking} onTicket={openTicket} onCancel={setCancelTarget} />
              ))}
            </div>
            <div className="mt-5">
              <Pagination page={page} pages={pages} total={filtered.length} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      <TicketModal open={Boolean(ticket)} onClose={() => setTicket(null)} booking={ticket?.booking} ticket={ticket?.ticket} />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
        loading={cancelling}
        title="Cancel this booking?"
        confirmLabel="Cancel booking"
        message={
          cancelTarget
            ? `You are cancelling ${cancelTarget.ref} at ${cancelTarget.facility?.name}. Refunds follow the published policy: full refund 2+ hours before start, 75% between 1–2 hours, 50% within an hour, none after check-in.`
            : ''
        }
      />
    </div>
  );
}
