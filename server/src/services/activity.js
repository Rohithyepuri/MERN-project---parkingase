import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';

export async function notify(userId, { type = 'system', title, body = '', link = '' }) {
  if (!userId) return null;
  return Notification.create({ user: userId, type, title, body, link });
}

export async function recordAudit(req, { action, entity, entityId = '', summary = '' }) {
  const actor = req?.user || null;
  try {
    await AuditLog.create({
      actor: actor?._id || null,
      actorName: actor?.name || 'system',
      actorRole: actor?.role || 'system',
      action,
      entity,
      entityId: String(entityId || ''),
      summary,
      ip: req?.ip || '',
    });
  } catch (error) {
    console.error('[audit] failed to record', action, error.message);
  }
}
