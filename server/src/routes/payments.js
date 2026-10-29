import { Router } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate } from '../middleware/auth.js';
import {
  paymentModeInfo,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from '../services/payments.js';
import { markBookingPaid, markPaymentFailed } from '../services/bookings.js';
import { issueTicket } from '../services/ticket.js';
import { bookingView, paymentView } from '../utils/serialize.js';
import { env } from '../config.js';

const router = Router();

router.get('/config', (req, res) => {
  res.json(paymentModeInfo());
});

router.get(
  '/mine',
  authenticate,
  asyncHandler(async (req, res) => {
    const payments = await Payment.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate({ path: 'booking', select: 'ref status startTime endTime facility', populate: { path: 'facility', select: 'name' } });
    res.json({ payments: payments.map(paymentView) });
  })
);

async function loadOwnedPending(bookingId, user) {
  if (!mongoose.isValidObjectId(bookingId)) throw new ApiError(404, 'Booking not found', 'not_found');
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found', 'not_found');
  if (String(booking.user) !== String(user._id)) throw new ApiError(403, 'Not your booking', 'forbidden');
  const payment = await Payment.findOne({ booking: booking._id }).sort({ createdAt: -1 });
  if (!payment) throw new ApiError(404, 'Payment record not found', 'not_found');
  return { booking, payment };
}

router.post(
  '/:bookingId/confirm',
  authenticate,
  asyncHandler(async (req, res) => {
    const { booking, payment } = await loadOwnedPending(req.params.bookingId, req.user);

    if (booking.status === 'confirmed' || booking.status === 'checked_in') {
      return res.json({
        status: 'already_confirmed',
        booking: bookingView(booking),
        ticket: issueTicket(booking),
        payment: paymentView(payment),
      });
    }
    if (booking.status !== 'pending' && booking.status !== 'payment_failed') {
      throw new ApiError(409, `This booking is ${booking.status} and cannot be paid`, 'invalid_state');
    }

    if (payment.provider === 'demo') {
      const outcome = req.body.outcome === 'fail' ? 'fail' : 'success';
      if (outcome === 'fail') {
        const failed = await markPaymentFailed({
          booking,
          payment,
          reason: 'Demo payment declined by the customer',
        });
        return res.status(402).json({
          status: 'failed',
          message: 'Payment failed. No money was moved.',
          booking: bookingView(failed),
        });
      }
      await markBookingPaid({ booking, payment, paymentId: `demo_pay_${payment.orderId.slice(-10)}`, method: 'demo' });
    } else {
      const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
      if (!orderId || !paymentId || !signature) {
        throw new ApiError(400, 'Razorpay order, payment and signature are required', 'validation_error');
      }
      if (payment.orderId !== orderId) {
        throw new ApiError(400, 'Payment order does not match this booking', 'payment_mismatch');
      }
      if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
        throw new ApiError(400, 'Payment signature verification failed', 'invalid_signature');
      }
      await markBookingPaid({ booking, payment, paymentId, signature, method: 'razorpay' });
    }

    const fresh = await Booking.findById(booking._id).populate(['facility', 'zone', 'floor', 'slot']);
    res.json({
      status: 'confirmed',
      booking: bookingView(fresh),
      ticket: issueTicket(fresh),
      payment: paymentView(await Payment.findById(payment._id)),
    });
  })
);

export async function handleWebhook(req, res) {
  try {
    if (!env.razorpay.webhookSecret) {
      return res.status(503).json({ error: 'Webhook secret is not configured' });
    }
    const signature = req.headers['x-razorpay-signature'];
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    if (!verifyWebhookSignature(raw, signature)) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(raw.toString('utf8') || '{}');
    const entity = event?.payload?.payment?.entity;
    if (!entity?.order_id) return res.json({ received: true, ignored: 'no payment entity' });

    const payment = await Payment.findOne({ orderId: entity.order_id });
    if (!payment) return res.json({ received: true, ignored: 'unknown order' });

    const eventId =
      req.headers['x-razorpay-event-id'] ||
      `${event.event}:${entity.id}`;

    if ((payment.processedEvents || []).includes(eventId)) {
      return res.json({ received: true, duplicate: true });
    }
    payment.processedEvents.push(eventId);

    const booking = await Booking.findById(payment.booking);
    if (!booking) {
      await payment.save();
      return res.json({ received: true, ignored: 'booking missing' });
    }

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      await payment.save();
      await markBookingPaid({ booking, payment, paymentId: entity.id, method: entity.method || 'razorpay' });
    } else if (event.event === 'payment.failed') {
      await payment.save();
      await markPaymentFailed({ booking, payment, reason: entity.error_description || 'Payment failed' });
    } else {
      await payment.save();
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('[webhook] error', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

export default router;
