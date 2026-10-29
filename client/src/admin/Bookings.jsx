import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarCheck, ExternalLink, Filter, Search } from 'lucide-react';
import { api } from '../api/client';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  SectionHeading,
  Select,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';
import { BOOKING_STATUS } from '../lib/constants';
import { currency, dateTime, timeOnly } from '../lib/format';
import { useDebounce } from '../lib/useDebounce';

export default function AdminBookings() {
  const [filters, setFilters] = useState({ status: '', facility: '', search: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ bookings: [], pagination: null });
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const search = useDebounce(filters.search, 350);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (filters.status) params.set('status', filters.status);
      if (filters.facility) params.set('facility', filters.facility);
      if (search) params.set('search', search);
      const [bookingData, facilityData] = await Promise.all([
        api(`/api/admin/bookings?${params.toString()}`),
        api('/api/admin/facilities'),
      ]);
      setData(bookingData);
      setFacilities(facilityData.facilities || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters.status, filters.facility, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters.status, filters.facility, search]);

  const cancelBooking = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const result = await api(`/api/bookings/${cancelTarget.id}/cancel`, {
        method: 'POST',
        body: { reason: 'Cancelled by administrator' },
      });
      toast.success(
        result.refund ? `Cancelled · ${currency(result.refund.amount)} refunded` : 'Booking cancelled'
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
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Operations"
        title="Bookings"
        description="Every reservation, with the authoritative server state and refund record."
      />

      <div className="surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="label" htmlFor="booking-search">
              Search
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                id="booking-search"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder="Reference, plate, customer email"
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
          <div className="w-40">
            <label className="label" htmlFor="booking-status">
              Status
            </label>
            <Select
              id="booking-status"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="h-9 py-0 text-xs"
            >
              <option value="">All statuses</option>
              {Object.entries(BOOKING_STATUS).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-56">
            <label className="label" htmlFor="booking-facility">
              Facility
            </label>
            <Select
              id="booking-facility"
              value={filters.facility}
              onChange={(event) => setFilters((prev) => ({ ...prev, facility: event.target.value }))}
              className="h-9 py-0 text-xs"
            >
              <option value="">All facilities</option>
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </Select>
          </div>
          {(filters.search || filters.status || filters.facility) && (
            <Button
              size="sm"
              variant="ghost"
              icon={Filter}
              onClick={() => setFilters({ status: '', facility: '', search: '' })}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      <div className="surface overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data.bookings.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No bookings found"
            description="Adjust the filters or wait for the next reservation."
          />
        ) : (
          <>
            <Table minWidth={960}>
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Customer</Th>
                  <Th>Facility / bay</Th>
                  <Th>Window</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.bookings.map((booking) => (
                  <Tr key={booking.id}>
                    <Td className="font-mono text-xs">{booking.ref}</Td>
                    <Td>
                      <p className="text-xs font-medium">{booking.user?.name || '—'}</p>
                      <p className="text-[10px] text-muted">{booking.user?.email}</p>
                    </Td>
                    <Td>
                      <p className="text-xs">{booking.facility?.name}</p>
                      <p className="font-mono text-[10px] text-muted">
                        {booking.slot?.code} · {booking.vehicle?.plate}
                      </p>
                    </Td>
                    <Td className="text-xs text-muted">
                      {dateTime(booking.startTime)}
                      <span className="block text-[10px]">to {timeOnly(booking.endTime)}</span>
                    </Td>
                    <Td>
                      <Badge tone={BOOKING_STATUS[booking.status]?.tone || 'slate'}>
                        {BOOKING_STATUS[booking.status]?.label || booking.status}
                      </Badge>
                    </Td>
                    <Td className="text-right font-mono text-xs">
                      {currency(booking.finalAmount ?? booking.amountPaid ?? booking.quote?.total)}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        <Link
                          to={`/bookings/${booking.id}`}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-[11px] text-muted transition hover:border-brand-400 hover:text-brand-700 dark:border-line-dark dark:hover:text-brand-300"
                        >
                          View <ExternalLink size={11} />
                        </Link>
                        {['confirmed', 'pending'].includes(booking.status) ? (
                          <Button size="xs" variant="ghost" onClick={() => setCancelTarget(booking)}>
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                ))}
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
        )}
      </div>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={cancelBooking}
        loading={cancelling}
        title="Cancel this booking?"
        confirmLabel="Cancel booking"
        message={
          cancelTarget
            ? `Cancelling ${cancelTarget.ref} applies the standard refund policy and is recorded in the audit log. This action cannot be undone.`
            : ''
        }
      />
    </div>
  );
}
