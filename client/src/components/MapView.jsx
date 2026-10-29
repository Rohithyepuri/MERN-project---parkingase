import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowUpRight, Navigation, Star } from 'lucide-react';
import { currency, distanceLabel } from '../lib/format';
import { cx } from './ui';

function pinIcon(facility) {
  const soldOut = facility.availableSlots === 0;
  const price = facility.minPrice != null ? `₹${facility.minPrice}` : 'Park';
  return L.divIcon({
    className: 'pk-pin',
    html: `<div class="pk-pin-inner ${soldOut ? 'pk-pin-muted' : ''}">${soldOut ? 'Full' : price}</div>`,
    iconSize: [68, 30],
    iconAnchor: [34, 26],
    popupAnchor: [0, -24],
  });
}

const userIcon = L.divIcon({
  className: 'pk-pin',
  html: '<div style="width:16px;height:16px;border-radius:999px;background:#D97706;border:3px solid #F7F8F5;box-shadow:0 0 0 4px rgba(217,119,6,0.25)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom ?? map.getZoom(), { duration: 0.8 });
  }, [center, zoom, map]);
  return null;
}

export default function MapView({
  facilities = [],
  center,
  zoom = 12,
  selectedId,
  onSelect,
  userLocation,
  className,
  showAttribution = true,
}) {
  const points = facilities.filter((f) => f.lat != null && f.lng != null);
  const fallback = [12.9716, 77.5946];
  const selected = points.find((f) => f.id === selectedId);
  const focus = selected ? [selected.lat, selected.lng] : center || (points[0] ? [points[0].lat, points[0].lng] : fallback);

  return (
    <div className={cx('relative overflow-hidden rounded-2xl border border-line dark:border-line-dark', className)}>
      <MapContainer center={focus} zoom={zoom} scrollWheelZoom className="h-full w-full" attributionControl={showAttribution}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={selected ? [selected.lat, selected.lng] : center} zoom={selected ? 15 : zoom} />
        {userLocation ? <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} /> : null}
        {points.map((facility) => (
          <Marker
            key={facility.id}
            position={[facility.lat, facility.lng]}
            icon={pinIcon(facility)}
            eventHandlers={{ click: () => onSelect?.(facility) }}
          >
            <Popup>
              <div className="min-w-[210px]">
                <p className="font-semibold text-ink">{facility.name}</p>
                <p className="mt-0.5 text-[11px] text-muted">{facility.address}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                  <span className={facility.availableSlots > 0 ? 'font-semibold text-brand-700' : 'font-semibold text-red-600'}>
                    {facility.availableSlots > 0 ? `${facility.availableSlots} free now` : 'Full right now'}
                  </span>
                  <span className="font-mono font-semibold text-ink">
                    {facility.minPrice != null ? `${currency(facility.minPrice)}/h` : '—'}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    {facility.rating?.average ? facility.rating.average.toFixed(1) : 'New'}
                    {facility.rating?.count ? ` (${facility.rating.count})` : ''}
                  </span>
                  {facility.distanceKm != null ? (
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <Navigation size={11} /> {distanceLabel(facility.distanceKm)}
                    </span>
                  ) : null}
                </div>
                <Link
                  to={`/facilities/${facility.id}`}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-700"
                >
                  View slots <ArrowUpRight size={12} />
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[400] flex items-center gap-2 rounded-full border border-line bg-white/90 px-3 py-1.5 text-[11px] font-medium text-ink shadow-soft backdrop-blur dark:border-line-dark dark:bg-ink-900/90 dark:text-paper">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
        </span>
        Live availability · {points.length} facilities
      </div>
    </div>
  );
}
