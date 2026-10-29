import { Router } from 'express';
import mongoose from 'mongoose';
import Facility from '../models/Facility.js';
import Floor from '../models/Floor.js';
import Zone from '../models/Zone.js';
import Slot from '../models/Slot.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import SlotLock, { LOCK_BUCKET_MS } from '../models/SlotLock.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { requireFields, toBool, toNumber } from '../utils/validate.js';
import { parseClock } from '../services/pricing.js';
import { recordAudit } from '../services/activity.js';
import { randomCode } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

const AMENITIES = ['cctv', 'security', 'ev_charging', 'covered', 'accessible', 'washroom', 'valet', 'lift'];
const VEHICLE_TYPES = ['2W', '4W', 'EV'];
const SLOT_TYPES = ['standard', 'compact', 'accessible', 'ev', 'premium'];

const oid = (value, label = 'id') => {
  if (!mongoose.isValidObjectId(value)) throw new ApiError(404, `${label} not found`, 'not_found');
  return value;
};

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function pricingPayload(input, base = {}) {
  const pricing = { ...base };
  const numeric = [
    ['peakStartHour', 0, 23],
    ['peakEndHour', 0, 24],
    ['peakMultiplier', 1, 3],
    ['weekendMultiplier', 1, 3],
    ['dailyMax', 0, 100000],
    ['minimumCharge', 0, 100000],
    ['overstayGraceMinutes', 0, 120],
  ];
  for (const [key, min, max] of numeric) {
    if (input[key] !== undefined && input[key] !== '') {
      pricing[key] = toNumber(input[key], { min, max, field: key });
    }
  }
  return pricing;
}

function facilityPayload(body, existing = null) {
  const payload = {};
  if (body.name !== undefined || !existing) {
    payload.name = String(body.name || '').trim();
    if (payload.name.length < 2 || payload.name.length > 100) {
      throw new ApiError(400, 'Facility name must be 2–100 characters', 'validation_error');
    }
  }
  if (body.address !== undefined || !existing) {
    payload.address = String(body.address || '').trim();
    if (payload.address.length < 3) throw new ApiError(400, 'Address is required', 'validation_error');
  }
  if (body.city !== undefined || !existing) {
    payload.city = String(body.city || '').trim();
    if (!payload.city) throw new ApiError(400, 'City is required', 'validation_error');
  }
  if (body.description !== undefined) payload.description = String(body.description).slice(0, 600);
  if (body.phone !== undefined) payload.phone = String(body.phone).slice(0, 20);
  if (body.lat !== undefined) {
    payload.lat = body.lat === null || body.lat === '' ? null : toNumber(body.lat, { min: -90, max: 90, field: 'Latitude' });
  }
  if (body.lng !== undefined) {
    payload.lng = body.lng === null || body.lng === '' ? null : toNumber(body.lng, { min: -180, max: 180, field: 'Longitude' });
  }
  if (body.amenities !== undefined) {
    if (!Array.isArray(body.amenities)) throw new ApiError(400, 'Amenities must be a list', 'validation_error');
    payload.amenities = body.amenities.filter((a) => AMENITIES.includes(a));
  }
  if (body.vehicleTypes !== undefined) {
    if (!Array.isArray(body.vehicleTypes) || !body.vehicleTypes.length) {
      throw new ApiError(400, 'Select at least one vehicle type', 'validation_error');
    }
    payload.vehicleTypes = body.vehicleTypes.filter((v) => VEHICLE_TYPES.includes(v));
    if (!payload.vehicleTypes.length) throw new ApiError(400, 'Invalid vehicle type', 'validation_error');
  }
  if (body.openTime !== undefined) {
    parseClock(body.openTime, 'Opening time');
    payload.openTime = body.openTime;
  }
  if (body.closeTime !== undefined) {
    parseClock(body.closeTime, 'Closing time');
    payload.closeTime = body.closeTime;
  }
  if (body.open24x7 !== undefined) payload.open24x7 = toBool(body.open24x7);
  if (body.pricing !== undefined) payload.pricing = pricingPayload(body.pricing, existing?.pricing || {});
  if (body.isActive !== undefined) payload.isActive = toBool(body.isActive);
  return payload;
}

