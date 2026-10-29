import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Inbox,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';

export const cx = (...args) => args.filter(Boolean).join(' ');

const VARIANTS = {
  primary:
    'bg-brand-500 text-white shadow-[0_8px_20px_-10px_rgba(5,150,105,0.9)] hover:bg-brand-600 hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 active:bg-brand-700 disabled:bg-brand-500/50',
  secondary:
    'border border-line bg-white text-ink hover:border-brand-400 hover:text-brand-700 hover:-translate-y-0.5 dark:border-line-dark dark:bg-ink-850 dark:text-paper dark:hover:border-brand-500 dark:hover:text-brand-300',
  ghost:
    'text-ink/75 hover:bg-ink/5 hover:text-ink dark:text-paper/70 dark:hover:bg-white/5 dark:hover:text-paper',
  danger:
    'bg-red-600 text-white hover:bg-red-700 hover:-translate-y-0.5 active:translate-y-0 disabled:bg-red-600/50',
  subtle:
    'bg-brand-500/10 text-brand-700 hover:bg-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25',
  amber: 'bg-amber-500 text-white hover:bg-amber-600 hover:-translate-y-0.5 active:translate-y-0',
};

const SIZES = {
  xs: 'h-8 px-2.5 text-xs gap-1.5',
  sm: 'h-9 px-3.5 text-sm gap-2',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
  icon: 'h-9 w-9 justify-center',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex select-none items-center justify-center rounded-xl font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : Icon ? <Icon size={16} aria-hidden /> : null}
      {children}
      {IconRight ? <IconRight size={16} aria-hidden /> : null}
    </button>
  );
}

export function Spinner({ size = 18, className }) {
  return <Loader2 size={size} className={cx('animate-spin text-brand-600 dark:text-brand-300', className)} aria-hidden />;
}

export function Field({ label, htmlFor, hint, error, required, children, className }) {
  return (
    <div className={className}>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label} {required ? <span className="text-amber-600">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }) {
  return <input className={cx('field', className)} {...props} />;
}

