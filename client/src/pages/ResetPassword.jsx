import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { api } from '../api/client';
import AuthShell from '../components/AuthShell';
import { Button, Field, Input } from '../components/ui';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const token = params.get('token') || '';

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: { token, password }, auth: false });
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Make it at least 8 characters and include a letter and a number."
      footer={
        <p>
          <Link to="/login" className="link inline-flex items-center gap-1">
            <ArrowLeft size={13} /> Back to sign in
          </Link>
        </p>
      }
    >
      {!token ? (
        <div className="surface p-6">
          <h3 className="font-display text-base font-semibold">This link is incomplete</h3>
          <p className="mt-1 text-sm text-muted">
            The reset token is missing. Request a new link from the{' '}
            <Link to="/forgot-password" className="link">
              forgot password
            </Link>{' '}
            page.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="New password" htmlFor="password">
            <div className="relative">
              <LockKeyhole size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                id="password"
                type="password"
                className="pl-9"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
          </Field>
          <Field label="Confirm password" htmlFor="confirm">
            <div className="relative">
              <LockKeyhole size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                id="confirm"
                type="password"
                className="pl-9"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
              />
            </div>
          </Field>
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
