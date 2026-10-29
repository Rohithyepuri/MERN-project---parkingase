import mongoose from 'mongoose';

const lineSchema = new mongoose.Schema(
  { label: { type: String, required: true }, amount: { type: Number, required: true } },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    by: { type: String, default: 'system' },
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    plate: { type: String, required: true, uppercase: true, trim: true },
    type: { type: String, enum: ['2W', '4W', 'EV'], required: true },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    ref: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    floor: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true, index: true },
    vehicle: { type: vehicleSchema, required: true },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'expired', 'payment_failed', 'no_show'],
      default: 'pending',
      index: true,
    },
    quote: {
      currency: { type: String, default: 'INR' },
      hours: { type: Number, required: true },
      lines: { type: [lineSchema], default: [] },
      total: { type: Number, required: true },
      hourlyRate: { type: Number, required: true },
      snapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    amountPaid: { type: Number, default: 0 },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    holdExpiresAt: { type: Date, default: null, index: true },
    checkedInAt: Date,
    checkedOutAt: Date,
    finalAmount: { type: Number, default: null },
    overstayMinutes: { type: Number, default: 0 },
    overstayCharge: { type: Number, default: 0 },
    cancellation: {
      reason: String,
      by: { type: String, default: null },
      at: Date,
      refundPercent: { type: Number, default: 0 },
      refundAmount: { type: Number, default: 0 },
    },
    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true }
);

bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ facility: 1, startTime: 1 });
bookingSchema.index({ status: 1, startTime: 1 });

export default mongoose.model('Booking', bookingSchema);
