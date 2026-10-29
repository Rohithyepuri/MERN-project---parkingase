import { Router } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Session from '../models/Session.js';
import Facility from '../models/Facility.js';
import Incident from '../models/Incident.js';
import AuditLog from '../models/AuditLog.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requireStaff } from '../middleware/auth.js';
import { parseTicket } from '../services/ticket.js';
import { checkInBooking, checkOutBooking } from '../services/bookings.js';
import { recordAudit } from '../services/activity.js';
import { entryWindow } from '../services/pricing.js';
import { bookingView, sessionView } from '../utils/serialize.js';
import { isStaffAssigned } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);
router.use(requireStaff);

function scopeFacilityIds(user) {
  return user.role === 'admin' ? null : (user.staffFacilities || []).map(String);
}

async function facilitiesFor(user) {
  if (user.role === 'admin') return Facility.find({ isActive: true }).select('name city').sort({ name: 1 });
  return Facility.find({ _id: { $in: user.staffFacilities || [] } }).select('name city').sort({ name: 1 });
}

router.get(
  '/facilities',
  asyncHandler(async (req, res) => {
    const facilities = await facilitiesFor(req.user);
    res.json({ facilities: facilities.map((f) => ({ id: String(f._id), name: f.name, city: f.city })) });
  })
);

async function resolveTicket(rawTicket, staffUser) {
  const value = String(rawTicket || '').trim();
  const manualRef = /^PK-[A-Za-z0-9]{6}$/.test(value) ? { ref: value.toUpperCase() } : null;
  const parsed = manualRef || parseTicket(value);
  if (!parsed) {
    await recordAudit({ user: staffUser, ip: null }, {
      action: 'ticket.rejected',
      entity: 'Booking',
      summary: 'Malformed or forged ticket',
    });
    return { error: { code: 'invalid_ticket', message: 'This ticket is not valid. Ask the driver to reopen their pass.' } };
  }

  const booking = await Booking.findOne({ ref: parsed.ref })
    .populate('facility')
    .populate('slot')
    .populate('zone')
    .populate('floor')
    .populate('user', 'name email phone');

  if (!booking) {
    return { error: { code: 'not_found', message: 'No booking matches this ticket.' } };
  }
  if (!isStaffAssigned(staffUser, booking.facility?._id)) {
    await recordAudit({ user: staffUser, ip: null }, {
      action: 'ticket.rejected',
      entity: 'Booking',
      entityId: booking._id,
      summary: 'Ticket is for a facility this operator cannot access',
    });
    return { error: { code: 'facility_scope', message: 'This ticket belongs to a facility you are not assigned to.' } };
  }
  return { booking };
}

function evaluateEntry(booking) {
  const { opensAt, closesAt } = entryWindow(booking);
  const now = new Date();
  if (booking.status === 'checked_in') {
    return { allowed: false, code: 'already_checked_in', message: 'This ticket has already been used to enter.' };
  }
  if (booking.status === 'pending' || booking.status === 'payment_failed') {
    return { allowed: false, code: 'unpaid', message: 'This booking has not been paid for.' };
  }
  if (booking.status !== 'confirmed') {
    return { allowed: false, code: 'not_valid', message: `This booking is ${booking.status.replace('_', ' ')} and cannot be used.` };
  }
  if (now < opensAt) {
    return {
      allowed: false,
      code: 'entry_too_early',
      message: `Entry opens at ${opensAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (1 hour before the booking).`,
      opensAt,
    };
  }
  if (now > closesAt) {
    return { allowed: false, code: 'window_closed', message: 'The booked parking window has already ended.' };
  }
  return { allowed: true, message: 'Ticket verified. Ready to record entry.' };
}

router.post(
  '/validate',
  asyncHandler(async (req, res) => {
    requireFieldsClient(req.body, ['ticket']);
    const { booking, error } = await resolveTicket(String(req.body.ticket), req.user);
    if (error) return res.status(400).json({ valid: false, ...error });

    const entry = evaluateEntry(booking);
    if (!entry.allowed) {
      await recordAudit(req, {
        action: 'ticket.rejected',
        entity: 'Booking',
        entityId: booking._id,
        summary: `${booking.ref} · ${entry.code}`,
      });
    }

    res.json({
      valid: entry.allowed,
      message: entry.message,
      code: entry.code || 'ok',
      entry,
      booking: bookingView(booking, { includeUser: true }),
    });
  })
);

