import { releaseExpiredHolds, releaseLocks } from './locks.js';
import Booking from '../models/Booking.js';
import Notification from '../models/Notification.js';
import { notify } from './activity.js';

const NO_SHOW_AFTER_MS = 2 * 60 * 60 * 1000;

export async function sweepBookings() {
  const now = new Date();
  const expired = await releaseExpiredHolds(now);

  const upcoming = await Booking.find({
    status: 'confirmed',
    startTime: { $gte: new Date(now.getTime() + 45 * 60_000), $lte: new Date(now.getTime() + 75 * 60_000) },
  }).limit(50);

  let reminders = 0;
  for (const booking of upcoming) {
    const link = `/bookings/${booking._id}`;
    const existing = await Notification.exists({ user: booking.user, type: 'reminder', link });
    if (existing) continue;
    await notify(booking.user, {
      type: 'reminder',
      title: 'Your parking starts soon',
      body: `Booking ${booking.ref} starts at ${new Date(booking.startTime).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
      })}. Keep your entry pass handy.`,
      link,
    });
    reminders += 1;
  }

  const neglect = await Booking.find({
    status: 'confirmed',
    endTime: { $lt: new Date(now.getTime() - NO_SHOW_AFTER_MS) },
  }).limit(50);

  for (const booking of neglect) {
    booking.status = 'no_show';
    booking.timeline.push({ status: 'no_show', note: 'No entry recorded within 2 hours of the booking window', at: now, by: 'system' });
    await booking.save();
    await releaseLocks(booking._id);
    await notify(booking.user, {
      type: 'booking',
      title: `Booking ${booking.ref} marked as a no-show`,
      body: 'No entry was recorded for this reservation.',
      link: `/bookings/${booking._id}`,
    });
  }

  return { expired, reminders, noShows: neglect.length };
}
