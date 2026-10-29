import { ApiError } from '../utils/errors.js';

const buckets = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref?.();

export function rateLimit({ windowMs = 15 * 60_000, max = 20, message = 'Too many attempts. Try again shortly.' } = {}) {
  return (req, res, next) => {
    const identity = req.user?._id ? String(req.user._id) : req.ip;
    const key = `${req.baseUrl}${req.path}:${identity}`;
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return next(new ApiError(429, message, 'rate_limited'));
    }
    return next();
  };
}
