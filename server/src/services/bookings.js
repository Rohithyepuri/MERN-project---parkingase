import Booking from '../models/Booking.js';
import Session from '../models/Session.js';
import Refund from '../models/Refund.js';
import Facility from '../models/Facility.js';
import Zone from '../models/Zone.js';
import { releaseLocks } from './locks.js';
import { notify } from './activity.js';
import {
  refundPercentFor,
  refundAmountFor,
  requestRazorpayRefund,
} from './payments.js';
import { computeOverstay, entryWindow } from './pricing.js';
import { ApiError } from '../utils/errors.js';
import { round2 } from '../utils/helpers.js';

const unpaidStatuses = new Set(['pending', 'payment_failed']);

export async function markBookingPaid({ booking, payment, paymentId = '', signature = '', method = '' }) {
  const now = new Date();

  if (['confirmed', 'checked_in', 'completed'].includes(booking.status)) {
    if (payment && payment.status !== 'captured') {
      payment.status = 'captured';
      if (paymentId) payment.paymentId = paymentId;
      if (signature) payment.signature = signature;
      payment.capturedAt = payment.capturedAt || now;
      await payment.save();
    }
    return booking;
  }

  if (!unpaidStatuses.has(booking.status)) {
    throw new ApiError(409, `This booking is ${booking.status} and cannot be paid`, 'invalid_state');
  }

  if (payment) {
    payment.status = 'captured';
    if (paymentId) payment.paymentId = paymentId;
    if (signature) payment.signature = signature;
    if (method) payment.method = method;
    payment.capturedAt = now;
    payment.failureReason = '';
    await payment.save();
  }

  booking.status = 'confirmed';
  booking.amountPaid = payment ? payment.amount : booking.quote.total;
  if (payment) booking.payment = payment._id;
  booking.holdExpiresAt = null;
  booking.timeline.push({
    status: 'confirmed',
    note: `Payment captured${payment ? ` · ${payment.mode} mode` : ''}`,
    at: now,
    by: 'system',
  });
  await booking.save();

  await notify(booking.user, {
    type: 'payment',
    title: `Payment successful · ₹${round2(booking.amountPaid)}`,
    body: `Booking ${booking.ref} is confirmed. Your entry pass is ready.`,
    link: `/bookings/${booking._id}`,
  });

  return booking;
}

export async function markPaymentFailed({ booking, payment, reason = 'Payment failed' }) {
  const now = new Date();
  if (payment) {
    payment.status = 'failed';
    payment.failureReason = String(reason).slice(0, 200);
    await payment.save();
  }
  if (unpaidStatuses.has(booking.status)) {
    booking.status = 'payment_failed';
    booking.timeline.push({ status: 'payment_failed', note: String(reason).slice(0, 200), at: now, by: 'system' });
    await booking.save();
    await releaseLocks(booking._id);
  }
  await notify(booking.user, {
    type: 'payment',
    title: 'Payment failed',
    body: `We could not confirm payment for ${booking.ref}. The slot has been released.`,
    link: `/bookings/${booking._id}`,
  });
  return booking;
}

export async function cancelBooking({ booking, payment = null, reason = '', by = 'customer', actorId = null }) {
  const now = new Date();
  if (!['pending', 'confirmed', 'payment_failed'].includes(booking.status)) {
    throw new ApiError(409, `A ${booking.status} booking cannot be cancelled`, 'invalid_state');
  }

  let refund = null;
  let refundPercent = 0;
  let refundAmount = 0;

  const wasPaid = ['confirmed'].includes(booking.status) && booking.amountPaid > 0 && payment;
  if (wasPaid) {
    refundPercent = refundPercentFor(booking.startTime, now);
    refundAmount = refundAmountFor(booking.amountPaid, refundPercent);

    if (refundAmount > 0) {
      let providerStatus = 'processed';
      try {
        const result = await requestRazorpayRefund({
          paymentId: payment.paymentId || payment.orderId,
          amount: refundAmount,
          notes: { booking: booking.ref, reason: reason.slice(0, 120) },
        });
        providerStatus = result.status === 'processed' ? 'processed' : 'pending';
      } catch (error) {
        providerStatus = 'pending';
        console.error('[refund] provider call failed', error.message);
      }

      refund = await Refund.create({
        payment: payment._id,
        booking: booking._id,
        user: booking.user,
        amount: refundAmount,
        percent: refundPercent,
        reason,
        status: providerStatus,
        provider: payment.provider,
        createdBy: actorId,
      });

      payment.refundedAmount = round2((payment.refundedAmount || 0) + refundAmount);
      payment.status = payment.refundedAmount >= payment.amount ? 'refunded' : 'partially_refunded';
      await payment.save();
    }
  }

  booking.status = 'cancelled';
  booking.cancellation = {
    reason,
    by,
    at: now,
    refundPercent,
    refundAmount,
  };
  booking.timeline.push({
    status: 'cancelled',
    note: refundAmount > 0
      ? `Cancelled · ${refundPercent}% refund (₹${refundAmount})`
      : `Cancelled${booking.amountPaid > 0 ? ' · no refund due under policy' : ''}`,
    at: now,
    by,
  });
  await booking.save();
  await releaseLocks(booking._id);

  await notify(booking.user, {
    type: 'booking',
    title: `Booking ${booking.ref} cancelled`,
    body: refundAmount > 0
      ? `A refund of ₹${refundAmount} (${refundPercent}%) has been initiated.`
      : 'No refund applies under the cancellation policy.',
    link: `/bookings/${booking._id}`,
  });

  return { booking, refund, refundPercent, refundAmount };
}

