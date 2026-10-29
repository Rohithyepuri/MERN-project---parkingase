import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, ExternalLink, MapPin, Plus, Search, Settings2 } from 'lucide-react';
import { api } from '../api/client';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  InlineNote,
  Input,
  Progress,
  SectionHeading,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';
import { currency } from '../lib/format';

export default function AdminFacilities() {
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/admin/facilities');
      setFacilities(data.facilities || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return facilities;
    const needle = query.trim().toLowerCase();
    return facilities.filter((facility) =>
      [facility.name, facility.address, facility.city].some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [facilities, query]);

  const deactivate = async () => {
    if (!target) return;
    setDeactivating(true);
    try {
      await api(`/api/admin/facilities/${target.id}`, { method: 'DELETE' });
      toast.success('Facility deactivated');
      setTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Inventory"
        title="Facilities"
        description="Physical locations, their layout and live utilisation."
        actions={
          <Button size="sm" icon={Plus} onClick={() => navigate('/admin/facilities/new')}>
            Add facility
          </Button>
        }
      />

      <div className="surface p-4">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, address or city"
            className="pl-10"
            aria-label="Search facilities"
          />
        </div>
      </div>

      <InlineNote tone="slate" title="Deactivation, not deletion">
        Deactivating hides a facility from discovery and blocks new bookings while preserving every existing booking, payment
        and audit record. Slots with upcoming bookings cannot be taken out of service.
      </InlineNote>

      <div className="surface overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={query ? 'No facilities match that search' : 'No facilities yet'}
            description={
              query ? 'Try a different name or city.' : 'Create your first facility, add floors and zones, then publish slots.'
            }
            action={
              query ? (
                <Button variant="secondary" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              ) : (
                <Button icon={Plus} onClick={() => navigate('/admin/facilities/new')}>
                  Add facility
                </Button>
              )
            }
          />
        ) : (
          <Table minWidth={900}>
            <thead>
              <tr>
                <Th>Facility</Th>
                <Th>Layout</Th>
                <Th>Live occupancy</Th>
                <Th>EV charging</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((facility) => {
                const utilisation = facility.slots ? Math.round((facility.busyNow / facility.slots) * 100) : 0;
                return (
                  <Tr key={facility.id}>
                    <Td>
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                          <Building2 size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{facility.name}</p>
                          <p className="flex items-center gap-1 truncate text-[11px] text-muted">
                            <MapPin size={10} /> {facility.address}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {facility.floors} floor{facility.floors === 1 ? '' : 's'} · {facility.zones} zone{facility.zones === 1 ? '' : 's'}
                      <span className="block text-[10px]">{facility.slots} bays</span>
                    </Td>
                    <Td>
                      <div className="w-32">
                        <div className="mb-1 flex justify-between text-[10px] text-muted">
                          <span className="font-mono">
                            {facility.busyNow}/{facility.slots}
                          </span>
                          <span>{utilisation}%</span>
                        </div>
                        <Progress value={utilisation} />
                      </div>
                    </Td>
                    <Td className="text-xs text-muted">
                      {facility.amenities?.includes('ev_charging') ? <Badge tone="emerald">EV ready</Badge> : '—'}
                    </Td>
                    <Td>
                      {facility.isActive ? <Badge tone="emerald" dot>Active</Badge> : <Badge tone="slate">Inactive</Badge>}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={Settings2}
                          onClick={() => navigate(`/admin/facilities/${facility.id}`)}
                        >
                          Manage
                        </Button>
                        {facility.isActive ? (
                          <Button size="xs" variant="ghost" onClick={() => setTarget(facility)}>
                            Deactivate
                          </Button>
                        ) : null}
                        <a
                          href={`/facilities/${facility.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-ink/5 hover:text-ink dark:hover:bg-white/5 dark:hover:text-paper"
                          aria-label={`Preview ${facility.name}`}
                          title="Preview public page"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        onConfirm={deactivate}
        loading={deactivating}
        title="Deactivate this facility?"
        confirmLabel="Deactivate"
        message={
          target
            ? `${target.name} will disappear from public search and reject new bookings. Existing bookings, payments and audit history are kept. You can reactivate it later from the facility editor.`
            : ''
        }
      />
    </div>
  );
}
