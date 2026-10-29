import crypto from 'node:crypto';
import { env } from '../config.js';

function sign(ref) {
  return crypto.createHmac('sha256', env.ticketKey).update(ref).digest('hex').slice(0, 40);
}

export function issueTicket(booking) {
  return `${booking.ref}.${sign(booking.ref)}`;
}

export function parseTicket(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const ref = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (!/^PK-[A-Z0-9]{6}$/.test(ref)) return null;

  const expected = sign(ref);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { ref };
}
