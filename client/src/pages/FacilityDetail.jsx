import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Info,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Star,
  Ticket,
  Wallet,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import CheckoutModal from '../components/CheckoutModal';
import MapView from '../components/MapView';
import SlotGrid from '../components/SlotGrid';
import TicketModal from '../components/TicketModal';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  InlineNote,
  Input,
  Modal,
  Select,
  Skeleton,
  cx,
} from '../components/ui';
import { AMENITIES, SLOT_TYPES, VEHICLE_TYPES } from '../lib/constants';
import {
  currency,
  dateInput,
  dateOnly,
  dateTime,
  isFacilityOpen,
  openHoursLabel,
  relative,
  timeOnly,
} from '../lib/format';

const IST = 5.5 * 3600 * 1000;

function minutesOfDay(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

function parseClock(value) {
  const [hour, minute] = String(value || '00:00').split(':').map(Number);
  return hour * 60 + minute;
}

function withinHours(date, facility) {
  if (facility?.open24x7) return true;
  const open = parseClock(facility?.openTime || '00:00');
  const close = parseClock(facility?.closeTime || '23:59');
  if (close <= open) return true;
  const minutes = minutesOfDay(date);
  return minutes >= open && minutes <= close;
}

function tomorrowAt(hour, minute = 0) {
  const now = new Date();
  const shifted = new Date(now.getTime() + IST);
  const base = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1, hour, minute);
  return new Date(base - IST);
}

function defaultWindow() {
  const base = new Date(Date.now() + 45 * 60000);
  base.setSeconds(0, 0);
  const minutes = base.getMinutes();
  base.setMinutes(minutes < 30 ? 30 : 60);
  return { start: base, end: new Date(base.getTime() + 2 * 3600000) };
}

function Stars({ value = 0, size = 13 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-line dark:text-line-dark'}
        />
      ))}
    </span>
  );
}

