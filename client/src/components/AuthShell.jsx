import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { Logo } from './Logo';

export default function AuthShell({ title, subtitle, children, footer, wide = false }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink-950 p-10 text-paper lg:flex lg:flex-col">
        <div className="absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" aria-hidden />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" aria-hidden />
        <div className="relative">
          <Logo to="/" />
        </div>

        <div className="relative mt-auto max-w-md">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-brand-300">
            <Sparkles size={12} /> Smart parking, without the guesswork
          </p>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight">
            Find your space.
            <br />
            Book with confidence.
            <br />
            <span className="text-brand-300">Park with ease.</span>
          </h1>
          <ul className="mt-7 space-y-3 text-sm text-white/70">
            {[
              'Server-verified reservations that never double-book a slot',
              'Signed QR passes with duplicate-entry protection',
              'Transparent pricing, refunds and itemised receipts',
              'Live facility operations for staff and admins',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-400" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-9 grid grid-cols-3 gap-3">
            {[
              ['4', 'facilities'],
              ['270', 'parking bays'],
              ['3', 'role-based views'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="font-display text-xl font-semibold text-white">{value}</p>
                <p className="text-[11px] text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-10 flex items-center justify-between text-[11px] text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} /> Data stays in your own MongoDB
          </span>
          <span className="font-mono">ParkEase / 2026</span>
        </div>
      </aside>

      <main className="flex flex-col bg-paper dark:bg-ink-950">
        <div className="flex items-center justify-between px-5 py-5 lg:hidden">
          <Logo />
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink dark:hover:text-paper">
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className={wide ? 'w-full max-w-xl' : 'w-full max-w-md'}>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink dark:text-paper">{title}</h2>
            {subtitle ? <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p> : null}
            <div className="mt-7">{children}</div>
            {footer ? <div className="mt-6 text-sm text-muted">{footer}</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
}
