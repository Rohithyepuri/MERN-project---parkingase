import mongoose from 'mongoose';

const slotSchema = new mongoose.Schema(
  {
    facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    floor: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true, index: true },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    status: { type: String, enum: ['available', 'maintenance'], default: 'available', index: true },
    isActive: { type: Boolean, default: true },
    note: { type: String, default: '', maxlength: 200 },
  },
  { timestamps: true }
);

slotSchema.index({ facility: 1, code: 1 }, { unique: true });
slotSchema.index({ zone: 1, code: 1 });

export default mongoose.model('Slot', slotSchema);
