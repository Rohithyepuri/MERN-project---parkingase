import { ApiError } from '../utils/errors.js';

export function requireFields(body, fields) {
  const missing = fields.filter((field) => {
    const value = body?.[field];
    return value === undefined || value === null || (typeof value === 'string' && !value.trim());
  });
  if (missing.length) {
    throw new ApiError(400, `Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`, 'validation_error');
  }
}

export function requireString(value, { min = 1, max = 500, field = 'value' } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min || text.length > max) {
    throw new ApiError(400, `${field} must be between ${min} and ${max} characters`, 'validation_error');
  }
  return text;
}

export function toNumber(value, { min = -Infinity, max = Infinity, field = 'value', fallback } = {}) {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw new ApiError(400, `${field} is required`, 'validation_error');
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw new ApiError(400, `${field} is invalid`, 'validation_error');
  }
  return num;
}

export function toDate(value, field = 'date') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, `${field} is invalid`, 'validation_error');
  return date;
}

export function toBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || ''));
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function pagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}
