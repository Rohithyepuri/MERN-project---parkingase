import mongoose from 'mongoose';

const zoneSchema = new mongoose.Schema(
  {
    facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    floor: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    vehicleType: { type: String, enum: ['2W', '4W', 'EV'], required: true },
    slotType: {
      type: String,
      enum: ['standard', 'compact', 'accessible', 'ev', 'premium'],
      default: 'standard',
    },
    pricePerHour: { type: Number, required: true, min: 0, max: 10000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

zoneSchema.index({ floor: 1, name: 1 }, { unique: true });

export default mongoose.model('Zone', zoneSchema);
