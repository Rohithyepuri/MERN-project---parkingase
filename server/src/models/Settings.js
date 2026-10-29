import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'app' },
    supportEmail: { type: String, default: 'support@parkease.dev' },
    supportPhone: { type: String, default: '+91 80 0000 0000' },
    brandTagline: { type: String, default: 'Find your space. Book with confidence. Park with ease.' },
    defaultGraceMinutes: { type: Number, default: 15 },
    holdMinutes: { type: Number, default: 10 },
    cancellationPolicy: {
      type: String,
      default:
        'Full refund when cancelled 2+ hours before start. 75% between 1 and 2 hours. 50% within 1 hour. No refund after check-in.',
    },
    maintenanceMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Settings', settingsSchema);
