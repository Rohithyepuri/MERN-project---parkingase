import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, Clock3, Heart, MapPin, Navigation, Star } from 'lucide-react';
import { AMENITIES, FACILITY_PLACEHOLDER_GRADIENTS } from '../lib/constants';
import { currency, distanceLabel, isFacilityOpen, openHoursLabel } from '../lib/format';
import { Badge, cx } from './ui';

export default function FacilityCard({ facility, index = 0, compared = false, onCompare, favorited = false, onFavorite, compact = false }) {
  const gradient = FACILITY_PLACEHOLDER_GRADIENTS[index % FACILITY_PLACEHOLDER_GRADIENTS.length];
  const open = isFacilityOpen(facility);
  const free = facility.availableSlots ?? 0;
  const total = facility.totalSlots ?? 0;
  const occupancy = total ? Math.round(((total - free) / total) * 100) : 0;

  return (
    <article className="group surface overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className={cx('relative overflow-hidden bg-gradient-to-br', gradient, compact ? 'h-24' : 'h-36')}>
        <div className="absolute inset-0 grid grid-cols-8 gap-1.5 p-4 opacity-25" aria-hidden>
          {Array.from({ length: compact ? 16 : 24 }).map((_, i) => (
            <span key={i} className="rounded-[3px] border border-white/50 bg-white/10" />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent" />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold backdrop-blur',
              open
                ? 'border-white/30 bg-white/15 text-white'
                : 'border-white/20 bg-ink-950/40 text-white/80'
            )}
          >
            <span className={cx('h-1.5 w-1.5 rounded-full', open ? 'bg-brand-300' : 'bg-amber-400')} />
            {open ? 'Open now' : 'Closed'}
          </span>
          {facility.rating?.average ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
              <Star size={10} className="fill-amber-300 text-amber-300" />
              {facility.rating.average.toFixed(1)}
            </span>
          ) : null}
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {onFavorite ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onFavorite(facility);
              }}
              aria-pressed={favorited}
              aria-label={favorited ? `Remove ${facility.name} from favourites` : `Save ${facility.name} to favourites`}
              className={cx(
                'flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur transition',
                favorited
                  ? 'border-amber-300 bg-amber-500 text-white'
                  : 'border-white/30 bg-white/15 text-white hover:bg-white/25'
              )}
            >
              <Heart size={12} className={favorited ? 'fill-white' : ''} />
            </button>
          ) : null}

          {onCompare ? (
            <button
              type="button"
              onClick={() => onCompare(facility)}
              aria-pressed={compared}
              aria-label={compared ? `Remove ${facility.name} from comparison` : `Add ${facility.name} to comparison`}
              className={cx(
                'flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-semibold backdrop-blur transition',
                compared
                  ? 'border-amber-300 bg-amber-500 text-white'
                  : 'border-white/30 bg-white/15 text-white hover:bg-white/25'
              )}
            >
              {compared ? <Check size={11} /> : null}
              {compared ? 'Comparing' : 'Compare'}
            </button>
          ) : null}
        </div>

        <div className="absolute inset-x-4 bottom-3 flex items-end justify-between">
          <p className="font-display text-sm font-medium text-white/90">
            {facility.city}
            {facility.distanceKm != null ? ` · ${distanceLabel(facility.distanceKm)} away` : ''}
          </p>
          <p className="font-mono text-xs font-semibold text-white">
            {free > 0 ? `${free} free` : 'Full'}
          </p>
        </div>
      </div>

      <div className={cx('p-5', compact && 'p-4')}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-[17px] font-semibold leading-snug text-ink dark:text-paper">
            {facility.name}
          </h3>
          <p className="shrink-0 text-right">
            <span className="font-mono text-base font-semibold text-ink dark:text-paper">
              {facility.minPrice != null ? currency(facility.minPrice) : '—'}
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-muted">per hour</span>
          </p>
        </div>

        <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <MapPin size={13} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{facility.address}</span>
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {facility.amenities?.slice(0, 3).map((amenity) => (
            <span
              key={amenity}
              className="rounded-md border border-line bg-paper px-1.5 py-0.5 text-[10px] font-medium text-ink/60 dark:border-line-dark dark:bg-ink-850 dark:text-paper/60"
            >
              {AMENITIES[amenity] || amenity}
            </span>
          ))}
          {facility.amenities?.length > 3 ? (
            <span className="text-[10px] text-muted">+{facility.amenities.length - 3}</span>
          ) : null}
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock3 size={11} /> {openHoursLabel(facility)}
            </span>
            <span className="font-mono">{occupancy}% full</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line dark:bg-line-dark">
            <div
              className={cx('h-full rounded-full', free === 0 ? 'bg-red-500' : free / Math.max(total, 1) < 0.2 ? 'bg-amber-500' : 'bg-brand-500')}
              style={{ width: `${Math.min(100, occupancy)}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Link
            to={`/facilities/${facility.id}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600 hover:shadow-lift"
          >
            View slots <ArrowUpRight size={14} />
          </Link>
          {facility.lat != null && facility.lng != null ? (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition hover:border-brand-400 hover:text-brand-700 dark:border-line-dark dark:hover:text-brand-300"
              aria-label={`Directions to ${facility.name}`}
              title="Directions"
            >
              <Navigation size={15} />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
