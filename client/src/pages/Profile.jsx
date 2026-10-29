import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bell, LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Avatar,
  Badge,
  Button,
  Field,
  InlineNote,
  Input,
  Switch,
  cx,
} from '../components/ui';
import { USER_ROLES } from '../lib/constants';
import { dateOnly } from '../lib/format';

export default function Profile() {
  const { user, refresh, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [prefs, setPrefs] = useState({ notifications: true });

  useEffect(() => {
    if (!user) return;
    setProfile({ name: user.name || '', phone: user.phone || '' });
    setPrefs({ notifications: user.preferences?.notifications !== false });
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await api('/api/auth/me', { method: 'PATCH', body: profile });
      await refresh();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePreferences = async (next) => {
    setPrefs(next);
    try {
      await api('/api/auth/me', { method: 'PATCH', body: { preferences: next } });
      await refresh();
      toast.success('Preferences saved');
    } catch (err) {
      toast.error(err.message);
      setPrefs({ notifications: !next.notifications });
    }
  };

  const chooseTheme = async (nextTheme) => {
    setTheme(nextTheme);
    try {
      await api('/api/auth/me', { method: 'PATCH', body: { preferences: { theme: nextTheme } } });
      await refresh();
    } catch {
      /* theme still applies locally */
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (passwords.next.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (passwords.next !== passwords.confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: passwords.current, newPassword: passwords.next },
      });
      toast.success('Password changed');
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div className="page pb-20 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} size={56} />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{user.name}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1">
                <Mail size={13} /> {user.email}
              </span>
              <Badge tone={USER_ROLES[user.role]?.tone}>{USER_ROLES[user.role]?.label || user.role}</Badge>
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          icon={LogOut}
          onClick={() => {
            logout();
            navigate('/');
          }}
        >
          Sign out
        </Button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section className="surface p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold">Profile details</h2>
            <p className="text-xs text-muted">Used on entry passes and support conversations.</p>
            <form onSubmit={saveProfile} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="profile-name">
                  <Input
                    id="profile-name"
                    value={profile.name}
                    onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                    maxLength={80}
                  />
                </Field>
                <Field label="Phone" htmlFor="profile-phone">
                  <Input
                    id="profile-phone"
                    value={profile.phone}
                    onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="+91 98450 00000"
                    maxLength={20}
                  />
                </Field>
              </div>
              <Field label="Email" htmlFor="profile-email" hint="Email changes are managed by an administrator.">
                <Input id="profile-email" value={user.email} disabled />
              </Field>
              <Button type="submit" loading={savingProfile} size="sm">
                Save changes
              </Button>
            </form>
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold">Password</h2>
            <p className="text-xs text-muted">Use at least 8 characters with a letter and a number.</p>
            <form onSubmit={changePassword} className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Current" htmlFor="p-current">
                <Input
                  id="p-current"
                  type="password"
                  value={passwords.current}
                  onChange={(event) => setPasswords((prev) => ({ ...prev, current: event.target.value }))}
                  autoComplete="current-password"
                />
              </Field>
              <Field label="New" htmlFor="p-next">
                <Input
                  id="p-next"
                  type="password"
                  value={passwords.next}
                  onChange={(event) => setPasswords((prev) => ({ ...prev, next: event.target.value }))}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm" htmlFor="p-confirm">
                <Input
                  id="p-confirm"
                  type="password"
                  value={passwords.confirm}
                  onChange={(event) => setPasswords((prev) => ({ ...prev, confirm: event.target.value }))}
                  autoComplete="new-password"
                />
              </Field>
              <div className="sm:col-span-3">
                <Button type="submit" size="sm" variant="secondary" loading={savingPassword}>
                  Update password
                </Button>
              </div>
            </form>
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold">Appearance</h2>
            <p className="text-xs text-muted">Theme is applied instantly and remembered on this device.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { key: 'light', label: 'Light' },
                { key: 'dark', label: 'Dark' },
                { key: 'system', label: 'System' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => chooseTheme(option.key)}
                  className={cx(
                    'rounded-xl border px-3 py-3 text-sm font-medium transition',
                    theme === option.key
                      ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                      : 'border-line text-muted hover:border-brand-400 dark:border-line-dark'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface p-5">
            <h2 className="font-display text-base font-semibold">Account</h2>
            <dl className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Role</dt>
                <dd>
                  <Badge tone={USER_ROLES[user.role]?.tone}>{USER_ROLES[user.role]?.label || user.role}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Status</dt>
                <dd className="font-medium capitalize">{user.status}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Member since</dt>
                <dd className="font-medium">{dateOnly(user.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">User ID</dt>
                <dd className="font-mono text-[10px] text-muted">{user.id}</dd>
              </div>
            </dl>
          </section>

          <section className="surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-1.5 font-display text-base font-semibold">
                  <Bell size={15} /> Notifications
                </h2>
                <p className="mt-0.5 text-xs text-muted">Booking, payment and session updates in the bell menu.</p>
              </div>
              <Switch
                checked={prefs.notifications}
                onChange={(value) => savePreferences({ ...prefs, notifications: value })}
                label="Notification preferences"
              />
            </div>
            <div className="mt-4">
              <InlineNote tone="slate" title="Delivery">
                In-app only. Email, SMS or WhatsApp delivery is added only when a provider is configured.
              </InlineNote>
            </div>
          </section>

          <section className="surface p-5">
            <h2 className="flex items-center gap-1.5 font-display text-base font-semibold">
              <ShieldCheck size={15} /> Security
            </h2>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
              <li>JWT session with a signed expiry.</li>
              <li>Passwords hashed with bcrypt; never stored in plain text.</li>
              <li>Role permissions enforced on every API request.</li>
              <li>Sign out clears the token from this browser.</li>
            </ul>
          </section>

          {user.role !== 'user' ? (
            <section className="rounded-2xl border border-brand-500/25 bg-brand-500/[0.06] p-5">
              <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-brand-800 dark:text-brand-200">
                <UserRound size={15} /> Console access
              </h2>
              <p className="mt-1 text-xs text-brand-800/80 dark:text-brand-200/70">
                You have the {user.role} role. Open your operations workspace from the header menu.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => navigate(user.role === 'admin' ? '/admin' : '/staff')}
              >
                Open {user.role === 'admin' ? 'admin' : 'staff'} console
              </Button>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
