import { Router } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import Refund from '../models/Refund.js';
import User from '../models/User.js';
import Facility from '../models/Facility.js';
import Floor from '../models/Floor.js';
import Zone from '../models/Zone.js';
import Slot from '../models/Slot.js';
import Session from '../models/Session.js';
import SlotLock, { LOCK_BUCKET_MS } from '../models/SlotLock.js';
import AuditLog from '../models/AuditLog.js';
import Settings from '../models/Settings.js';
import Review from '../models/Review.js';
import Incident from '../models/Incident.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { requireFields, isEmail, pagination, toBool, toNumber } from '../utils/validate.js';
import { recordAudit, notify } from '../services/activity.js';
import { requestRazorpayRefund } from '../services/payments.js';
import { toCsv, sendCsv } from '../services/csv.js';
import { bookingView, paymentView, userView } from '../utils/serialize.js';
import { refreshFacilityRating } from './reviews.js';
import { escapeRegex } from '../utils/validate.js';
import { round2 } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

const IST_OFFSET = 5.5 * 3600 * 1000;

function istDayStart(date = new Date()) {
  const shifted = new Date(date.getTime() + IST_OFFSET);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - IST_OFFSET);
}

function lastNDates(n) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const out = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i -= 1) out.push(fmt.format(new Date(now - i * 86400000)));
  return out;
}

function parseRange(query, defaultDays = 30) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - defaultDays * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    throw new ApiError(400, 'Provide a valid date range', 'validation_error');
  }
  return { from, to };
}

