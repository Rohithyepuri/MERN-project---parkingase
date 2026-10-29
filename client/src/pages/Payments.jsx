import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, ExternalLink, Receipt, Undo2, Wallet } from 'lucide-react';
import { api } from '../api/client';
import {
  Badge,
  ErrorState,
  Skeleton,
  StatCard,
  Table,
  Td,
  Th,
  Tr,
  EmptyState,
} from '../components/ui';
import { PAYMENT_STATUS } from '../lib/constants';
import { currency, dateTime } from '../lib/format';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/payments/mine');
      setPayments(data.payments || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const captured = payments.filter((payment) => ['captured', 'refunded', 'partially_refunded'].includes(payment.status));
    const paid = captured.reduce((sum, payment) => sum + payment.amount, 0);
    const refunded = captured.reduce((sum, payment) => sum + (payment.refundedAmount || 0), 0);
    return { paid, refunded, net: paid - refunded, count: captured.length };
  }, [payments]);

  return (
    <div className="page pb-20 pt-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">Money</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Payments & receipts</h1>
        <p className="mt-1 text-sm text-muted">
          Every transaction in this build is labelled DEMO or Razorpay TEST. No real money moves.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total paid" value={loading ? '—' : currency(totals.paid)} hint={`${totals.count} successful transactions`} icon={Wallet} />
        <StatCard
          label="Refunded"
          value={loading ? '—' : currency(totals.refunded)}
          hint="Returned under the cancellation policy"
          icon={Undo2}
          tone="amber"
        />
        <StatCard
          label="Net spend"
          value={loading ? '—' : currency(totals.net)}
          hint="Captured minus refunds"
          icon={Receipt}
          tone="slate"
        />
      </div>

      <div className="mt-6 surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-line-dark">
          <h2 className="font-display text-base font-semibold">Transaction history</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
            <CreditCard size={11} /> TEST MODE
          </span>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No payments yet"
            description="Once you reserve a bay and complete checkout, receipts will appear here."
          />
        ) : (
          <Table minWidth={760}>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Booking</Th>
                <Th>Mode</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Refunded</Th>
                <Th>Reference</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <Tr key={payment.id}>
                  <Td className="whitespace-nowrap text-xs text-muted">{dateTime(payment.createdAt)}</Td>
                  <Td>
                    {payment.booking?.id ? (
                      <Link
                        to={`/bookings/${payment.booking.id}`}
                        className="inline-flex items-center gap-1 font-mono text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                      >
                        {payment.booking.ref || 'View'} <ExternalLink size={11} />
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={payment.mode === 'DEMO' ? 'slate' : 'amber'}>
                      {payment.mode}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={PAYMENT_STATUS[payment.status]?.tone || 'slate'}>
                      {PAYMENT_STATUS[payment.status]?.label || payment.status}
                    </Badge>
                  </Td>
                  <Td className="text-right font-mono text-xs font-semibold">{currency(payment.amount)}</Td>
                  <Td className="text-right font-mono text-xs text-muted">{payment.refundedAmount ? currency(payment.refundedAmount) : '—'}</Td>
                  <Td className="max-w-[160px] truncate font-mono text-[10px] text-muted">{payment.paymentId || payment.orderId || '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        With Razorpay test keys configured, the server creates orders, verifies payment signatures and processes refunds
        through the provider. Without keys, the labelled DEMO flow confirms or fails payments locally for demonstration.
      </p>
    </div>
  );
}
