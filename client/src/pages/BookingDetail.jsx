import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  CalendarClock,
  Car,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Clock3,
  CreditCard,
  MapPin,
  Receipt,
  ShieldCheck,
  Star,
  Ticket,
  XCircle,
} from 'lucide-react';
import { api } from '../api/client';
import CheckoutModal from '../components/CheckoutModal';
import TicketModal from '../components/TicketModal';
import {
  Badge,
  Button,
  ConfirmDialog,
  ErrorState,
  Field,
  InlineNote,
  Skeleton,
  Textarea,
  cx,
} from '../components/ui';
import { BOOKING_STATUS, PAYMENT_STATUS } from '../lib/constants';
import { currency, dateOnly, dateTime, relative, timeOnly } from '../lib/format';

const TIMELINE_ICONS = {
  pending: Clock3,
  confirmed: CheckCircle2,
  checked_in: Car,
  completed: Receipt,
  cancelled: XCircle,
  expired: CircleSlash,
  payment_failed: XCircle,
  no_show: CircleSlash,
};

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ticketOpen, setTicketOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [detail, myReviews] = await Promise.all([api(`/api/bookings/${id}`), api('/api/reviews/mine')]);
      setData(detail);
      setReviews(myReviews.reviews || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="page py-8">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-28 w-full rounded-2xl" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page py-16">
        <div className="surface">
          <ErrorState message={error || 'Booking not found.'} onRetry={load} />
        </div>
      </div>
    );
  }

  const { booking, payment, ticket, canCancel, paymentInfo } = data;
  const status = BOOKING_STATUS[booking.status] || BOOKING_STATUS.pending;
  const timeline = [...(booking.timeline || [])].sort((a, b) => new Date(a.at) - new Date(b.at));
  const existingReview = reviews.find((review) => review.booking === booking.id);
  const isCompleted = booking.status === 'completed';

  const cancelBooking = async () => {
    setCancelling(true);
    try {
      const result = await api(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        body: { reason: 'Cancelled from booking details' },
      });
      toast.success(
        result.refund ? `Cancelled · ${currency(result.refund.amount)} refund (${result.refund.percent}%)` : 'Booking cancelled'
      );
      setCancelOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api('/api/reviews', {
        method: 'POST',
        body: { bookingId: booking.id, rating, comment },
      });
      toast.success('Thanks — your review is live.');
      setComment('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page pb-20 pt-6">
      <nav className="flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
        <Link to="/bookings" className="inline-flex items-center gap-1 hover:text-ink dark:hover:text-paper">
          <ArrowLeft size={13} /> My bookings
        </Link>
        <ChevronRight size={12} />
        <span className="font-mono">{booking.ref}</span>
      </nav>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">{booking.facility?.name}</h1>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="font-mono">{booking.ref}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} /> {booking.facility?.address}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">{status.description}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold">{currency(booking.finalAmount ?? booking.amountPaid ?? booking.quote?.total)}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted">
            {booking.finalAmount != null ? 'final bill' : booking.amountPaid ? 'paid' : 'booking total'}
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="surface p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold">Reservation details</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Window</dt>
                <dd className="mt-0.5 flex items-start gap-1.5 font-medium">
                  <CalendarClock size={14} className="mt-0.5 text-brand-600 dark:text-brand-300" />
                  <span>
                    {dateOnly(booking.startTime)}
                    <span className="block text-xs font-normal text-muted">
                      {timeOnly(booking.startTime)} → {timeOnly(booking.endTime)}
                    </span>
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Bay</dt>
                <dd className="mt-0.5">
                  <span className="font-mono font-semibold">{booking.slot?.code}</span>
                  <span className="block text-xs text-muted">
                    {booking.zone?.name} · {booking.floor?.name}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Vehicle</dt>
                <dd className="mt-0.5">
                  <span className="font-mono font-semibold">{booking.vehicle?.plate}</span>
                  <span className="block text-xs text-muted">{booking.vehicle?.type}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Booked</dt>
                <dd className="mt-0.5 font-medium">{dateTime(booking.createdAt)}</dd>
              </div>
            </dl>

            {booking.quote?.lines?.length ? (
              <div className="mt-5 border-t border-line pt-4 dark:border-line-dark">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Price breakdown</p>
                <ul className="space-y-1.5 text-sm">
                  {booking.quote.lines.map((line) => (
                    <li key={line.label} className="flex justify-between gap-3">
                      <span className="text-muted">{line.label}</span>
                      <span className="font-mono">{currency(line.amount)}</span>
                    </li>
                  ))}
                  {booking.overstayCharge > 0 ? (
                    <li className="flex justify-between gap-3 text-amber-700 dark:text-amber-300">
                      <span>Overstay · {booking.overstayMinutes} min</span>
                      <span className="font-mono">{currency(booking.overstayCharge)}</span>
                    </li>
                  ) : null}
                  <li className="flex justify-between gap-3 border-t border-line pt-2 text-sm font-semibold dark:border-line-dark">
                    <span>{booking.finalAmount != null ? 'Final bill' : 'Total'}</span>
                    <span className="font-mono">{currency(booking.finalAmount ?? booking.quote.total)}</span>
                  </li>
                </ul>
              </div>
            ) : null}

            {booking.cancellation?.at ? (
              <div className="mt-5">
                <InlineNote tone="amber" title="Cancellation">
                  {booking.cancellation.reason || 'Cancelled'} · {booking.cancellation.refundPercent}% refund ·{' '}
                  {currency(booking.cancellation.refundAmount)} · {relative(booking.cancellation.at)}
                </InlineNote>
              </div>
            ) : null}
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold">Booking timeline</h2>
            <p className="text-xs text-muted">Every timestamp comes from a server event, not the browser.</p>
            <ol className="mt-5 space-y-0">
              {timeline.map((event, index) => {
                const Icon = TIMELINE_ICONS[event.status] || Clock3;
                const isLast = index === timeline.length - 1;
                return (
                  <li key={`${event.status}-${index}`} className="relative flex gap-4 pb-6 last:pb-0">
                    {!isLast ? <span className="absolute left-[15px] top-8 h-full w-px bg-line dark:bg-line-dark" aria-hidden /> : null}
                    <span
                      className={cx(
                        'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                        index === timeline.length - 1
                          ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                          : 'border-line bg-paper text-muted dark:border-line-dark dark:bg-ink-850'
                      )}
                    >
                      <Icon size={14} />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{BOOKING_STATUS[event.status]?.label || event.status}</p>
                        <span className="font-mono text-[10px] text-muted">{dateTime(event.at)}</span>
                      </div>
                      {event.note ? <p className="mt-0.5 text-xs text-muted">{event.note}</p> : null}
                      {event.by ? <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted/70">by {event.by}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {payment ? (
            <section className="surface p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold">Payment</h2>
                  <p className="text-xs text-muted">
                    {payment.provider === 'demo' ? 'Demo payment' : 'Razorpay test mode'} · {payment.mode}
                  </p>
                </div>
                <Badge tone={PAYMENT_STATUS[payment.status]?.tone || 'slate'}>{PAYMENT_STATUS[payment.status]?.label || payment.status}</Badge>
              </div>
              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-muted">Amount</dt>
                  <dd className="mt-0.5 font-mono text-sm font-semibold">{currency(payment.amount)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Refunded</dt>
                  <dd className="mt-0.5 font-mono text-sm">{currency(payment.refundedAmount || 0)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Reference</dt>
                  <dd className="mt-0.5 truncate font-mono text-[11px]">{payment.paymentId || payment.orderId}</dd>
                </div>
              </dl>
              {payment.failureReason ? (
                <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  {payment.failureReason}
                </p>
              ) : null}
            </section>
          ) : null}

          {isCompleted ? (
            <section className="surface p-5 sm:p-6" id="review">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold">Rate this stay</h2>
                  <p className="text-xs text-muted">Only verified completed stays can leave a review.</p>
                </div>
                {existingReview ? <Badge tone="emerald">Review submitted</Badge> : null}
              </div>

              {existingReview ? (
                <div className="mt-3 rounded-xl bg-paper p-4 dark:bg-ink-850">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        className={star <= existingReview.rating ? 'fill-amber-400 text-amber-400' : 'text-line dark:text-line-dark'}
                      />
                    ))}
                    <span className="ml-1 font-mono text-[10px] text-muted">{relative(existingReview.createdAt)}</span>
                  </div>
                  {existingReview.comment ? <p className="mt-2 text-sm text-ink/75 dark:text-paper/75">{existingReview.comment}</p> : null}
                </div>
              ) : (
                <form onSubmit={submitReview} className="mt-4 space-y-3">
                  <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={rating === star}
                        onClick={() => setRating(star)}
                        className="rounded-md p-1 transition hover:bg-amber-500/10"
                        aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      >
                        <Star
                          size={22}
                          className={star <= rating ? 'fill-amber-400 text-amber-400' : 'text-line dark:text-line-dark'}
                        />
                      </button>
                    ))}
                  </div>
                  <Field label="Comment (optional)" htmlFor="review-comment">
                    <Textarea
                      id="review-comment"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="How was the bay, signage and lighting?"
                      maxLength={600}
                    />
                  </Field>
                  <Button type="submit" size="sm" loading={submitting}>
                    Publish review
                  </Button>
                </form>
              )}
            </section>
          ) : null}
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="surface overflow-hidden">
            <div className="border-b border-line bg-paper/60 px-5 py-3 dark:border-line-dark dark:bg-ink-850/60">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Entry pass</p>
            </div>
            <div className="p-5">
              {ticket ? (
                <>
                  <div className="mx-auto flex w-fit rounded-xl border border-line bg-white p-3 dark:border-line-dark">
                    <QRCodeSVG value={ticket} size={150} bgColor="#ffffff" fgColor="#0C120E" level="M" />
                  </div>
                  <p className="mt-3 text-center font-mono text-sm font-semibold">{booking.ref}</p>
                  <p className="mt-1 text-center text-xs text-muted">
                    Valid {dateTime(booking.startTime)} → {timeOnly(booking.endTime)}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button className="flex-1" size="sm" icon={Ticket} onClick={() => setTicketOpen(true)}>
                      Open pass
                    </Button>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-ink/5 text-muted dark:bg-white/5">
                    <Ticket size={20} />
                  </span>
                  <p className="mt-2 text-sm font-medium">No active pass</p>
                  <p className="mt-1 text-xs text-muted">
                    {booking.status === 'pending'
                      ? 'Complete payment to unlock your signed entry pass.'
                      : 'A pass is only issued for confirmed and active bookings.'}
                  </p>
                </div>
              )}

              <div className="mt-4 space-y-2">
                {paymentInfo ? (
                  <Button
                    className="w-full"
                    size="sm"
                    icon={CreditCard}
                    onClick={() =>
                      setCheckout({
                        booking,
                        payment: paymentInfo,
                        holdExpiresAt: booking.holdExpiresAt,
                      })
                    }
                  >
                    Complete payment
                  </Button>
                ) : null}
                {canCancel ? (
                  <Button variant="secondary" className="w-full" size="sm" onClick={() => setCancelOpen(true)}>
                    Cancel booking
                  </Button>
                ) : null}
                {isCompleted && !existingReview ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    size="sm"
                    icon={Star}
                    onClick={() => document.getElementById('review')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    Leave a review
                  </Button>
                ) : null}
                <Button variant="ghost" className="w-full" size="sm" onClick={() => navigate('/bookings')}>
                  Back to bookings
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 dark:border-line-dark dark:bg-ink-900">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <ShieldCheck size={14} className="text-brand-600 dark:text-brand-300" /> Good to know
            </p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
              <li>Entry opens 1 hour before the start and closes at the end time.</li>
              <li>A pass can be scanned once. Duplicate entry attempts are rejected.</li>
              <li>Overstay beyond the grace period is billed at the bay's hourly rate.</li>
              <li>Your ticket contains a signed reference only — no personal data.</li>
            </ul>
          </div>
        </aside>
      </div>

      <TicketModal open={ticketOpen} onClose={() => setTicketOpen(false)} booking={booking} ticket={ticket} />

      <CheckoutModal
        open={Boolean(checkout)}
        onClose={() => setCheckout(null)}
        checkout={checkout}
        onPaid={(payload) => {
          setCheckout(null);
          toast.success('Payment confirmed');
          if (payload.ticket) {
            setData((previous) => (previous ? { ...previous, booking: payload.booking, ticket: payload.ticket, paymentInfo: null } : previous));
          }
          load();
        }}
        onFailed={() => {
          setCheckout(null);
          load();
        }}
      />

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={cancelBooking}
        loading={cancelling}
        title="Cancel this reservation?"
        confirmLabel="Cancel booking"
        message="Refunds follow the published policy: full refund 2+ hours before start, 75% between 1–2 hours, 50% within an hour, and none after check-in. This cannot be undone."
      />
    </div>
  );
}
