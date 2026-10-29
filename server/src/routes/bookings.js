import { Router } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import Settings from '../models/Settings.js';
import Slot from '../models/Slot.js';
import Zone from '../models/Zone.js';
import Floor from '../models/Floor.js';
import Facility from '../models/Facility.js';
import Vehicle from '../models/Vehicle.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate } from '../middleware/auth.js';
import { requireFields, pagination, toDate, toNumber } from '../utils/validate.js';
import { paymentMode, env, paymentsAreLive } from '../config.js';
import { computeQuote, assertWithinOpeningHours } from '../services/pricing.js';
import { acquireLocks, releaseExpiredHolds, releaseLocks } from '../services/locks.js';
import { createOrder } from '../services/payments.js';
import { issueTicket } from '../services/ticket.js';
import { cancelBooking, markBookingPaid } from '../services/bookings.js';
import { recordAudit } from '../services/activity.js';
import { bookingView, paymentView } from '../utils/serialize.js';
import { isStaffAssigned, makeBookingRef, round2 } from '../utils/helpers.js';

const router = Router();

router.post(
  '/quote',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['slotId', 'startTime', 'endTime']);
    const { slot, facility, zone } = await prepareSlot(req.body.slotId);
    const start = toDate(req.body.startTime, 'Start time');
    const end = toDate(req.body.endTime, 'End time');
    assertWithinOpeningHours({ facility, start, end });
    const quote = computeQuote({ start, end, zone, facility });
    res.json({ quote, zone: { id: String(zone._id), name: zone.name, pricePerHour: zone.pricePerHour } });
  })
);

router.use(authenticate);

const TICKET_STATUSES = new Set(['confirmed', 'checked_in']);

async function loadBooking(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Booking not found', 'not_found');
  const booking = await Booking.findById(id)
    .populate('facility')
    .populate('zone')
    .populate('floor')
    .populate('slot')
    .populate('user', 'name email phone');
  if (!booking) throw new ApiError(404, 'Booking not found', 'not_found');
  return booking;
}

function canView(user, booking) {
  if (user.role === 'admin') return true;
  if (String(booking.user?._id || booking.user) === String(user._id)) return true;
  if (user.role === 'staff' && isStaffAssigned(user, booking.facility?._id || booking.facility)) return true;
  return false;
}

async function prepareSlot(slotId) {
  if (!mongoose.isValidObjectId(slotId)) throw new ApiError(404, 'Slot not found', 'not_found');
  const slot = await Slot.findOne({ _id: slotId, isActive: true });
  if (!slot) throw new ApiError(404, 'Slot not found', 'not_found');
  if (slot.status === 'maintenance') {
    throw new ApiError(409, 'This slot is under maintenance. Choose another slot.', 'slot_maintenance');
  }
  const [facility, zone] = await Promise.all([Facility.findById(slot.facility), Zone.findById(slot.zone)]);
  if (!facility || !facility.isActive) throw new ApiError(409, 'This facility is not accepting bookings', 'facility_inactive');
  if (!zone || !zone.isActive) throw new ApiError(409, 'This zone is not available', 'zone_inactive');
  return { slot, facility, zone };
}

function resolveVehicle(user, body, zone) {
  const type = body.vehicleType || zone.vehicleType;
  if (type !== zone.vehicleType) {
    throw new ApiError(
      400,
      `This zone only accepts ${zone.vehicleType === '2W' ? 'two-wheelers' : zone.vehicleType === 'EV' ? 'electric vehicles' : 'four-wheelers'}`,
      'vehicle_type_mismatch'
    );
  }
  const plate = String(body.plate || '').trim().toUpperCase();
  if (plate && !/^[A-Z0-9][A-Z0-9 -]{2,15}$/.test(plate)) {
    throw new ApiError(400, 'Enter a valid registration number', 'validation_error');
  }
  return { plate, type };
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['slotId', 'startTime', 'endTime']);
    const start = toDate(req.body.startTime, 'Start time');
    const end = toDate(req.body.endTime, 'End time');

    if (start.getTime() < Date.now() - 5 * 60_000) {
      throw new ApiError(400, 'Start time cannot be in the past', 'invalid_window');
    }
    if (end.getTime() - start.getTime() < 30 * 60_000) {
      throw new ApiError(400, 'Minimum booking duration is 30 minutes', 'invalid_window');
    }

    await releaseExpiredHolds();

    const appSettings = await Settings.findOne({ key: 'app' }).lean();
    if (appSettings?.maintenanceMode) {
      throw new ApiError(503, 'Bookings are temporarily paused by the operator. Try again shortly.', 'maintenance_mode');
    }

    const { slot, facility, zone } = await prepareSlot(req.body.slotId);
    assertWithinOpeningHours({ facility, start, end });

    let vehicle = resolveVehicle(req.user, req.body, zone);
    let vehicleId = null;
    if (req.body.vehicleId) {
      const saved = await Vehicle.findOne({ _id: req.body.vehicleId, user: req.user._id });
      if (!saved) throw new ApiError(404, 'Vehicle not found', 'not_found');
      if (saved.type !== zone.vehicleType) {
        throw new ApiError(400, 'That vehicle does not match this zone', 'vehicle_type_mismatch');
      }
      vehicle = { plate: saved.plate, type: saved.type };
      vehicleId = saved._id;
    }
    if (!vehicle.plate) throw new ApiError(400, 'Vehicle registration number is required', 'validation_error');

    const quote = computeQuote({ start, end, zone, facility });
    const bookingId = new mongoose.Types.ObjectId();

    await acquireLocks({ slotId: slot._id, facilityId: facility._id, bookingId, start, end });

    let payment = null;
    let booking = null;
    try {
      payment = await Payment.create({
        user: req.user._id,
        booking: bookingId,
        provider: paymentMode === 'DEMO' ? 'demo' : 'razorpay',
        mode: paymentMode === 'DEMO' ? 'DEMO' : 'TEST',
        amount: quote.total,
        currency: quote.currency,
        status: 'created',
      });

      booking = await Booking.create({
        _id: bookingId,
        ref: makeBookingRef(),
        user: req.user._id,
        facility: facility._id,
        floor: slot.floor,
        zone: zone._id,
        slot: slot._id,
        vehicle: { vehicleId, plate: vehicle.plate, type: vehicle.type },
        startTime: start,
        endTime: end,
        status: 'pending',
        quote,
        payment: payment._id,
        holdExpiresAt: new Date(Date.now() + env.bookingHoldMinutes * 60_000),
        timeline: [{ status: 'pending', note: 'Reservation created · awaiting payment', at: new Date(), by: 'customer' }],
      });

      const order = await createOrder({ booking, amount: quote.total });
      payment.orderId = order.orderId;
      await payment.save();

      if (quote.total === 0) {
        await markBookingPaid({ booking, payment });
      }

      await booking.populate(['facility', 'zone', 'floor', 'slot']);

      res.status(201).json({
        booking: bookingView(booking),
        payment: {
          id: String(payment._id),
          provider: order.provider,
          mode: order.mode,
          orderId: order.orderId,
          amount: quote.total,
          currency: quote.currency,
          keyId: order.keyId,
          payable: quote.total > 0,
        },
        holdExpiresAt: booking.holdExpiresAt,
      });
    } catch (error) {
      await releaseLocks(bookingId);
      if (booking) await Booking.deleteOne({ _id: bookingId, status: 'pending' });
      if (payment) await Payment.deleteOne({ _id: payment._id });
      throw error;
    }
  })
);