const iso = (value) => (value ? new Date(value).toISOString() : '');

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const dayStart = istDayStart(now);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    const currentBucket = new Date(Math.floor(now.getTime() / LOCK_BUCKET_MS) * LOCK_BUCKET_MS);

    const [
      facilityCount,
      totalSlots,
      busyNow,
      activeSessions,
      todayBookings,
      todayPayments,
      refunds30,
      created30,
      cancelled30,
      statusRows,
      recentAudit,
      recentBookings,
      paymentSeries,
      bookingSeries,
      facilities,
      slotCounts,
      busyByFacility,
      sessionsByFacility,
    ] = await Promise.all([
      Facility.countDocuments({ isActive: true }),
      Slot.countDocuments({ isActive: true }),
      SlotLock.countDocuments({ bucket: currentBucket }),
      Session.countDocuments({ status: 'active' }),
      Booking.countDocuments({ startTime: { $gte: dayStart, $lt: dayEnd } }),
      Payment.aggregate([
        { $match: { status: { $in: ['captured', 'refunded', 'partially_refunded'] }, capturedAt: { $gte: dayStart, $lt: dayEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Refund.aggregate([{ $match: { createdAt: { $gte: monthAgo } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Booking.countDocuments({ createdAt: { $gte: monthAgo } }),
      Booking.countDocuments({ status: 'cancelled', createdAt: { $gte: monthAgo } }),
      Booking.aggregate([{ $match: { createdAt: { $gte: monthAgo } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      AuditLog.find({}).sort({ at: -1 }).limit(8).lean(),
      Booking.find({}).sort({ createdAt: -1 }).limit(6).populate('facility', 'name').populate('user', 'name email').lean(),
      Payment.aggregate([
        {
          $match: {
            status: { $in: ['captured', 'refunded', 'partially_refunded'] },
            capturedAt: { $gte: new Date(now.getTime() - 7 * 86400000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$capturedAt', timezone: 'Asia/Kolkata' } },
            total: { $sum: '$amount' },
          },
        },
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: new Date(now.getTime() - 7 * 86400000) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
            count: { $sum: 1 },
          },
        },
      ]),
      Facility.find({ isActive: true }).select('name').lean(),
      Slot.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$facility', slots: { $sum: 1 } } }]),
      SlotLock.aggregate([{ $match: { bucket: currentBucket } }, { $group: { _id: '$facility', busy: { $sum: 1 } } }]),
      Session.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$facility', active: { $sum: 1 } } }]),
    ]);

    const dates = lastNDates(7);
    const revenueMap = new Map(paymentSeries.map((p) => [p._id, p.total]));
    const bookingMap = new Map(bookingSeries.map((p) => [p._id, p.count]));
    const slotsMap = new Map(slotCounts.map((s) => [String(s._id), s.slots]));
    const busyMap = new Map(busyByFacility.map((s) => [String(s._id), s.busy]));
    const activeMap = new Map(sessionsByFacility.map((s) => [String(s._id), s.active]));

    res.json({
      metrics: {
        facilities: facilityCount,
        totalSlots,
        availableSlots: Math.max(0, totalSlots - busyNow),
        occupancyRate: totalSlots ? Math.round((busyNow / totalSlots) * 1000) / 10 : 0,
        activeSessions,
        todayBookings,
        todayRevenue: round2(todayPayments[0]?.total || 0),
        refunds30d: round2(refunds30[0]?.total || 0),
        cancellationRate30d: created30 ? Math.round((cancelled30 / created30) * 1000) / 10 : 0,
      },
      series: {
        revenue: dates.map((date) => ({ date, value: round2(revenueMap.get(date) || 0) })),
        bookings: dates.map((date) => ({ date, value: bookingMap.get(date) || 0 })),
      },
      bookingsByStatus: statusRows.map((s) => ({ status: s._id, count: s.count })),
      topFacilities: facilities
        .map((f) => {
          const slots = slotsMap.get(String(f._id)) || 0;
          const busy = busyMap.get(String(f._id)) || 0;
          return {
            id: String(f._id),
            name: f.name,
            slots,
            busy,
            activeSessions: activeMap.get(String(f._id)) || 0,
            utilization: slots ? Math.round((busy / slots) * 1000) / 10 : 0,
          };
        })
        .sort((a, b) => b.utilization - a.utilization)
        .slice(0, 5),
      recentAudit: recentAudit.map((a) => ({
        id: String(a._id),
        action: a.action,
        actor: a.actorName,
        role: a.actorRole,
        summary: a.summary,
        at: a.at,
      })),
      recentBookings: recentBookings.map((b) => ({
        id: String(b._id),
        ref: b.ref,
        status: b.status,
        startTime: b.startTime,
        amount: b.amountPaid || b.quote?.total || 0,
        facility: b.facility?.name,
        customer: b.user?.name,
      })),
      updatedAt: now,
    });
  })
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query, { defaultLimit: 20 });
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search)), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('staffFacilities', 'name'),
      User.countDocuments(filter),
    ]);
    res.json({
      users: users.map(userView),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

router.post(
  '/users',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name', 'email', 'password', 'role']);
    const email = String(req.body.email).trim().toLowerCase();
    if (!isEmail(email)) throw new ApiError(400, 'Enter a valid email address', 'validation_error');
    if (!['staff', 'admin', 'user'].includes(req.body.role)) throw new ApiError(400, 'Invalid role', 'validation_error');
    if (String(req.body.password).length < 8) throw new ApiError(400, 'Password must be at least 8 characters', 'weak_password');
    if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists', 'email_taken');

    const facilities = Array.isArray(req.body.staffFacilities) ? req.body.staffFacilities : [];
    if (facilities.some((id) => !mongoose.isValidObjectId(id))) {
      throw new ApiError(400, 'Invalid facility assignment', 'validation_error');
    }

    const user = await User.create({
      name: String(req.body.name).trim(),
      email,
      password: req.body.password,
      phone: String(req.body.phone || '').slice(0, 20),
      role: req.body.role,
      staffFacilities: req.body.role === 'staff' ? facilities : [],
    });

    await recordAudit(req, {
      action: 'user.create',
      entity: 'User',
      entityId: user._id,
      summary: `Created ${user.role} account for ${user.email}`,
    });

    res.status(201).json({ user: userView(await user.populate('staffFacilities', 'name')) });
  })
);

router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'User not found', 'not_found');
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'User not found', 'not_found');

    const isSelf = String(user._id) === String(req.user._id);
    const nextRole = req.body.role ?? user.role;
    const nextStatus = req.body.status ?? user.status;

    if (!['user', 'staff', 'admin'].includes(nextRole)) throw new ApiError(400, 'Invalid role', 'validation_error');
    if (!['active', 'suspended'].includes(nextStatus)) throw new ApiError(400, 'Invalid account status', 'validation_error');

    if (isSelf && (nextRole !== user.role || nextStatus !== 'active')) {
      throw new ApiError(400, 'You cannot change your own role or suspend your own account', 'forbidden_change');
    }

    if (user.role === 'admin' && (nextRole !== 'admin' || nextStatus !== 'active')) {
      const otherAdmins = await User.countDocuments({ _id: { $ne: user._id }, role: 'admin', status: 'active' });
      if (otherAdmins === 0) throw new ApiError(400, 'At least one active administrator must remain', 'last_admin');
    }

    if (req.body.name !== undefined) user.name = String(req.body.name).trim().slice(0, 80);
    if (req.body.phone !== undefined) user.phone = String(req.body.phone).slice(0, 20);
    user.role = nextRole;
    user.status = nextStatus;

    if (req.body.staffFacilities !== undefined) {
      const list = Array.isArray(req.body.staffFacilities) ? req.body.staffFacilities : [];
      if (list.some((id) => !mongoose.isValidObjectId(id))) throw new ApiError(400, 'Invalid facility assignment', 'validation_error');
      user.staffFacilities = nextRole === 'staff' ? list : [];
    } else if (nextRole !== 'staff') {
      user.staffFacilities = [];
    }

    await user.save();
    await user.populate('staffFacilities', 'name');

    await recordAudit(req, {
      action: 'user.update',
      entity: 'User',
      entityId: user._id,
      summary: `${user.email} · role ${user.role} · ${user.status}`,
    });

    res.json({ user: userView(user) });
  })
);

router.get(
  '/bookings',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query, { defaultLimit: 20 });
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.facility && mongoose.isValidObjectId(req.query.facility)) filter.facility = req.query.facility;
    if (req.query.from || req.query.to) {
      filter.startTime = {};
      if (req.query.from) filter.startTime.$gte = new Date(req.query.from);
      if (req.query.to) filter.startTime.$lte = new Date(req.query.to);
    }
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search)), 'i');
      const userIds = await User.find({ $or: [{ name: rx }, { email: rx }] }).select('_id').limit(25).lean();
      filter.$or = [
        { ref: rx },
        { 'vehicle.plate': rx },
        { user: { $in: userIds.map((u) => u._id) } },
      ];
    }

    const [items, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name email phone')
        .populate('facility', 'name')
        .populate('zone', 'name vehicleType pricePerHour')
        .populate('floor', 'name level')
        .populate('slot', 'code'),
      Booking.countDocuments(filter),
    ]);

    res.json({
      bookings: items.map((b) => bookingView(b, { includeUser: true })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

router.get(
  '/payments',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query, { defaultLimit: 20 });
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }
    const [items, total, totals] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name email')
        .populate({ path: 'booking', select: 'ref' }),
      Payment.countDocuments(filter),
      Payment.aggregate([
        { $match: { ...filter, status: { $in: ['captured', 'refunded', 'partially_refunded'] } } },
        { $group: { _id: null, collected: { $sum: '$amount' }, refunded: { $sum: '$refundedAmount' } } },
      ]),
    ]);

    res.json({
      payments: items.map(paymentView),
      totals: {
        collected: round2(totals[0]?.collected || 0),
        refunded: round2(totals[0]?.refunded || 0),
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

router.post(
  '/payments/:id/refund',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Payment not found', 'not_found');
    const payment = await Payment.findById(req.params.id).populate('booking', 'ref user');
    if (!payment) throw new ApiError(404, 'Payment not found', 'not_found');
    if (!['captured', 'partially_refunded'].includes(payment.status)) {
      throw new ApiError(409, 'Only a captured payment can be refunded', 'invalid_state');
    }

    const remaining = round2(payment.amount - (payment.refundedAmount || 0));
    const amount = req.body.amount !== undefined
      ? toNumber(req.body.amount, { min: 0.01, max: remaining, field: 'Refund amount' })
      : remaining;
    if (amount > remaining) throw new ApiError(400, 'Refund exceeds the remaining paid amount', 'validation_error');

    let status = 'processed';
    try {
      const result = await requestRazorpayRefund({
        paymentId: payment.paymentId || payment.orderId,
        amount,
        notes: { booking: payment.booking?.ref, admin: req.user.email },
      });
      status = result.status === 'processed' ? 'processed' : 'pending';
    } catch (error) {
      status = 'pending';
      console.error('[admin refund] provider failed', error.message);
    }

    const refund = await Refund.create({
      payment: payment._id,
      booking: payment.booking?._id || payment.booking,
      user: payment.user,
      amount,
      percent: Math.round((amount / payment.amount) * 1000) / 10,
      reason: String(req.body.reason || 'Manual refund by administrator').slice(0, 200),
      status,
      provider: payment.provider,
      createdBy: req.user._id,
    });

    payment.refundedAmount = round2((payment.refundedAmount || 0) + amount);
    payment.status = payment.refundedAmount >= payment.amount ? 'refunded' : 'partially_refunded';
    await payment.save();

    await notify(payment.user, {
      type: 'refund',
      title: `Refund of ₹${amount} initiated`,
      body: `Refund for ${payment.booking?.ref || 'your booking'} is ${status}.`,
      link: '/payments',
    });

    await recordAudit(req, {
      action: 'payment.refund',
      entity: 'Payment',
      entityId: payment._id,
      summary: `₹${amount} refunded for ${payment.booking?.ref || 'payment'} · ${status}`,
    });

    res.json({ refund: { id: String(refund._id), amount, status }, payment: paymentView(payment) });
  })
);

router.get(
  '/refunds',
  asyncHandler(async (req, res) => {
    const refunds = await Refund.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('user', 'name email')
      .populate('booking', 'ref');
    res.json({
      refunds: refunds.map((r) => ({
        id: String(r._id),
        amount: r.amount,
        percent: r.percent,
        reason: r.reason,
        status: r.status,
        provider: r.provider,
        createdAt: r.createdAt,
        user: r.user ? { name: r.user.name, email: r.user.email } : null,
        booking: r.booking ? { id: String(r.booking._id), ref: r.booking.ref } : null,
      })),
    });
  })
);

router.get(
  '/reports/summary',
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req.query, 30);

    const [paymentRows, bookingRows, statusRows, facilityRows] = await Promise.all([
      Payment.aggregate([
        { $match: { status: { $in: ['captured', 'refunded', 'partially_refunded'] }, capturedAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$capturedAt', timezone: 'Asia/Kolkata' } },
            revenue: { $sum: '$amount' },
            refunded: { $sum: '$refundedAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$facility', count: { $sum: 1 }, revenue: { $sum: '$amountPaid' } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        { $lookup: { from: 'facilities', localField: '_id', foreignField: '_id', as: 'facility' } },
        { $unwind: { path: '$facility', preserveNullAndEmptyArrays: true } },
      ]),
    ]);

    const totalRevenue = paymentRows.reduce((sum, r) => sum + r.revenue, 0);
    const totalRefunded = paymentRows.reduce((sum, r) => sum + r.refunded, 0);
    const totalBookings = bookingRows.reduce((sum, r) => sum + r.count, 0);

    res.json({
      range: { from, to },
      totals: {
        revenue: round2(totalRevenue),
        refunded: round2(totalRefunded),
        net: round2(totalRevenue - totalRefunded),
        bookings: totalBookings,
      },
      revenueSeries: paymentRows.map((r) => ({ date: r._id, revenue: round2(r.revenue), refunded: round2(r.refunded) })),
      bookingSeries: bookingRows.map((r) => ({ date: r._id, count: r.count })),
      statusBreakdown: statusRows.map((r) => ({ status: r._id, count: r.count })),
      topFacilities: facilityRows.map((r) => ({
        id: String(r._id),
        name: r.facility?.name || 'Removed facility',
        bookings: r.count,
        revenue: round2(r.revenue || 0),
      })),
    });
  })
);

router.get(
  '/reports/revenue.csv',
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req.query, 30);
    const payments = await Payment.find({ capturedAt: { $gte: from, $lte: to } })
      .sort({ capturedAt: 1 })
      .populate('user', 'name email')
      .populate({ path: 'booking', select: 'ref facility', populate: { path: 'facility', select: 'name' } });

    const csv = toCsv(
      payments.map((p) => ({
        paymentId: p.paymentId || p.orderId,
        bookingRef: p.booking?.ref || '',
        facility: p.booking?.facility?.name || '',
        customer: p.user?.name || '',
        email: p.user?.email || '',
        mode: `${p.provider.toUpperCase()}-${p.mode}`,
        status: p.status,
        amount: p.amount,
        refunded: p.refundedAmount || 0,
        createdAt: iso(p.createdAt),
        capturedAt: iso(p.capturedAt),
      })),
      [
        { key: 'paymentId', label: 'Payment ID' },
        { key: 'bookingRef', label: 'Booking Ref' },
        { key: 'facility', label: 'Facility' },
        { key: 'customer', label: 'Customer' },
        { key: 'email', label: 'Email' },
        { key: 'mode', label: 'Mode' },
        { key: 'status', label: 'Status' },
        { key: 'amount', label: 'Amount (INR)' },
        { key: 'refunded', label: 'Refunded (INR)' },
        { key: 'createdAt', label: 'Created At' },
        { key: 'capturedAt', label: 'Captured At' },
      ]
    );

    await recordAudit(req, {
      action: 'report.export',
      entity: 'Report',
      summary: `Revenue CSV · ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`,
    });
    sendCsv(res, `parkease-revenue-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`, csv);
  })
);