router.get(
  '/facilities',
  asyncHandler(async (req, res) => {
    const facilities = await Facility.find({}).sort({ createdAt: -1 }).lean();
    const ids = facilities.map((f) => f._id);
    const [floors, zones, slots, busy] = await Promise.all([
      Floor.aggregate([{ $match: { facility: { $in: ids } } }, { $group: { _id: '$facility', count: { $sum: 1 } } }]),
      Zone.aggregate([{ $match: { facility: { $in: ids } } }, { $group: { _id: '$facility', count: { $sum: 1 } } }]),
      Slot.aggregate([{ $match: { facility: { $in: ids } } }, { $group: { _id: '$facility', count: { $sum: 1 } } }]),
      SlotLock.aggregate([
        {
          $match: {
            facility: { $in: ids },
            bucket: new Date(Math.floor(Date.now() / LOCK_BUCKET_MS) * LOCK_BUCKET_MS),
          },
        },
        { $group: { _id: '$facility', count: { $sum: 1 } } },
      ]),
    ]);
    const toMap = (rows) => new Map(rows.map((r) => [String(r._id), r.count]));
    const floorMap = toMap(floors);
    const zoneMap = toMap(zones);
    const slotMap = toMap(slots);
    const busyMap = toMap(busy);

    res.json({
      facilities: facilities.map((f) => ({
        id: String(f._id),
        name: f.name,
        slug: f.slug,
        address: f.address,
        city: f.city,
        lat: f.lat,
        lng: f.lng,
        description: f.description,
        phone: f.phone,
        amenities: f.amenities,
        vehicleTypes: f.vehicleTypes,
        openTime: f.openTime,
        closeTime: f.closeTime,
        open24x7: f.open24x7,
        pricing: f.pricing,
        rating: f.rating,
        isActive: f.isActive,
        floors: floorMap.get(String(f._id)) || 0,
        zones: zoneMap.get(String(f._id)) || 0,
        slots: slotMap.get(String(f._id)) || 0,
        busyNow: busyMap.get(String(f._id)) || 0,
        createdAt: f.createdAt,
      })),
    });
  })
);

router.get(
  '/facilities/:id',
  asyncHandler(async (req, res) => {
    oid(req.params.id, 'Facility');
    const facility = await Facility.findById(req.params.id).lean();
    if (!facility) throw new ApiError(404, 'Facility not found', 'not_found');

    const [floors, zones, slots, staff, bookings] = await Promise.all([
      Floor.find({ facility: facility._id }).sort({ level: 1 }).lean(),
      Zone.find({ facility: facility._id }).lean(),
      Slot.find({ facility: facility._id }).sort({ code: 1 }).lean(),
      User.find({ staffFacilities: facility._id }).select('name email role').lean(),
      Booking.countDocuments({ facility: facility._id, status: { $in: ['confirmed', 'checked_in'] } }),
    ]);
    const busy = await SlotLock.distinct('slot', {
      facility: facility._id,
      bucket: new Date(Math.floor(Date.now() / LOCK_BUCKET_MS) * LOCK_BUCKET_MS),
    });
    const busySet = new Set(busy.map(String));

    res.json({
      facility: {
        ...facility,
        id: String(facility._id),
      },
      floors: floors.map((f) => ({ id: String(f._id), name: f.name, level: f.level, isActive: f.isActive })),
      zones: zones.map((z) => ({
        id: String(z._id),
        floor: String(z.floor),
        name: z.name,
        vehicleType: z.vehicleType,
        slotType: z.slotType,
        pricePerHour: z.pricePerHour,
        isActive: z.isActive,
        slots: slots.filter((s) => String(s.zone) === String(z._id)).length,
      })),
      slots: slots.map((s) => ({
        id: String(s._id),
        facility: String(s.facility),
        floor: String(s.floor),
        zone: String(s.zone),
        code: s.code,
        status: s.status,
        isActive: s.isActive,
        note: s.note,
        busy: busySet.has(String(s._id)),
      })),
      staff: staff.map((u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role })),
      activeBookings: bookings,
    });
  })
);

router.post(
  '/facilities',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name', 'address', 'city']);
    const payload = facilityPayload(req.body);
    let slug = slugify(payload.name);
    if (!slug) slug = `park-${randomCode(4).toLowerCase()}`;

    let facility;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        facility = await Facility.create({
          ...payload,
          slug: attempt === 0 ? slug : `${slug}-${randomCode(3).toLowerCase()}`,
          pricing: payload.pricing || {},
        });
        break;
      } catch (error) {
        if (error?.code !== 11000) throw error;
        if (attempt === 2) throw new ApiError(409, 'A facility with a similar name already exists', 'slug_taken');
      }
    }

    await recordAudit(req, {
      action: 'facility.create',
      entity: 'Facility',
      entityId: facility._id,
      summary: `Created ${facility.name} (${facility.city})`,
    });

    res.status(201).json({ facility: { ...facility.toObject(), id: String(facility._id) } });
  })
);

