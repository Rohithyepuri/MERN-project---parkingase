import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { env, paymentMode } from './config.js';
import authRoutes from './routes/auth.js';
import facilityRoutes from './routes/facilities.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes, { handleWebhook } from './routes/payments.js';
import staffRoutes from './routes/staff.js';
import adminRoutes from './routes/admin.js';
import adminInventoryRoutes from './routes/adminInventory.js';
import vehicleRoutes from './routes/vehicles.js';
import notificationRoutes from './routes/notifications.js';
import reviewRoutes from './routes/reviews.js';
import { ApiError, notFound } from './utils/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self)');
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (env.clientOrigin.includes(origin) || env.nodeEnv !== 'production') return callback(null, true);
      return callback(new ApiError(403, 'Origin not allowed', 'cors_denied'));
    },
    credentials: false,
  })
);

// Signature verification needs the untouched body, so this must precede express.json().
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), handleWebhook);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    service: 'parkease-api',
    db: dbStates[mongoose.connection.readyState] || 'unknown',
    paymentMode,
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminInventoryRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', notFound);

const clientDist = path.resolve(__dirname, '../../client/dist');
const hasClientBuild = fs.existsSync(path.join(clientDist, 'index.html'));
if (hasClientBuild) {
  app.use(express.static(clientDist, { maxAge: '1h', index: false }));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('/', (req, res) =>
    res.json({
      service: 'ParkEase API',
      docs: '/api/health',
      hint: 'Client dev server runs on http://localhost:5173',
    })
  );
}

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let code = err.code || 'server_error';
  let details = err.details;

  if (err.name === 'ValidationError') {
    status = 400;
    code = 'validation_error';
    message = Object.values(err.errors || {}).map((e) => e.message).join(', ') || 'Validation failed';
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'invalid_id';
    message = 'Invalid identifier';
  } else if (err.code === 11000) {
    status = 409;
    code = 'duplicate';
    message = 'That record already exists';
    details = err.keyValue;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'invalid_json';
    message = 'Request body is not valid JSON';
  }

  if (status >= 500) console.error('[api]', err);

  res.status(status).json({
    error: {
      message,
      code,
      ...(details ? { details } : {}),
    },
  });
});

export default app;
