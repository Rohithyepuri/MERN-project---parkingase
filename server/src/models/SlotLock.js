import mongoose from 'mongoose';

// One document per 30-minute occupancy bucket. A unique index on
// (slot, bucket) makes overlapping reservations impossible under concurrency:
// the second writer receives a duplicate-key error and is rejected.
const slotLockSchema = new mongoose.Schema(
  {
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
    bucket: { type: Date, required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
  },
  { timestamps: true }
);

slotLockSchema.index({ slot: 1, bucket: 1 }, { unique: true });
slotLockSchema.index({ booking: 1 });
slotLockSchema.index({ bucket: 1 });

export const LOCK_BUCKET_MS = 30 * 60 * 1000;

export default mongoose.model('SlotLock', slotLockSchema);
