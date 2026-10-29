import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import {
  ArrowUpRight,
  Building2,
  CalendarCheck,
  CarFront,
  CreditCard,
  Gauge,
  LayoutDashboard,
  RefreshCw,
  Undo2,
  Wallet,
} from 'lucide-react';
import { api } from '../api/client';
import {
  Badge,
  Button,
  ErrorState,
  Progress,
  SectionHeading,
  Skeleton,
  StatCard,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';
import { BOOKING_STATUS } from '../lib/constants';
import { currency, dateTime, relative, timeOnly } from '../lib/format';

function ChartTip({ active, payload, label, currencyValue = false }) {
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

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await api('/api/admin/overview');
      setData(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="surface">
        <ErrorState message={error || 'Overview unavailable'} onRetry={load} />
      </div>
    );
  }

  const { metrics, series, topFacilities, recentAudit, recentBookings } = data;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Operator overview"
        title="ParkEase control room"
        description="Every figure is computed from live database records, not hard-coded samples."
        actions={
          <>
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load}>
              Refresh
            </Button>
            <Link to="/admin/reports">
              <Button size="sm" icon={ArrowUpRight}>
                Reports
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active facilities" value={metrics.facilities} hint={`${metrics.totalSlots} bays managed`} icon={Building2} />
        <StatCard
          label="Available right now"
          value={metrics.availableSlots}
          hint={`${metrics.occupancyRate}% occupancy`}
          icon={CarFront}
          tone="amber"
        />
        <StatCard label="Vehicles inside" value={metrics.activeSessions} hint="Active staff sessions" icon={LayoutDashboard} tone="brand" />
        <StatCard label="Bookings today" value={metrics.todayBookings} hint="Reservations starting today" icon={CalendarCheck} tone="slate" />
        <StatCard label="Collected today" value={currency(metrics.todayRevenue)} hint="Captured payments today" icon={Wallet} tone="brand" />
        <StatCard label="Refunds (30d)" value={currency(metrics.refunds30d)} hint="Processed and pending" icon={Undo2} tone="amber" />
        <StatCard label="Cancellation rate" value={`${metrics.cancellationRate30d}%`} hint="Last 30 days" icon={Gauge} tone="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Revenue · last 7 days</h2>
              <p className="text-xs text-muted">Captured payments by day (IST)</p>
            </div>
            <Badge tone="emerald">Live</Badge>
          </div>
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.revenue} margin={{ left: -16, right: 6, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.32} />
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
                  width={46}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip content={<ChartTip currencyValue />} />
                <Area type="monotone" dataKey="value" stroke="#059669" strokeWidth={2} fill="url(#revenueFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Bookings · last 7 days</h2>
              <p className="text-xs text-muted">Reservations created per day</p>
            </div>
            <Badge tone="amber">Live</Badge>
          </div>
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.bookings} margin={{ left: -22, right: 6, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(101,113,104,0.16)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => value.slice(5)}
                  tick={{ fontSize: 10, fill: '#657168' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: '#657168' }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={34}>
                  {series.bookings.map((entry, index) => (
                    <Cell key={entry.date} fill={index === series.bookings.length - 1 ? '#059669' : '#D97706'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-line-dark">
            <div>
              <h2 className="font-display text-base font-semibold">Top facilities</h2>
              <p className="text-xs text-muted">Current bay utilisation</p>
            </div>
            <Link to="/admin/facilities" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
              Manage
            </Link>
          </div>
          <div className="divide-y divide-line dark:divide-line-dark">
            {topFacilities.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No active facilities yet.</p>
            ) : (
              topFacilities.map((facility) => (
                <div key={facility.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">{facility.name}</p>
                      <span className="font-mono text-xs text-muted">{facility.busy}/{facility.slots}</span>
                    </div>
                    <div className="mt-2">
                      <Progress value={facility.utilization} />
                    </div>
                  </div>
                  <span className="w-14 text-right font-mono text-xs font-semibold">{facility.utilization}%</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Recent activity</h2>
              <p className="text-xs text-muted">Audit trail</p>
            </div>
            <Link to="/admin/audit" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
              All logs
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {recentAudit.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{event.summary || event.action}</p>
                  <p className="text-[10px] text-muted">
                    {event.actor} · {event.role} · {relative(event.at)}
                  </p>
                </div>
              </li>
            ))}
            {!recentAudit.length ? <p className="text-xs text-muted">No activity yet.</p> : null}
          </ul>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-line-dark">
          <div>
            <h2 className="font-display text-base font-semibold">Latest bookings</h2>
            <p className="text-xs text-muted">Newest reservations across all facilities</p>
          </div>
          <Link to="/admin/bookings" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
            Open bookings
          </Link>
        </div>
        <Table minWidth={760}>
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Customer</Th>
              <Th>Facility</Th>
              <Th>Start</Th>
              <Th>Status</Th>
              <Th className="text-right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {recentBookings.map((booking) => (
              <Tr key={booking.id}>
                <Td className="font-mono text-xs">{booking.ref}</Td>
                <Td className="text-xs">{booking.customer}</Td>
                <Td className="text-xs">{booking.facility}</Td>
                <Td className="text-xs text-muted">
                  {dateTime(booking.startTime)}
                  <span className="block text-[10px]">{timeOnly(booking.startTime)}</span>
                </Td>
                <Td>
                  <Badge tone={BOOKING_STATUS[booking.status]?.tone || 'slate'}>
                    {BOOKING_STATUS[booking.status]?.label || booking.status}
                  </Badge>
                </Td>
                <Td className="text-right font-mono text-xs">{currency(booking.amount)}</Td>
              </Tr>
            ))}
            {!recentBookings.length ? (
              <Tr>
                <Td colSpan={6} className="py-8 text-center text-sm text-muted">
                  No bookings yet.
                </Td>
              </Tr>
            ) : null}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
