import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Heart, Search } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import FacilityCard from '../components/FacilityCard';
import { Button, EmptyState, ErrorState, Skeleton } from '../components/ui';

export default function Favorites() {
  const { user, refresh } = useAuth();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/facilities?sort=recommended', { auth: false });
      setFacilities(data.facilities || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const favoriteIds = useMemo(() => new Set((user?.favorites || []).map(String)), [user?.favorites]);
  const saved = facilities.filter((facility) => favoriteIds.has(String(facility.id)));

  const toggleFavorite = async (facility) => {
    try {
      const result = await api(`/api/facilities/${facility.id}/favorite`, { method: 'POST' });
      await refresh();
      toast.success(result.favorited ? 'Saved' : 'Removed from favourites');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="page pb-20 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">Shortlist</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Saved facilities</h1>
          <p className="mt-1 text-sm text-muted">Your go-to lots, with live availability.</p>
        </div>
        <Link to="/facilities">
          <Button variant="secondary" icon={Search}>
            Explore more
          </Button>
        </Link>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-80 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="surface">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : saved.length === 0 ? (
          <div className="surface">
            <EmptyState
              icon={Heart}
              title="No saved facilities yet"
              description="Tap the heart on any facility card to keep it here for quicker booking."
              action={
                <Link to="/facilities">
                  <Button icon={Search}>Find parking</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((facility, index) => (
              <FacilityCard
                key={facility.id}
                facility={facility}
                index={index}
                favorited
                onFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
