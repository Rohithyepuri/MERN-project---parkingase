import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { cx } from './ui';

export function ThemeToggle({ className }) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={cx(
        'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-ink/70 transition hover:border-brand-400 hover:text-brand-700 dark:border-line-dark dark:bg-ink-850 dark:text-paper/70 dark:hover:border-brand-500 dark:hover:text-brand-300',
        className
      )}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
