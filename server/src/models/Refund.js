import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema(
  {
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    percent: { type: Number, required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['processed', 'pending', 'failed'], default: 'processed' },
    provider: { type: String, enum: ['razorpay', 'demo'], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Refund', refundSchema);
