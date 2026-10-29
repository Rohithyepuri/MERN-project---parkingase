import mongoose from 'mongoose';

const floorSchema = new mongoose.Schema(
  {
    facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    level: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

floorSchema.index({ facility: 1, level: 1 }, { unique: true });

export default mongoose.model('Floor', floorSchema);
