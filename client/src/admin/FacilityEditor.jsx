import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Layers,
  Plus,
  Save,
  Search,
  Trash2,
  Wrench,
} from 'lucide-react';
import { api } from '../api/client';
import MapPicker from '../components/MapPicker';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  InlineNote,
  Input,
  SectionHeading,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Textarea,
  cx,
} from '../components/ui';
import { AMENITIES, SLOT_TYPES, VEHICLE_TYPES } from '../lib/constants';
import { currency, dateOnly } from '../lib/format';

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'layout', label: 'Layout' },
  { key: 'slots', label: 'Slots' },
];

const emptyForm = () => ({
  name: '',
  description: '',
  address: '',
  city: '',
  phone: '',
  lat: null,
  lng: null,
  amenities: [],
  vehicleTypes: ['4W'],
  openTime: '06:00',
  closeTime: '23:30',
  open24x7: false,
  isActive: true,
  pricing: {
    peakStartHour: 9,
    peakEndHour: 18,
    peakMultiplier: 1.25,
    weekendMultiplier: 1,
    dailyMax: 300,
    minimumCharge: 20,
    overstayGraceMinutes: 15,
  },
});

function fromFacility(facility) {
  return {
    name: facility.name || '',
    description: facility.description || '',
    address: facility.address || '',
    city: facility.city || '',
    phone: facility.phone || '',
    lat: facility.lat ?? null,
    lng: facility.lng ?? null,
    amenities: facility.amenities || [],
    vehicleTypes: facility.vehicleTypes || ['4W'],
    openTime: facility.openTime || '06:00',
    closeTime: facility.closeTime || '23:30',
    open24x7: Boolean(facility.open24x7),
    isActive: facility.isActive !== false,
    pricing: { ...emptyForm().pricing, ...(facility.pricing || {}) },
  };
}