router.patch(
  '/facilities/:id',
  asyncHandler(async (req, res) => {
    oid(req.params.id, 'Facility');
    const facility = await Facility.findById(req.params.id);
    if (!facility) throw new ApiError(404, 'Facility not found', 'not_found');

    const payload = facilityPayload(req.body, facility);
    Object.assign(facility, payload);
    await facility.save();

    await recordAudit(req, {
      action: 'facility.update',
      entity: 'Facility',
      entityId: facility._id,
      summary: `Updated ${facility.name} · ${Object.keys(payload).join(', ')}`,
    });

    res.json({ facility: { ...facility.toObject(), id: String(facility._id) } });
  })
);

router.delete(
  '/facilities/:id',
  asyncHandler(async (req, res) => {
    oid(req.params.id, 'Facility');
    const facility = await Facility.findById(req.params.id);
    if (!facility) throw new ApiError(404, 'Facility not found', 'not_found');

    facility.isActive = false;
    await facility.save();

    await recordAudit(req, {
      action: 'facility.deactivate',
      entity: 'Facility',
      entityId: facility._id,
      summary: `Deactivated ${facility.name}. Existing bookings are preserved.`,
    });

    res.json({ message: 'Facility deactivated. Existing bookings are preserved.', facility: { id: String(facility._id), isActive: false } });
  })
);

router.post(
  '/facilities/:id/floors',
  asyncHandler(async (req, res) => {
    oid(req.params.id, 'Facility');
    requireFields(req.body, ['name', 'level']);
    const facility = await Facility.exists({ _id: req.params.id });
    if (!facility) throw new ApiError(404, 'Facility not found', 'not_found');

    try {
      const floor = await Floor.create({
        facility: req.params.id,
        name: String(req.body.name).slice(0, 40),
        level: toNumber(req.body.level, { min: -5, max: 100, field: 'Level' }),
      });
      await recordAudit(req, {
        action: 'floor.create',
        entity: 'Floor',
        entityId: floor._id,
        summary: `${floor.name} · level ${floor.level}`,
      });
      res.status(201).json({ floor: { id: String(floor._id), name: floor.name, level: floor.level, isActive: true } });
    } catch (error) {
      if (error?.code === 11000) throw new ApiError(409, 'A floor with that level already exists', 'floor_exists');
      throw error;
    }
  })
);

router.patch(
  '/floors/:id',
  asyncHandler(async (req, res) => {
    oid(req.params.id, 'Floor');
    const floor = await Floor.findById(req.params.id);
    if (!floor) throw new ApiError(404, 'Floor not found', 'not_found');
    if (req.body.name !== undefined) floor.name = String(req.body.name).slice(0, 40);
    if (req.body.level !== undefined) floor.level = toNumber(req.body.level, { min: -5, max: 100, field: 'Level' });
    if (req.body.isActive !== undefined) floor.isActive = toBool(req.body.isActive);
    try {
      await floor.save();
    } catch (error) {
      if (error?.code === 11000) throw new ApiError(409, 'A floor with that level already exists', 'floor_exists');
      throw error;
    }
    await recordAudit(req, { action: 'floor.update', entity: 'Floor', entityId: floor._id, summary: floor.name });
    res.json({ floor: { id: String(floor._id), name: floor.name, level: floor.level, isActive: floor.isActive } });
  })
);

router.delete(
  '/floors/:id',
  asyncHandler(async (req, res) => {
    oid(req.params.id, 'Floor');
    const floor = await Floor.findById(req.params.id);
    if (!floor) throw new ApiError(404, 'Floor not found', 'not_found');

    const zoneCount = await Zone.countDocuments({ floor: floor._id });
    if (zoneCount > 0) throw new ApiError(409, 'Remove the zones on this floor first', 'floor_in_use');

    await floor.deleteOne();
    await recordAudit(req, { action: 'floor.delete', entity: 'Floor', entityId: floor._id, summary: floor.name });
    res.json({ message: 'Floor removed' });
  })
);

