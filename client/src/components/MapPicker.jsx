import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Loader2, MapPin, Search } from 'lucide-react';
import { Button, cx, Input } from './ui';

const pin = L.divIcon({
  className: 'pk-pin',
  html: '<div class="pk-pin-inner" style="padding:6px 8px">Pin</div>',
  iconSize: [46, 30],
  iconAnchor: [23, 28],
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

function Controller({ position, zoom }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (position) map.flyTo(position, zoom ?? 16, { duration: 0.6 });
  }, [position, zoom, map]);
  return null;
}

export default function MapPicker({ lat, lng, onChange, className }) {
  const hasPoint = lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
  const position = hasPoint ? [Number(lat), Number(lng)] : null;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const search = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    setResults([]);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=0&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Search unavailable');
      const data = await response.json();
      setResults(
        data.map((item) => ({
          name: item.display_name,
          lat: Number(item.lat),
          lng: Number(item.lon),
        }))
      );
      if (!data.length) setError('No places found. Try a landmark or postcode.');
    } catch (err) {
      if (err.name !== 'AbortError') setError('Address search is unavailable right now. Click the map instead.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className={cx('space-y-3', className)}>
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search an address or landmark (OpenStreetMap)"
            className="pl-9"
            aria-label="Search address"
          />
        </div>
        <Button type="submit" variant="secondary" loading={searching} icon={Search}>
          Search
        </Button>
      </form>

      {error ? <p className="text-xs text-amber-700 dark:text-amber-300">{error}</p> : null}

      {results.length ? (
        <ul className="overflow-hidden rounded-xl border border-line bg-white text-sm shadow-soft dark:border-line-dark dark:bg-ink-850">
          {results.map((result) => (
            <li key={`${result.lat}-${result.lng}`}>
              <button
                type="button"
                onClick={() => {
                  onChange(result.lat, result.lng);
                  setResults([]);
                }}
                className="flex w-full items-start gap-2 border-b border-line/70 px-3 py-2.5 text-left transition last:border-0 hover:bg-paper dark:border-line-dark/70 dark:hover:bg-ink-800"
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-brand-600" />
                <span className="line-clamp-2 text-xs text-ink/80 dark:text-paper/80">{result.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative h-72 overflow-hidden rounded-xl border border-line dark:border-line-dark">
        <MapContainer center={position || [12.9716, 77.5946]} zoom={position ? 16 : 11} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={onChange} />
          <Controller position={position} />
          {position ? <Marker position={position} icon={pin} /> : null}
        </MapContainer>
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-ink shadow-soft dark:bg-ink-900/90 dark:text-paper">
          Click the map to drop the pin
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="facility-lat">
            Latitude
          </label>
          <Input
            id="facility-lat"
            type="number"
            step="0.000001"
            value={hasPoint ? lat : ''}
            placeholder="12.971599"
            onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value), lng)}
          />
        </div>
        <div>
          <label className="label" htmlFor="facility-lng">
            Longitude
          </label>
          <Input
            id="facility-lng"
            type="number"
            step="0.000001"
            value={hasPoint ? lng : ''}
            placeholder="77.594566"
            onChange={(event) => onChange(lat, event.target.value === '' ? null : Number(event.target.value))}
          />
        </div>
      </div>

      {searching ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Loader2 size={13} className="animate-spin" /> Searching OpenStreetMap…
        </p>
      ) : null}
    </div>
  );
}
