import crypto from 'node:crypto';
import { env, paymentsAreLive, paymentMode } from '../config.js';
import { ApiError } from '../utils/errors.js';
import { round2 } from '../utils/helpers.js';

const RAZORPAY_API = 'https://api.razorpay.com/v1';

function authHeader() {
  const token = Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString('base64');
  return `Basic ${token}`;
}

export const paymentModeInfo = () => ({
  mode: paymentMode,
  razorpayEnabled: paymentsAreLive,
  keyId: paymentsAreLive ? env.razorpay.keyId : null,
  testMode: true,
  currency: env.currency,
});

export async function createOrder({ booking, amount }) {
  if (!paymentsAreLive) {
    return {
      provider: 'demo',
      mode: 'DEMO',
      orderId: `demo_order_${crypto.randomBytes(8).toString('hex')}`,
      amount,
      currency: env.currency,
      keyId: null,
    };
  }

  const response = await fetch(`${RAZORPAY_API}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: env.currency,
      receipt: booking.ref,
      notes: { bookingRef: booking.ref },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(502, data?.error?.description || 'Could not create payment order', 'payment_provider_error');
  }

  return {
    provider: 'razorpay',
    mode: 'TEST',
    orderId: data.id,
    amount,
    currency: env.currency,
    keyId: env.razorpay.keyId,
  };
}

export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!env.razorpay.webhookSecret && !env.razorpay.keySecret) {
    throw new ApiError(400, 'Razorpay is not configured', 'payment_not_configured');
  }
  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const a = Buffer.from(String(signature || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpay.webhookSecret) return false;
  const expected = crypto
    .createHmac('sha256', env.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(String(signature || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function requestRazorpayRefund({ paymentId, amount, notes }) {
  if (!paymentsAreLive) {
    return { id: `demo_refund_${crypto.randomBytes(6).toString('hex')}`, status: 'processed' };
  }
  const response = await fetch(`${RAZORPAY_API}/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      notes,
      speed: 'normal',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(502, data?.error?.description || 'Refund failed at provider', 'refund_provider_error');
  }
  return { id: data.id, status: data.status === 'processed' ? 'processed' : 'pending' };
}

export function refundPercentFor(startTime, now = new Date()) {
  const hoursBefore = (new Date(startTime).getTime() - now.getTime()) / 3600000;
  if (hoursBefore >= 2) return 100;
  if (hoursBefore >= 1) return 75;
  if (hoursBefore >= 0.5) return 50;
  return 0;
}

export function refundAmountFor(total, percent) {
  return round2((Number(total || 0) * percent) / 100);
}
