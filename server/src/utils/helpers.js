import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function makeBookingRef() {
  return `PK-${randomCode(6)}`;
}

export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatInr(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

export function isStaffAssigned(user, facilityId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return (user.staffFacilities || []).some((id) => String(id) === String(facilityId));
}
