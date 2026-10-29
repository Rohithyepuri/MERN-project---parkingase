import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  Camera,
  CameraOff,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LogIn,
  LogOut,
  ScanLine,
  Search,
  ShieldAlert,
  Timer,
  UserRound,
  XCircle,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { NotificationBell } from '../components/NotificationBell';
import { ThemeToggle } from '../components/ThemeToggle';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  InlineNote,
  Input,
  Modal,
  Select,
  Skeleton,
  StatCard,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  Tr,
  cx,
} from '../components/ui';
import { INCIDENT_CATEGORIES, INCIDENT_STATUS } from '../lib/constants';
import { currency, dateTime, duration, relative, timeOnly } from '../lib/format';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'scan', label: 'Ticket desk' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'history', label: 'History' },
  { key: 'incidents', label: 'Incidents' },
];

export default function StaffConsole() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((item) => item.key === params.get('tab')) ? params.get('tab') : 'overview';
  const setTab = (next) => setParams({ tab: next }, { replace: true });

  const [facilities, setFacilities] = useState([]);
  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [token, setToken] = useState('');
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimer = useRef(null);

  const [exitTarget, setExitTarget] = useState(null);
  const [exiting, setExiting] = useState(false);
  const [exitResult, setExitResult] = useState(null);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ facilityId: '', category: 'equipment', description: '' });
  const [savingIncident, setSavingIncident] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [facilityData, overviewData, activeData, historyData, incidentData] = await Promise.all([
        api('/api/staff/facilities'),
        api('/api/staff/overview'),
        api('/api/staff/sessions?status=active'),
        api('/api/staff/history'),
        api('/api/staff/incidents'),
      ]);
      setFacilities(facilityData.facilities || []);
      setOverview(overviewData);
      setSessions(activeData.sessions || []);
      setHistory(historyData.sessions || []);
      setIncidents(incidentData.incidents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const stopCamera = useCallback(() => {
    if (scanTimer.current) clearInterval(scanTimer.current);
    scanTimer.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (scanning && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [scanning]);

  const startCamera = async () => {
    if (!('BarcodeDetector' in window)) {
      toast.error('Camera QR scanning is not supported in this browser. Paste the token instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      scanTimer.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) {
            setToken(codes[0].rawValue);
            toast.success('QR captured');
            stopCamera();
          }
        } catch {
          /* ignore frame errors */
        }
      }, 500);
    } catch {
      toast.error('Camera permission denied or unavailable. Paste the token instead.');
      stopCamera();
    }
  };

  const validate = async () => {
    if (!token.trim()) {
      toast.error('Paste a ticket token or booking reference first.');
      return;
    }
    setValidating(true);
    setValidation(null);
    try {
      const data = await api('/api/staff/validate', { method: 'POST', body: { ticket: token.trim() } });
      setValidation(data);
    } catch (err) {
      setValidation({ valid: false, message: err.message, code: err.code });
    } finally {
      setValidating(false);
    }
  };

  const recordEntry = async () => {
    setEntryLoading(true);
    try {
      const data = await api('/api/staff/entry', { method: 'POST', body: { ticket: token.trim() } });
      toast.success('Entry recorded');
      setValidation({
        valid: true,
        message: 'Entry recorded. Session is now active.',
        code: 'checked_in',
        booking: data.booking,
        entry: { allowed: false, code: 'checked_in' },
      });
      setToken('');
      loadAll();
    } catch (err) {
      toast.error(err.message);
      setValidation({ valid: false, message: err.message, code: err.code });
    } finally {
      setEntryLoading(false);
    }
  };

  const processExit = async () => {
    if (!exitTarget) return;
    setExiting(true);
    try {
      const data = await api('/api/staff/exit', { method: 'POST', body: { bookingId: exitTarget.bookingId } });
      setExitResult(data);
      setExitTarget(null);
      toast.success('Exit recorded');
      loadAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExiting(false);
    }
  };

  const submitIncident = async (event) => {
    event.preventDefault();
    if (!incidentForm.facilityId) {
      toast.error('Choose a facility.');
      return;
    }
    if (incidentForm.description.trim().length < 8) {
      toast.error('Describe the incident in a little more detail.');
      return;
    }
    setSavingIncident(true);
    try {
      await api('/api/staff/incidents', { method: 'POST', body: incidentForm });
      toast.success('Incident reported');
      setIncidentOpen(false);
      setIncidentForm({ facilityId: facilities[0]?.id || '', category: 'equipment', description: '' });
      loadAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingIncident(false);
    }
  };

  const openIncidents = incidents.filter((incident) => incident.status === 'open' || incident.status === 'investigating').length;
  const metrics = overview?.metrics;

  const activeSessionRows = useMemo(
    () =>
      sessions.map((session) => ({
        ...session,
        overdue: session.overdue || new Date(session.expectedExitAt) < new Date(),
      })),
    [sessions]
  );

  if (loading && !overview) {
    return (
      <div className="min-h-screen bg-paper dark:bg-ink-950">
        <div className="page py-10">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="mt-6 h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper dark:bg-ink-950">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md dark:border-line-dark dark:bg-ink-950/85">
        <div className="page flex h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <span className="hidden rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300 sm:inline">
              Staff console
            </span>
            <span className="hidden max-w-[280px] truncate text-[11px] text-muted md:inline">
              {facilities.map((facility) => facility.name).join(' · ')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="hidden text-xs font-medium text-muted hover:text-ink dark:hover:text-paper sm:block">
              My dashboard
            </Link>
            <ThemeToggle />
            <NotificationBell />
            <Link to="/profile" aria-label="Profile">
              <Avatar name={user?.name} size={34} />
            </Link>
          </div>
        </div>
      </header>

      <main className="page py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">Gate operations</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Hello, {user?.name?.split(' ')[0]}</h1>
            <p className="mt-1 text-sm text-muted">
              {facilities.length ? `You operate ${facilities.length} facilit${facilities.length === 1 ? 'y' : 'ies'}.` : 'No facilities assigned yet.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={loadAll}>
              Refresh
            </Button>
            <Button size="sm" icon={LogOut} variant="secondary" onClick={() => setTab('sessions')}>
              Process exit
            </Button>
            <Button size="sm" icon={ScanLine} onClick={() => setTab('scan')}>
              Scan a ticket
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {facilities.map((facility) => (
            <span
              key={facility.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-medium dark:border-line-dark dark:bg-ink-900"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              {facility.name}
              <span className="text-muted">· {facility.city}</span>
            </span>
          ))}
        </div>

        {error ? (
          <div className="surface mt-6">
            <ErrorState message={error} onRetry={loadAll} />
          </div>
        ) : (
          <>
            <div className="mt-6 surface p-2">
              <Tabs
                className="border-0 px-2"
                value={tab}
                onChange={setTab}
                items={TABS.map((item) => ({
                  ...item,
                  count: item.key === 'sessions' ? sessions.length : item.key === 'incidents' ? openIncidents : undefined,
                }))}
              />
            </div>

            {tab === 'overview' ? (
              <div className="mt-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Vehicles inside" value={metrics?.activeSessions ?? 0} hint="Active sessions right now" icon={LogIn} />
                  <StatCard label="Expected arrivals" value={metrics?.expectedArrivals ?? 0} hint="Confirmed bookings today" icon={CalendarCheck} tone="amber" />
                  <StatCard label="Overdue sessions" value={metrics?.overdue ?? 0} hint="Beyond booked end time" icon={Timer} tone="red" />
                  <StatCard label="Failed scans today" value={metrics?.failedToday ?? 0} hint="Rejected tickets at the gate" icon={ShieldAlert} tone="slate" />
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                  <div className="surface overflow-hidden">
                    <div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-line-dark">
                      <div>
                        <h2 className="font-display text-base font-semibold">Vehicles inside</h2>
                        <p className="text-xs text-muted">{activeSessionRows.length} active sessions</p>
                      </div>
                      <Button size="xs" variant="secondary" onClick={() => setTab('sessions')}>
                        View all
                      </Button>
                    </div>
                    {activeSessionRows.length === 0 ? (
                      <EmptyState compact icon={LogIn} title="No vehicles inside" description="Scan a valid pass to record the first entry." />
                    ) : (
                      <Table minWidth={620}>
                        <thead>
                          <tr>
                            <Th>Vehicle</Th>
                            <Th>Slot</Th>
                            <Th>Entry</Th>
                            <Th>Expected exit</Th>
                            <Th />
                          </tr>
                        </thead>
                        <tbody>
                          {activeSessionRows.slice(0, 6).map((session) => (
                            <Tr key={session.id}>
                              <Td>
                                <p className="font-mono text-xs font-semibold">{session.vehicle?.plate}</p>
                                <p className="text-[10px] text-muted">{session.booking?.ref}</p>
                              </Td>
                              <Td className="font-mono text-xs">{session.slot?.code}</Td>
                              <Td className="text-xs text-muted">{timeOnly(session.entryAt)}</Td>
                              <Td>
                                <span className={cx('text-xs', session.overdue ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted')}>
                                  {timeOnly(session.expectedExitAt)}
                                  {session.overdue ? ' · overdue' : ''}
                                </span>
                              </Td>
                              <Td className="text-right">
                                <Button
                                  size="xs"
                                  variant="secondary"
                                  onClick={() =>
                                    setExitTarget({
                                      bookingId: session.booking?.id,
                                      ref: session.booking?.ref,
                                      plate: session.vehicle?.plate,
                                      slot: session.slot?.code,
                                      entryAt: session.entryAt,
                                      expectedExitAt: session.expectedExitAt,
                                    })
                                  }
                                >
                                  Exit
                                </Button>
                              </Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </div>

                  <div className="surface p-5">
                    <h2 className="font-display text-base font-semibold">Recent operations</h2>
                    <p className="text-xs text-muted">Audit trail from the gate and admin actions.</p>
                    <ul className="mt-4 space-y-3">
                      {(overview?.recentEvents || []).slice(0, 7).map((event) => (
                        <li key={event.id} className="flex gap-3">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{event.summary || event.action}</p>
                            <p className="text-[10px] text-muted">
                              {event.actor} · {event.action} · {relative(event.at)}
                            </p>
                          </div>
                        </li>
                      ))}
                      {!overview?.recentEvents?.length ? <p className="text-xs text-muted">No events yet.</p> : null}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'scan' ? (
              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
                <div className="surface p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-semibold">Validate a ticket</h2>
                      <p className="mt-0.5 text-xs text-muted">
                        Paste the signed token from the driver's pass, or type the booking reference (PK-XXXXXX) for manual lookup.
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" icon={Camera} onClick={scanning ? stopCamera : startCamera}>
                      {scanning ? 'Stop camera' : 'Scan QR'}
                    </Button>
                  </div>

                  {scanning ? (
                    <div className="relative mt-4 overflow-hidden rounded-xl border border-line bg-ink-950 dark:border-line-dark">
                      <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline />
                      <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-dashed border-brand-400/70" />
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="absolute right-2 top-2 rounded-lg bg-ink-950/70 p-2 text-white"
                        aria-label="Stop camera"
                      >
                        <CameraOff size={16} />
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    <Field label="Ticket token or booking reference" htmlFor="ticket">
                      <Textarea
                        id="ticket"
                        value={token}
                        onChange={(event) => {
                          setToken(event.target.value);
                          setValidation(null);
                        }}
                        placeholder="PK-AB12CD.8f3c… or just PK-AB12CD for manual lookup"
                        className="min-h-[88px] font-mono text-xs"
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button loading={validating} icon={Search} onClick={validate}>
                        Validate ticket
                      </Button>
                      {validation?.valid && validation.entry?.allowed ? (
                        <Button variant="secondary" loading={entryLoading} icon={LogIn} onClick={recordEntry}>
                          Record entry
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setToken('');
                          setValidation(null);
                          stopCamera();
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                    <InlineNote tone="slate">
                      Validation checks the signature, booking state, facility assignment and the entry window (opens 1 hour
                      before start). A second scan of the same pass is rejected.
                    </InlineNote>
                  </div>
                </div>

                <div className="surface p-5 sm:p-6">
                  <h2 className="font-display text-base font-semibold">Result</h2>
                  {!validation ? (
                    <div className="mt-4">
                      <EmptyState
                        compact
                        icon={ScanLine}
                        title="Waiting for a scan"
                        description="Paste a token or use the camera. The verdict will appear here with the driver's booking."
                      />
                    </div>
                  ) : (
                    <div className="mt-4">
                      <div
                        className={cx(
                          'flex items-start gap-3 rounded-xl border px-4 py-3',
                          validation.valid
                            ? 'border-brand-500/30 bg-brand-500/10'
                            : 'border-red-500/30 bg-red-500/10'
                        )}
                      >
                        {validation.valid ? (
                          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-300" />
                        ) : (
                          <XCircle size={20} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
                        )}
                        <div>
                          <p className="text-sm font-semibold">{validation.valid ? 'Ticket valid' : 'Entry not allowed'}</p>
                          <p className="mt-0.5 text-xs text-ink/70 dark:text-paper/70">{validation.message}</p>
                        </div>
                      </div>

                      {validation.booking ? (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-xl bg-paper p-4 dark:bg-ink-850">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-display text-sm font-semibold">{validation.booking.facility?.name}</p>
                                <p className="text-[11px] text-muted">{validation.booking.facility?.address}</p>
                              </div>
                              <Badge tone={validation.booking.status === 'checked_in' ? 'emerald' : 'amber'}>
                                {validation.booking.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <dt className="text-muted">Vehicle</dt>
                                <dd className="font-mono font-semibold">{validation.booking.vehicle?.plate}</dd>
                              </div>
                              <div>
                                <dt className="text-muted">Driver</dt>
                                <dd>{validation.booking.user?.name || '—'}</dd>
                              </div>
                              <div>
                                <dt className="text-muted">Bay</dt>
                                <dd className="font-mono">{validation.booking.slot?.code}</dd>
                              </div>
                              <div>
                                <dt className="text-muted">Booking</dt>
                                <dd className="font-mono text-[11px]">{validation.booking.ref}</dd>
                              </div>
                              <div className="col-span-2">
                                <dt className="text-muted">Window</dt>
                                <dd>
                                  {dateTime(validation.booking.startTime)} → {timeOnly(validation.booking.endTime)}
                                </dd>
                              </div>
                            </dl>
                          </div>

                          {validation.booking.status === 'checked_in' ? (
                            <Button
                              className="w-full"
                              variant="secondary"
                              icon={LogOut}
                              onClick={() =>
                                setExitTarget({
                                  bookingId: validation.booking.id,
                                  ref: validation.booking.ref,
                                  plate: validation.booking.vehicle?.plate,
                                  slot: validation.booking.slot?.code,
                                  entryAt: validation.booking.checkedInAt,
                                  expectedExitAt: validation.booking.endTime,
                                })
                              }
                            >
                              Process exit & bill
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {tab === 'sessions' ? (
              <div className="mt-6 surface overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 dark:border-line-dark">
                  <div>
                    <h2 className="font-display text-base font-semibold">Active parking sessions</h2>
                    <p className="text-xs text-muted">{sessions.length} vehicles inside your facilities</p>
                  </div>
                  <Button size="xs" variant="secondary" onClick={loadAll}>
                    Refresh
                  </Button>
                </div>
                {sessions.length === 0 ? (
                  <EmptyState
                    icon={LogIn}
                    title="No vehicles inside"
                    description="Entries recorded at the ticket desk will show up here with live overstay flags."
                  />
                ) : (
                  <Table minWidth={820}>
                    <thead>
                      <tr>
                        <Th>Vehicle</Th>
                        <Th>Facility</Th>
                        <Th>Bay</Th>
                        <Th>Entry</Th>
                        <Th>Booked until</Th>
                        <Th>Status</Th>
                        <Th className="text-right">Action</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSessionRows.map((session) => (
                        <Tr key={session.id}>
                          <Td>
                            <p className="font-mono text-xs font-semibold">{session.vehicle?.plate}</p>
                            <p className="text-[10px] text-muted">{session.booking?.user?.name || session.booking?.ref}</p>
                          </Td>
                          <Td className="text-xs">{session.facility?.name}</Td>
                          <Td className="font-mono text-xs">{session.slot?.code}</Td>
                          <Td className="text-xs text-muted">
                            {timeOnly(session.entryAt)}
                            <span className="block text-[10px]">{duration((Date.now() - new Date(session.entryAt)) / 60000)} ago</span>
                          </Td>
                          <Td className="text-xs text-muted">{timeOnly(session.expectedExitAt)}</Td>
                          <Td>
                            {session.overdue ? (
                              <Badge tone="red">
                                <AlertTriangle size={10} /> Overstay
                              </Badge>
                            ) : (
                              <Badge tone="emerald">On time</Badge>
                            )}
                          </Td>
                          <Td className="text-right">
                            <Button
                              size="xs"
                              icon={LogOut}
                              onClick={() =>
                                setExitTarget({
                                  bookingId: session.booking?.id,
                                  ref: session.booking?.ref,
                                  plate: session.vehicle?.plate,
                                  slot: session.slot?.code,
                                  entryAt: session.entryAt,
                                  expectedExitAt: session.expectedExitAt,
                                })
                              }
                            >
                              Process exit
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            ) : null}

            {tab === 'history' ? (
              <div className="mt-6 surface overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-5 py-4 dark:border-line-dark">
                  <div>
                    <h2 className="font-display text-base font-semibold">Session history</h2>
                    <p className="text-xs text-muted">Completed stays with final amounts</p>
                  </div>
                  <span className="font-mono text-[10px] text-muted">Latest 100</span>
                </div>
                {history.length === 0 ? (
                  <EmptyState icon={ClipboardList} title="No completed sessions yet" description="History appears after the first vehicle checks out." />
                ) : (
                  <Table minWidth={860}>
                    <thead>
                      <tr>
                        <Th>Vehicle</Th>
                        <Th>Booking</Th>
                        <Th>Facility</Th>
                        <Th>Entry</Th>
                        <Th>Exit</Th>
                        <Th className="text-right">Overstay</Th>
                        <Th className="text-right">Final bill</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.slice(0, 40).map((session) => (
                        <Tr key={session.id}>
                          <Td className="font-mono text-xs font-semibold">{session.vehicle?.plate}</Td>
                          <Td className="font-mono text-[11px] text-muted">{session.booking?.ref}</Td>
                          <Td className="text-xs">{session.facility?.name}</Td>
                          <Td className="text-xs text-muted">{dateTime(session.entryAt)}</Td>
                          <Td className="text-xs text-muted">{dateTime(session.exitAt)}</Td>
                          <Td className="text-right font-mono text-xs">
                            {session.overstayMinutes ? `${session.overstayMinutes} min` : '—'}
                          </Td>
                          <Td className="text-right font-mono text-xs font-semibold">
                            {session.booking?.finalAmount != null ? currency(session.booking.finalAmount) : '—'}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            ) : null}

            {tab === 'incidents' ? (
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold">Incidents</h2>
                    <p className="text-xs text-muted">Report operational issues; administrators resolve them.</p>
                  </div>
                  <Button
                    size="sm"
                    icon={AlertTriangle}
                    onClick={() => {
                      setIncidentForm({ facilityId: facilities[0]?.id || '', category: 'equipment', description: '' });
                      setIncidentOpen(true);
                    }}
                  >
                    Report incident
                  </Button>
                </div>

                {incidents.length === 0 ? (
                  <div className="surface">
                    <EmptyState
                      icon={ShieldAlert}
                      title="No incidents reported"
                      description="Keep the lot safe — report equipment faults, security concerns or vehicle damage here."
                      action={<Button size="sm" onClick={() => setIncidentOpen(true)}>Report an incident</Button>}
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {incidents.map((incident) => (
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
                            <p className="mt-0.5 text-xs text-muted">
                              {incident.slot ? `Bay ${incident.slot.code} · ` : ''}
                              reported by {incident.reportedBy || 'staff'} · {relative(incident.createdAt)}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-ink/75 dark:text-paper/75">{incident.description}</p>
                        {incident.notes?.length ? (
                          <div className="mt-3 rounded-lg bg-paper px-3 py-2 text-[11px] text-muted dark:bg-ink-850">
                            {incident.notes[incident.notes.length - 1].text}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </>
        )}
      </main>

      <Modal
        open={Boolean(exitTarget)}
        onClose={() => setExitTarget(null)}
        title="Process vehicle exit"
        description="The server calculates overstay beyond the grace period."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setExitTarget(null)} disabled={exiting}>
              Cancel
            </Button>
            <Button size="sm" icon={LogOut} loading={exiting} onClick={processExit}>
              Confirm exit
            </Button>
          </div>
        }
      >
        {exitTarget ? (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted">Vehicle</dt>
                <dd className="font-mono text-sm font-semibold">{exitTarget.plate}</dd>
              </div>
              <div>
                <dt className="text-muted">Booking</dt>
                <dd className="font-mono text-[11px]">{exitTarget.ref}</dd>
              </div>
              <div>
                <dt className="text-muted">Bay</dt>
                <dd className="font-mono">{exitTarget.slot}</dd>
              </div>
              <div>
                <dt className="text-muted">Entry</dt>
                <dd>{exitTarget.entryAt ? dateTime(exitTarget.entryAt) : '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">Booked until</dt>
                <dd>{exitTarget.expectedExitAt ? dateTime(exitTarget.expectedExitAt) : '—'}</dd>
              </div>
            </dl>
            <InlineNote tone="amber" title="Overstay">
              The final bill includes the paid reservation plus any overstay beyond the facility&apos;s grace period, billed
              per started hour at the bay rate.
            </InlineNote>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(exitResult)} onClose={() => setExitResult(null)} title="Exit complete" size="sm">
        {exitResult ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-800 dark:text-brand-200">
              <CheckCircle2 size={16} /> {exitResult.message}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted">Paid online</dt>
                <dd className="font-mono text-sm">{currency(exitResult.booking?.amountPaid)}</dd>
              </div>
              <div>
                <dt className="text-muted">Overstay</dt>
                <dd className="font-mono text-sm">
                  {exitResult.overstay?.charge ? currency(exitResult.overstay.charge) : '—'}
                </dd>
              </div>
              <div className="col-span-2 border-t border-line pt-2 dark:border-line-dark">
                <dt className="text-muted">Final bill</dt>
                <dd className="font-mono text-lg font-semibold text-amber-700 dark:text-amber-300">
                  {currency(exitResult.finalAmount)}
                </dd>
              </div>
            </dl>
            <Button className="w-full" size="sm" onClick={() => setExitResult(null)}>
              Done
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal open={incidentOpen} onClose={() => setIncidentOpen(false)} title="Report an incident">
        <form onSubmit={submitIncident} className="space-y-4">
          <Field label="Facility" htmlFor="incident-facility" required>
            <Select
              id="incident-facility"
              value={incidentForm.facilityId}
              onChange={(event) => setIncidentForm((prev) => ({ ...prev, facilityId: event.target.value }))}
            >
              <option value="">Choose a facility</option>
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" htmlFor="incident-category">
            <Select
              id="incident-category"
              value={incidentForm.category}
              onChange={(event) => setIncidentForm((prev) => ({ ...prev, category: event.target.value }))}
            >
              {Object.entries(INCIDENT_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="What happened?" htmlFor="incident-description" required>
            <Textarea
              id="incident-description"
              value={incidentForm.description}
              onChange={(event) => setIncidentForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Eg. Barrier at level 1 stuck open, security informed."
              maxLength={500}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setIncidentOpen(false)} disabled={savingIncident}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={savingIncident}>
              Submit report
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