function requireFieldsClient(body, fields) {
  const missing = fields.filter((f) => !body?.[f]);
  if (missing.length) throw new ApiError(400, `Missing required field: ${missing.join(', ')}`, 'validation_error');
}

router.post(
  '/entry',
  asyncHandler(async (req, res) => {
    requireFieldsClient(req.body, ['ticket']);
    const { booking, error } = await resolveTicket(String(req.body.ticket), req.user);
    if (error) return res.status(400).json({ valid: false, ...error });

    const entry = evaluateEntry(booking);
    if (!entry.allowed) {
      await recordAudit(req, {
        action: 'ticket.rejected',
        entity: 'Booking',
        entityId: booking._id,
        summary: `${booking.ref} · ${entry.code}`,
      });
      return res.status(entry.code === 'already_checked_in' ? 409 : 400).json({ valid: false, ...entry });
    }

    const updated = await checkInBooking({ booking, staffUser: req.user });
    const populated = await Booking.findById(updated._id)
      .populate('facility')
      .populate('zone')
      .populate('floor')
      .populate('slot')
      .populate('user', 'name email phone');
    const session = await Session.findOne({ booking: updated._id })
      .populate('facility')
      .populate('slot')
      .populate({ path: 'booking', populate: ['user', 'zone', 'floor', 'slot', 'facility'] });

    await recordAudit(req, {
      action: 'session.checkin',
      entity: 'Session',
      entityId: session?._id,
      summary: `${updated.ref} · ${updated.vehicle.plate} entered`,
    });

    res.json({ valid: true, message: 'Entry recorded.', booking: bookingView(populated, { includeUser: true }), session: sessionView(session) });
  })
);

async function resolveExitBooking(req) {
  let booking = null;
  if (req.body.bookingId) {
    if (!mongoose.isValidObjectId(req.body.bookingId)) throw new ApiError(404, 'Booking not found', 'not_found');
    booking = await Booking.findById(req.body.bookingId);
  } else if (req.body.ticket) {
    const parsed = parseTicket(String(req.body.ticket));
    if (!parsed) throw new ApiError(400, 'This ticket is not valid', 'invalid_ticket');
    booking = await Booking.findOne({ ref: parsed.ref });
  }
  if (!booking) throw new ApiError(404, 'Booking not found', 'not_found');
  if (!isStaffAssigned(req.user, booking.facility)) {
    throw new ApiError(403, 'This booking belongs to a facility you are not assigned to', 'forbidden');
  }
  return booking;
}

router.post(
  '/exit',
  asyncHandler(async (req, res) => {
    const booking = await resolveExitBooking(req);
    const result = await checkOutBooking({ booking, staffUser: req.user });

    await recordAudit(req, {
      action: 'session.checkout',
      entity: 'Session',
      entityId: result.session._id,
      summary: `${booking.ref} · final ₹${result.finalAmount}${result.overstay.charge > 0 ? ` (overstay ₹${result.overstay.charge})` : ''}`,
    });

    const fresh = await Booking.findById(booking._id)
      .populate('facility')
      .populate('zone')
      .populate('floor')
      .populate('slot')
      .populate('user', 'name email phone');

    res.json({
      message: result.overstay.charge > 0 ? 'Exit recorded with overstay charge.' : 'Exit recorded. No overstay charge.',
      booking: bookingView(fresh, { includeUser: true }),
      session: sessionView(result.session),
      overstay: result.overstay,
      finalAmount: result.finalAmount,
    });
  })
);

