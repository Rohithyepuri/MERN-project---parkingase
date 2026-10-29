import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRight, Clock3, CreditCard, ShieldCheck, TriangleAlert } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { dateTime, duration, timeOnly, currency } from '../lib/format';
import { Badge, Button, InlineNote, Modal } from './ui';

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Could not load Razorpay checkout'));
    document.body.appendChild(script);
  });
}

export default function CheckoutModal({ open, onClose, checkout, onPaid, onFailed }) {
  const { user } = useAuth();
  const [paying, setPaying] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const booking = checkout?.booking;
  const payment = checkout?.payment;
  const holdUntil = checkout?.holdExpiresAt || booking?.holdExpiresAt;

  useEffect(() => {
    if (!open || !holdUntil) return undefined;
    const tick = () => {
      const seconds = Math.max(0, Math.round((new Date(holdUntil).getTime() - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) setPaying(false);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [open, holdUntil]);

  const clock = useMemo(() => {
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [remaining]);

  if (!booking) return null;

  const demo = payment?.provider === 'demo';
  const expired = remaining === 0;

  const confirmDemo = async (outcome) => {
    setPaying(true);
    try {
      const data = await api(`/api/payments/${booking.id}/confirm`, {
        method: 'POST',
        body: { outcome },
      });
      toast.success('Payment captured in demo mode');
      onPaid(data);
    } catch (error) {
      toast.error(error.message);
      onFailed?.(error);
    } finally {
      setPaying(false);
    }
  };

  const payWithRazorpay = async () => {
    setPaying(true);
    try {
      const Razorpay = await loadRazorpay();
      const instance = new Razorpay({
        key: payment.keyId,
        amount: Math.round(payment.amount * 100),
        currency: payment.currency,
        name: 'ParkEase',
        description: `Parking booking ${booking.ref}`,
        order_id: payment.orderId,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#059669' },
        modal: {
          ondismiss: () => setPaying(false),
        },
        handler: async (response) => {
          try {
            const data = await api(`/api/payments/${booking.id}/confirm`, {
              method: 'POST',
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            toast.success('Payment verified');
            onPaid(data);
          } catch (error) {
            toast.error(error.message);
            onFailed?.(error);
          } finally {
            setPaying(false);
          }
        },
      });
      instance.on('payment.failed', (response) => {
        toast.error(response?.error?.description || 'Payment failed');
        setPaying(false);
      });
      instance.open();
    } catch (error) {
      toast.error(error.message);
      setPaying(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Checkout"
      description={`Reservation ${booking.ref} is held while you pay.`}
      size="lg"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <ShieldCheck size={13} /> Secured on the server. Prices are locked to this booking.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={paying}>
              Pay later
            </Button>
            {demo ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => confirmDemo('fail')}
                  disabled={paying || expired}
                >
                  Simulate failure
                </Button>
                <Button size="sm" loading={paying} disabled={expired} onClick={() => confirmDemo('success')} icon={CreditCard}>
                  Pay {currency(payment.amount)}
                </Button>
              </>
            ) : (
              <Button size="sm" loading={paying} disabled={expired} onClick={payWithRazorpay} icon={CreditCard}>
                Pay {currency(payment.amount)} with Razorpay
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
            <Clock3 size={14} /> Slot held for <span className="font-mono">{clock}</span>
          </span>
          <Badge tone="amberSolid">{demo ? 'DEMO PAYMENT' : 'RAZORPAY TEST MODE'}</Badge>
        </div>

        <div className="surface-muted p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-sm font-semibold">{booking.facility?.name}</p>
              <p className="mt-0.5 text-xs text-muted">
                {booking.zone?.name} · Slot <span className="font-mono">{booking.slot?.code}</span>
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="font-mono font-semibold">{booking.vehicle?.plate}</p>
              <p className="text-muted">{booking.vehicle?.type}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs dark:border-line-dark">
            <div>
              <p className="text-muted">From</p>
              <p className="font-medium">{dateTime(booking.startTime)}</p>
            </div>
            <div>
              <p className="text-muted">To</p>
              <p className="font-medium">{dateTime(booking.endTime)}</p>
            </div>
            <div>
              <p className="text-muted">Duration</p>
              <p className="font-medium">{booking.quote?.hours} hour(s)</p>
            </div>
            <div>
              <p className="text-muted">Vehicle</p>
              <p className="font-medium">{booking.vehicle?.plate}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Price breakdown</p>
          <ul className="space-y-1.5 text-sm">
            {booking.quote?.lines?.map((line) => (
              <li key={line.label} className="flex justify-between gap-3">
                <span className="text-ink/70 dark:text-paper/70">{line.label}</span>
                <span className="font-mono">{currency(line.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-line pt-2 text-base font-semibold dark:border-line-dark">
              <span>Total payable</span>
              <span className="font-mono text-amber-700 dark:text-amber-300">{currency(booking.quote?.total)}</span>
            </li>
          </ul>
        </div>

        {demo ? (
          <InlineNote tone="amber" title="Demo payments are on">
            No real money moves. A successful demo payment confirms the booking and issues a signed QR pass. Razorpay
            test mode activates automatically when test keys are set on the server.
          </InlineNote>
        ) : (
          <InlineNote tone="amber" title="Razorpay test mode">
            Use Razorpay test cards. The secret key stays on the server and every signature is verified before the
            booking is confirmed.
          </InlineNote>
        )}

        {expired ? (
          <InlineNote tone="amber" title="Hold expired">
            <span className="inline-flex items-center gap-1.5">
              <TriangleAlert size={12} /> The slot has been released. Start a new booking to continue.
            </span>
          </InlineNote>
        ) : null}
      </div>
    </Modal>
  );
}
