import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { signToken, authenticate } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { requireFields, requireString, isEmail } from '../utils/validate.js';
import { userView } from '../utils/serialize.js';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 30, message: 'Too many attempts. Try again shortly.' });

function assertPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters', 'weak_password');
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new ApiError(400, 'Password must include a letter and a number', 'weak_password');
  }
  return password;
}

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name', 'email', 'password']);
    const name = requireString(req.body.name, { min: 2, max: 80, field: 'Name' });
    const email = String(req.body.email).trim().toLowerCase();
    if (!isEmail(email)) throw new ApiError(400, 'Enter a valid email address', 'validation_error');
    const password = assertPassword(req.body.password);

    const existing = await User.findOne({ email });
    if (existing) throw new ApiError(409, 'An account with this email already exists', 'email_taken');

    const user = await User.create({
      name,
      email,
      password,
      phone: String(req.body.phone || '').trim().slice(0, 20),
      role: 'user',
    });

    res.status(201).json({ token: signToken(user), user: userView(user) });
  })
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['email', 'password']);
    const email = String(req.body.email).trim().toLowerCase();
    const user = await User.findOne({ email }).select('+password');
    if (!user) throw new ApiError(401, 'Invalid email or password', 'invalid_credentials');

    const ok = await user.comparePassword(String(req.body.password));
    if (!ok) throw new ApiError(401, 'Invalid email or password', 'invalid_credentials');
    if (user.status === 'suspended') throw new ApiError(403, 'This account is suspended. Contact support.', 'account_suspended');

    user.lastLoginAt = new Date();
    await user.save();

    res.json({ token: signToken(user), user: userView(user) });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: userView(req.user) });
  })
);

router.patch(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (req.body.name !== undefined) {
      user.name = requireString(req.body.name, { min: 2, max: 80, field: 'Name' });
    }
    if (req.body.phone !== undefined) {
      user.phone = String(req.body.phone).trim().slice(0, 20);
    }
    if (req.body.preferences && typeof req.body.preferences === 'object') {
      const theme = req.body.preferences.theme;
      if (theme && !['light', 'dark', 'system'].includes(theme)) {
        throw new ApiError(400, 'Invalid theme preference', 'validation_error');
      }
      if (theme) user.preferences.theme = theme;
      if (typeof req.body.preferences.notifications === 'boolean') {
        user.preferences.notifications = req.body.preferences.notifications;
      }
    }
    await user.save();
    res.json({ user: userView(user) });
  })
);

router.post(
  '/change-password',
  authenticate,
  authLimiter,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['currentPassword', 'newPassword']);
    const next = assertPassword(req.body.newPassword);
    const user = await User.findById(req.user._id).select('+password');
    const ok = await user.comparePassword(String(req.body.currentPassword));
    if (!ok) throw new ApiError(400, 'Current password is incorrect', 'invalid_credentials');
    user.password = next;
    await user.save();
    res.json({ message: 'Password updated' });
  })
);

router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['email']);
    const email = String(req.body.email).trim().toLowerCase();
    const user = await User.findOne({ email });
    if (user) {
      const token = jwt.sign({ sub: String(user._id), purpose: 'password_reset' }, env.jwtSecret, {
        expiresIn: '30m',
      });
      const link = `${env.clientOrigin[0]}/reset-password?token=${token}`;
      if (env.nodeEnv !== 'production') {
        console.log(`[auth] password reset link for ${email}: ${link}`);
      }
    }
    res.json({
      message: 'If that email exists, a reset link has been sent.',
    });
  })
);

router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['token', 'password']);
    const password = assertPassword(req.body.password);
    let payload;
    try {
      payload = jwt.verify(String(req.body.token), env.jwtSecret);
    } catch {
      throw new ApiError(400, 'This reset link is invalid or has expired', 'invalid_token');
    }
    if (payload.purpose !== 'password_reset') {
      throw new ApiError(400, 'This reset link is invalid', 'invalid_token');
    }
    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(400, 'This reset link is invalid', 'invalid_token');
    user.password = password;
    await user.save();
    res.json({ message: 'Password reset. Sign in with your new password.' });
  })
);

export default router;