router.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const facilityIds = scopeFacilityIds(req.user);
    const filter = { status: req.query.status === 'completed' ? 'completed' : 'active' };
    if (facilityIds) filter.facility = { $in: facilityIds };

    const sessions = await Session.find(filter)
      .sort({ entryAt: -1 })
      .limit(Math.min(100, Number(req.query.limit) || 50))
      .populate('facility')
      .populate('slot')
      .populate({ path: 'booking', populate: ['user', 'zone', 'floor', 'slot', 'facility'] });

    res.json({ sessions: sessions.map(sessionView) });
  })
);

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const facilityIds = scopeFacilityIds(req.user);
    const now = new Date();
    const istOffset = 5.5 * 3600 * 1000;
    const shifted = new Date(now.getTime() + istOffset);
    const dayStart = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - istOffset);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

    const facilityFilter = facilityIds ? { facility: { $in: facilityIds } } : {};
    const startOfDayFilter = facilityIds ? { facility: { $in: facilityIds } } : {};

    const [expectedArrivals, activeSessions, arrivalsToday, overdue, failedToday, recentAudit] = await Promise.all([
      Booking.countDocuments({
        ...facilityFilter,
        status: 'confirmed',
        startTime: { $gte: dayStart, $lt: dayEnd },
      }),
      Session.find({ ...facilityFilter, status: 'active' })
        .sort({ entryAt: -1 })
        .populate('facility')
        .populate('slot')
        .populate({ path: 'booking', populate: ['user', 'zone', 'floor', 'slot', 'facility'] }),
      Session.countDocuments({ ...startOfDayFilter, entryAt: { $gte: dayStart, $lt: dayEnd } }),
      Session.countDocuments({ ...facilityFilter, status: 'active', expectedExitAt: { $lt: now } }),
      AuditLog.countDocuments({
        action: { $in: ['ticket.rejected', 'ticket.invalid'] },
        at: { $gte: dayStart, $lt: dayEnd },
      }),
      AuditLog.find({}).sort({ at: -1 }).limit(8),
    ]);

    res.json({
      metrics: {
        expectedArrivals,
        activeSessions: activeSessions.length,
        arrivalsToday,
        overdue,
        failedToday,
        expectedDepartures: activeSessions.filter(
          (s) => new Date(s.expectedExitAt).getTime() <= now.getTime() + 2 * 3600 * 1000
        ).length,
      },
      activeSessions: activeSessions.slice(0, 8).map(sessionView),
      recentEvents: recentAudit.map((a) => ({
        id: String(a._id),
        action: a.action,
        summary: a.summary,
        actor: a.actorName,
        at: a.at,
      })),
      updatedAt: now,
    });
  })
);

router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const facilityIds = scopeFacilityIds(req.user);
    const filter = { status: 'completed' };
    if (facilityIds) filter.facility = { $in: facilityIds };
    if (req.query.from || req.query.to) {
      filter.exitAt = {};
      if (req.query.from) filter.exitAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.exitAt.$lte = new Date(req.query.to);
    }
    const sessions = await Session.find(filter)
      .sort({ exitAt: -1 })
      .limit(100)
      .populate('facility')
      .populate('slot')
      .populate({ path: 'booking', populate: ['user', 'zone', 'floor', 'slot', 'facility'] });

    res.json({ sessions: sessions.map(sessionView) });
  })
);

router.get(
  '/incidents',
  asyncHandler(async (req, res) => {
    const facilityIds = scopeFacilityIds(req.user);
    const filter = facilityIds ? { facility: { $in: facilityIds } } : {};
    const incidents = await Incident.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('facility', 'name')
      .populate('slot', 'code')
      .populate('reportedBy', 'name');
    res.json({
      incidents: incidents.map((i) => ({
        id: String(i._id),
        facility: { id: String(i.facility?._id), name: i.facility?.name },
        slot: i.slot ? { id: String(i.slot._id), code: i.slot.code } : null,
        category: i.category,
        description: i.description,
        status: i.status,
        reportedBy: i.reportedBy?.name,
        createdAt: i.createdAt,
        resolvedAt: i.resolvedAt,
      })),
    });
  })
);

router.post(
  '/incidents',
  asyncHandler(async (req, res) => {
    requireFieldsClient(req.body, ['facilityId', 'description']);
    if (!mongoose.isValidObjectId(req.body.facilityId)) throw new ApiError(404, 'Facility not found', 'not_found');
    if (!isStaffAssigned(req.user, req.body.facilityId)) {
      throw new ApiError(403, 'You are not assigned to that facility', 'forbidden');
    }
    const categories = ['vehicle_damage', 'equipment', 'safety', 'cleanliness', 'security', 'other'];
    const category = categories.includes(req.body.category) ? req.body.category : 'other';

    const incident = await Incident.create({
      facility: req.body.facilityId,
      slot: mongoose.isValidObjectId(req.body.slotId) ? req.body.slotId : null,
      reportedBy: req.user._id,
      category,
      description: String(req.body.description).slice(0, 500),
    });

    await recordAudit(req, {
      action: 'incident.report',
      entity: 'Incident',
      entityId: incident._id,
      summary: `${category} · ${String(req.body.description).slice(0, 80)}`,
    });

    res.status(201).json({ message: 'Incident reported', incident: { id: String(incident._id) } });
  })
);

export default router;