export default function FacilityEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const loadedRef = useRef(null);

  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const [floorDraft, setFloorDraft] = useState({ name: '', level: '' });
  const [zoneDraft, setZoneDraft] = useState({});
  const [openZoneFor, setOpenZoneFor] = useState(null);
  const [slotZone, setSlotZone] = useState('');
  const [slotQuery, setSlotQuery] = useState('');
  const [bulk, setBulk] = useState({ count: 10, prefix: '', startNumber: 1 });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const loadDetail = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/admin/facilities/${id}`);
      setDetail(data);
      if (loadedRef.current !== data.facility.id) {
        loadedRef.current = data.facility.id;
        setForm(fromFacility(data.facility));
      }
      setSlotZone((current) => current || data.zones[0]?.id || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const setPricing = (key, value) =>
    setForm((prev) => ({ ...prev, pricing: { ...prev.pricing, [key]: value } }));

  const toggleArray = (key, value) =>
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((item) => item !== value) : [...prev[key], value],
    }));

  const detailsPayload = () => ({
    name: form.name.trim(),
    description: form.description,
    address: form.address.trim(),
    city: form.city.trim(),
    phone: form.phone,
    lat: form.lat,
    lng: form.lng,
    amenities: form.amenities,
    vehicleTypes: form.vehicleTypes,
    openTime: form.openTime,
    closeTime: form.closeTime,
    open24x7: form.open24x7,
    isActive: form.isActive,
  });

  const saveDetails = async (event) => {
    event?.preventDefault();
    if (form.name.trim().length < 2 || !form.address.trim() || !form.city.trim()) {
      toast.error('Name, address and city are required.');
      return;
    }
    if (!form.vehicleTypes.length) {
      toast.error('Select at least one vehicle type.');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const data = await api('/api/admin/facilities', {
          method: 'POST',
          body: { ...detailsPayload(), pricing: form.pricing },
        });
        toast.success('Facility created. Add floors and zones next.');
        navigate(`/admin/facilities/${data.facility.id}`, { replace: true });
        setTab('layout');
      } else {
        await api(`/api/admin/facilities/${id}`, { method: 'PATCH', body: detailsPayload() });
        toast.success('Facility details saved');
        loadDetail();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const savePricing = async (event) => {
    event?.preventDefault();
    setSaving(true);
    try {
      await api(`/api/admin/facilities/${id}`, { method: 'PATCH', body: { pricing: form.pricing } });
      toast.success('Pricing rules saved');
      loadDetail();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addFloor = async (event) => {
    event.preventDefault();
    if (!floorDraft.name.trim() || floorDraft.level === '') {
      toast.error('Enter a floor name and level.');
      return;
    }
    setBusy(true);
    try {
      await api(`/api/admin/facilities/${id}/floors`, {
        method: 'POST',
        body: { name: floorDraft.name.trim(), level: Number(floorDraft.level) },
      });
      setFloorDraft({ name: '', level: '' });
      toast.success('Floor added');
      loadDetail();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addZone = async (event, floorId) => {
    event.preventDefault();
    const draft = zoneDraft[floorId] || {};
    if (!draft.name?.trim() || draft.pricePerHour === undefined || draft.pricePerHour === '') {
      toast.error('Enter a zone name and hourly rate.');
      return;
    }
    setBusy(true);
    try {
      await api(`/api/admin/floors/${floorId}/zones`, {
        method: 'POST',
        body: {
          name: draft.name.trim(),
          vehicleType: draft.vehicleType || '4W',
          slotType: draft.slotType || 'standard',
          pricePerHour: Number(draft.pricePerHour),
        },
      });
      setZoneDraft((prev) => ({ ...prev, [floorId]: {} }));
      setOpenZoneFor(null);
      toast.success('Zone added');
      loadDetail();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const bulkAddSlots = async (event) => {
    event.preventDefault();
    if (!slotZone) {
      toast.error('Choose a zone first.');
      return;
    }
    setBusy(true);
    try {
      const body = { count: Number(bulk.count), startNumber: Number(bulk.startNumber) };
      if (bulk.prefix.trim()) body.prefix = bulk.prefix.trim();
      const data = await api(`/api/admin/zones/${slotZone}/slots`, { method: 'POST', body });
      toast.success(data.message || 'Slots added');
      loadDetail();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleSlotStatus = async (slot) => {
    try {
      await api(`/api/admin/slots/${slot.id}`, {
        method: 'PATCH',
        body: { status: slot.status === 'maintenance' ? 'available' : 'maintenance' },
      });
      toast.success(slot.status === 'maintenance' ? 'Slot returned to service' : 'Slot marked for maintenance');
      loadDetail();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const zones = detail?.zones || [];
  const floors = detail?.floors || [];
  const slots = detail?.slots || [];
  const zoneMap = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones]);
  const selectedZone = zoneMap.get(slotZone);
  const zoneSlots = slots
    .filter((slot) => slot.zone === slotZone)
    .filter((slot) => !slotQuery || slot.code.toLowerCase().includes(slotQuery.toLowerCase()));

  const requestDelete = (kind, item) => {
    const map = {
      facility: {
        title: 'Deactivate facility?',
        message: 'The facility will be hidden from discovery. Existing data is preserved.',
        action: async () => api(`/api/admin/facilities/${item.id}`, { method: 'DELETE' }),
        after: () => loadDetail(),
      },
      floor: {
        title: 'Delete this floor?',
        message: 'Floors can only be deleted when they have no zones.',
        action: async () => api(`/api/admin/floors/${item.id}`, { method: 'DELETE' }),
        after: () => loadDetail(),
      },
      zone: {
        title: 'Delete this zone?',
        message: 'Zones can only be deleted when they contain no active slots.',
        action: async () => api(`/api/admin/zones/${item.id}`, { method: 'DELETE' }),
        after: () => loadDetail(),
      },
      slot: {
        title: `Remove slot ${item.code}?`,
        message: 'Slots with booking history are deactivated instead of deleted, preserving the audit trail.',
        action: async () => api(`/api/admin/slots/${item.id}`, { method: 'DELETE' }),
        after: () => loadDetail(),
      },
    };
    setConfirm({ ...map[kind], item });
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await confirm.action();
      toast.success('Done');
      confirm.after?.();
      setConfirm(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!isNew && loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isNew && (error || !detail)) {
    return (
      <div className="surface">
        <ErrorState message={error || 'Facility not found'} onRetry={loadDetail} />
      </div>
    );
  }

  const facility = detail?.facility;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/facilities"
          className="inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-ink dark:hover:text-paper"
        >
          <ArrowLeft size={13} /> All facilities
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
              {isNew ? 'New facility' : facility?.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {isNew
                ? 'Create the location, then add floors, zones and bays.'
                : `${facility?.address} · ${facility?.city}`}
            </p>
          </div>
          {!isNew ? (
            <div className="flex flex-wrap items-center gap-2">
              {facility?.isActive ? <Badge tone="emerald" dot>Active</Badge> : <Badge tone="slate">Inactive</Badge>}
              <a
                href={`/facilities/${facility?.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-xs text-muted transition hover:border-brand-400 hover:text-brand-700 dark:border-line-dark dark:hover:text-brand-300"
              >
                Preview <ExternalLink size={12} />
              </a>
            </div>
          ) : null}
        </div>
      </div>

      {!isNew ? (
        <div className="surface p-2">
          <Tabs className="border-0 px-2" items={TABS} value={tab} onChange={setTab} />
        </div>
      ) : null}

      {(tab === 'details' || isNew) ? (
        <form onSubmit={saveDetails} className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="surface p-5 sm:p-6">
              <h2 className="font-display text-base font-semibold">Identity</h2>
              <div className="mt-4 space-y-4">
                <Field label="Facility name" htmlFor="f-name" required>
                  <Input
                    id="f-name"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Indiranagar Metro Parking"
                    maxLength={100}
                  />
                </Field>
                <Field label="Description" htmlFor="f-description" hint="Shown on the public facility page.">
                  <Textarea
                    id="f-description"
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    maxLength={600}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Street address" htmlFor="f-address" required>
                    <Input
                      id="f-address"
                      value={form.address}
                      onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                      maxLength={240}
                    />
                  </Field>
                  <Field label="City" htmlFor="f-city" required>
                    <Input
                      id="f-city"
                      value={form.city}
                      onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                      maxLength={60}
                    />
                  </Field>
                </div>
                <Field label="Contact phone" htmlFor="f-phone">
                  <Input
                    id="f-phone"
                    value={form.phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                    maxLength={20}
                  />
                </Field>
              </div>
            </div>

            <div className="surface p-5 sm:p-6">
              <h2 className="font-display text-base font-semibold">Access & hours</h2>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3 dark:border-line-dark">
                  <div>
                    <p className="text-sm font-medium">Open 24 hours</p>
                    <p className="text-xs text-muted">Disable opening-hour validation for this facility.</p>
                  </div>
                  <Switch
                    checked={form.open24x7}
                    onChange={(value) => setForm((prev) => ({ ...prev, open24x7: value }))}
                    label="Open 24 hours"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Opening time" htmlFor="f-open">
                    <Input
                      id="f-open"
                      type="time"
                      value={form.openTime}
                      disabled={form.open24x7}
                      onChange={(event) => setForm((prev) => ({ ...prev, openTime: event.target.value }))}
                    />
                  </Field>
                  <Field label="Closing time" htmlFor="f-close">
                    <Input
                      id="f-close"
                      type="time"
                      value={form.closeTime}
                      disabled={form.open24x7}
                      onChange={(event) => setForm((prev) => ({ ...prev, closeTime: event.target.value }))}
                    />
                  </Field>
                </div>
                <div>
                  <p className="label">Vehicle types accepted</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(VEHICLE_TYPES).map(([key, meta]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleArray('vehicleTypes', key)}
                        className={cx('chip', form.vehicleTypes.includes(key) && 'chip-active')}
                      >
                        {meta.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="label">Amenities</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(AMENITIES).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleArray('amenities', key)}
                        className={cx('chip', form.amenities.includes(key) && 'chip-active')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {!isNew ? (
                  <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3 dark:border-line-dark">
                    <div>
                      <p className="text-sm font-medium">Accepting bookings</p>
                      <p className="text-xs text-muted">Turn off to hide from discovery and reject new bookings.</p>
                    </div>
                    <Switch
                      checked={form.isActive}
                      onChange={(value) => setForm((prev) => ({ ...prev, isActive: value }))}
                      label="Facility active"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="surface p-5 sm:p-6">
              <h2 className="font-display text-base font-semibold">Location on map</h2>
              <p className="text-xs text-muted">Click the map to drop a pin, search an address, or type coordinates.</p>
              <div className="mt-4">
                <MapPicker
                  lat={form.lat}
                  lng={form.lng}
                  onChange={(lat, lng) => setForm((prev) => ({ ...prev, lat, lng }))}
                />
              </div>
            </div>

            <div className="surface p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="submit" loading={saving} icon={Save}>
                  {isNew ? 'Create facility' : 'Save details'}
                </Button>
                {!isNew ? (
                  <span className="text-[11px] text-muted">Pricing is edited on its own tab.</span>
                ) : (
                  <span className="text-[11px] text-muted">You can add floors right after creating.</span>
                )}
              </div>
            </div>
          </div>
        </form>
      ) : null}

      {!isNew && tab === 'pricing' ? (
        <form onSubmit={savePricing} className="grid gap-6 lg:grid-cols-2">
          <div className="surface p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold">Rate rules</h2>
            <p className="text-xs text-muted">Zones carry their own hourly rate. These rules apply surcharges and caps.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Peak start hour (IST)" htmlFor="p-start">
                <Input
                  id="p-start"
                  type="number"
                  min={0}
                  max={23}
                  value={form.pricing.peakStartHour}
                  onChange={(event) => setPricing('peakStartHour', event.target.value)}
                />
              </Field>
              <Field label="Peak end hour (IST)" htmlFor="p-end">
                <Input
                  id="p-end"
                  type="number"
                  min={0}
                  max={24}
                  value={form.pricing.peakEndHour}
                  onChange={(event) => setPricing('peakEndHour', event.target.value)}
                />
              </Field>
              <Field label="Peak multiplier" htmlFor="p-mult">
                <Input
                  id="p-mult"
                  type="number"
                  step="0.05"
                  min={1}
                  max={3}
                  value={form.pricing.peakMultiplier}
                  onChange={(event) => setPricing('peakMultiplier', event.target.value)}
                />
              </Field>
              <Field label="Weekend multiplier" htmlFor="p-weekend">
                <Input
                  id="p-weekend"
                  type="number"
                  step="0.05"
                  min={1}
                  max={3}
                  value={form.pricing.weekendMultiplier}
                  onChange={(event) => setPricing('weekendMultiplier', event.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="surface p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold">Guardrails</h2>
            <div className="mt-4 space-y-4">
              <Field label="Minimum charge (₹)" htmlFor="p-min">
                <Input
                  id="p-min"
                  type="number"
                  min={0}
                  value={form.pricing.minimumCharge}
                  onChange={(event) => setPricing('minimumCharge', event.target.value)}
                />
              </Field>
              <Field label="Daily maximum (₹)" htmlFor="p-max" hint="Applied per 24 hours of parking.">
                <Input
                  id="p-max"
                  type="number"
                  min={0}
                  value={form.pricing.dailyMax}
                  onChange={(event) => setPricing('dailyMax', event.target.value)}
                />
              </Field>
              <Field label="Overstay grace (minutes)" htmlFor="p-grace" hint="Time before overstay billing starts.">
                <Input
                  id="p-grace"
                  type="number"
                  min={0}
                  max={120}
                  value={form.pricing.overstayGraceMinutes}
                  onChange={(event) => setPricing('overstayGraceMinutes', event.target.value)}
                />
              </Field>
              <Button type="submit" loading={saving} icon={Save} className="w-full">
                Save pricing
              </Button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <InlineNote tone="slate" title="How the server prices a booking">
              Each started hour is charged at the zone rate. Peak hours and weekends apply the multipliers, the minimum
              charge lifts small totals, and the daily maximum caps large ones. The confirmed quote is snapshotted onto the
              booking so later changes never alter an agreed price.
            </InlineNote>
          </div>
        </form>
      ) : null}

      {!isNew && tab === 'layout' ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            {floors.length === 0 ? (
              <div className="surface">
                <EmptyState
                  icon={Layers}
                  title="No floors yet"
                  description="Add a floor first, then create zones for each vehicle type."
                />
              </div>
            ) : (
              floors.map((floor) => {
                const floorZones = zones.filter((zone) => zone.floor === floor.id);
                const draft = zoneDraft[floor.id] || {};
                return (
                  <div key={floor.id} className="surface overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper/60 px-5 py-3 dark:border-line-dark dark:bg-ink-850/60">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-xs font-mono font-semibold text-brand-700 dark:text-brand-300">
                          {floor.level}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{floor.name}</p>
                          <p className="text-[10px] text-muted">
                            {floorZones.length} zone{floorZones.length === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={Plus}
                          onClick={() => setOpenZoneFor(openZoneFor === floor.id ? null : floor.id)}
                        >
                          Add zone
                        </Button>
                        <button
                          type="button"
                          onClick={() => requestDelete('floor', floor)}
                          className="rounded-lg p-1.5 text-muted transition hover:bg-red-500/10 hover:text-red-600"
                          aria-label={`Delete floor ${floor.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="p-4">
                      {floorZones.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-line px-3 py-5 text-center text-xs text-muted dark:border-line-dark">
                          No zones on this floor yet.
                        </p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {floorZones.map((zone) => (
                            <div key={zone.id} className="rounded-xl border border-line p-3 dark:border-line-dark">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium">{zone.name}</p>
                                  <p className="text-[11px] text-muted">
                                    {VEHICLE_TYPES[zone.vehicleType]?.short} · {SLOT_TYPES[zone.slotType]}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-xs text-amber-700 dark:text-amber-300">
                                    {currency(zone.pricePerHour)}/h
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => requestDelete('zone', zone)}
                                    className="rounded-lg p-1 text-muted transition hover:bg-red-500/10 hover:text-red-600"
                                    aria-label={`Delete zone ${zone.name}`}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                              <p className="mt-2 text-[11px] text-muted">{zone.slots} slot{zone.slots === 1 ? '' : 's'}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {openZoneFor === floor.id ? (
                        <form onSubmit={(event) => addZone(event, floor.id)} className="mt-4 rounded-xl border border-brand-500/25 bg-brand-500/[0.04] p-4">
                          <p className="text-xs font-semibold">New zone on {floor.name}</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <Input
                              placeholder="Zone A · Covered"
                              value={draft.name || ''}
                              onChange={(event) =>
                                setZoneDraft((prev) => ({ ...prev, [floor.id]: { ...draft, name: event.target.value } }))
                              }
                              aria-label="Zone name"
                            />
                            <Input
                              type="number"
                              min={0}
                              placeholder="Rate per hour"
                              value={draft.pricePerHour ?? ''}
                              onChange={(event) =>
                                setZoneDraft((prev) => ({
                                  ...prev,
                                  [floor.id]: { ...draft, pricePerHour: event.target.value },
                                }))
                              }
                              aria-label="Zone rate"
                            />
                            <Select
                              value={draft.vehicleType || '4W'}
                              onChange={(event) =>
                                setZoneDraft((prev) => ({
                                  ...prev,
                                  [floor.id]: { ...draft, vehicleType: event.target.value },
                                }))
                              }
                              aria-label="Vehicle type"
                            >
                              {Object.entries(VEHICLE_TYPES).map(([key, meta]) => (
                                <option key={key} value={key}>
                                  {meta.label}
                                </option>
                              ))}
                            </Select>
                            <Select
                              value={draft.slotType || 'standard'}
                              onChange={(event) =>
                                setZoneDraft((prev) => ({ ...prev, [floor.id]: { ...draft, slotType: event.target.value } }))
                              }
                              aria-label="Slot type"
                            >
                              {Object.entries(SLOT_TYPES).map(([key, label]) => (
                                <option key={key} value={key}>
                                  {label}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button type="submit" size="xs" loading={busy}>
                              Create zone
                            </Button>
                            <Button type="button" size="xs" variant="ghost" onClick={() => setOpenZoneFor(null)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-4">
            <form onSubmit={addFloor} className="surface p-5">
              <h2 className="font-display text-base font-semibold">Add a floor</h2>
              <div className="mt-3 space-y-3">
                <Field label="Name" htmlFor="floor-name">
                  <Input
                    id="floor-name"
                    value={floorDraft.name}
                    onChange={(event) => setFloorDraft((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Level 2"
                  />
                </Field>
                <Field label="Level" htmlFor="floor-level" hint="Negative numbers allowed for basements.">
                  <Input
                    id="floor-level"
                    type="number"
                    value={floorDraft.level}
                    onChange={(event) => setFloorDraft((prev) => ({ ...prev, level: event.target.value }))}
                    placeholder="2"
                  />
                </Field>
                <Button type="submit" size="sm" icon={Plus} className="w-full" loading={busy}>
                  Add floor
                </Button>
              </div>
            </form>

            <InlineNote tone="slate" title="Layout rules">
              Slots belong to a zone, which belongs to a floor. Bookings are only accepted when the vehicle type matches
              the zone. Zones and floors with slots cannot be deleted.
            </InlineNote>
          </div>
        </div>
      ) : null}

      {!isNew && tab === 'slots' ? (
        <div className="space-y-5">
          <div className="surface p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-[220px]">
                <label className="label" htmlFor="slot-zone">
                  Zone
                </label>
                <Select id="slot-zone" value={slotZone} onChange={(event) => setSlotZone(event.target.value)}>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {floors.find((floor) => floor.id === zone.floor)?.name} · {zone.name} ({zone.slots} slots)
                    </option>
                  ))}
                </Select>
              </div>
              <div className="relative min-w-[180px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  value={slotQuery}
                  onChange={(event) => setSlotQuery(event.target.value)}
                  placeholder="Find a slot code"
                  className="h-10 pl-8 text-xs"
                  aria-label="Search slots"
                />
              </div>
            </div>

            {zones.length === 0 ? (
              <div className="mt-4">
                <InlineNote tone="amber">Create a floor and zone before adding slots.</InlineNote>
              </div>
            ) : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">
                  {selectedZone?.name || 'Slots'}
                  <span className="ml-2 text-xs font-normal text-muted">{zoneSlots.length} shown</span>
                </h2>
                {selectedZone ? (
                  <span className="font-mono text-xs text-amber-700 dark:text-amber-300">
                    {currency(selectedZone.pricePerHour)}/h
                  </span>
                ) : null}
              </div>

              {zoneSlots.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-line px-3 py-8 text-center text-xs text-muted dark:border-line-dark">
                  No slots in this zone yet. Use the generator on the right.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-6">
                  {zoneSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={cx(
                        'group relative rounded-lg border px-2 py-3 text-center',
                        slot.status === 'maintenance'
                          ? 'border-dashed border-amber-500/60 bg-amber-500/5'
                          : slot.busy
                            ? 'border-line bg-line/30 dark:border-line-dark dark:bg-line-dark/40'
                            : 'border-brand-500/30 bg-brand-500/[0.05]'
                      )}
                    >
                      <p className="font-mono text-[11px] font-semibold">{slot.code}</p>
                      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted">
                        {slot.status === 'maintenance' ? 'Maint.' : slot.busy ? 'In use' : 'Free'}
                      </p>
                      <div className="mt-2 flex justify-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => toggleSlotStatus(slot)}
                          className="rounded-md border border-line p-1 text-muted hover:border-amber-500 hover:text-amber-700 dark:border-line-dark dark:hover:text-amber-300"
                          aria-label={slot.status === 'maintenance' ? `Restore ${slot.code}` : `Set ${slot.code} to maintenance`}
                          title={slot.status === 'maintenance' ? 'Return to service' : 'Mark maintenance'}
                        >
                          <Wrench size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDelete('slot', slot)}
                          className="rounded-md border border-line p-1 text-muted hover:border-red-500 hover:text-red-600 dark:border-line-dark"
                          aria-label={`Delete ${slot.code}`}
                          title="Remove slot"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <form onSubmit={bulkAddSlots} className="surface p-5">
                <h2 className="font-display text-base font-semibold">Generate slots</h2>
                <p className="text-xs text-muted">Bulk-create sequential bay codes in the selected zone.</p>
                <div className="mt-3 space-y-3">
                  <Field label="How many?" htmlFor="bulk-count">
                    <Input
                      id="bulk-count"
                      type="number"
                      min={1}
                      max={200}
                      value={bulk.count}
                      onChange={(event) => setBulk((prev) => ({ ...prev, count: event.target.value }))}
                    />
                  </Field>
                  <Field label="Start number" htmlFor="bulk-start">
                    <Input
                      id="bulk-start"
                      type="number"
                      min={1}
                      max={999}
                      value={bulk.startNumber}
                      onChange={(event) => setBulk((prev) => ({ ...prev, startNumber: event.target.value }))}
                    />
                  </Field>
                  <Field label="Prefix (optional)" htmlFor="bulk-prefix" hint="Defaults to the zone's own prefix.">
                    <Input
                      id="bulk-prefix"
                      value={bulk.prefix}
                      onChange={(event) => setBulk((prev) => ({ ...prev, prefix: event.target.value.toUpperCase() }))}
                      placeholder="GA"
                      maxLength={8}
                    />
                  </Field>
                  <Button type="submit" size="sm" icon={Plus} className="w-full" loading={busy} disabled={!slotZone}>
                    Add slots
                  </Button>
                </div>
              </form>

              <div className="surface p-5">
                <h2 className="flex items-center gap-1.5 font-display text-base font-semibold">
                  <Building2 size={15} /> Facility facts
                </h2>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Floors</dt>
                    <dd className="font-mono">{floors.length}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Zones</dt>
                    <dd className="font-mono">{zones.length}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Slots</dt>
                    <dd className="font-mono">{slots.length}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Active bookings</dt>
                    <dd className="font-mono">{detail?.activeBookings ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Created</dt>
                    <dd>{facility ? dateOnly(facility.createdAt) : '—'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        loading={busy}
        title={confirm?.title || 'Confirm'}
        confirmLabel="Confirm"
        message={confirm?.message || ''}
      />
    </div>
  );
}
