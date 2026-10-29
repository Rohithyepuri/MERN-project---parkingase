import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorName: { type: String, default: 'system' },
    actorRole: { type: String, default: 'system' },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String, default: '' },
    summary: { type: String, default: '' },
    ip: { type: String, default: '' },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

auditLogSchema.index({ at: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