router.get(
  '/reports/bookings.csv',
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req.query, 30);
    const bookings = await Booking.find({ createdAt: { $gte: from, $lte: to } })
      .sort({ createdAt: 1 })
      .populate('user', 'name email')
      .populate('facility', 'name')
      .populate('slot', 'code')
      .populate('zone', 'name vehicleType');

    const csv = toCsv(
      bookings.map((b) => ({
        ref: b.ref,
        status: b.status,
        customer: b.user?.name || '',
        email: b.user?.email || '',
        facility: b.facility?.name || '',
        slot: b.slot?.code || '',
        zone: b.zone?.name || '',
        vehicleType: b.zone?.vehicleType || '',
        plate: b.vehicle?.plate || '',
        start: iso(b.startTime),
        end: iso(b.endTime),
        hours: b.quote?.hours || '',
        estimate: b.quote?.total || 0,
        paid: b.amountPaid || 0,
        final: b.finalAmount ?? '',
        overstayCharge: b.overstayCharge || 0,
        createdAt: iso(b.createdAt),
      })),
      [
        { key: 'ref', label: 'Booking Ref' },
        { key: 'status', label: 'Status' },
        { key: 'customer', label: 'Customer' },
        { key: 'email', label: 'Email' },
        { key: 'facility', label: 'Facility' },
        { key: 'slot', label: 'Slot' },
        { key: 'zone', label: 'Zone' },
        { key: 'vehicleType', label: 'Vehicle Type' },
        { key: 'plate', label: 'Vehicle' },
        { key: 'start', label: 'Start' },
        { key: 'end', label: 'End' },
        { key: 'hours', label: 'Hours' },
        { key: 'estimate', label: 'Estimate (INR)' },
        { key: 'paid', label: 'Paid (INR)' },
        { key: 'final', label: 'Final (INR)' },
        { key: 'overstayCharge', label: 'Overstay (INR)' },
        { key: 'createdAt', label: 'Created At' },
      ]
    );

    await recordAudit(req, {
      action: 'report.export',
      entity: 'Report',
      summary: `Bookings CSV · ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`,
    });
    sendCsv(res, `parkease-bookings-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`, csv);
  })
);

