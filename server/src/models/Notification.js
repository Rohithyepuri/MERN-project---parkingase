import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['booking', 'payment', 'refund', 'reminder', 'session', 'system'],
      default: 'system',
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
