import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, Receipt, Undo2, Wallet } from 'lucide-react';
import { api } from '../api/client';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Pagination,
  SectionHeading,
  Select,
  Skeleton,
  StatCard,
  Tabs,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';
import { PAYMENT_STATUS } from '../lib/constants';
import { currency, dateTime } from '../lib/format';

export default function AdminPayments() {
  const [tab, setTab] = useState('transactions');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ payments: [], totals: { collected: 0, refunded: 0 }, pagination: null });
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundForm, setRefundForm] = useState({ amount: '', reason: '' });
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (status) params.set('status', status);
      const [paymentData, refundData] = await Promise.all([
        api(`/api/admin/payments?${params.toString()}`),
        api('/api/admin/refunds'),
      ]);
      setData(paymentData);
      setRefunds(refundData.refunds || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const openRefund = (payment) => {
    setRefundTarget(payment);
    setRefundForm({ amount: String(payment.amount - (payment.refundedAmount || 0)), reason: '' });
  };

  const submitRefund = async (event) => {
    event.preventDefault();
    if (!refundTarget) return;
    setRefunding(true);
    try {
      await api(`/api/admin/payments/${refundTarget.id}/refund`, {
        method: 'POST',
        body: {
          amount: Number(refundForm.amount),
          reason: refundForm.reason || 'Manual refund by administrator',
        },
      });
      toast.success('Refund processed');
      setRefundTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Money"
        title="Payments & refunds"
        description="Test-mode transactions, provider references and refund state changes."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Collected" value={currency(data.totals.collected)} hint="Captured in this ledger" icon={Wallet} />
        <StatCard label="Refunded" value={currency(data.totals.refunded)} hint="Including partial refunds" icon={Undo2} tone="amber" />
        <StatCard label="Net" value={currency(data.totals.collected - data.totals.refunded)} hint="Collected minus refunded" icon={Receipt} tone="slate" />
      </div>

      <div className="surface p-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2">
          <Tabs
            className="border-0"
            value={tab}
            onChange={setTab}
            items={[
              { key: 'transactions', label: 'Transactions', count: data.pagination?.total },
              { key: 'refunds', label: 'Refunds', count: refunds.length },
            ]}
          />
          {tab === 'transactions' ? (
            <div className="flex items-center gap-2 py-2">
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-8 py-0 text-xs"
                aria-label="Filter payment status"
              >
                <option value="">All statuses</option>
                {Object.entries(PAYMENT_STATUS).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
      </div>

      <div className="surface overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : tab === 'transactions' ? (
          data.payments.length === 0 ? (
            <EmptyState icon={CreditCard} title="No transactions" description="Captured payments will appear here." />
          ) : (
            <>
              <Table minWidth={960}>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Customer</Th>
                    <Th>Booking</Th>
                    <Th>Mode</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Amount</Th>
                    <Th className="text-right">Refunded</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((payment) => {
                    const refundable = ['captured', 'partially_refunded'].includes(payment.status);
                    return (
                      <Tr key={payment.id}>
                        <Td className="text-xs text-muted">{dateTime(payment.createdAt)}</Td>
                        <Td>
                          <p className="text-xs font-medium">{payment.user?.name}</p>
                          <p className="text-[10px] text-muted">{payment.user?.email}</p>
                        </Td>
                        <Td className="font-mono text-[11px]">{payment.booking?.ref || '—'}</Td>
                        <Td>
                          <Badge tone={payment.mode === 'DEMO' ? 'slate' : 'amber'}>{payment.mode}</Badge>
                        </Td>
                        <Td>
                          <Badge tone={PAYMENT_STATUS[payment.status]?.tone || 'slate'}>
                            {PAYMENT_STATUS[payment.status]?.label || payment.status}
                          </Badge>
                        </Td>
                        <Td className="text-right font-mono text-xs">{currency(payment.amount)}</Td>
                        <Td className="text-right font-mono text-xs text-muted">
                          {payment.refundedAmount ? currency(payment.refundedAmount) : '—'}
                        </Td>
                        <Td>
                          <div className="flex justify-end">
                            {refundable ? (
                              <Button size="xs" variant="secondary" onClick={() => openRefund(payment)}>
                                Refund
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted">—</span>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
              <div className="border-t border-line px-5 py-3 dark:border-line-dark">
                <Pagination
                  page={data.pagination.page}
                  pages={data.pagination.pages}
                  total={data.pagination.total}
                  onChange={setPage}
                />
              </div>
            </>
          )
        ) : refunds.length === 0 ? (
          <EmptyState icon={Undo2} title="No refunds issued" description="Cancellations and manual refunds are recorded here." />
        ) : (
          <Table minWidth={820}>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th>Booking</Th>
                <Th>Reason</Th>
                <Th className="text-right">Percent</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((refund) => (
                <Tr key={refund.id}>
                  <Td className="text-xs text-muted">{dateTime(refund.createdAt)}</Td>
                  <Td className="text-xs">{refund.user?.name}</Td>
                  <Td className="font-mono text-[11px]">{refund.booking?.ref}</Td>
                  <Td className="max-w-[220px] truncate text-xs text-muted">{refund.reason}</Td>
                  <Td className="text-right font-mono text-xs">{refund.percent}%</Td>
                  <Td className="text-right font-mono text-xs font-semibold">{currency(refund.amount)}</Td>
                  <Td>
                    <Badge tone={PAYMENT_STATUS[refund.status]?.tone || 'slate'}>
                      {PAYMENT_STATUS[refund.status]?.label || refund.status}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <Modal
        open={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
        title="Issue a refund"
        description="Recorded in the payment ledger and audit log."
        size="sm"
      >
        {refundTarget ? (
          <form onSubmit={submitRefund} className="space-y-4">
            <div className="rounded-xl bg-paper p-3 text-xs dark:bg-ink-850">
              <div className="flex justify-between">
                <span className="text-muted">Payment</span>
                <span className="font-mono">{refundTarget.paymentId || refundTarget.orderId}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted">Paid</span>
                <span className="font-mono">{currency(refundTarget.amount)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted">Already refunded</span>
                <span className="font-mono">{currency(refundTarget.refundedAmount || 0)}</span>
              </div>
            </div>
            <Field
              label="Refund amount (₹)"
              htmlFor="refund-amount"
              required
              hint={`Maximum ${currency(refundTarget.amount - (refundTarget.refundedAmount || 0))}`}
            >
              <Input
                id="refund-amount"
                type="number"
                min={0.01}
                max={refundTarget.amount - (refundTarget.refundedAmount || 0)}
                step="0.01"
                value={refundForm.amount}
                onChange={(event) => setRefundForm((prev) => ({ ...prev, amount: event.target.value }))}
                required
              />
            </Field>
            <Field label="Reason" htmlFor="refund-reason">
              <Input
                id="refund-reason"
                value={refundForm.reason}
                onChange={(event) => setRefundForm((prev) => ({ ...prev, reason: event.target.value }))}
                placeholder="Goodwill / service issue"
                maxLength={200}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setRefundTarget(null)} disabled={refunding}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={refunding} icon={Undo2}>
                Refund
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
