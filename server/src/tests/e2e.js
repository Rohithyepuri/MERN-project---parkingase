const BASE = process.env.API_URL || 'http://localhost:5000';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, label, extra = '') {
  if (condition) {
    passed += 1;
    results.push(`PASS  ${label}`);
  } else {
    failed += 1;
    results.push(`FAIL  ${label}${extra ? ` — ${extra}` : ''}`);
  }
}

async function api(method, path, { token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: response.status, data, headers: response.headers };
}

async function login(email, password) {
  const res = await api('POST', '/api/auth/login', { body: { email, password } });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(res.data)}`);
  return res.data.token;
}

const addMinutes = (date, minutes) => new Date(new Date(date).getTime() + minutes * 60000);

async function main() {
  const health = await api('GET', '/api/health');
  assert(health.status === 200 && health.data.db === 'connected', 'health endpoint reports connected database');

  const config = await api('GET', '/api/payments/config');
  assert(config.status === 200 && config.data.mode === 'DEMO', 'payment config exposes labelled mode');

  const [adminToken, staffToken, staff2Token, userToken, kabirToken] = await Promise.all([
    login('admin@parkease.dev', 'Admin@123'),
    login('staff@parkease.dev', 'Staff@123'),
    login('staff2@parkease.dev', 'Staff@123'),
    login('user@parkease.dev', 'User@123'),
    login('kabir@example.com', 'Demo@123'),
  ]);
  assert(Boolean(adminToken && staffToken && userToken && kabirToken), 'all demo roles can sign in');

  const unauth = await api('GET', '/api/bookings/mine');
  assert(unauth.status === 401, 'unauthenticated booking access is rejected');

  const forbiddenAdmin = await api('GET', '/api/admin/overview', { token: userToken });
  assert(forbiddenAdmin.status === 403, 'customer cannot reach admin APIs');

  const forbiddenStaff = await api('POST', '/api/staff/validate', { token: userToken, body: { ticket: 'x' } });
  assert(forbiddenStaff.status === 403, 'customer cannot reach staff APIs');

  const wrongStaffFacility = await api('GET', '/api/staff/facilities', { token: staff2Token });
  const staff2Facilities = wrongStaffFacility.data.facilities || [];
  assert(wrongStaffFacility.status === 200 && staff2Facilities.length === 2, 'staff console is scoped to assigned facilities');

  const list = await api('GET', '/api/facilities?sort=availability');
  assert(list.status === 200 && list.data.facilities.length >= 4, 'public facility discovery returns seeded facilities');
  const facility = list.data.facilities.find((f) => f.name.includes('MG Road'));
  assert(Boolean(facility?.lat && facility?.lng), 'facility exposes coordinates for the map');

  const detail = await api('GET', `/api/facilities/${facility.id}`);
  assert(detail.status === 200 && detail.data.zones.length >= 3, 'facility detail includes floors and zones');
  const zone4W = detail.data.zones.find((z) => z.vehicleType === '4W');
  const freeSlots = detail.data.slots.filter((s) => s.zone === zone4W.id && !s.busy && s.status === 'available');
  assert(freeSlots.length >= 3, 'facility detail exposes available slots for the requested window');

  const slotConcurrency = freeSlots[0];
  const slotRefund = freeSlots[1];
  const slotEntry = freeSlots[2];

  const startRefund = addMinutes(new Date(), 200);
  const endRefund = addMinutes(startRefund, 120);

  const quote = await api('POST', '/api/bookings/quote', {
    token: userToken,
    body: { slotId: slotRefund.id, startTime: startRefund, endTime: endRefund },
  });
  assert(
    quote.status === 200 && quote.data.quote.total > 0 && quote.data.quote.lines.length >= 1,
    'server returns an itemised price quote'
  );

  const publicQuote = await api('POST', '/api/bookings/quote', {
    body: { slotId: slotRefund.id, startTime: startRefund, endTime: endRefund },
  });
  assert(publicQuote.status === 200 && publicQuote.data.quote.total > 0, 'price preview is available before sign-in');

  const windowConcurrencyStart = addMinutes(new Date(), 240);
  const windowConcurrencyEnd = addMinutes(windowConcurrencyStart, 60);
  const concurrencyBody = {
    slotId: slotConcurrency.id,
    startTime: windowConcurrencyStart,
    endTime: windowConcurrencyEnd,
    vehicleType: '4W',
  };

  const [raceA, raceB] = await Promise.all([
    api('POST', '/api/bookings', { token: userToken, body: { ...concurrencyBody, plate: 'KA-01-MJ-4821' } }),
    api('POST', '/api/bookings', { token: kabirToken, body: { ...concurrencyBody, plate: 'KA-03-HB-9911' } }),
  ]);
  const created = [raceA, raceB].filter((r) => r.status === 201);
  const conflicts = [raceA, raceB].filter((r) => r.status === 409);
  assert(created.length === 1 && conflicts.length === 1, 'concurrent reservations cannot double-book one slot', JSON.stringify([raceA.status, raceB.status]));

  if (created.length) {
    const winnerToken = created[0] === raceA ? userToken : kabirToken;
    const bookingId = created[0].data.booking.id;
    const cancelPending = await api('POST', `/api/bookings/${bookingId}/cancel`, { token: winnerToken, body: { reason: 'concurrency test cleanup' } });
    assert(cancelPending.status === 200, 'pending booking can be released');
  }

  const bookingStart = addMinutes(new Date(), 9);
  const bookingEnd = addMinutes(bookingStart, 60);
  const bookingRes = await api('POST', '/api/bookings', {
    token: userToken,
    body: {
      slotId: slotEntry.id,
      startTime: bookingStart,
      endTime: bookingEnd,
      plate: 'KA-01-MJ-4821',
      vehicleType: '4W',
    },
  });
  assert(bookingRes.status === 201 && bookingRes.data.booking.status === 'pending', 'booking starts in pending state');
  assert(bookingRes.data.payment.mode === 'DEMO' && bookingRes.data.payment.orderId, 'booking returns a labelled payment order');

  const bookingId = bookingRes.data.booking.id;
  const confirm = await api('POST', `/api/payments/${bookingId}/confirm`, { token: userToken, body: { outcome: 'success' } });
  assert(confirm.status === 200 && confirm.data.booking.status === 'confirmed', 'payment confirmation moves booking to confirmed');
  assert(Boolean(confirm.data.ticket && confirm.data.ticket.includes('.')), 'confirmed booking receives a signed ticket');

  const forged = `${confirm.data.ticket.split('.')[0]}.${'0'.repeat(40)}`;
  const forgedRes = await api('POST', '/api/staff/validate', { token: staff2Token, body: { ticket: forged } });
  assert(forgedRes.status === 400 && forgedRes.data.valid === false, 'forged ticket is rejected');

  const wrongFacility = await api('POST', '/api/staff/validate', { token: staffToken, body: { ticket: confirm.data.ticket } });
  assert(wrongFacility.status === 400 && wrongFacility.data.code === 'facility_scope', 'staff cannot validate another facility ticket');

  const validation = await api('POST', '/api/staff/validate', { token: staff2Token, body: { ticket: confirm.data.ticket } });
  assert(validation.status === 200 && validation.data.valid === true, 'genuine ticket validates at the gate');

  const manualValidation = await api('POST', '/api/staff/validate', {
    token: staff2Token,
    body: { ticket: confirm.data.booking.ref },
  });
  assert(
    manualValidation.status === 200 && manualValidation.data.valid === true,
    'booking reference works as a manual gate lookup'
  );

  const entry = await api('POST', '/api/staff/entry', { token: staff2Token, body: { ticket: confirm.data.ticket } });
  assert(entry.status === 200 && entry.data.booking.status === 'checked_in' && entry.data.session, 'entry records a parking session');
  assert(
    Boolean(entry.data.booking.slot?.code && entry.data.booking.user?.name),
    'entry response includes bay and driver details'
  );

  const duplicateEntry = await api('POST', '/api/staff/entry', { token: staff2Token, body: { ticket: confirm.data.ticket } });
  assert(duplicateEntry.status === 409, 'duplicate entry is blocked');

  const exit = await api('POST', '/api/staff/exit', { token: staff2Token, body: { bookingId } });
  if (exit.status !== 200) console.log('exit response', exit.status, JSON.stringify(exit.data));
  assert(exit.status === 200 && exit.data.booking.status === 'completed', 'exit completes the booking');
  assert(exit.status === 200 && exit.data.finalAmount >= exit.data.booking.amountPaid, 'final bill is calculated on the server');

  const cancelCompleted = await api('POST', `/api/bookings/${bookingId}/cancel`, { token: userToken, body: {} });
  assert(cancelCompleted.status === 409, 'completed bookings cannot be cancelled');

  const refundBooking = await api('POST', '/api/bookings', {
    token: userToken,
    body: {
      slotId: slotRefund.id,
      startTime: startRefund,
      endTime: endRefund,
      plate: 'KA-01-MJ-4821',
      vehicleType: '4W',
    },
  });
  assert(refundBooking.status === 201, 'refund test booking created');
  const refundId = refundBooking.data.booking.id;
  await api('POST', `/api/payments/${refundId}/confirm`, { token: userToken, body: { outcome: 'success' } });

  const refundCancel = await api('POST', `/api/bookings/${refundId}/cancel`, { token: userToken, body: { reason: 'Plans changed' } });
  assert(
    refundCancel.status === 200 && refundCancel.data.refund?.percent === 100 && refundCancel.data.booking.status === 'cancelled',
    'cancellation before 2 hours issues a 100% refund'
  );

  const failedPayment = await api('POST', '/api/bookings', {
    token: userToken,
    body: {
      slotId: slotRefund.id,
      startTime: addMinutes(new Date(), 600),
      endTime: addMinutes(new Date(), 660),
      plate: 'KA-01-MJ-4821',
      vehicleType: '4W',
    },
  });
  assert(failedPayment.status === 201, 'second booking for failed-payment test created');
  const failedId = failedPayment.data.booking.id;
  const declined = await api('POST', `/api/payments/${failedId}/confirm`, { token: userToken, body: { outcome: 'fail' } });
  assert(declined.status === 402 && declined.data.booking.status === 'payment_failed', 'failed payment releases the slot');

  const mine = await api('GET', '/api/bookings/mine?scope=all&limit=50', { token: userToken });
  assert(mine.status === 200 && mine.data.bookings.length > 0, 'customer booking history loads');

  const detailRes = await api('GET', `/api/bookings/${bookingId}`, { token: userToken });
  assert(detailRes.status === 200 && detailRes.data.booking.timeline.length >= 4, 'booking timeline records every lifecycle step');

  const vehicles = await api('POST', '/api/vehicles', {
    token: userToken,
    body: { plate: 'KA-09-TT-1234', type: '4W', make: 'Kia', model: 'Seltos' },
  });
  assert(vehicles.status === 201, 'customer can add a vehicle');
  const vehicleId = vehicles.data.vehicle.id;
  const deleteVehicle = await api('DELETE', `/api/vehicles/${vehicleId}`, { token: userToken });
  assert(deleteVehicle.status === 200, 'customer can remove a vehicle');

  const notifications = await api('GET', '/api/notifications', { token: userToken });
  assert(notifications.status === 200 && notifications.data.notifications.length > 0, 'in-app notifications are delivered');

  const staffOverview = await api('GET', '/api/staff/overview', { token: staffToken });
  assert(staffOverview.status === 200 && typeof staffOverview.data.metrics.activeSessions === 'number', 'staff overview returns live metrics');

  const adminOverview = await api('GET', '/api/admin/overview', { token: adminToken });
  assert(adminOverview.status === 200 && adminOverview.data.metrics.facilities >= 4, 'admin overview returns database-backed metrics');

  const adminBookings = await api('GET', '/api/admin/bookings?limit=5', { token: adminToken });
  assert(adminBookings.status === 200 && adminBookings.data.bookings.length > 0, 'admin booking table loads');

  const adminUsers = await api('GET', '/api/admin/users?limit=50', { token: adminToken });
  assert(adminUsers.status === 200 && adminUsers.data.users.some((u) => u.role === 'admin'), 'admin user directory loads');

  const payments = await api('GET', '/api/admin/payments?limit=10', { token: adminToken });
  assert(payments.status === 200 && payments.data.payments.length > 0, 'admin payment ledger loads');

  const refunds = await api('GET', '/api/admin/refunds', { token: adminToken });
  assert(refunds.status === 200 && refunds.data.refunds.some((r) => r.percent === 100), 'refund ledger records the 100% refund');

  const revenueCsv = await api('GET', '/api/admin/reports/revenue.csv', { token: adminToken });
  assert(
    revenueCsv.status === 200 && String(revenueCsv.headers.get('content-type')).includes('text/csv'),
    'revenue CSV export is downloadable'
  );
  const bookingsCsv = await api('GET', '/api/admin/reports/bookings.csv', { token: adminToken });
  assert(bookingsCsv.status === 200 && String(bookingsCsv.data.raw || '').includes('Booking Ref'), 'bookings CSV contains headers');

  const occupancyCsv = await api('GET', '/api/admin/reports/occupancy.csv', { token: adminToken });
  assert(occupancyCsv.status === 200, 'occupancy CSV export is downloadable');

  const summary = await api('GET', '/api/admin/reports/summary', { token: adminToken });
  assert(summary.status === 200 && summary.data.totals.revenue >= 0, 'reports summary returns aggregates');

  const audit = await api('GET', '/api/admin/audit-logs?limit=10', { token: adminToken });
  assert(audit.status === 200 && audit.data.logs.length > 0, 'audit log is populated');

  const settings = await api('GET', '/api/admin/settings', { token: adminToken });
  assert(settings.status === 200 && settings.data.settings.supportEmail, 'admin settings load');

  const invalidFacility = await api('POST', '/api/admin/facilities', { token: adminToken, body: { name: 'x' } });
  assert(invalidFacility.status === 400, 'facility validation rejects incomplete payloads');

  const upcoming = await api('GET', '/api/bookings/mine?scope=upcoming&limit=20', { token: userToken });
  const protectedBooking = (upcoming.data.bookings || []).find(
    (b) => b.status === 'confirmed' && b.facility.id !== facility.id
  );
  if (protectedBooking) {
    const slotMaintenance = await api('PATCH', `/api/admin/slots/${protectedBooking.slot.id}`, {
      token: adminToken,
      body: { status: 'maintenance' },
    });
    assert(slotMaintenance.status === 409, 'taking a slot with upcoming bookings out of service is blocked');
  } else {
    assert(false, 'taking a slot with upcoming bookings out of service is blocked', 'no confirmed booking found');
  }

  const reviewCheck = await api('GET', `/api/reviews/facility/${facility.id}`);
  assert(reviewCheck.status === 200, 'facility reviews are publicly readable');

  results.forEach((line) => console.log(line));
  console.log('');
  console.log(`Passed ${passed}, failed ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  results.forEach((line) => console.log(line));
  console.error('E2E run crashed:', error);
  process.exitCode = 1;
});
