import mongoose from 'mongoose';

const pricingSchema = new mongoose.Schema(
  {
    currency: { type: String, default: 'INR' },
    peakStartHour: { type: Number, min: 0, max: 23, default: 9 },
    peakEndHour: { type: Number, min: 0, max: 24, default: 18 },
    peakMultiplier: { type: Number, min: 1, max: 3, default: 1.25 },
    weekendMultiplier: { type: Number, min: 1, max: 3, default: 1 },
    dailyMax: { type: Number, min: 0, default: 300 },
    minimumCharge: { type: Number, min: 0, default: 20 },
    overstayGraceMinutes: { type: Number, min: 0, max: 120, default: 15 },
  },
  { _id: false }
);

const facilitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, trim: true, maxlength: 600, default: '' },
    address: { type: String, required: true, trim: true, maxlength: 240 },
    city: { type: String, required: true, trim: true, maxlength: 60, index: true },
    lat: { type: Number, min: -90, max: 90, default: null },
    lng: { type: Number, min: -180, max: 180, default: null },
    phone: { type: String, default: '' },
    amenities: {
      type: [{ type: String, enum: ['cctv', 'security', 'ev_charging', 'covered', 'accessible', 'washroom', 'valet', 'lift'] }],
      default: [],
    },
    vehicleTypes: { type: [{ type: String, enum: ['2W', '4W', 'EV'] }], default: ['4W'] },
    openTime: { type: String, default: '06:00' },
    closeTime: { type: String, default: '23:30' },
    open24x7: { type: Boolean, default: false },
    pricing: { type: pricingSchema, default: () => ({}) },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

facilitySchema.index({ name: 'text', address: 'text', city: 'text' });

export default mongoose.model('Facility', facilitySchema);
