import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { api } from '../api/client';
import AuthShell from '../components/AuthShell';
import { Button, Field, InlineNote, Input } from '../components/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: { email: email.trim() }, auth: false });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will send a reset link to the email on your account."
      footer={
        <p>
          <Link to="/login" className="link inline-flex items-center gap-1">
            <ArrowLeft size={13} /> Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="surface p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
            <MailCheck size={22} />
          </span>
          <h3 className="mt-3 font-display text-lg font-semibold">Check your inbox</h3>
          <p className="mt-1 text-sm text-muted">
            If <span className="font-medium text-ink dark:text-paper">{email}</span> belongs to an account, a reset link
            is on its way. It expires in 30 minutes.
          </p>
          <div className="mt-5">
            <InlineNote tone="slate" title="Running locally?">
              No email provider is configured in this demo. The reset link is printed in the API server console so you can
              continue the flow.
            </InlineNote>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email address" htmlFor="email" error={error}>
            <div className="relative">
              <MailCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                id="email"
                type="email"
                className="pl-9"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
