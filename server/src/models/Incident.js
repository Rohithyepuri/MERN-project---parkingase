import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema(
  {
    facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', default: null },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: {
      type: String,
      enum: ['vehicle_damage', 'equipment', 'safety', 'cleanliness', 'security', 'other'],
      default: 'other',
    },
    description: { type: String, required: true, maxlength: 500 },
    status: { type: String, enum: ['open', 'investigating', 'resolved', 'closed'], default: 'open', index: true },
    notes: [
      {
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String,
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    resolvedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('Incident', incidentSchema);