export default function FacilityDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const firstWindow = useRef(defaultWindow());
  const [start, setStart] = useState(() => dateInput(firstWindow.current.start));
  const [end, setEnd] = useState(() => dateInput(firstWindow.current.end));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [manualVehicle, setManualVehicle] = useState(false);
  const [manualPlate, setManualPlate] = useState('');
  const [reserving, setReserving] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const adjustedRef = useRef(false);

  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;

  const loadDetail = useCallback(
    async (signal) => {
      const params = new URLSearchParams();
      if (start) {
        const value = new Date(start);
        if (!Number.isNaN(value.getTime())) params.set('start', value.toISOString());
      }
      if (end) {
        const value = new Date(end);
        if (!Number.isNaN(value.getTime())) params.set('end', value.toISOString());
      }
      return api(`/api/facilities/${id}?${params.toString()}`, { auth: false, signal });
    },
    [id, start, end]
  );

  useEffect(() => {
    const controller = new AbortController();
    if (!data) setLoading(true);
    else setRefreshing(true);
    setError('');

    loadDetail(controller.signal)
      .then((payload) => {
        setData(payload);
        if (!adjustedRef.current) {
          adjustedRef.current = true;
          const facility = payload.facility;
          if (!withinHours(startDate, facility) || !withinHours(endDate, facility)) {
            const open = parseClock(facility.openTime || '06:00');
            const nextStart = tomorrowAt(Math.min(23, Math.floor(open / 60) + 1));
            setStart(dateInput(nextStart));
            setEnd(dateInput(new Date(nextStart.getTime() + 2 * 3600000)));
          }
        }
        setSelected((current) => {
          if (!current) return null;
          const fresh = payload.slots.find((slot) => slot.id === current.slot.id);
          if (!fresh || fresh.busy || fresh.status === 'maintenance') {
            toast.error('That bay was just taken. Pick another one.');
            return null;
          }
          return { ...current, slot: fresh };
        });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [loadDetail, reloadKey]);

  useEffect(() => {
    if (!user) {
      setVehicles([]);
      return;
    }
    api('/api/vehicles')
      .then((payload) => setVehicles(payload.vehicles || []))
      .catch(() => setVehicles([]));
  }, [user]);

  const zoneForSlot = selected?.zone || null;
  const matchingVehicles = useMemo(
    () => (zoneForSlot ? vehicles.filter((vehicle) => vehicle.type === zoneForSlot.vehicleType) : []),
    [vehicles, zoneForSlot]
  );

  const slotKey = selected?.slot?.id;
  useEffect(() => {
    if (!slotKey) return;
    const matches = vehicles.filter((vehicle) => vehicle.type === zoneForSlot?.vehicleType);
    const preferred = matches.find((vehicle) => vehicle.isDefault) || matches[0];
    setVehicleId(preferred?.id || '');
    setManualVehicle(!preferred);
  }, [slotKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected?.slot?.id) {
      setQuote(null);
      setQuoteError('');
      return undefined;
    }
    if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setQuote(null);
      setQuoteError('Choose a valid start and end time.');
      return undefined;
    }
    if (endDate <= startDate) {
      setQuote(null);
      setQuoteError('End time must be after the start time.');
      return undefined;
    }
    if (endDate - startDate < 30 * 60000) {
      setQuote(null);
      setQuoteError('Minimum booking duration is 30 minutes.');
      return undefined;
    }

    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError('');
    const timer = setTimeout(async () => {
      try {
        const payload = await api('/api/bookings/quote', {
          method: 'POST',
          body: {
            slotId: selected.slot.id,
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
          },
          auth: false,
        });
        if (!cancelled) setQuote(payload.quote);
      } catch (err) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(err.message);
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selected?.slot?.id, start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectSlot = (slot) => {
    const zone = data?.zones.find((item) => item.id === slot.zone);
    setSelected({ slot, zone });
    setQuote(null);
  };

  const setDuration = (hours) => {
    if (!startDate) return;
    setEnd(dateInput(new Date(startDate.getTime() + hours * 3600000)));
  };

  const durationHours = startDate && endDate ? Math.max(0, (endDate - startDate) / 3600000) : 0;

  const reserve = async () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (!selected || !quote) return;
    if (manualVehicle && !manualPlate.trim()) {
      toast.error('Enter the vehicle registration number.');
      return;
    }
    setReserving(true);
    try {
      const body = {
        slotId: selected.slot.id,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      };
      if (manualVehicle || !vehicleId) {
        body.plate = manualPlate.trim().toUpperCase();
        body.vehicleType = selected.zone.vehicleType;
      } else {
        body.vehicleId = vehicleId;
      }
      const payload = await api('/api/bookings', { method: 'POST', body });
      setCheckout(payload);
    } catch (err) {
      toast.error(err.message);
      if (err.code === 'slot_conflict' || err.code === 'invalid_state') {
        setSelected(null);
        setQuote(null);
        setReloadKey((value) => value + 1);
      }
    } finally {
      setReserving(false);
    }
  };

  const handlePaid = (payload) => {
    setCheckout(null);
    setTicket({ booking: payload.booking, ticket: payload.ticket });
    setSelected(null);
    setQuote(null);
    setReloadKey((value) => value + 1);
    if (payload.booking?.status === 'confirmed') toast.success('Booking confirmed. Your pass is ready.');
  };

  const handlePaymentFailure = () => {
    setCheckout(null);
    setSelected(null);
    setQuote(null);
    setReloadKey((value) => value + 1);
  };

  if (loading) {
    return (
      <div className="page py-8">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-64 w-full rounded-3xl" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page py-16">
        <div className="surface">
          <ErrorState message={error || 'Facility not found.'} onRetry={() => setReloadKey((value) => value + 1)} />
        </div>
      </div>
    );
  }

  const facility = data.facility;
  const freeCount = data.slots.filter((slot) => !slot.busy && slot.status === 'available').length;
  const mapFacility = {
    ...facility,
    totalSlots: data.slots.length,
    availableSlots: freeCount,
    minPrice: data.zones.length ? Math.min(...data.zones.map((zone) => zone.pricePerHour)) : null,
  };

  return (
    <div className="page pb-20 pt-6">
      <nav className="flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-ink dark:hover:text-paper">
          Home
        </Link>
        <ChevronRight size={12} />
        <Link to="/facilities" className="hover:text-ink dark:hover:text-paper">
          Find parking
        </Link>
        <ChevronRight size={12} />
        <span className="truncate font-medium text-ink/80 dark:text-paper/80">{facility.name}</span>
      </nav>

      <header className="relative mt-4 overflow-hidden rounded-3xl bg-ink-950 p-6 text-paper sm:p-8">
        <div className="absolute inset-0 opacity-30" aria-hidden>
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-600/50 blur-3xl" />
          <div className="absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="absolute inset-0 grid grid-cols-10 gap-2 p-6 opacity-20">
            {Array.from({ length: 30 }).map((_, index) => (
              <span key={index} className="rounded border border-white/40 bg-white/5" />
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isFacilityOpen(facility) ? 'emerald' : 'slate'} dot>
              {isFacilityOpen(facility) ? 'Open now' : 'Closed now'}
            </Badge>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-mono text-white/70">
              <Clock3 size={11} /> {openHoursLabel(facility)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
              <Star size={11} className="fill-amber-400 text-amber-400" />
              {facility.rating?.average ? `${facility.rating.average.toFixed(1)} (${facility.rating.count} reviews)` : 'New on ParkEase'}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{facility.name}</h1>
              <p className="mt-2 flex items-start gap-1.5 text-sm text-white/60">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                {facility.address}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">{facility.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {facility.phone ? (
                <a
                  href={`tel:${facility.phone.replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10"
                >
                  <Phone size={13} /> {facility.phone}
                </a>
              ) : null}
              {facility.lat != null && facility.lng != null ? (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10"
                >
                  <Navigation size={13} /> Directions
                </a>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white">
                {freeCount} of {data.slots.length} free now
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {facility.amenities.map((amenity) => (
              <span
                key={amenity}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/65"
              >
                <CheckCircle2 size={11} className="text-brand-400" /> {AMENITIES[amenity] || amenity}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <section className="surface p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">Choose your window</h2>
                <p className="mt-0.5 text-sm text-muted">Availability is checked against the exact time range you pick.</p>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => setDuration(hours)}
                    className={cx(
                      'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition',
                      Math.abs(durationHours - hours) < 0.01
                        ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                        : 'border-line text-muted hover:border-brand-400 dark:border-line-dark'
                    )}
                  >
                    {hours}h
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Start" htmlFor="start">
                <Input
                  id="start"
                  type="datetime-local"
                  value={start}
                  min={dateInput(new Date())}
                  onChange={(event) => setStart(event.target.value)}
                />
              </Field>
              <Field label="End" htmlFor="end" hint={startDate ? `Duration ${durationHours.toFixed(1)} h` : undefined}>
                <Input id="end" type="datetime-local" value={end} min={start || dateInput(new Date())} onChange={(event) => setEnd(event.target.value)} />
              </Field>
            </div>

            {!withinHours(startDate, facility) ? (
              <div className="mt-3">
                <InlineNote tone="amber" title="Outside opening hours">
                  This facility runs {openHoursLabel(facility)}. Pick a window inside those hours.
                </InlineNote>
              </div>
            ) : null}

            <div className="mt-6">
              <SlotGrid
                floors={data.floors}
                zones={data.zones}
                slots={data.slots}
                selectedId={selected?.slot?.id}
                onSelect={selectSlot}
                loading={refreshing}
              />
            </div>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-line-dark">
                <div>
                  <h2 className="font-display text-base font-semibold">Getting there</h2>
                  <p className="text-xs text-muted">{facility.city}</p>
                </div>
                {facility.lat != null ? (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                  >
                    Open in Maps
                  </a>
                ) : null}
              </div>
              {facility.lat != null && facility.lng != null ? (
                <MapView
                  facilities={[mapFacility]}
                  center={[facility.lat, facility.lng]}
                  zoom={15}
                  selectedId={facility.id}
                  className="h-56 rounded-none border-0"
                />
              ) : (
                <div className="p-6">
                  <EmptyState
                    compact
                    icon={MapPin}
                    title="Map pin not set"
                    description="The operator has not published coordinates for this facility yet."
                  />
                </div>
              )}
            </section>

            <section className="surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">Driver reviews</h2>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <Stars value={facility.rating?.average || 0} /> {facility.rating?.count || 0}
                </span>
              </div>
              <div className="mt-3 space-y-4">
                {data.reviews.length === 0 ? (
                  <p className="rounded-xl bg-paper px-3 py-4 text-xs text-muted dark:bg-ink-850">
                    No reviews yet. Reviews are only accepted from drivers who completed a stay here.
                  </p>
                ) : (
                  data.reviews.slice(0, 3).map((review) => (
                    <article key={review.id} className="border-b border-line pb-3 last:border-0 last:pb-0 dark:border-line-dark">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{review.author}</p>
                        <span className="font-mono text-[10px] text-muted">{relative(review.createdAt)}</span>
                      </div>
                      <div className="mt-1">
                        <Stars value={review.rating} size={11} />
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{review.comment}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>

        <aside className="h-fit lg:sticky lg:top-24">
          <div className="surface overflow-hidden">
            <div className="border-b border-line bg-paper/60 px-5 py-4 dark:border-line-dark dark:bg-ink-850/60">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Your reservation</p>
              <p className="mt-1 font-display text-lg font-semibold">
                {quote ? currency(quote.total) : '—'}
                <span className="ml-1.5 text-xs font-normal text-muted">
                  {quote ? `for ${quote.hours} hour${quote.hours === 1 ? '' : 's'}` : 'select a bay'}
                </span>
              </p>
            </div>

            <div className="space-y-4 p-5">
              {selected ? (
                <div className="rounded-xl border border-brand-500/25 bg-brand-500/[0.05] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted">Selected bay</p>
                      <p className="font-mono text-base font-semibold text-brand-700 dark:text-brand-300">{selected.slot.code}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {selected.zone?.name} · {SLOT_TYPES[selected.zone?.slotType]} ·{' '}
                        {VEHICLE_TYPES[selected.zone?.vehicleType]?.short}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(null);
                        setQuote(null);
                      }}
                      className="text-[11px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline dark:hover:text-paper"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center dark:border-line-dark">
                  <p className="font-display text-sm font-medium">Pick a bay above</p>
                  <p className="mt-1 text-xs text-muted">Green bays are free for your chosen window.</p>
                </div>
              )}

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted">
                    <CalendarClock size={12} /> Window
                  </span>
                  <span className="text-right font-medium">
                    {startDate && endDate ? `${dateTime(startDate)} → ${timeOnly(endDate)}` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted">
                    <Clock3 size={12} /> Duration
                  </span>
                  <span className="font-mono">{durationHours ? `${durationHours.toFixed(1)} h` : '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted">
                    <ShieldCheck size={12} /> Entry
                  </span>
                  <span>Opens 1 h before start</span>
                </div>
              </div>

              {user ? (
                <div className="border-t border-line pt-4 dark:border-line-dark">
                  <div className="flex items-center justify-between">
                    <p className="label mb-0">Vehicle</p>
                    <button
                      type="button"
                      onClick={() => setManualVehicle((value) => !value)}
                      className="text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-300"
                    >
                      {manualVehicle ? 'Use saved vehicle' : 'Use another vehicle'}
                    </button>
                  </div>
                  {manualVehicle || matchingVehicles.length === 0 ? (
                    <div className="mt-2">
                      <Input
                        value={manualPlate}
                        onChange={(event) => setManualPlate(event.target.value.toUpperCase())}
                        placeholder="KA-01-AB-1234"
                        aria-label="Vehicle registration number"
                        maxLength={16}
                      />
                      <p className="hint">
                        {selected
                          ? `${VEHICLE_TYPES[selected.zone.vehicleType].label} bay — plate must match this vehicle type.`
                          : 'Select a bay to see which vehicle type is allowed.'}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <Select
                        value={vehicleId}
                        onChange={(event) => setVehicleId(event.target.value)}
                        aria-label="Saved vehicle"
                      >
                        {matchingVehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.plate} · {vehicle.make} {vehicle.model}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <Link to="/vehicles" className="mt-2 inline-flex items-center gap-0.5 text-[11px] text-muted hover:text-brand-700 dark:hover:text-brand-300">
                    Manage vehicles <ChevronRight size={11} />
                  </Link>
                </div>
              ) : (
                <InlineNote tone="slate" title="Sign in to reserve">
                  <span className="inline-flex items-center gap-1.5">
                    <Info size={12} /> An account keeps your passes and receipts in one place.
                  </span>
                </InlineNote>
              )}

              {quoteLoading ? (
                <div className="space-y-2 border-t border-line pt-4 dark:border-line-dark">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ) : quote ? (
                <div className="space-y-1.5 border-t border-line pt-4 text-xs dark:border-line-dark">
                  {quote.lines.map((line) => (
                    <div key={line.label} className="flex justify-between gap-2">
                      <span className="text-muted">{line.label}</span>
                      <span className="font-mono">{currency(line.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-2 border-t border-line pt-2 text-sm font-semibold dark:border-line-dark">
                    <span>Total</span>
                    <span className="font-mono text-amber-700 dark:text-amber-300">{currency(quote.total)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPolicyOpen(true)}
                    className="mt-1 text-[10px] text-muted underline underline-offset-2 hover:text-ink dark:hover:text-paper"
                  >
                    Cancellation & refund policy
                  </button>
                </div>
              ) : quoteError && selected ? (
                <p className="border-t border-line pt-4 text-xs font-medium text-amber-700 dark:border-line-dark dark:text-amber-300">
                  {quoteError}
                </p>
              ) : null}

              <Button
                className="w-full"
                size="lg"
                loading={reserving}
                disabled={!quote || quoteLoading || !selected || !withinHours(startDate, facility)}
                onClick={reserve}
                iconRight={ArrowRight}
              >
                {user ? (quote ? `Reserve for ${currency(quote.total)}` : 'Select a bay') : 'Sign in to reserve'}
              </Button>
              <p className="text-center text-[10px] leading-relaxed text-muted">
                {user ? 'Price is locked to this booking. Slot held for 10 minutes at checkout.' : 'New to ParkEase? Creating an account takes under a minute.'}
              </p>
            </div>
          </div>

          <div className="surface mt-4 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Pricing notes</p>
            <ul className="mt-2 space-y-1.5 text-[11px] text-muted">
              <li className="flex justify-between gap-2">
                <span>Peak hours</span>
                <span className="font-mono">
                  {facility.pricing.peakStartHour}:00–{facility.pricing.peakEndHour}:00 · ×{facility.pricing.peakMultiplier}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Daily maximum</span>
                <span className="font-mono">{currency(facility.pricing.dailyMax)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Overstay grace</span>
                <span className="font-mono">{facility.pricing.overstayGraceMinutes} min</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <CheckoutModal
        open={Boolean(checkout)}
        onClose={() => setCheckout(null)}
        checkout={checkout}
        onPaid={handlePaid}
        onFailed={handlePaymentFailure}
      />

      <TicketModal
        open={Boolean(ticket)}
        onClose={() => setTicket(null)}
        booking={ticket?.booking}
        ticket={ticket?.ticket}
      />

      <Modal open={policyOpen} onClose={() => setPolicyOpen(false)} title="Cancellation & refund policy" size="sm">
        <div className="space-y-3 text-sm text-ink/75 dark:text-paper/75">
          <p>Cancel more than 2 hours before the start time for a full refund.</p>
          <p>Between 1 and 2 hours before start: 75% refund.</p>
          <p>Within 1 hour of the start time: 50% refund.</p>
          <p>Once the vehicle has checked in, the booking cannot be cancelled.</p>
          <div className="rounded-xl bg-paper p-3 text-xs text-muted dark:bg-ink-850">
            <p className="flex items-center gap-1.5 font-medium text-ink dark:text-paper">
              <Wallet size={13} /> Refunds in this build
            </p>
            <p className="mt-1">
              Demo payments are refunded instantly in the ledger. With Razorpay test keys configured, refunds are requested
              from the provider and their status is tracked.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