export function Textarea({ className, ...props }) {
  return <textarea className={cx('field min-h-[92px] resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <div className="relative">
      <select className={cx('field appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  );
}

export function Checkbox({ label, className, ...props }) {
  const id = useId();
  return (
    <label htmlFor={props.id || id} className={cx('flex cursor-pointer items-start gap-2.5 text-sm', className)}>
      <input
        id={props.id || id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-line text-brand-600 accent-brand-600 focus:ring-brand-500 dark:border-line-dark"
        {...props}
      />
      {label ? <span className="text-ink/80 dark:text-paper/80">{label}</span> : null}
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-brand-500' : 'bg-line dark:bg-line-dark'
      )}
    >
      <span
        className={cx(
          'inline-block translate-x-1 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-1'
        )}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );
}

const TONES = {
  emerald: 'bg-brand-500/12 text-brand-700 border-brand-500/25 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30',
  amber: 'bg-amber-500/12 text-amber-700 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  red: 'bg-red-500/10 text-red-700 border-red-500/25 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
  slate: 'bg-ink/5 text-ink/70 border-line dark:bg-white/5 dark:text-paper/65 dark:border-line-dark',
  brand: 'bg-brand-600 text-white border-brand-600',
  amberSolid: 'bg-amber-500 text-white border-amber-500',
};

export function Badge({ tone = 'slate', className, children, dot = false }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
        TONES[tone] || TONES.slate,
        className
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Avatar({ name = '', size = 36, className }) {
  const value = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-500/15 font-display text-sm font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {value || 'PE'}
    </span>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('skeleton', className)} aria-hidden />;
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="surface p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="mt-3 h-4 w-1/2" />
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, compact = false }) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-10' : 'px-6 py-16')}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-paper text-brand-600 dark:border-line-dark dark:bg-ink-850 dark:text-brand-300">
        <Icon size={24} aria-hidden />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold text-ink dark:text-paper">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry, compact = false }) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-10' : 'px-6 py-14')}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400">
        <AlertTriangle size={22} aria-hidden />
      </span>
      <h3 className="mt-3 font-display text-base font-semibold">Could not load this</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md', className }) {
  const panelRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const focusable = panel?.querySelector(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
      }
      if (event.key === 'Tab' && panel) {
        const nodes = Array.from(
          panel.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')
        ).filter((el) => el.offsetParent !== null);
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-ink-950/55 backdrop-blur-[2px]"
        onClick={() => onClose?.()}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-white shadow-2xl animate-fade-up dark:border-line-dark dark:bg-ink-900 sm:rounded-3xl',
          widths[size],
          className
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4 dark:border-line-dark">
            <div>
              {title ? (
                <h2 id={titleId} className="font-display text-lg font-semibold text-ink dark:text-paper">
                  {title}
                </h2>
              ) : null}
              {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted transition hover:bg-ink/5 hover:text-ink dark:hover:bg-white/5 dark:hover:text-paper"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="border-t border-line px-6 py-4 dark:border-line-dark">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone} size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-ink/75 dark:text-paper/75">{message}</p>
    </Modal>
  );
}

export function Tabs({ items, value, onChange, className }) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto border-b border-line dark:border-line-dark', className)} role="tablist">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cx(
              'relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors sm:px-4',
              active
                ? 'text-brand-700 dark:text-brand-300'
                : 'text-muted hover:text-ink dark:hover:text-paper'
            )}
          >
            <span className="flex items-center gap-2">
              {item.label}
              {item.count !== undefined ? (
                <span
                  className={cx(
                    'rounded-full px-1.5 py-0.5 font-mono text-[10px]',
                    active ? 'bg-brand-500/12 text-brand-700 dark:text-brand-300' : 'bg-ink/5 text-muted dark:bg-white/5'
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </span>
            {active ? <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-500" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({ page = 1, pages = 1, total, onChange }) {
  if (pages <= 1) {
    return total !== undefined ? <p className="text-xs text-muted">{total} record{total === 1 ? '' : 's'}</p> : null;
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-muted">
        Page {page} of {pages}
        {total !== undefined ? ` · ${total} records` : ''}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="xs" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="xs" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', className }) {
  const tones = {
    brand: 'bg-brand-500/10 text-brand-700 dark:text-brand-300',
    amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
    slate: 'bg-ink/5 text-ink/70 dark:bg-white/5 dark:text-paper/70',
  };
  return (
    <div className={cx('surface p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {Icon ? (
          <span className={cx('flex h-9 w-9 items-center justify-center rounded-xl', tones[tone])}>
            <Icon size={17} aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink dark:text-paper">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, description, actions, className }) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">{eyebrow}</p>
        ) : null}
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink dark:text-paper sm:text-[28px]">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Table({ children, minWidth = 720 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }) {
  return (
    <th
      className={cx(
        'whitespace-nowrap border-b border-line px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted dark:border-line-dark',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }) {
  return (
    <td colSpan={colSpan} className={cx('border-b border-line/70 px-4 py-3.5 align-middle dark:border-line-dark/70', className)}>
      {children}
    </td>
  );
}

export function Tr({ children, className, ...props }) {
  return (
    <tr className={cx('last:[&>td]:border-0 hover:bg-paper/70 dark:hover:bg-ink-850/60', className)} {...props}>
      {children}
    </tr>
  );
}

export function CopyButton({ value, label = 'Copy', className }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={cx('inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs text-muted transition hover:border-brand-400 hover:text-brand-700 dark:border-line-dark dark:hover:text-brand-300', className)}
      aria-label={copied ? 'Copied' : label}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export function InlineNote({ tone = 'amber', title, children }) {
  const styles = {
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    emerald: 'border-brand-500/30 bg-brand-500/10 text-brand-800 dark:text-brand-200',
    slate: 'border-line bg-paper text-muted dark:border-line-dark dark:bg-ink-850',
  };
  const Icon = tone === 'emerald' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={cx('flex gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-relaxed', styles[tone])}>
      <Icon size={15} className="mt-0.5 shrink-0" aria-hidden />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  );
}

export function Progress({ value = 0, tone = 'brand', label }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      {label ? (
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>{label}</span>
          <span className="font-mono">{width}%</span>
        </div>
      ) : null}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line dark:bg-line-dark">
        <div
          className={cx('h-full rounded-full transition-all', tone === 'amber' ? 'bg-amber-500' : 'bg-brand-500')}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
