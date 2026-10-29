import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowUpRight,
  Building2,
  Compass,
  Crosshair,
  List,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import FacilityCard from '../components/FacilityCard';
import MapView from '../components/MapView';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  cx,
} from '../components/ui';
import { AMENITIES, VEHICLE_TYPES } from '../lib/constants';
import { currency, distanceLabel, openHoursLabel, relative } from '../lib/format';
import { useDebounce } from '../lib/useDebounce';

const SORTS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'distance', label: 'Nearest first' },
  { value: 'price', label: 'Lowest price' },
  { value: 'availability', label: 'Most available' },
  { value: 'rating', label: 'Top rated' },
];

const AMENITY_FILTERS = ['covered', 'cctv', 'ev_charging', 'accessible'];

export default function FindParking() {
  const { user, refresh } = useAuth();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [vehicleType, setVehicleType] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [amenities, setAmenities] = useState([]);
  const [sort, setSort] = useState('recommended');
  const [coords, setCoords] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [compare, setCompare] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [mobileView, setMobileView] = useState('list');
  const [locating, setLocating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const controllerRef = useRef(null);

  const amenityKey = amenities.join(',');

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (vehicleType) params.set('vehicleType', vehicleType);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (amenityKey) params.set('amenities', amenityKey);
    if (sort) params.set('sort', sort);
    if (coords) {
      params.set('lat', coords.lat);
      params.set('lng', coords.lng);
      if (sort === 'recommended') params.set('sort', 'distance');
    }

    setLoading(true);
    setError('');
    api(`/api/facilities?${params.toString()}`, { auth: false, signal: controller.signal })
      .then((data) => {
        setFacilities(data.facilities || []);
        setUpdatedAt(data.updatedAt);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, vehicleType, maxPrice, amenityKey, sort, coords, reloadKey]);

  const activeFilters =
    (vehicleType ? 1 : 0) + (maxPrice ? 1 : 0) + amenities.length + (coords ? 1 : 0);

  const toggleAmenity = (amenity) => {
    setAmenities((prev) => (prev.includes(amenity) ? prev.filter((item) => item !== amenity) : [...prev, amenity]));
  };

  const nearMe = () => {
    if (!navigator.geolocation) {
      toast.error('Your browser does not support geolocation.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5)),
        });
        setSort('distance');
        setLocating(false);
        toast.success('Sorted by distance from you');
      },
      () => {
        setLocating(false);
        toast.error('Location permission denied. You can still search by area.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  };

  const toggleCompare = (facility) => {
    setCompare((prev) => {
      const exists = prev.find((item) => item.id === facility.id);
      if (exists) return prev.filter((item) => item.id !== facility.id);
      if (prev.length >= 3) {
        toast.error('You can compare up to three facilities.');
        return prev;
      }
      return [...prev, facility];
    });
  };

  const selectFromMap = (facility) => {
    setSelectedId(facility.id);
    setMobileView('list');
    setTimeout(() => {
      document.getElementById(`facility-${facility.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  };

  const clearAll = () => {
    setSearch('');
    setVehicleType('');
    setMaxPrice('');
    setAmenities([]);
    setCoords(null);
    setSort('recommended');
  };

  const favoriteIds = useMemo(() => new Set((user?.favorites || []).map(String)), [user?.favorites]);

  const toggleFavorite = async (facility) => {
    if (!user) return;
    try {
      const result = await api(`/api/facilities/${facility.id}/favorite`, { method: 'POST' });
      await refresh();
      toast.success(result.favorited ? 'Saved to favourites' : 'Removed from favourites');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const compareRows = useMemo(
    () => [
      { label: 'From', render: (f) => (f.minPrice != null ? `${currency(f.minPrice)}/h` : '—') },
      { label: 'Available now', render: (f) => `${f.availableSlots} of ${f.totalSlots} bays` },
      { label: 'Distance', render: (f) => (f.distanceKm != null ? distanceLabel(f.distanceKm) : '—') },
      { label: 'Rating', render: (f) => (f.rating?.average ? `${f.rating.average.toFixed(1)} / 5 (${f.rating.count})` : 'New') },
      { label: 'Hours', render: (f) => openHoursLabel(f) },
      { label: 'Vehicle types', render: (f) => f.vehicleTypes.map((t) => VEHICLE_TYPES[t]?.short || t).join(' · ') },
      { label: 'Amenities', render: (f) => f.amenities.map((a) => AMENITIES[a] || a).join(', ') || '—' },
    ],
    []
  );

  return (
    <div className="page pb-24 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">Discover</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Find parking near you</h1>
          <p className="mt-1 text-sm text-muted">
            {loading
              ? 'Loading live availability…'
              : `${facilities.length} ${facilities.length === 1 ? 'facility' : 'facilities'} match your filters`}
            {updatedAt && !loading ? <span className="ml-1 font-mono text-[11px]">· updated {relative(updatedAt)}</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={coords ? 'subtle' : 'secondary'} size="sm" icon={LocateFixed} loading={locating} onClick={nearMe}>
            {coords ? 'Using my location' : 'Near me'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={SlidersHorizontal}
            className="lg:hidden"
            onClick={() => setFiltersOpen(true)}
          >
            Filters {activeFilters ? `(${activeFilters})` : ''}
          </Button>
        </div>
      </div>

      <div className={cx('mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px] xl:grid-cols-[minmax(0,1fr)_520px]')}>
        <div className="min-w-0">
          <div className="surface p-4">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by area, landmark or facility name"
                  className="pl-10"
                  aria-label="Search parking"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink dark:hover:text-paper"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                ) : null}
              </div>

              <div className="hidden flex-wrap items-center gap-2 lg:flex">
                <button
                  type="button"
                  onClick={() => setVehicleType('')}
                  className={cx('chip', !vehicleType && 'chip-active')}
                >
                  All vehicles
                </button>
                {Object.entries(VEHICLE_TYPES).map(([key, meta]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setVehicleType(vehicleType === key ? '' : key)}
                    className={cx('chip', vehicleType === key && 'chip-active')}
                  >
                    {meta.short} · {meta.label}
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-line dark:bg-line-dark" />
                {AMENITY_FILTERS.map((amenity) => (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className={cx('chip', amenities.includes(amenity) && 'chip-active')}
                  >
                    {AMENITIES[amenity]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="h-9 w-auto min-w-[150px] py-0 text-xs"
                  aria-label="Sort facilities"
                >
                  {SORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                  className="h-9 w-auto min-w-[130px] py-0 text-xs"
                  aria-label="Maximum hourly price"
                >
                  <option value="">Any price</option>
                  <option value="25">Up to ₹25/h</option>
                  <option value="40">Up to ₹40/h</option>
                  <option value="60">Up to ₹60/h</option>
                </Select>
                {activeFilters || search ? (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs font-medium text-muted underline-offset-4 hover:text-ink hover:underline dark:hover:text-paper"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 lg:hidden">
            <div className="flex rounded-xl border border-line bg-white p-1 dark:border-line-dark dark:bg-ink-900">
              <button
                type="button"
                onClick={() => setMobileView('list')}
                className={cx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  mobileView === 'list' ? 'bg-brand-500 text-white' : 'text-muted'
                )}
              >
                <List size={13} /> List
              </button>
              <button
                type="button"
                onClick={() => setMobileView('map')}
                className={cx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  mobileView === 'map' ? 'bg-brand-500 text-white' : 'text-muted'
                )}
              >
                <MapIcon size={13} /> Map
              </button>
            </div>
          </div>

          <div className={cx('mt-4', mobileView === 'map' && 'hidden lg:block')}>
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="surface overflow-hidden">
                    <Skeleton className="h-36 w-full rounded-none" />
                    <div className="space-y-3 p-5">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="surface">
                <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />
              </div>
            ) : facilities.length === 0 ? (
              <div className="surface">
                <EmptyState
                  icon={Building2}
                  title="No parking matches those filters"
                  description="Try widening the price range or clearing a filter. Every facility in the list has real, server-side availability."
                  action={
                    <Button variant="secondary" onClick={clearAll}>
                      Clear all filters
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {facilities.map((facility, index) => (
                  <div
                    key={facility.id}
                    id={`facility-${facility.id}`}
                    className={cx('rounded-2xl transition', selectedId === facility.id && 'ring-2 ring-amber-500 ring-offset-2 ring-offset-paper dark:ring-offset-ink-950')}
                  >
                    <FacilityCard
                      facility={facility}
                      index={index}
                      compared={compare.some((item) => item.id === facility.id)}
                      onCompare={toggleCompare}
                      favorited={favoriteIds.has(String(facility.id))}
                      onFavorite={user ? toggleFavorite : undefined}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-24 h-[calc(100vh-8rem)]">
            <MapView
              facilities={facilities}
              center={coords ? [coords.lat, coords.lng] : undefined}
              selectedId={selectedId}
              onSelect={selectFromMap}
              userLocation={coords}
              className="h-full"
              zoom={coords ? 14 : 12}
            />
          </div>
        </div>
      </div>

      {mobileView === 'map' ? (
        <div className="fixed inset-x-0 bottom-0 top-16 z-20 lg:hidden">
          <MapView
            facilities={facilities}
            center={coords ? [coords.lat, coords.lng] : undefined}
            selectedId={selectedId}
            onSelect={selectFromMap}
            userLocation={coords}
            className="h-full rounded-none border-0"
            zoom={coords ? 14 : 12}
          />
          <div className="absolute bottom-16 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-white/95 p-1.5 shadow-xl backdrop-blur dark:border-line-dark dark:bg-ink-900/95">
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white"
            >
              <List size={14} /> Show {facilities.length} results
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-ink/70 dark:text-paper/70"
            >
              <SlidersHorizontal size={13} /> Filters
            </button>
          </div>
        </div>
      ) : null}

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" size="sm">
        <div className="space-y-5">
          <div>
            <p className="label">Vehicle type</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setVehicleType('')} className={cx('chip', !vehicleType && 'chip-active')}>
                All
              </button>
              {Object.entries(VEHICLE_TYPES).map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setVehicleType(vehicleType === key ? '' : key)}
                  className={cx('chip', vehicleType === key && 'chip-active')}
                >
                  {meta.short}
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
                  onClick={() => toggleAmenity(key)}
                  className={cx('chip', amenities.includes(key) && 'chip-active')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Maximum price</p>
            <Select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}>
              <option value="">Any price</option>
              <option value="25">Up to ₹25/h</option>
              <option value="40">Up to ₹40/h</option>
              <option value="60">Up to ₹60/h</option>
            </Select>
          </div>
          <Button className="w-full" onClick={() => setFiltersOpen(false)}>
            Show {facilities.length} results
          </Button>
        </div>
      </Modal>

      {compare.length ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur dark:border-line-dark dark:bg-ink-900/95">
          <div className="page flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Comparing</span>
              {compare.map((facility) => (
                <span
                  key={facility.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-medium dark:border-line-dark dark:bg-ink-850"
                >
                  {facility.name}
                  <button
                    type="button"
                    onClick={() => toggleCompare(facility)}
                    aria-label={`Remove ${facility.name}`}
                    className="text-muted hover:text-ink dark:hover:text-paper"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCompare([])}>
                Clear
              </Button>
              <Button size="sm" icon={Compass} onClick={() => setCompareOpen(true)}>
                Compare ({compare.length})
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Compare facilities"
        description="Live figures at the time this page loaded."
        size="xl"
      >
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr>
                <th className="w-36 px-2 pb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Facility
                </th>
                {compare.map((facility, index) => (
                  <th key={facility.id} className="px-2 pb-3 text-left">
                    <span className="block text-[11px] font-mono text-muted">Option {index + 1}</span>
                    <span className="font-display text-sm font-semibold">{facility.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row) => (
                <tr key={row.label} className="border-t border-line dark:border-line-dark">
                  <td className="px-2 py-3 text-xs font-medium text-muted">{row.label}</td>
                  {compare.map((facility) => (
                    <td key={facility.id} className="px-2 py-3 text-xs">
                      {row.render(facility)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-line dark:border-line-dark">
                <td className="px-2 py-4" />
                {compare.map((facility) => (
                  <td key={facility.id} className="px-2 py-4">
                    <Link to={`/facilities/${facility.id}`} onClick={() => setCompareOpen(false)}>
                      <Button size="xs" iconRight={ArrowUpRight}>
                        View slots
                      </Button>
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