router.post(
  '/floors/:id/zones',
  asyncHandler(async (req, res) => {
    oid(req.params.id, 'Floor');
    requireFields(req.body, ['name', 'vehicleType', 'pricePerHour']);
    const floor = await Floor.findById(req.params.id);
    if (!floor) throw new ApiError(404, 'Floor not found', 'not_found');

    const vehicleType = String(req.body.vehicleType);
    if (!VEHICLE_TYPES.includes(vehicleType)) throw new ApiError(400, 'Invalid vehicle type', 'validation_error');
    const slotType = SLOT_TYPES.includes(req.body.slotType) ? req.body.slotType : 'standard';

    try {
      const zone = await Zone.create({
        facility: floor.facility,
        floor: floor._id,
        name: String(req.body.name).slice(0, 40),
        vehicleType,
        slotType,
        pricePerHour: toNumber(req.body.pricePerHour, { min: 0, max: 10000, field: 'Price per hour' }),
      });
      await recordAudit(req, {
        action: 'zone.create',
        entity: 'Zone',
        entityId: zone._id,
        summary: `${floor.name} · ${zone.name} · ₹${zone.pricePerHour}/h`,
      });
      res.status(201).json({
        zone: {
          id: String(zone._id),
          floor: String(zone.floor),
          name: zone.name,
          vehicleType: zone.vehicleType,
          slotType: zone.slotType,
          pricePerHour: zone.pricePerHour,
          isActive: true,
          slots: 0,
        },
      });
    } catch (error) {
      if (error?.code === 11000) throw new ApiError(409, 'A zone with that name already exists on this floor', 'zone_exists');
      throw error;
    }
  })
);

router.patch(
  '/zones/:id',
  asyncHandler(async (req, res) => {
    oid(req.params.id, 'Zone');
    const zone = await Zone.findById(req.params.id);
    if (!zone) throw new ApiError(404, 'Zone not found', 'not_found');
    if (req.body.name !== undefined) zone.name = String(req.body.name).slice(0, 40);
    if (req.body.pricePerHour !== undefined) {
      zone.pricePerHour = toNumber(req.body.pricePerHour, { min: 0, max: 10000, field: 'Price per hour' });
    }
    if (req.body.slotType !== undefined && SLOT_TYPES.includes(req.body.slotType)) zone.slotType = req.body.slotType;
    if (req.body.vehicleType !== undefined) {
      if (!VEHICLE_TYPES.includes(req.body.vehicleType)) throw new ApiError(400, 'Invalid vehicle type', 'validation_error');
      zone.vehicleType = req.body.vehicleType;
    }
    if (req.body.isActive !== undefined) zone.isActive = toBool(req.body.isActive);
    await zone.save();
    await recordAudit(req, { action: 'zone.update', entity: 'Zone', entityId: zone._id, summary: `${zone.name} · ₹${zone.pricePerHour}/h` });
    res.json({ zone: { id: String(zone._id), name: zone.name, pricePerHour: zone.pricePerHour, vehicleType: zone.vehicleType, slotType: zone.slotType, isActive: zone.isActive } });
  })
);

router.delete(
  '/zones/:id',
  asyncHandler(async (req, res) => {
    oid(req.params.id, 'Zone');
    const zone = await Zone.findById(req.params.id);
    if (!zone) throw new ApiError(404, 'Zone not found', 'not_found');

    const slotCount = await Slot.countDocuments({ zone: zone._id, isActive: true });
    if (slotCount > 0) throw new ApiError(409, 'Remove or deactivate the slots in this zone first', 'zone_in_use');

    await zone.deleteOne();
    await recordAudit(req, { action: 'zone.delete', entity: 'Zone', entityId: zone._id, summary: zone.name });
    res.json({ message: 'Zone removed' });
  })
);

