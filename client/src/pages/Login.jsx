import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';
import { Button, Field, Input, InlineNote, cx } from '../components/ui';

const DEMO = [
  { role: 'Customer', email: 'user@parkease.dev', password: 'User@123' },
  { role: 'Staff', email: 'staff@parkease.dev', password: 'Staff@123' },
  { role: 'Admin', email: 'admin@parkease.dev', password: 'Admin@123' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.email || !form.password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await login(form.email.trim(), form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      const from = location.state?.from;
      const destination = user.role === 'admin' ? '/admin' : user.role === 'staff' ? '/staff' : from || '/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your reservations, entry passes and parking sessions."
      footer={
        <p>
          New to ParkEase?{' '}
          <Link to="/register" className="link">
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email address" htmlFor="email">
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="pl-9"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
          </div>
        </Field>

        <Field label="Password" htmlFor="password">
          <div className="relative">
            <LockKeyhole size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              className="pl-9 pr-10"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
            <button
              type="button"
              onClick={() => setShow((value) => !value)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted transition hover:text-ink dark:hover:text-paper"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>

        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between">
          <Link to="/forgot-password" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
            Forgot password?
          </Link>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted">
            <ShieldCheck size={12} /> JWT session
          </span>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={loading} iconRight={ArrowRight}>
          Sign in
        </Button>
      </form>

      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-px flex-1 bg-line dark:bg-line-dark" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Demo accounts</span>
          <span className="h-px flex-1 bg-line dark:bg-line-dark" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {DEMO.map((account) => (
            <button
              key={account.role}
              type="button"
              onClick={() => {
                setForm({ email: account.email, password: account.password });
                setError('');
              }}
              className={cx(
                'rounded-xl border border-line bg-white px-2 py-2 text-center text-[11px] font-medium transition hover:border-brand-400 hover:text-brand-700 dark:border-line-dark dark:bg-ink-850 dark:text-paper/75 dark:hover:border-brand-500'
              )}
            >
              <UserRound size={13} className="mx-auto mb-1 text-muted" />
              {account.role}
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] text-muted">Tap to fill credentials, then sign in.</p>
      </div>

      <div className="mt-5">
        <InlineNote tone="slate">
          Payments in this build run in <strong>DEMO</strong> or <strong>Razorpay test mode</strong>. No real money moves.
        </InlineNote>
      </div>
    </AuthShell>
  );
}
