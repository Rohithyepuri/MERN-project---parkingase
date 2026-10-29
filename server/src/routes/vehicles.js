import { Router } from 'express';
import mongoose from 'mongoose';
import Vehicle from '../models/Vehicle.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate } from '../middleware/auth.js';
import { requireFields } from '../utils/validate.js';

const router = Router();
router.use(authenticate);

const TYPES = ['2W', '4W', 'EV'];

function normalizePlate(value) {
  const plate = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9 -]{2,15}$/.test(plate)) {
    throw new ApiError(400, 'Enter a valid registration number', 'validation_error');
  }
  return plate;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const vehicles = await Vehicle.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: 1 });
    res.json({ vehicles: vehicles.map((v) => ({ ...v.toObject(), id: String(v._id) })) });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['plate', 'type']);
    if (!TYPES.includes(req.body.type)) throw new ApiError(400, 'Vehicle type must be 2W, 4W or EV', 'validation_error');

    const count = await Vehicle.countDocuments({ user: req.user._id });
    const makeDefault = req.body.isDefault === true || count === 0;

    if (makeDefault) await Vehicle.updateMany({ user: req.user._id }, { $set: { isDefault: false } });

    try {
      const vehicle = await Vehicle.create({
        user: req.user._id,
        plate: normalizePlate(req.body.plate),
        type: req.body.type,
        make: String(req.body.make || '').slice(0, 40),
        model: String(req.body.model || '').slice(0, 40),
        isDefault: makeDefault,
      });
      res.status(201).json({ vehicle: { ...vehicle.toObject(), id: String(vehicle._id) } });
    } catch (error) {
      if (error?.code === 11000) throw new ApiError(409, 'That vehicle is already saved', 'vehicle_exists');
      throw error;
    }
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Vehicle not found', 'not_found');
    const vehicle = await Vehicle.findOne({ _id: req.params.id, user: req.user._id });
    if (!vehicle) throw new ApiError(404, 'Vehicle not found', 'not_found');

    if (req.body.plate !== undefined) vehicle.plate = normalizePlate(req.body.plate);
    if (req.body.type !== undefined) {
      if (!TYPES.includes(req.body.type)) throw new ApiError(400, 'Invalid vehicle type', 'validation_error');
      vehicle.type = req.body.type;
    }
    if (req.body.make !== undefined) vehicle.make = String(req.body.make).slice(0, 40);
    if (req.body.model !== undefined) vehicle.model = String(req.body.model).slice(0, 40);
    if (req.body.isDefault === true) {
      await Vehicle.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
      vehicle.isDefault = true;
    }

    try {
      await vehicle.save();
    } catch (error) {
      if (error?.code === 11000) throw new ApiError(409, 'That vehicle is already saved', 'vehicle_exists');
      throw error;
    }
    res.json({ vehicle: { ...vehicle.toObject(), id: String(vehicle._id) } });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Vehicle not found', 'not_found');
    const vehicle = await Vehicle.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!vehicle) throw new ApiError(404, 'Vehicle not found', 'not_found');

    if (vehicle.isDefault) {
      const next = await Vehicle.findOne({ user: req.user._id }).sort({ createdAt: 1 });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }
    res.json({ message: 'Vehicle removed' });
  })
);

export default router;
