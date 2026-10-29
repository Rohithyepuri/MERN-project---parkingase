import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ShieldCheck, Star, TriangleAlert } from 'lucide-react';
import { api } from '../api/client';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  SectionHeading,
  Select,
  Skeleton,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  Tr,
} from '../components/ui';
import { INCIDENT_CATEGORIES, INCIDENT_STATUS } from '../lib/constants';
import { dateTime, relative } from '../lib/format';

export default function Moderation() {
  const [tab, setTab] = useState('reviews');
  const [reviews, setReviews] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [reviewFilter, setReviewFilter] = useState('');
  const [incidentFilter, setIncidentFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);
  const [noteDraft, setNoteDraft] = useState({ status: 'investigating', note: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const reviewParams = new URLSearchParams({ limit: 50 });
      if (reviewFilter) reviewParams.set('status', reviewFilter);
      const incidentParams = new URLSearchParams();
      if (incidentFilter) incidentParams.set('status', incidentFilter);
      const [reviewData, incidentData] = await Promise.all([
        api(`/api/admin/reviews?${reviewParams.toString()}`),
        api(`/api/admin/incidents?${incidentParams.toString()}`),
      ]);
      setReviews(reviewData.reviews || []);
      setIncidents(incidentData.incidents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [reviewFilter, incidentFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleReview = async (review) => {
    try {
      await api(`/api/admin/reviews/${review.id}`, {
        method: 'PATCH',
        body: { status: review.status === 'visible' ? 'hidden' : 'visible' },
      });
      toast.success(review.status === 'visible' ? 'Review hidden' : 'Review restored');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openIncident = (incident) => {
    setTarget(incident);
    setNoteDraft({ status: incident.status, note: '' });
  };

  const saveIncident = async (event) => {
    event.preventDefault();
    if (!target) return;
    setSaving(true);
    try {
      await api(`/api/admin/incidents/${target.id}`, {
        method: 'PATCH',
        body: { status: noteDraft.status, note: noteDraft.note || undefined },
      });
      toast.success('Incident updated');
      setTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Trust & safety"
        title="Moderation"
        description="Verified-visit reviews and operational incidents raised by staff."
      />

      <div className="surface p-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2">
          <Tabs
            className="border-0"
            value={tab}
            onChange={setTab}
            items={[
              { key: 'reviews', label: 'Reviews', count: reviews.length },
              { key: 'incidents', label: 'Incidents', count: incidents.length },
            ]}
          />
          <div className="py-2">
            {tab === 'reviews' ? (
              <Select
                value={reviewFilter}
                onChange={(event) => setReviewFilter(event.target.value)}
                className="h-8 py-0 text-xs"
                aria-label="Filter reviews"
              >
                <option value="">All reviews</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </Select>
            ) : (
              <Select
                value={incidentFilter}
                onChange={(event) => setIncidentFilter(event.target.value)}
                className="h-8 py-0 text-xs"
                aria-label="Filter incidents"
              >
                <option value="">All incidents</option>
                {Object.entries(INCIDENT_STATUS).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="surface space-y-3 p-5">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="surface">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : tab === 'reviews' ? (
        <div className="surface overflow-hidden">
          {reviews.length === 0 ? (
            <EmptyState icon={Star} title="No reviews yet" description="Only completed stays can leave a review." />
          ) : (
            <Table minWidth={880}>
              <thead>
                <tr>
                  <Th>Review</Th>
                  <Th>Facility</Th>
                  <Th>Reviewer</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <Tr key={review.id}>
                    <Td>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={12}
                            className={star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-line dark:text-line-dark'}
                          />
                        ))}
                        <span className="ml-1 text-[10px] text-muted">{relative(review.createdAt)}</span>
                      </div>
                      <p className="mt-1 max-w-md text-xs text-ink/75 dark:text-paper/75">{review.comment || '—'}</p>
                    </Td>
                    <Td className="text-xs">{review.facility?.name}</Td>
                    <Td className="text-xs text-muted">{review.user?.name}</Td>
                    <Td>
                      {review.status === 'visible' ? <Badge tone="emerald">Visible</Badge> : <Badge tone="slate">Hidden</Badge>}
                    </Td>
                    <Td>
                      <div className="flex justify-end">
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={review.status === 'visible' ? EyeOff : Eye}
                          onClick={() => toggleReview(review)}
                        >
                          {review.status === 'visible' ? 'Hide' : 'Restore'}
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {incidents.length === 0 ? (
            <div className="surface md:col-span-2">
              <EmptyState icon={ShieldCheck} title="No incidents" description="Staff incident reports will appear here." />
            </div>
          ) : (
            incidents.map((incident) => (
              <article key={incident.id} className="surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={INCIDENT_STATUS[incident.status]?.tone || 'slate'}>
                        {INCIDENT_STATUS[incident.status]?.label || incident.status}
                      </Badge>
                      <span className="text-[10px] uppercase tracking-wider text-muted">
                        {INCIDENT_CATEGORIES[incident.category] || incident.category}
                      </span>
                    </div>
                    <h3 className="mt-2 font-display text-sm font-semibold">{incident.facility?.name}</h3>
                    <p className="text-[11px] text-muted">
                      {incident.slot ? `Bay ${incident.slot.code} · ` : ''}reported by {incident.reportedBy || 'staff'} ·{' '}
                      {relative(incident.createdAt)}
                    </p>
                  </div>
                  <TriangleAlert size={17} className="text-amber-500" />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink/75 dark:text-paper/75">{incident.description}</p>
                {incident.notes?.length ? (
                  <div className="mt-3 space-y-1 rounded-lg bg-paper px-3 py-2 text-[11px] text-muted dark:bg-ink-850">
                    {incident.notes.map((note, index) => (
                      <p key={index}>
                        {note.text} <span className="text-[9px]">· {dateTime(note.at)}</span>
                      </p>
                    ))}
                  </div>
                ) : null}
                <Button size="xs" variant="secondary" className="mt-3" onClick={() => openIncident(incident)}>
                  Update status
                </Button>
              </article>
            ))
          )}
        </div>
      )}

      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title="Update incident" size="sm">
        {target ? (
          <form onSubmit={saveIncident} className="space-y-4">
            <div className="rounded-xl bg-paper p-3 text-xs dark:bg-ink-850">
              <p className="font-medium">{target.facility?.name}</p>
              <p className="mt-1 text-muted">{target.description}</p>
            </div>
            <Field label="Status" htmlFor="incident-status">
              <Select
                id="incident-status"
                value={noteDraft.status}
                onChange={(event) => setNoteDraft((prev) => ({ ...prev, status: event.target.value }))}
              >
                {Object.entries(INCIDENT_STATUS).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Resolution note (optional)" htmlFor="incident-note">
              <Textarea
                id="incident-note"
                value={noteDraft.note}
                onChange={(event) => setNoteDraft((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Electrician replaced the fitting. Verified working."
                maxLength={300}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setTarget(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={saving}>
                Save
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