export async function checkInBooking({ booking, staffUser }) {
  const now = new Date();
  if (booking.status === 'checked_in') {
    throw new ApiError(409, 'This ticket has already been used to enter', 'already_checked_in');
  }
  if (booking.status !== 'confirmed') {
    throw new ApiError(409, `Entry is not allowed for a ${booking.status} booking`, 'invalid_state');
  }

  const { opensAt, closesAt } = entryWindow(booking);
  if (now < opensAt) {
    throw new ApiError(400, `Entry opens at ${opensAt.toLocaleString('en-IN')}`, 'entry_too_early');
  }
  if (now > closesAt) {
    throw new ApiError(400, 'The booking window has already ended', 'entry_window_closed');
  }

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'confirmed' },
    {
      $set: { status: 'checked_in', checkedInAt: now },
      $push: {
        timeline: {
          status: 'checked_in',
          note: `Vehicle ${booking.vehicle.plate} checked in`,
          at: now,
          by: staffUser?.name || 'staff',
        },
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new ApiError(409, 'This ticket has already been used to enter', 'already_checked_in');
  }

  try {
    await Session.create({
      booking: updated._id,
      user: updated.user,
      facility: updated.facility,
      slot: updated.slot,
      vehicle: { plate: updated.vehicle.plate, type: updated.vehicle.type },
      entryAt: now,
      expectedExitAt: updated.endTime,
      status: 'active',
      entryBy: staffUser?._id,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'This ticket has already been used to enter', 'already_checked_in');
    }
    throw error;
  }

  await notify(updated.user, {
    type: 'session',
    title: 'Parking session started',
    body: `Vehicle ${updated.vehicle.plate} entered. Booked until ${new Date(updated.endTime).toLocaleString('en-IN')}.`,
    link: `/bookings/${updated._id}`,
  });

  return updated;
}

export async function checkOutBooking({ booking, staffUser, exitAt = new Date() }) {
  if (booking.status !== 'checked_in') {
    throw new ApiError(409, 'Only a checked-in vehicle can be checked out', 'invalid_state');
  }

  const session = await Session.findOne({ booking: booking._id, status: 'active' });
  if (!session) {
    throw new ApiError(409, 'No active parking session was found for this booking', 'no_session');
  }

  const [zone, facility] = await Promise.all([
    Zone.findById(booking.zone),
    Facility.findById(booking.facility),
  ]);
  if (!zone || !facility) {
    throw new ApiError(409, 'The parking inventory for this booking no longer exists', 'inventory_missing');
  }

  const overstay = computeOverstay({
    endTime: booking.endTime,
    exitTime: exitAt,
    zone,
    facility,
  });
  const finalAmount = round2((booking.amountPaid || 0) + overstay.charge);

  booking.status = 'completed';
  booking.checkedOutAt = exitAt;
  booking.overstayMinutes = overstay.overstayMinutes;
  booking.overstayCharge = overstay.charge;
  booking.finalAmount = finalAmount;
  booking.timeline.push({
    status: 'completed',
    note: overstay.charge > 0
      ? `Checked out · ${overstay.overstayMinutes} min overstay · ₹${overstay.charge} extra`
      : 'Checked out · no overstay charge',
    at: exitAt,
    by: staffUser?.name || 'staff',
  });
  await booking.save();

  session.exitAt = exitAt;
  session.status = 'completed';
  session.overstayMinutes = overstay.overstayMinutes;
  session.extraCharge = overstay.charge;
  session.exitBy = staffUser?._id || null;
  await session.save();

  await releaseLocks(booking._id);

  await notify(booking.user, {
    type: 'session',
    title: 'Parking session ended',
    body: overstay.charge > 0
      ? `Final bill ₹${finalAmount} (includes ₹${overstay.charge} overstay).`
      : `Final bill ₹${finalAmount}. Thanks for parking with ParkEase.`,
    link: `/bookings/${booking._id}`,
  });

  return { booking, session, overstay, finalAmount };
}

export async function expireBooking(booking) {
  const now = new Date();
  booking.status = 'expired';
  booking.timeline.push({ status: 'expired', note: 'Payment window closed', at: now, by: 'system' });
  await booking.save();
  await releaseLocks(booking._id);
  return booking;
}
