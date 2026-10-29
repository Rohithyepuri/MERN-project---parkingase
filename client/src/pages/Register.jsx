import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';
import { Button, Field, Input } from '../components/ui';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) next.email = 'Enter a valid email address.';
    if (form.phone && !/^[+\d][\d\s-]{6,19}$/.test(form.phone)) next.phone = 'Enter a valid phone number.';
    if (form.password.length < 8) next.password = 'At least 8 characters.';
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) next.password = 'Include a letter and a number.';
    if (form.password !== form.confirm) next.confirm = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      toast.success('Account created. Welcome to ParkEase.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrors({ form: error.message });
    } finally {
      setLoading(false);
    }
  };

  const strength = (() => {
    let score = 0;
    if (form.password.length >= 8) score += 1;
    if (/[A-Z]/.test(form.password)) score += 1;
    if (/\d/.test(form.password)) score += 1;
    if (/[^A-Za-z0-9]/.test(form.password)) score += 1;
    return score;
  })();

  return (
    <AuthShell
      title="Create your account"
      subtitle="Book a bay in seconds, carry a digital pass and keep every receipt in one place."
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="link">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="name" error={errors.name}>
          <div className="relative">
            <UserRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              id="name"
              className="pl-9"
              placeholder="Ananya Sharma"
              autoComplete="name"
              value={form.name}
              onChange={set('name')}
            />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" error={errors.email}>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                id="email"
                type="email"
                className="pl-9"
                placeholder="you@example.com"
                autoComplete="email"
                value={form.email}
                onChange={set('email')}
              />
            </div>
          </Field>
          <Field label="Phone (optional)" htmlFor="phone" error={errors.phone}>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                id="phone"
                className="pl-9"
                placeholder="+91 98450 00000"
                autoComplete="tel"
                value={form.phone}
                onChange={set('phone')}
              />
            </div>
          </Field>
        </div>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint="At least 8 characters with a letter and a number."
        >
          <div className="relative">
            <LockKeyhole size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              className="pl-9 pr-10"
              placeholder="Create a password"
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
            />
            <button
              type="button"
              onClick={() => setShow((value) => !value)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-ink dark:hover:text-paper"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>

        {form.password ? (
          <div className="flex gap-1" aria-hidden>
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={`h-1 flex-1 rounded-full ${
                  strength >= step ? (strength >= 3 ? 'bg-brand-500' : 'bg-amber-500') : 'bg-line dark:bg-line-dark'
                }`}
              />
            ))}
          </div>
        ) : null}

        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}>
          <div className="relative">
            <LockKeyhole size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              id="confirm"
              type={show ? 'text' : 'password'}
              className="pl-9"
              placeholder="Repeat your password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={set('confirm')}
            />
          </div>
        </Field>

        {errors.form ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300" role="alert">
            {errors.form}
          </p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" loading={loading} iconRight={ArrowRight}>
          Create account
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-muted">
          New accounts are created with the customer role. Staff and admin accounts are provisioned by an administrator.
        </p>
      </form>
    </AuthShell>
  );
}
