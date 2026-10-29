import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, CalendarRange, Download, FileSpreadsheet, Undo2, Wallet } from 'lucide-react';
import { api, download } from '../api/client';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Progress,
  SectionHeading,
  Skeleton,
  StatCard,
} from '../components/ui';
import { BOOKING_STATUS } from '../lib/constants';
import { currency } from '../lib/format';

function inputDate(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function ChartTip({ active, payload, label, currencyValue }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-lg dark:border-line-dark dark:bg-ink-850">
      <p className="font-medium">{label}</p>
      <p className="mt-0.5 font-mono text-brand-700 dark:text-brand-300">
        {currencyValue ? currency(payload[0].value) : payload[0].value}
      </p>
    </div>
  );
}

export default function AdminReports() {
  const today = new Date();
  const [from, setFrom] = useState(() => inputDate(new Date(today.getTime() - 29 * 86400000)));
  const [to, setTo] = useState(() => inputDate(today));
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  const rangeQuery = useMemo(
    () => `from=${encodeURIComponent(`${from}T00:00:00`)}&to=${encodeURIComponent(`${to}T23:59:59`)}`,
    [from, to]
  );

  const load = useCallback(async () => {
    if (!from || !to || from > to) {
      setError('Choose a valid date range.');
      setSummary(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/admin/reports/summary?${rangeQuery}`);
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [rangeQuery, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async (kind) => {
    setExporting(kind);
    try {
      await download(`/api/admin/reports/${kind}.csv?${rangeQuery}`);
      toast.success(`${kind} export downloaded`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting('');
    }
  };

  const maxStatus = summary?.statusBreakdown?.reduce((max, row) => Math.max(max, row.count), 0) || 0;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Analytics"
        title="Reports"
        description="Database-backed revenue, demand and occupancy — exportable as CSV."
      />

      <div className="surface flex flex-wrap items-end gap-3 p-4">
        <Field label="From" htmlFor="report-from" className="w-40">
          <Input id="report-from" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="To" htmlFor="report-to" className="w-40">
          <Input id="report-to" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2 pb-0.5">
          <Button size="sm" variant="secondary" icon={CalendarRange} onClick={load} loading={loading}>
            Apply range
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={Download}
            loading={exporting === 'revenue'}
            onClick={() => exportCsv('revenue')}
          >
            Revenue CSV
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={FileSpreadsheet}
            loading={exporting === 'bookings'}
            onClick={() => exportCsv('bookings')}
          >
            Bookings CSV
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={FileSpreadsheet}
            loading={exporting === 'occupancy'}
            onClick={() => exportCsv('occupancy')}
          >
            Occupancy CSV
          </Button>
        </div>
      </div>

      {loading && !summary ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="surface">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Revenue collected" value={currency(summary.totals.revenue)} hint="Captured in range" icon={Wallet} />
            <StatCard label="Refunded" value={currency(summary.totals.refunded)} hint="Issued in range" icon={Undo2} tone="amber" />
            <StatCard label="Net revenue" value={currency(summary.totals.net)} hint="Collected minus refunds" icon={BarChart3} tone="slate" />
            <StatCard label="Bookings" value={summary.totals.bookings} hint="Created in range" icon={CalendarRange} tone="brand" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="surface p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base font-semibold">Revenue trend</h2>
                  <p className="text-xs text-muted">Captured payments by day (IST)</p>
                </div>
                <Badge tone="emerald">Net {currency(summary.totals.net)}</Badge>
              </div>
              <div className="mt-4 h-72">
                {summary.revenueSeries.length === 0 ? (
                  <EmptyState compact icon={Wallet} title="No revenue in this range" description="Try a wider date range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={summary.revenueSeries} margin={{ left: -12, right: 8, top: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#059669" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(101,113,104,0.16)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => value.slice(5)}
                        tick={{ fontSize: 10, fill: '#657168' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#657168' }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                        tickFormatter={(value) => `₹${value}`}
                      />
                      <Tooltip content={<ChartTip currencyValue />} />
                      <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} fill="url(#reportRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="surface p-5">
              <h2 className="font-display text-base font-semibold">Bookings by day</h2>
              <p className="text-xs text-muted">Reservations created in range</p>
              <div className="mt-4 h-72">
                {summary.bookingSeries.length === 0 ? (
                  <EmptyState compact icon={CalendarRange} title="No bookings in this range" description="Try a wider range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.bookingSeries} margin={{ left: -24, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(101,113,104,0.16)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => value.slice(5)}
                        tick={{ fontSize: 10, fill: '#657168' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#657168' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={28} fill="#D97706" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="surface p-5">
              <h2 className="font-display text-base font-semibold">Booking status mix</h2>
              <p className="text-xs text-muted">How reservations ended up in this period</p>
              <div className="mt-4 space-y-3">
                {summary.statusBreakdown.length === 0 ? (
                  <p className="text-sm text-muted">No bookings in range.</p>
                ) : (
                  summary.statusBreakdown.map((row) => (
                    <div key={row.status}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <Badge tone={BOOKING_STATUS[row.status]?.tone || 'slate'}>
                            {BOOKING_STATUS[row.status]?.label || row.status}
                          </Badge>
                        </span>
                        <span className="font-mono">{row.count}</span>
                      </div>
                      <Progress value={maxStatus ? (row.count / maxStatus) * 100 : 0} tone={row.status === 'cancelled' ? 'amber' : 'brand'} />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="surface p-5">
              <h2 className="font-display text-base font-semibold">Top facilities</h2>
              <p className="text-xs text-muted">By bookings created in range</p>
              <div className="mt-4 overflow-hidden rounded-xl border border-line dark:border-line-dark">
                {summary.topFacilities.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-muted">No facility activity in range.</p>
                ) : (
                  summary.topFacilities.map((facility) => (
                    <div
                      key={facility.id}
                      className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3 last:border-0 dark:border-line-dark/70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{facility.name}</p>
                        <p className="text-[11px] text-muted">{facility.bookings} bookings</p>
                      </div>
                      <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-300">
                        {currency(facility.revenue)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-5 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
        <p className="font-semibold">About these numbers</p>
        <p className="mt-1">
          Revenue counts captured payments (including subsequently refunded ones separately). Occupancy CSV measures booked
          hours per zone against 24-hour capacity for the selected dates. Exports exclude anything outside the selected
          range and are protected against spreadsheet formula injection.
        </p>
      </div>
    </div>
  );
}
