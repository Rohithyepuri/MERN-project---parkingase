import 'dotenv/config';

const devFallback = (name) => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set in production`);
  }
  return `parkease-dev-${name.toLowerCase()}-do-not-use-in-production`;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/parkease',
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || devFallback('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  ticketKey: process.env.TICKET_HMAC_KEY || devFallback('TICKET_HMAC_KEY'),
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  bookingHoldMinutes: Math.max(2, Number(process.env.BOOKING_HOLD_MINUTES || 10)),
  currency: 'INR',
  timezone: 'Asia/Kolkata',
};

export const paymentsAreLive = Boolean(env.razorpay.keyId && env.razorpay.keySecret);
export const paymentMode = paymentsAreLive ? 'RAZORPAY_TEST' : 'DEMO';
