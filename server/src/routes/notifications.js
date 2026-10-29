import { Router } from 'express';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = { user: req.user._id };
    if (req.query.unread === 'true') filter.readAt = null;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ user: req.user._id, readAt: null }),
    ]);

    res.json({
      notifications: notifications.map((n) => ({
        id: String(n._id),
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      unreadCount,
    });
  })
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Notification not found', 'not_found');
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notification) throw new ApiError(404, 'Notification not found', 'not_found');
    res.json({ message: 'Marked as read' });
  })
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
      { user: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    res.json({ updated: result.modifiedCount });
  })
);

export default router;
