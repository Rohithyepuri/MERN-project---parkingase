import { useCallback, useEffect, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { api } from '../api/client';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Pagination,
  SectionHeading,
  Select,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';
import { USER_ROLES } from '../lib/constants';
import { dateTime, relative } from '../lib/format';
import { useDebounce } from '../lib/useDebounce';

export default function AdminAuditLogs() {
  const [filters, setFilters] = useState({ q: '', action: '', role: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ logs: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const q = useDebounce(filters.q, 350);
  const action = useDebounce(filters.action, 350);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (q) params.set('q', q);
      if (action) params.set('action', action);
      if (filters.role) params.set('role', filters.role);
      if (filters.from) params.set('from', `${filters.from}T00:00:00`);
      if (filters.to) params.set('to', `${filters.to}T23:59:59`);
      const payload = await api(`/api/admin/audit-logs?${params.toString()}`);
      setData(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, q, action, filters.role, filters.from, filters.to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [q, action, filters.role, filters.from, filters.to]);

  const reset = () => setFilters({ q: '', action: '', role: '', from: '', to: '' });

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Governance"
        title="Audit logs"
        description="Append-only record of administrative changes, gate actions and exports."
      />

      <div className="surface p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <Field label="Search" htmlFor="audit-q">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  id="audit-q"
                  value={filters.q}
                  onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
                  placeholder="Summary, actor, entity ID"
                  className="h-9 pl-8 text-xs"
                />
              </div>
            </Field>
          </div>
          <Field label="Action contains" htmlFor="audit-action">
            <Input
              id="audit-action"
              value={filters.action}
              onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value }))}
              placeholder="e.g. refund"
              className="h-9 text-xs"
            />
          </Field>
          <Field label="Role" htmlFor="audit-role">
            <Select
              id="audit-role"
              value={filters.role}
              onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))}
              className="h-9 py-0 text-xs"
            >
              <option value="">All roles</option>
              {Object.entries(USER_ROLES).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
              <option value="system">System</option>
            </Select>
          </Field>
          <Field label="From" htmlFor="audit-from">
            <Input
              id="audit-from"
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
              className="h-9 text-xs"
            />
          </Field>
          <Field label="To" htmlFor="audit-to">
            <Input
              id="audit-to"
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
              className="h-9 text-xs"
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="xs" variant="ghost" onClick={reset}>
            Reset filters
          </Button>
        </div>
      </div>

      <div className="surface overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data.logs.length === 0 ? (
          <EmptyState icon={ScrollText} title="No audit entries" description="Actions performed by staff and admins will be recorded here." />
        ) : (
          <>
            <Table minWidth={900}>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Summary</Th>
                  <Th>IP</Th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => (
                  <Tr key={log.id}>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {dateTime(log.at)}
                      <span className="block text-[10px]">{relative(log.at)}</span>
                    </Td>
                    <Td>
                      <p className="text-xs font-medium">{log.actor}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted">{log.role}</p>
                    </Td>
                    <Td>
                      <span className="rounded-md bg-ink/5 px-1.5 py-0.5 font-mono text-[10px] dark:bg-white/5">{log.action}</span>
                    </Td>
                    <Td className="text-xs text-muted">
                      {log.entity}
                      {log.entityId ? <span className="block font-mono text-[9px]">{log.entityId.slice(-8)}</span> : null}
                    </Td>
                    <Td className="max-w-[340px] text-xs">{log.summary}</Td>
                    <Td className="font-mono text-[10px] text-muted">{log.ip || '—'}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <div className="border-t border-line px-5 py-3 dark:border-line-dark">
              <Pagination
                page={data.pagination.page}
                pages={data.pagination.pages}
                total={data.pagination.total}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      <p className="text-[11px] text-muted">
        Audit entries are immutable. Passwords, tokens and payment secrets are never written to the log.
      </p>
    </div>
  );
}
