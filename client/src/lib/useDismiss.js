import { useEffect } from 'react';

export function useDismiss(ref, onDismiss, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onDismiss();
    };
    const key = (event) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', key);
    };
  }, [ref, onDismiss, active]);
}
