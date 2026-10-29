import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema(
  {
    plate: { type: String, default: '' },
    type: { type: String, enum: ['2W', '4W', 'EV'], default: '4W' },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
    vehicle: { type: vehicleSchema, default: () => ({}) },
    entryAt: { type: Date, required: true },
    expectedExitAt: { type: Date, required: true },
    exitAt: Date,
    status: { type: String, enum: ['active', 'completed'], default: 'active', index: true },
    overstayMinutes: { type: Number, default: 0 },
    extraCharge: { type: Number, default: 0 },
    entryBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    exitBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Session', sessionSchema);
