import { Router } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import Facility from '../models/Facility.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate } from '../middleware/auth.js';
import { requireFields } from '../utils/validate.js';

const router = Router();

async function refreshFacilityRating(facilityId) {
  const result = await Review.aggregate([
    { $match: { facility: new mongoose.Types.ObjectId(facilityId), status: 'visible' } },
    { $group: { _id: '$facility', average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const average = result[0] ? Math.round(result[0].average * 10) / 10 : 0;
  const count = result[0]?.count || 0;
  await Facility.updateOne({ _id: facilityId }, { $set: { rating: { average, count } } });
}

router.get(
  '/facility/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Facility not found', 'not_found');
    const reviews = await Review.find({ facility: req.params.id, status: 'visible' })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('user', 'name');
    res.json({
      reviews: reviews.map((r) => ({
        id: String(r._id),
        rating: r.rating,
        comment: r.comment,
        author: r.user?.name || 'ParkEase driver',
        createdAt: r.createdAt,
      })),
    });
  })
);

router.get(
  '/mine',
  authenticate,
  asyncHandler(async (req, res) => {
    const reviews = await Review.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('facility', 'name');
    res.json({
      reviews: reviews.map((r) => ({
        id: String(r._id),
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        booking: r.booking ? String(r.booking) : null,
        facility: { id: String(r.facility?._id), name: r.facility?.name },
        createdAt: r.createdAt,
      })),
    });
  })
);

router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['bookingId', 'rating']);
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ApiError(400, 'Rating must be between 1 and 5', 'validation_error');
    }
    if (!mongoose.isValidObjectId(req.body.bookingId)) throw new ApiError(404, 'Booking not found', 'not_found');

    const booking = await Booking.findOne({ _id: req.body.bookingId, user: req.user._id });
    if (!booking) throw new ApiError(404, 'Booking not found', 'not_found');
    if (booking.status !== 'completed') {
      throw new ApiError(409, 'You can review a facility after completing a parking session', 'review_not_allowed');
    }

    const existing = await Review.findOne({ booking: booking._id });
    if (existing) throw new ApiError(409, 'You have already reviewed this booking', 'review_exists');

    const review = await Review.create({
      user: req.user._id,
      facility: booking.facility,
      booking: booking._id,
      rating,
      comment: String(req.body.comment || '').slice(0, 600),
    });
    await refreshFacilityRating(booking.facility);

    res.status(201).json({
      review: { id: String(review._id), rating: review.rating, comment: review.comment },
    });
  })
);

export { refreshFacilityRating };
export default router;