router.get(
  '/reports/occupancy.csv',
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req.query, 30);
    const [zones, slotCounts, bookingRows] = await Promise.all([
      Zone.find({}).populate('facility', 'name').populate('floor', 'name').lean(),
      Slot.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$zone', slots: { $sum: 1 } } }]),
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: from, $lte: to },
            status: { $in: ['confirmed', 'checked_in', 'completed'] },
          },
        },
        {
          $group: {
            _id: '$zone',
            bookings: { $sum: 1 },
            revenue: { $sum: '$amountPaid' },
            hours: { $sum: { $divide: [{ $subtract: ['$endTime', '$startTime'] }, 3600000] } },
          },
        },
      ]),
    ]);

    const slotMap = new Map(slotCounts.map((s) => [String(s._id), s.slots]));
    const bookingMap = new Map(bookingRows.map((b) => [String(b._id), b]));

    const csv = toCsv(
      zones.map((z) => {
        const stats = bookingMap.get(String(z._id)) || { bookings: 0, revenue: 0, hours: 0 };
        const slots = slotMap.get(String(z._id)) || 0;
        return {
          facility: z.facility?.name || '',
          floor: z.floor?.name || '',
          zone: z.name,
          vehicleType: z.vehicleType,
          rate: z.pricePerHour,
          slots,
          bookings: stats.bookings,
          bookedHours: round2(stats.hours),
          revenue: round2(stats.revenue),
          utilization: slots ? round2((stats.hours / (slots * 24)) * 100) : 0,
        };
      }),
      [
        { key: 'facility', label: 'Facility' },
        { key: 'floor', label: 'Floor' },
        { key: 'zone', label: 'Zone' },
        { key: 'vehicleType', label: 'Vehicle Type' },
        { key: 'rate', label: 'Rate (INR/h)' },
        { key: 'slots', label: 'Slots' },
        { key: 'bookings', label: 'Bookings' },
        { key: 'bookedHours', label: 'Booked Hours' },
        { key: 'revenue', label: 'Revenue (INR)' },
        { key: 'utilization', label: 'Utilization %' },
      ]
    );

    await recordAudit(req, {
      action: 'report.export',
      entity: 'Report',
      summary: `Occupancy CSV · ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`,
    });
    sendCsv(res, `parkease-occupancy-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`, csv);
  })
);