router.post(
  '/zones/:id/slots',
  asyncHandler(async (req, res) => {
    oid(req.params.id, 'Zone');
    const zone = await Zone.findById(req.params.id);
    if (!zone) throw new ApiError(404, 'Zone not found', 'not_found');

    const count = toNumber(req.body.count ?? 10, { min: 1, max: 200, field: 'Slot count' });
    const startNumber = toNumber(req.body.startNumber ?? 1, { min: 1, max: 999, field: 'Start number' });
    const floor = await Floor.findById(zone.floor);
    const prefix = String(req.body.prefix || `${floor?.name?.charAt(0) || 'P'}${zone.name.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || 'A'}`)
      .toUpperCase()
      .slice(0, 8);

    const docs = [];
    for (let i = 0; i < count; i += 1) {
      docs.push({
        facility: zone.facility,
        floor: zone.floor,
        zone: zone._id,
        code: `${prefix}-${String(startNumber + i).padStart(3, '0')}`,
        status: 'available',
        isActive: true,
      });
    }

    let inserted = 0;
    let duplicateCodes = [];
    try {
      const result = await Slot.insertMany(docs, { ordered: false });
      inserted = result.length;
    } catch (error) {
      if (error?.code === 11000 || error?.writeErrors) {
        inserted = error.insertedDocs?.length || 0;
        duplicateCodes = (error.writeErrors || [])
          .filter((we) => we.err?.code === 11000 || we.code === 11000)
          .map((we) => we.err?.op?.code || we.err?.keyValue?.code)
          .filter(Boolean);
        if (!inserted) throw new ApiError(409, 'Those slot codes already exist. Choose a different prefix or start number.', 'slot_exists');
      } else {
        throw error;
      }
    }

    await recordAudit(req, {
      action: 'slot.bulk_create',
      entity: 'Zone',
      entityId: zone._id,
      summary: `Created ${inserted} slots in ${zone.name} (${prefix})`,
    });

    res.status(201).json({ inserted, duplicateCodes, message: `${inserted} slots added.` });
  })
);

router.patch(
  '/slots/:id',
  asyncHandler(async (req, res) => {
    oid(req.params.id, 'Slot');
    const slot = await Slot.findById(req.params.id);
    if (!slot) throw new ApiError(404, 'Slot not found', 'not_found');

    const wantsUnavailable =
      (req.body.status !== undefined && req.body.status !== 'available') ||
      req.body.isActive === false;

    if (wantsUnavailable) {
      const active = await Booking.countDocuments({
        slot: slot._id,
        status: { $in: ['confirmed', 'checked_in'] },
        endTime: { $gt: new Date() },
      });
      if (active > 0) {
        throw new ApiError(
          409,
          'This slot has active or upcoming bookings. Cancel or complete them before taking it out of service.',
          'slot_in_use'
        );
      }
    }

    if (req.body.code !== undefined) slot.code = String(req.body.code).toUpperCase().slice(0, 20);
    if (req.body.status !== undefined) {
      if (!['available', 'maintenance'].includes(req.body.status)) {
        throw new ApiError(400, 'Invalid slot status', 'validation_error');
      }
      slot.status = req.body.status;
    }
    if (req.body.isActive !== undefined) slot.isActive = toBool(req.body.isActive);
    if (req.body.note !== undefined) slot.note = String(req.body.note).slice(0, 200);

    try {
      await slot.save();
    } catch (error) {
      if (error?.code === 11000) throw new ApiError(409, 'A slot with that code already exists in this facility', 'slot_exists');
      throw error;
    }

    await recordAudit(req, {
      action: 'slot.update',
      entity: 'Slot',
      entityId: slot._id,
      summary: `${slot.code} · ${slot.status}${slot.isActive ? '' : ' · inactive'}`,
    });

    res.json({ slot: { id: String(slot._id), code: slot.code, status: slot.status, isActive: slot.isActive, note: slot.note } });
  })
);

router.delete(
  '/slots/:id',
  asyncHandler(async (req, res) => {
    oid(req.params.id, 'Slot');
    const slot = await Slot.findById(req.params.id);
    if (!slot) throw new ApiError(404, 'Slot not found', 'not_found');

    const active = await Booking.countDocuments({
      slot: slot._id,
      status: { $in: ['confirmed', 'checked_in'] },
      endTime: { $gt: new Date() },
    });
    if (active > 0) {
      throw new ApiError(
        409,
        'This slot has active or upcoming bookings. Cancel or complete them before removing it.',
        'slot_in_use'
      );
    }

    const used = await Booking.countDocuments({ slot: slot._id });
    if (used > 0) {
      slot.isActive = false;
      slot.status = 'maintenance';
      await slot.save();
      await recordAudit(req, { action: 'slot.deactivate', entity: 'Slot', entityId: slot._id, summary: `${slot.code} deactivated (has booking history)` });
      return res.json({ message: 'Slot has booking history, so it was deactivated instead of deleted.' });
    }

    await slot.deleteOne();
    await recordAudit(req, { action: 'slot.delete', entity: 'Slot', entityId: slot._id, summary: slot.code });
    res.json({ message: 'Slot removed' });
  })
);

export default router;
