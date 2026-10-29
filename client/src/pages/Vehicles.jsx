import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Car, Check, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  cx,
} from '../components/ui';
import { VEHICLE_TYPES } from '../lib/constants';

const EMPTY = { plate: '', type: '4W', make: '', model: '', isDefault: false };

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/vehicles');
      setVehicles(data.vehicles || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY, isDefault: vehicles.length === 0 });
    setModalOpen(true);
  };

  const openEdit = (vehicle) => {
    setEditing(vehicle);
    setForm({
      plate: vehicle.plate,
      type: vehicle.type,
      make: vehicle.make || '',
      model: vehicle.model || '',
      isDefault: vehicle.isDefault,
    });
    setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!/^[A-Z0-9][A-Z0-9 -]{2,15}$/.test(form.plate.trim().toUpperCase())) {
      toast.error('Enter a valid registration number.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/vehicles/${editing.id}`, { method: 'PATCH', body: form });
        toast.success('Vehicle updated');
      } else {
        await api('/api/vehicles', { method: 'POST', body: form });
        toast.success('Vehicle saved');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (vehicle) => {
    try {
      await api(`/api/vehicles/${vehicle.id}`, { method: 'PATCH', body: { isDefault: true } });
      load();
      toast.success('Default vehicle updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/vehicles/${deleteTarget.id}`, { method: 'DELETE' });
      toast.success('Vehicle removed');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page pb-20 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">Garage</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">My vehicles</h1>
          <p className="mt-1 text-sm text-muted">
            Saved vehicles speed up checkout. Vehicle type must match the zone you book.
          </p>
        </div>
        <Button icon={Plus} onClick={openAdd}>
          Add vehicle
        </Button>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="surface">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="surface">
            <EmptyState
              icon={Car}
              title="No vehicles saved"
              description="Add your registration number once and reuse it at every checkout."
              action={
                <Button icon={Plus} onClick={openAdd}>
                  Add your first vehicle
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((vehicle) => (
              <article
                key={vehicle.id}
                className={cx(
                  'surface p-5 transition hover:shadow-lift',
                  vehicle.isDefault && 'border-brand-500/40 dark:border-brand-500/40'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                    <Car size={20} />
                  </span>
                  <div className="flex items-center gap-1.5">
                    {vehicle.isDefault ? (
                      <Badge tone="emerald">
                        <Star size={10} className="fill-current" /> Default
                      </Badge>
                    ) : null}
                    <Badge tone="slate">{VEHICLE_TYPES[vehicle.type]?.short || vehicle.type}</Badge>
                  </div>
                </div>
                <p className="mt-4 font-mono text-lg font-semibold tracking-tight">{vehicle.plate}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || VEHICLE_TYPES[vehicle.type]?.label}
                </p>
                <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 dark:border-line-dark">
                  {!vehicle.isDefault ? (
                    <Button variant="ghost" size="xs" icon={Check} onClick={() => makeDefault(vehicle)}>
                      Make default
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted">Used automatically at checkout</span>
                  )}
                  <span className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(vehicle)}
                      className="rounded-lg p-1.5 text-muted transition hover:bg-ink/5 hover:text-ink dark:hover:bg-white/5 dark:hover:text-paper"
                      aria-label={`Edit ${vehicle.plate}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(vehicle)}
                      className="rounded-lg p-1.5 text-muted transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                      aria-label={`Delete ${vehicle.plate}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit vehicle' : 'Add a vehicle'}
        description="Stored against your account only. Staff see the plate on the booking pass."
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="Registration number" htmlFor="plate" required hint="Example: KA-01-MJ-4821">
            <Input
              id="plate"
              value={form.plate}
              onChange={(event) => setForm((prev) => ({ ...prev, plate: event.target.value.toUpperCase() }))}
              placeholder="KA-01-MJ-4821"
              maxLength={16}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vehicle type" htmlFor="type" required>
              <Select id="type" value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}>
                {Object.entries(VEHICLE_TYPES).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Make (optional)" htmlFor="make">
              <Input
                id="make"
                value={form.make}
                onChange={(event) => setForm((prev) => ({ ...prev, make: event.target.value }))}
                placeholder="Hyundai"
                maxLength={40}
              />
            </Field>
          </div>
          <Field label="Model (optional)" htmlFor="model">
            <Input
              id="model"
              value={form.model}
              onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
              placeholder="i20"
              maxLength={40}
            />
          </Field>
          <Checkbox
            label="Use as my default vehicle"
            checked={form.isDefault}
            onChange={(event) => setForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Add vehicle'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Remove this vehicle?"
        confirmLabel="Remove vehicle"
        message={
          deleteTarget
            ? `${deleteTarget.plate} will be removed from your account. Existing bookings keep the plate they were made with.`
            : ''
        }
      />
    </div>
  );
}
