import { Link } from 'react-router-dom';
import { CalendarClock, ChevronRight, MapPin, Ticket } from 'lucide-react';
import { BOOKING_STATUS } from '../lib/constants';
import { currency, dateTime, timeRange, timeOnly } from '../lib/format';
import { Badge, Button, cx } from './ui';

export default function BookingCard({ booking, onTicket, onCancel, compact = false }) {
  const status = BOOKING_STATUS[booking.status] || BOOKING_STATUS.pending;
  const canTicket = ['confirmed', 'checked_in'].includes(booking.status);
  const isActive = ['pending', 'confirmed', 'checked_in'].includes(booking.status) && new Date(booking.endTime) > new Date();

  return (
    <article className={cx('surface overflow-hidden', compact ? 'p-4' : 'p-5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] font-semibold tracking-wide text-muted">{booking.ref}</p>
            <Badge tone={status.tone} dot={isActive}>
              {status.label}
            </Badge>
          </div>
          <h3 className="mt-1.5 truncate font-display text-base font-semibold text-ink dark:text-paper">
            {booking.facility?.name || 'Facility'}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <MapPin size={12} />
            <span className="truncate">{booking.zone?.name} · Slot <span className="font-mono">{booking.slot?.code}</span></span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-semibold">{currency(booking.finalAmount ?? booking.amountPaid ?? booking.quote?.total)}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted">
            {booking.finalAmount != null ? 'final bill' : 'booking total'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-paper px-2.5 py-2 text-[11px] text-muted dark:bg-ink-850">
        <CalendarClock size={12} className="shrink-0 text-brand-600 dark:text-brand-300" />
        <span className="truncate">
          {dateTime(booking.startTime)} → {timeOnly(booking.endTime)}
          {booking.overstayCharge > 0 ? <span className="ml-1 font-medium text-amber-600">· overstay ₹{booking.overstayCharge}</span> : null}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted">{booking.vehicle?.plate}</span>
        <div className="flex items-center gap-2">
          {canTicket ? (
            <Button variant="secondary" size="xs" icon={Ticket} onClick={() => onTicket?.(booking)}>
              Show pass
            </Button>
          ) : null}
          {onCancel && ['pending', 'confirmed'].includes(booking.status) && new Date(booking.startTime) > new Date() ? (
            <Button variant="ghost" size="xs" onClick={() => onCancel(booking)}>
              Cancel
            </Button>
          ) : null}
          <Link
            to={`/bookings/${booking.id}`}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-700 transition hover:gap-1.5 dark:text-brand-300"
          >
            Details <ChevronRight size={13} />
          </Link>
        </div>
      </div>
    </article>
  );
}
