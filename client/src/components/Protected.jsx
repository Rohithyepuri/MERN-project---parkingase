import { useEffect } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui';

export function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-brand-600" size={26} aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);
  return null;
}

export function Unauthorized() {
  return (
    <div className="page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-600">403</p>
      <h1 className="mt-3 font-display text-3xl font-semibold">This area is not yours to park in</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        Your account does not have permission to view this page. If you believe this is a mistake, contact an administrator.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/">
          <Button>Back to home</Button>
        </Link>
        <Link to="/dashboard">
          <Button variant="secondary">My dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page flex min-h-[65vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand-700">404</p>
      <h1 className="mt-3 font-display text-4xl font-semibold">That space is empty</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        We could not find the page you were looking for. The slot may have moved, or the link is out of date.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/">
          <Button>Back to home</Button>
        </Link>
        <Link to="/facilities">
          <Button variant="secondary">Find parking</Button>
        </Link>
      </div>
    </div>
  );
}