router.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query, { defaultLimit: 30 });
    const filter = {};
    if (req.query.action) filter.action = new RegExp(escapeRegex(String(req.query.action)), 'i');
    if (req.query.entity) filter.entity = req.query.entity;
    if (req.query.role) filter.actorRole = req.query.role;
    if (req.query.from || req.query.to) {
      filter.at = {};
      if (req.query.from) filter.at.$gte = new Date(req.query.from);
      if (req.query.to) filter.at.$lte = new Date(req.query.to);
    }
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q)), 'i');
      filter.$or = [{ summary: rx }, { actorName: rx }, { entityId: rx }, { action: rx }];
    }

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ at: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      logs: items.map((l) => ({
        id: String(l._id),
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        summary: l.summary,
        actor: l.actorName,
        role: l.actorRole,
        ip: l.ip,
        at: l.at,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = (await Settings.findOne({ key: 'app' })) || (await Settings.create({ key: 'app' }));
    res.json({ settings });
  })
);

router.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = (await Settings.findOne({ key: 'app' })) || (await Settings.create({ key: 'app' }));
    const allowed = ['supportEmail', 'supportPhone', 'brandTagline', 'defaultGraceMinutes', 'holdMinutes', 'cancellationPolicy'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) settings[key] = String(req.body[key]).slice(0, key === 'cancellationPolicy' ? 500 : 120);
    }
    if (req.body.maintenanceMode !== undefined) settings.maintenanceMode = toBool(req.body.maintenanceMode);
    if (req.body.defaultGraceMinutes !== undefined) {
      settings.defaultGraceMinutes = toNumber(req.body.defaultGraceMinutes, { min: 0, max: 120, field: 'Grace period' });
    }
    if (req.body.holdMinutes !== undefined) {
      settings.holdMinutes = toNumber(req.body.holdMinutes, { min: 2, max: 60, field: 'Hold minutes' });
    }
    await settings.save();
    await recordAudit(req, {
      action: 'settings.update',
      entity: 'Settings',
      entityId: settings._id,
      summary: `Updated ${Object.keys(req.body).join(', ')}`,
    });
    res.json({ settings });
  })
);

