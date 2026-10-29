import { QRCodeSVG } from 'qrcode.react';
import { CalendarClock, Car, MapPin, Printer, ShieldCheck } from 'lucide-react';
import { BOOKING_STATUS } from '../lib/constants';
import { dateTime, timeOnly, currency } from '../lib/format';
import { Badge, Button, CopyButton, InlineNote, Modal } from './ui';

export default function TicketModal({ open, onClose, booking, ticket }) {
  if (!booking) return null;
  const status = BOOKING_STATUS[booking.status] || BOOKING_STATUS.confirmed;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Digital parking pass"
      description="Show this at the gate. Staff scan it to record entry and exit."
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-muted">Entry opens 1 hour before the booking starts.</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
              Print / Save PDF
            </Button>
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      }
    >
      <div className="print-ticket">
        <div className="overflow-hidden rounded-2xl border border-line bg-white dark:border-line-dark dark:bg-ink-850">
          <div className="flex items-center justify-between gap-3 bg-ink-950 px-5 py-4 text-white">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-300">ParkEase pass</p>
              <p className="mt-0.5 font-display text-lg font-semibold">{booking.facility?.name}</p>
              <p className="text-xs text-white/60">{booking.facility?.address}</p>
            </div>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>

          <div className="grid gap-5 p-5 sm:grid-cols-[190px_1fr]">
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper p-3 dark:border-line-dark dark:bg-ink-900">
              {ticket ? (
                <QRCodeSVG value={ticket} size={164} bgColor="#ffffff" fgColor="#0C120E" level="M" />
              ) : (
                <div className="py-10 text-center text-xs text-muted">Pass not available for this status.</div>
              )}
              <p className="mt-2 font-mono text-[10px] text-muted">Scan at the gate</p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted">Booking reference</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-mono text-xl font-semibold tracking-tight">{booking.ref}</p>
                  <CopyButton value={booking.ref} label="Copy" />
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-muted">Slot</dt>
                  <dd className="font-mono font-semibold">{booking.slot?.code}</dd>
                </div>
                <div>
                  <dt className="text-muted">Vehicle</dt>
                  <dd className="font-mono font-semibold">{booking.vehicle?.plate}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted">Valid</dt>
                  <dd className="flex items-center gap-1.5 font-medium">
                    <CalendarClock size={13} className="text-brand-600" />
                    {dateTime(booking.startTime)} → {timeOnly(booking.endTime)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Amount paid</dt>
                  <dd className="font-mono font-semibold">{currency(booking.amountPaid)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Zone</dt>
                  <dd>{booking.zone?.name}</dd>
                </div>
              </dl>

              {ticket ? (
                <div className="rounded-lg bg-ink-950 px-3 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-white/40">Signed token</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-brand-300">{ticket}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 dark:border-line-dark">
            <p className="flex items-center gap-1.5 text-[10px] text-muted">
              <ShieldCheck size={12} /> Signed, opaque token — no personal data inside.
            </p>
            <p className="flex items-center gap-1.5 font-mono text-[10px] text-muted">
              <Car size={12} /> {booking.vehicle?.type}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <InlineNote tone="slate" title="How entry works">
          <span className="inline-flex items-start gap-1.5">
            <MapPin size={12} className="mt-0.5 shrink-0" />
            Staff scan this pass (or paste the token) at the assigned facility. A second scan of the same pass is
            rejected, so duplicate entry is impossible.
          </span>
        </InlineNote>
      </div>
    </Modal>
  );
}
