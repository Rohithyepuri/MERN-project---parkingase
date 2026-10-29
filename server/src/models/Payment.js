import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    provider: { type: String, enum: ['razorpay', 'demo'], required: true },
    mode: { type: String, enum: ['TEST', 'DEMO'], required: true },
    orderId: { type: String, index: true },
    paymentId: { type: String, index: true },
    signature: { type: String, default: '' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['created', 'pending', 'captured', 'failed', 'refunded', 'partially_refunded'],
      default: 'created',
      index: true,
    },
    method: { type: String, default: 'demo' },
    refundedAmount: { type: Number, default: 0 },
    failureReason: { type: String, default: '' },
    processedEvents: { type: [String], default: [] },
    capturedAt: Date,
  },
  { timestamps: true }
);

paymentSchema.index({ booking: 1, status: 1 });

export default mongoose.model('Payment', paymentSchema);