router.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query, { defaultLimit: 20 });
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name email')
        .populate('facility', 'name'),
      Review.countDocuments(filter),
    ]);
    res.json({
      reviews: items.map((r) => ({
        id: String(r._id),
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        user: { name: r.user?.name, email: r.user?.email },
        facility: { id: String(r.facility?._id), name: r.facility?.name },
        createdAt: r.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

router.patch(
  '/reviews/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Review not found', 'not_found');
    if (!['visible', 'hidden'].includes(req.body.status)) throw new ApiError(400, 'Invalid review status', 'validation_error');
    const review = await Review.findById(req.params.id);
    if (!review) throw new ApiError(404, 'Review not found', 'not_found');
    review.status = req.body.status;
    await review.save();
    await refreshFacilityRating(review.facility);
    await recordAudit(req, {
      action: 'review.moderate',
      entity: 'Review',
      entityId: review._id,
      summary: `Review marked ${review.status}`,
    });
    res.json({ message: `Review marked ${review.status}` });
  })
);

router.get(
  '/incidents',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const incidents = await Incident.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('facility', 'name')
      .populate('slot', 'code')
      .populate('reportedBy', 'name email');
    res.json({
      incidents: incidents.map((i) => ({
        id: String(i._id),
        facility: { id: String(i.facility?._id), name: i.facility?.name },
        slot: i.slot ? { id: String(i.slot._id), code: i.slot.code } : null,
        category: i.category,
        description: i.description,
        status: i.status,
        reportedBy: i.reportedBy?.name,
        notes: i.notes,
        createdAt: i.createdAt,
        resolvedAt: i.resolvedAt,
      })),
    });
  })
);

router.patch(
  '/incidents/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Incident not found', 'not_found');
    const incident = await Incident.findById(req.params.id);
    if (!incident) throw new ApiError(404, 'Incident not found', 'not_found');

    const statuses = ['open', 'investigating', 'resolved', 'closed'];
    if (req.body.status !== undefined) {
      if (!statuses.includes(req.body.status)) throw new ApiError(400, 'Invalid incident status', 'validation_error');
      incident.status = req.body.status;
      if (['resolved', 'closed'].includes(req.body.status)) incident.resolvedAt = new Date();
    }
    if (req.body.note) {
      incident.notes.push({ by: req.user._id, text: String(req.body.note).slice(0, 300), at: new Date() });
    }
    await incident.save();

    await recordAudit(req, {
      action: 'incident.update',
      entity: 'Incident',
      entityId: incident._id,
      summary: `Incident ${incident.status}`,
    });
    res.json({ message: 'Incident updated', status: incident.status });
  })
);

export default router;
