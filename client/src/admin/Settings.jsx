import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, Info, Save, ShieldAlert } from 'lucide-react';
import { api } from '../api/client';
import {
  Badge,
  Button,
  ErrorState,
  Field,
  InlineNote,
  Input,
  SectionHeading,
  Skeleton,
  Switch,
  Textarea,
} from '../components/ui';

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [payment, setPayment] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsData, paymentData] = await Promise.all([
        api('/api/admin/settings'),
        api('/api/payments/config', { auth: false }),
      ]);
      setSettings(settingsData.settings);
      setPayment(paymentData);
      setForm({
        supportEmail: settingsData.settings.supportEmail || '',
        supportPhone: settingsData.settings.supportPhone || '',
        brandTagline: settingsData.settings.brandTagline || '',
        cancellationPolicy: settingsData.settings.cancellationPolicy || '',
        maintenanceMode: Boolean(settingsData.settings.maintenanceMode),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api('/api/admin/settings', { method: 'PATCH', body: form });
      setSettings(data.settings);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="surface">
        <ErrorState message={error || 'Settings unavailable'} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Configuration"
        title="Settings"
        description="Public contact details, policy copy and operational switches."
      />

      {form.maintenanceMode ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Maintenance mode is ON</p>
            <p className="mt-0.5">New bookings are rejected with a clear message. Existing bookings and staff actions still work.</p>
          </div>
        </div>
      ) : null}

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="surface p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold">Brand & support</h2>
            <div className="mt-4 space-y-4">
              <Field label="Tagline" htmlFor="s-tagline">
                <Input
                  id="s-tagline"
                  value={form.brandTagline}
                  onChange={(event) => setForm((prev) => ({ ...prev, brandTagline: event.target.value }))}
                  maxLength={120}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Support email" htmlFor="s-email">
                  <Input
                    id="s-email"
                    type="email"
                    value={form.supportEmail}
                    onChange={(event) => setForm((prev) => ({ ...prev, supportEmail: event.target.value }))}
                    maxLength={120}
                  />
                </Field>
                <Field label="Support phone" htmlFor="s-phone">
                  <Input
                    id="s-phone"
                    value={form.supportPhone}
                    onChange={(event) => setForm((prev) => ({ ...prev, supportPhone: event.target.value }))}
                    maxLength={30}
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold">Cancellation policy copy</h2>
            <p className="text-xs text-muted">
              Shown to drivers. Refund tiers themselves are enforced by the server on every cancellation.
            </p>
            <div className="mt-4">
              <Field label="Policy text" htmlFor="s-policy">
                <Textarea
                  id="s-policy"
                  value={form.cancellationPolicy}
                  onChange={(event) => setForm((prev) => ({ ...prev, cancellationPolicy: event.target.value }))}
                  maxLength={500}
                  className="min-h-[120px]"
                />
              </Field>
            </div>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold">Maintenance mode</h2>
                <p className="mt-0.5 text-xs text-muted">Pause new reservations during outages or site work.</p>
              </div>
              <Switch
                checked={form.maintenanceMode}
                onChange={(value) => setForm((prev) => ({ ...prev, maintenanceMode: value }))}
                label="Maintenance mode"
              />
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" loading={saving} icon={Save}>
              Save settings
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <section className="surface p-5">
            <h2 className="flex items-center gap-1.5 font-display text-base font-semibold">
              <CreditCard size={15} /> Payment environment
            </h2>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted">Mode</span>
                <Badge tone={payment?.razorpayEnabled ? 'amber' : 'slate'}>{payment?.mode}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Razorpay keys</span>
                <span className="font-medium">{payment?.razorpayEnabled ? 'Configured (test)' : 'Not configured'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Currency</span>
                <span className="font-mono">{payment?.currency}</span>
              </div>
            </div>
            <div className="mt-4">
              <InlineNote tone={payment?.razorpayEnabled ? 'amber' : 'slate'} title={payment?.razorpayEnabled ? 'Test mode active' : 'Demo payments'}>
                {payment?.razorpayEnabled
                  ? 'Secret keys stay on the server. Signatures are verified before a booking is confirmed.'
                  : 'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the server environment to switch to real Razorpay test orders.'}
              </InlineNote>
            </div>
          </section>

          <section className="surface p-5">
            <h2 className="flex items-center gap-1.5 font-display text-base font-semibold">
              <Info size={15} /> Refund tiers
            </h2>
            <ul className="mt-2 space-y-1.5 text-[11px] text-muted">
              <li className="flex justify-between gap-2">
                <span>2+ hours before start</span>
                <span className="font-mono">100%</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>1–2 hours before start</span>
                <span className="font-mono">75%</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>30–60 minutes before start</span>
                <span className="font-mono">50%</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Under 30 minutes / after check-in</span>
                <span className="font-mono">0%</span>
              </li>
            </ul>
          </section>

          <section className="surface p-5">
            <h2 className="font-display text-base font-semibold">Record</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Last updated</dt>
                <dd>{settings?.updatedAt ? new Date(settings.updatedAt).toLocaleString('en-IN') : '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Settings key</dt>
                <dd className="font-mono">{settings?.key || 'app'}</dd>
              </div>
            </dl>
          </section>
        </div>
      </form>
    </div>
  );
}
