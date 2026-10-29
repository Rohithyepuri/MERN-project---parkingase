import SlotLock, { LOCK_BUCKET_MS } from '../models/SlotLock.js';
import Booking from '../models/Booking.js';
import { ApiError } from '../utils/errors.js';

export function bucketsFor(start, end) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new ApiError(400, 'Invalid booking window', 'invalid_window');
  }
  const first = Math.floor(startMs / LOCK_BUCKET_MS) * LOCK_BUCKET_MS;
  const buckets = [];
  for (let t = first; t < endMs; t += LOCK_BUCKET_MS) {
    buckets.push(new Date(t));
    if (buckets.length > 24 * 7 * 2) throw new ApiError(400, 'Booking window too long', 'invalid_window');
  }
  return buckets;
}

export async function acquireLocks({ slotId, facilityId, bookingId, start, end }) {
  const buckets = bucketsFor(start, end);
  try {
    await SlotLock.insertMany(
      buckets.map((bucket) => ({ slot: slotId, bucket, booking: bookingId, facility: facilityId })),
      { ordered: true }
    );
  } catch (error) {
    await SlotLock.deleteMany({ booking: bookingId });
    if (error?.code === 11000) {
      throw new ApiError(409, 'That slot was just reserved by someone else. Pick another slot.', 'slot_conflict');
    }
    throw error;
  }
}

export async function releaseLocks(bookingId) {
  await SlotLock.deleteMany({ booking: bookingId });
}

export async function busySlotIds(facilityId, start, end) {
  const buckets = bucketsFor(start, end);
  const ids = await SlotLock.distinct('slot', {
    facility: facilityId,
    bucket: { $gte: buckets[0], $lte: buckets[buckets.length - 1] },
  });
  return new Set(ids.map(String));
}

/**
 * Expire abandoned checkouts so inventory is never blocked indefinitely.
 * Safe to call frequently; it is idempotent.
 */
export async function releaseExpiredHolds(now = new Date()) {
  const stale = await Booking.find({
    status: 'pending',
    holdExpiresAt: { $ne: null, $lt: now },
  }).select('_id');

  if (!stale.length) return 0;
  const ids = stale.map((b) => b._id);

  await SlotLock.deleteMany({ booking: { $in: ids } });
  await Booking.updateMany(
    { _id: { $in: ids }, status: 'pending' },
    {
      $set: { status: 'expired' },
      $push: { timeline: { status: 'expired', note: 'Payment window closed', at: now, by: 'system' } },
    }
  );
  return ids.length;
}
