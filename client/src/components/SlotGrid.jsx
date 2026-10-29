import { Bike, Car, Zap } from 'lucide-react';
import { SLOT_TYPES, VEHICLE_TYPES } from '../lib/constants';
import { currency } from '../lib/format';
import { Badge, cx } from './ui';

const ICONS = { '2W': Bike, '4W': Car, EV: Zap };

export default function SlotGrid({ floors = [], zones = [], slots = [], selectedId, onSelect, loading = false }) {
  const sortedFloors = [...floors].sort((a, b) => a.level - b.level);

  if (!sortedFloors.length) {
    return (
      <div className="surface-muted p-8 text-center text-sm text-muted">
        This facility has not published its parking layout yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] border border-brand-500 bg-brand-500/10" /> Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] border border-amber-500 bg-amber-500/20" /> Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] border border-line bg-line/60 dark:border-line-dark dark:bg-line-dark" /> Taken
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] border border-dashed border-amber-600/60 bg-amber-500/5" /> Maintenance
        </span>
      </div>

      {sortedFloors.map((floor) => {
        const floorZones = zones.filter((zone) => String(zone.floor) === String(floor.id));
        if (!floorZones.length) return null;
        return (
          <section key={floor.id}>
            <div className="mb-3 flex items-center gap-3">
              <h3 className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-ink/80 dark:text-paper/80">
                {floor.name}
              </h3>
              <span className="h-px flex-1 bg-line dark:bg-line-dark" />
              <span className="font-mono text-[10px] text-muted">Level {floor.level}</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {floorZones.map((zone) => {
                const zoneSlots = slots.filter((slot) => String(slot.zone) === String(zone.id));
                const free = zoneSlots.filter((slot) => !slot.busy && slot.status !== 'maintenance').length;
                const Icon = ICONS[zone.vehicleType] || Car;
                return (
                  <div key={zone.id} className="surface p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-700 dark:text-brand-300">
                            <Icon size={14} />
                          </span>
                          <h4 className="truncate font-display text-sm font-semibold">{zone.name}</h4>
                        </div>
                        <p className="mt-1 text-[11px] text-muted">
                          {VEHICLE_TYPES[zone.vehicleType]?.label} · {SLOT_TYPES[zone.slotType]} ·{' '}
                          <span className="font-mono text-amber-700 dark:text-amber-300">{currency(zone.pricePerHour)}/h</span>
                        </p>
                      </div>
                      <Badge tone={free > 0 ? 'emerald' : 'slate'} dot>
                        {free > 0 ? `${free} free` : 'Full'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-5 xl:grid-cols-6">
                      {zoneSlots.map((slot) => {
                        const maintenance = slot.status === 'maintenance';
                        const taken = slot.busy && !maintenance;
                        const selected = String(selectedId) === String(slot.id);
                        const disabled = maintenance || taken;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => onSelect?.(slot)}
                            aria-pressed={selected}
                            aria-label={`Slot ${slot.code}${maintenance ? ', under maintenance' : taken ? ', occupied' : ', available'}`}
                            title={maintenance ? 'Under maintenance' : taken ? 'Booked for this window' : 'Select this slot'}
                            className={cx(
                              'group relative flex h-[62px] flex-col items-center justify-center rounded-lg border text-center transition-all duration-150',
                              selected
                                ? 'border-amber-500 bg-amber-500/15 shadow-[0_0_0_3px_rgba(217,119,6,0.18)]'
                                : maintenance
                                  ? 'cursor-not-allowed border-dashed border-amber-600/50 bg-amber-500/5'
                                  : taken
                                    ? 'cursor-not-allowed border-line bg-line/40 dark:border-line-dark dark:bg-line-dark/50'
                                    : 'border-brand-500/35 bg-brand-500/[0.06] hover:-translate-y-0.5 hover:border-brand-500 hover:bg-brand-500/10'
                            )}
                          >
                            <span
                              className={cx(
                                'font-mono text-[11px] font-semibold',
                                selected
                                  ? 'text-amber-700 dark:text-amber-300'
                                  : maintenance
                                    ? 'text-amber-700/70 dark:text-amber-300/70'
                                    : taken
                                      ? 'text-muted/70'
                                      : 'text-brand-700 dark:text-brand-300'
                              )}
                            >
                              {slot.code}
                            </span>
                            <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted/80">
                              {maintenance ? 'Maint.' : taken ? 'Taken' : selected ? 'Selected' : 'Free'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {loading ? (
        <p className="text-center text-xs text-muted" role="status">
          Refreshing availability…
        </p>
      ) : null}
    </div>
  );
}
