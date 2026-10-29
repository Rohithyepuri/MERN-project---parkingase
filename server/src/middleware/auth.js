import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config.js';
import { ApiError } from '../utils/errors.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw new ApiError(401, 'Sign in to continue', 'unauthenticated');

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new ApiError(401, 'Your session has expired. Sign in again.', 'session_expired');
    }

    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, 'Account no longer exists', 'unauthenticated');
    if (user.status === 'suspended') throw new ApiError(403, 'This account is suspended', 'account_suspended');

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(req, res, next) {
  if (!extractToken(req)) return next();
  return authenticate(req, res, next);
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Sign in to continue', 'unauthenticated'));
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to do that', 'forbidden'));
  }
  return next();
};

export const requireAdmin = requireRole('admin');
export const requireStaff = requireRole('staff', 'admin');
