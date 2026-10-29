import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plate: { type: String, required: true, uppercase: true, trim: true, maxlength: 16 },
    type: { type: String, enum: ['2W', '4W', 'EV'], required: true },
    make: { type: String, trim: true, maxlength: 40, default: '' },
    model: { type: String, trim: true, maxlength: 40, default: '' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

vehicleSchema.index({ user: 1, plate: 1 }, { unique: true });

export default mongoose.model('Vehicle', vehicleSchema);