router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query, { defaultLimit: 20 });
    const scope = String(req.query.scope || 'all');
    const now = new Date();

    const filter = { user: req.user._id };
    if (scope === 'upcoming') {
      filter.status = { $in: ['pending', 'payment_failed', 'confirmed', 'checked_in'] };
      filter.endTime = { $gte: now };
    } else if (scope === 'past') {
      filter.$or = [{ endTime: { $lt: now } }, { status: { $in: ['completed', 'cancelled', 'expired', 'no_show'] } }];
    }

    const [items, total] = await Promise.all([
      Booking.find(filter)
        .sort({ startTime: scope === 'upcoming' ? 1 : -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('facility')
        .populate('zone')
        .populate('floor')
        .populate('slot'),
      Booking.countDocuments(filter),
    ]);

    res.json({
      bookings: items.map((b) => bookingView(b)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const booking = await loadBooking(req.params.id);
    if (!canView(req.user, booking)) throw new ApiError(403, 'You cannot view this booking', 'forbidden');

    const payment = booking.payment ? await Payment.findById(booking.payment) : null;
    const owner = String(booking.user?._id || booking.user) === String(req.user._id);
    const ticket = TICKET_STATUSES.has(booking.status) ? issueTicket(booking) : null;
    const holdActive = booking.holdExpiresAt && new Date(booking.holdExpiresAt).getTime() > Date.now();
    const paymentInfo =
      payment && owner && booking.status === 'pending' && ['created', 'failed'].includes(payment.status) && holdActive
        ? {
            id: String(payment._id),
            provider: payment.provider,
            mode: payment.mode,
            orderId: payment.orderId,
            amount: payment.amount,
            currency: payment.currency,
            keyId: paymentsAreLive ? env.razorpay.keyId : null,
            payable: true,
          }
        : null;

    res.json({
      booking: bookingView(booking, { includeUser: req.user.role !== 'user', includePayment: true }),
      payment: payment ? paymentView(payment) : null,
      paymentInfo,
      ticket,
      role: req.user.role,
      canCancel:
        owner &&
        (['pending', 'payment_failed', 'confirmed'].includes(booking.status)) &&
        new Date(booking.startTime).getTime() > Date.now(),
    });
  })
);

router.get(
  '/:id/ticket',
  asyncHandler(async (req, res) => {
    const booking = await loadBooking(req.params.id);
    if (!canView(req.user, booking)) throw new ApiError(403, 'You cannot view this ticket', 'forbidden');
    if (!TICKET_STATUSES.has(booking.status)) {
      throw new ApiError(409, 'A ticket is available once the booking is paid and confirmed', 'not_confirmed');
    }
    res.json({
      ticket: issueTicket(booking),
      ref: booking.ref,
      status: booking.status,
      startTime: booking.startTime,
      endTime: booking.endTime,
      vehicle: booking.vehicle,
      slot: booking.slot?.code,
      facility: booking.facility?.name,
    });
  })
);

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const booking = await loadBooking(req.params.id);
    const owner = String(booking.user?._id || booking.user) === String(req.user._id);
    if (!owner && req.user.role !== 'admin') {
      throw new ApiError(403, 'You can only cancel your own booking', 'forbidden');
    }
    const payment = booking.payment ? await Payment.findById(booking.payment) : null;
    const reason = String(req.body.reason || 'Cancelled by customer').slice(0, 200);

    const result = await cancelBooking({
      booking,
      payment,
      reason,
      by: owner ? 'customer' : 'admin',
      actorId: req.user._id,
    });

    if (req.user.role === 'admin') {
      await recordAudit(req, {
        action: 'booking.cancel',
        entity: 'Booking',
        entityId: booking._id,
        summary: `Cancelled ${booking.ref} · refund ₹${result.refundAmount}`,
      });
    }

    res.json({
      booking: bookingView(result.booking),
      refund: result.refund
        ? { amount: result.refund.amount, percent: result.refund.percent, status: result.refund.status }
        : null,
    });
  })
);

export default router;
