import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Search, UserPlus, Users } from 'lucide-react';
import { api } from '../api/client';
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
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
import { dateOnly } from '../lib/format';
import { useDebounce } from '../lib/useDebounce';

export default function AdminUsers() {
  const [filters, setFilters] = useState({ search: '', role: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ users: [], pagination: null });
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const search = useDebounce(filters.search, 350);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.set('search', search);
      if (filters.role) params.set('role', filters.role);
      const [userData, facilityData] = await Promise.all([
        api(`/api/admin/users?${params.toString()}`),
        api('/api/admin/facilities'),
      ]);
      setData(userData);
      setFacilities(facilityData.facilities || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, filters.role]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, filters.role]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'staff',
      staffFacilities: [],
    });
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      status: user.status,
      staffFacilities: (user.staffFacilities || []).map((facility) => facility.id),
    });
    setModalOpen(true);
  };

  const toggleFacility = (id) =>
    setForm((prev) => ({
      ...prev,
      staffFacilities: prev.staffFacilities.includes(id)
        ? prev.staffFacilities.filter((item) => item !== id)
        : [...prev.staffFacilities, id],
    }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/admin/users/${editing.id}`, {
          method: 'PATCH',
          body: {
            name: form.name,
            phone: form.phone,
            role: form.role,
            status: form.status,
            staffFacilities: form.staffFacilities,
          },
        });
        toast.success('Account updated');
      } else {
        await api('/api/admin/users', {
          method: 'POST',
          body: {
            name: form.name,
            email: form.email,
            password: form.password,
            phone: form.phone,
            role: form.role,
            staffFacilities: form.staffFacilities,
          },
        });
        toast.success('Account created');
      }
      setModalOpen(false);
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
        eyebrow="People"
        title="Users & staff"
        description="Customer accounts, staff facility assignments and administrator access."
        actions={
          <Button size="sm" icon={UserPlus} onClick={openCreate}>
            Add account
          </Button>
        }
      />

      <div className="surface flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[240px] flex-1">
          <label className="label" htmlFor="user-search">
            Search
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              id="user-search"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Name or email"
              className="h-9 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="w-44">
          <label className="label" htmlFor="user-role">
            Role
          </label>
          <Select
            id="user-role"
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
          </Select>
        </div>
      </div>

      <div className="surface overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data.users.length === 0 ? (
          <EmptyState icon={Users} title="No accounts match" description="Adjust the filters or add a new account." />
        ) : (
          <>
            <Table minWidth={860}>
              <thead>
                <tr>
                  <Th>Account</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Facility scope</Th>
                  <Th>Joined</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <Tr key={user.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} size={34} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{user.name}</p>
                          <p className="truncate text-[11px] text-muted">{user.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={USER_ROLES[user.role]?.tone}>{USER_ROLES[user.role]?.label || user.role}</Badge>
                    </Td>
                    <Td>
                      {user.status === 'active' ? (
                        <Badge tone="emerald" dot>Active</Badge>
                      ) : (
                        <Badge tone="red">Suspended</Badge>
                      )}
                    </Td>
                    <Td className="max-w-[200px] text-[11px] text-muted">
                      {user.role === 'staff'
                        ? user.staffFacilities.map((facility) => facility.name).join(', ') || 'Unassigned'
                        : user.role === 'admin'
                          ? 'All facilities'
                          : 'Customer'}
                    </Td>
                    <Td className="text-xs text-muted">{dateOnly(user.createdAt)}</Td>
                    <Td>
                      <div className="flex justify-end">
                        <Button size="xs" variant="secondary" icon={Pencil} onClick={() => openEdit(user)}>
                          Edit
                        </Button>
                      </div>
                    </Td>
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Create an account'}
        description={editing ? 'Role and status changes are audited.' : 'Staff and admin accounts can only be created from here.'}
        size="lg"
      >
        {form ? (
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="u-name" required>
                <Input
                  id="u-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  maxLength={80}
                  required
                />
              </Field>
              <Field label="Phone" htmlFor="u-phone">
                <Input
                  id="u-phone"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  maxLength={20}
                />
              </Field>
            </div>

            <Field label="Email" htmlFor="u-email" required hint={editing ? 'Email cannot be changed here.' : undefined}>
              <Input
                id="u-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                disabled={Boolean(editing)}
                required
              />
            </Field>

            {!editing ? (
              <Field label="Temporary password" htmlFor="u-password" required hint="At least 8 characters.">
                <Input
                  id="u-password"
                  type="text"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  minLength={8}
                  required
                />
              </Field>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role" htmlFor="u-role">
                <Select
                  id="u-role"
                  value={form.role}
                  onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                >
                  {Object.entries(USER_ROLES).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {editing ? (
                <Field label="Status" htmlFor="u-status">
                  <Select
                    id="u-status"
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </Select>
                </Field>
              ) : null}
            </div>

            {form.role === 'staff' ? (
              <div>
                <p className="label">Facility assignment</p>
                <div className="grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-line p-3 dark:border-line-dark sm:grid-cols-2">
                  {facilities.map((facility) => (
                    <Checkbox
                      key={facility.id}
                      label={facility.name}
                      checked={form.staffFacilities.includes(facility.id)}
                      onChange={() => toggleFacility(facility.id)}
                    />
                  ))}
                  {!facilities.length ? <p className="text-xs text-muted">No facilities exist yet.</p> : null}
                </div>
                <p className="hint">Staff only see tickets and sessions for their assigned facilities.</p>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} icon={editing ? Pencil : Plus}>
                {editing ? 'Save changes' : 'Create account'}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
