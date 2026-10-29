import { Router } from 'express';
import mongoose from 'mongoose';
import Facility from '../models/Facility.js';
import Floor from '../models/Floor.js';
import Zone from '../models/Zone.js';
import Slot from '../models/Slot.js';
import Review from '../models/Review.js';
import SlotLock, { LOCK_BUCKET_MS } from '../models/SlotLock.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate } from '../middleware/auth.js';
import { escapeRegex } from '../utils/validate.js';
import { busySlotIds, bucketsFor } from '../services/locks.js';
import User from '../models/User.js';

const router = Router();

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search = '', city = '', vehicleType = '', maxPrice, amenities = '', sort = 'recommended', lat, lng } = req.query;

    const filter = { isActive: true };
    if (city) filter.city = new RegExp(`^${escapeRegex(city)}$`, 'i');
    if (search) {
      const rx = new RegExp(escapeRegex(String(search)), 'i');
      filter.$or = [{ name: rx }, { address: rx }, { city: rx }];
    }
    if (vehicleType) filter.vehicleTypes = vehicleType;
    if (amenities) {
      const list = String(amenities).split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length) filter.amenities = { $all: list };
    }

    const facilities = await Facility.find(filter).lean();
    if (!facilities.length) return res.json({ facilities: [], updatedAt: new Date() });

    const facilityIds = facilities.map((f) => f._id);
    const [slotStats, zoneStats, busyStats] = await Promise.all([
      Slot.aggregate([
        { $match: { facility: { $in: facilityIds }, isActive: true } },
        {
          $group: {
            _id: '$facility',
            total: { $sum: 1 },
            maintenance: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } },
          },
        },
      ]),
      Zone.aggregate([
        { $match: { facility: { $in: facilityIds }, isActive: true } },
        { $group: { _id: '$facility', minPrice: { $min: '$pricePerHour' }, zones: { $sum: 1 } } },
      ]),
      SlotLock.aggregate([
        {
          $match: {
            facility: { $in: facilityIds },
            bucket: new Date(Math.floor(Date.now() / LOCK_BUCKET_MS) * LOCK_BUCKET_MS),
          },
        },
        { $group: { _id: '$facility', busy: { $sum: 1 } } },
      ]),
    ]);

    const slotMap = new Map(slotStats.map((s) => [String(s._id), s]));
    const zoneMap = new Map(zoneStats.map((z) => [String(z._id), z]));
    const busyMap = new Map(busyStats.map((b) => [String(b._id), b.busy]));
    const max = maxPrice ? Number(maxPrice) : null;
    const origin = lat && lng ? { lat: Number(lat), lng: Number(lng) } : null;

    let list = facilities.map((f) => {
      const stats = slotMap.get(String(f._id)) || { total: 0, maintenance: 0 };
      const zones = zoneMap.get(String(f._id)) || { minPrice: null, zones: 0 };
      const busy = busyMap.get(String(f._id)) || 0;
      const available = Math.max(0, stats.total - stats.maintenance - busy);
      return {
        id: String(f._id),
        name: f.name,
        slug: f.slug,
        description: f.description,
        address: f.address,
        city: f.city,
        lat: f.lat,
        lng: f.lng,
        amenities: f.amenities,
        vehicleTypes: f.vehicleTypes,
        openTime: f.openTime,
        closeTime: f.closeTime,
        open24x7: f.open24x7,
        pricing: f.pricing,
        rating: f.rating,
        totalSlots: stats.total,
        maintenanceSlots: stats.maintenance,
        availableSlots: available,
        busyNow: busy,
        zoneCount: zones.zones,
        minPrice: zones.minPrice,
        distanceKm: origin && f.lat != null && f.lng != null ? distanceKm(origin.lat, origin.lng, f.lat, f.lng) : null,
      };
    });

    if (max !== null) list = list.filter((f) => f.minPrice != null && f.minPrice <= max);

    const sorters = {
      price: (a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity),
      rating: (a, b) => (b.rating?.average || 0) - (a.rating?.average || 0),
      availability: (a, b) => b.availableSlots - a.availableSlots,
      distance: (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
      name: (a, b) => a.name.localeCompare(b.name),
      recommended: (a, b) => {
        const score = (f) => (f.availableSlots > 0 ? 1 : 0) * 2 + (f.rating?.average || 0) / 5;
        return score(b) - score(a);
      },
    };
    list.sort(sorters[sort] || sorters.recommended);

    res.json({ facilities: list, updatedAt: new Date() });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Facility not found', 'not_found');
    const facility = await Facility.findOne({ _id: req.params.id, isActive: true }).lean();
    if (!facility) throw new ApiError(404, 'Facility not found', 'not_found');

    const now = new Date();
    const start = req.query.start ? new Date(req.query.start) : now;
    const end = req.query.end ? new Date(req.query.end) : new Date(now.getTime() + 60 * 60 * 1000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new ApiError(400, 'Invalid availability window', 'invalid_window');
    }
    bucketsFor(start, end);

    const [floors, zones, slots, reviews, busy] = await Promise.all([
      Floor.find({ facility: facility._id, isActive: true }).sort({ level: 1 }).lean(),
      Zone.find({ facility: facility._id, isActive: true }).lean(),
      Slot.find({ facility: facility._id, isActive: true }).sort({ code: 1 }).lean(),
      Review.find({ facility: facility._id, status: 'visible' })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('user', 'name')
        .lean(),
      busySlotIds(facility._id, start, end),
    ]);

    res.json({
      facility: {
        id: String(facility._id),
        name: facility.name,
        slug: facility.slug,
        description: facility.description,
        address: facility.address,
        city: facility.city,
        lat: facility.lat,
        lng: facility.lng,
        phone: facility.phone,
        amenities: facility.amenities,
        vehicleTypes: facility.vehicleTypes,
        openTime: facility.openTime,
        closeTime: facility.closeTime,
        open24x7: facility.open24x7,
        pricing: facility.pricing,
        rating: facility.rating,
      },
      floors: floors.map((f) => ({ id: String(f._id), name: f.name, level: f.level })),
      zones: zones.map((z) => ({
        id: String(z._id),
        floor: String(z.floor),
        name: z.name,
        vehicleType: z.vehicleType,
        slotType: z.slotType,
        pricePerHour: z.pricePerHour,
      })),
      slots: slots.map((s) => ({
        id: String(s._id),
        floor: String(s.floor),
        zone: String(s.zone),
        code: s.code,
        status: s.status,
        isActive: s.isActive,
        busy: busy.has(String(s._id)),
      })),
      reviews: reviews.map((r) => ({
        id: String(r._id),
        rating: r.rating,
        comment: r.comment,
        author: r.user?.name || 'ParkEase driver',
        createdAt: r.createdAt,
      })),
      window: { start, end },
      updatedAt: new Date(),
    });
  })
);

router.get(
  '/:id/availability',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Facility not found', 'not_found');
    const start = new Date(req.query.start);
    const end = new Date(req.query.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new ApiError(400, 'Provide a valid start and end time', 'invalid_window');
    }
    const busy = await busySlotIds(req.params.id, start, end);
    res.json({ busySlotIds: [...busy], updatedAt: new Date() });
  })
);

router.post(
  '/:id/favorite',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Facility not found', 'not_found');
    const facility = await Facility.exists({ _id: req.params.id, isActive: true });
    if (!facility) throw new ApiError(404, 'Facility not found', 'not_found');

    const user = await User.findById(req.user._id);
    const id = String(req.params.id);
    const index = user.favorites.findIndex((f) => String(f) === id);
    if (index >= 0) user.favorites.splice(index, 1);
    else user.favorites.push(req.params.id);
    await user.save();

    res.json({ favorited: index < 0, favorites: user.favorites.map(String) });
  })
);

export default router;
