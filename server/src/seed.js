import mongoose from 'mongoose';
import { connectDb, disconnectDb } from './db.js';
import User from './models/User.js';
import Vehicle from './models/Vehicle.js';
import Facility from './models/Facility.js';
import Floor from './models/Floor.js';
import Zone from './models/Zone.js';
import Slot from './models/Slot.js';
import SlotLock from './models/SlotLock.js';
import Booking from './models/Booking.js';
import Session from './models/Session.js';
import Payment from './models/Payment.js';
import Refund from './models/Refund.js';
import Notification from './models/Notification.js';
import AuditLog from './models/AuditLog.js';
import Review from './models/Review.js';
import Incident from './models/Incident.js';
import Settings from './models/Settings.js';
import { computeQuote } from './services/pricing.js';
import { acquireLocks } from './services/locks.js';
import { makeBookingRef, round2 } from './utils/helpers.js';

const IST = 5.5 * 3600 * 1000;

const istDate = (dayOffset, hour, minute = 0) => {
  const shifted = new Date(Date.now() + IST);
  const base = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(base + dayOffset * 86400000 + (hour * 60 + minute) * 60000 - IST);
};

const at = (date, minutes) => new Date(new Date(date).getTime() + minutes * 60000);

const facilityDefs = [
  {
    name: 'Indiranagar Metro Parking',
    city: 'Bengaluru',
    address: '100 Feet Road, Indiranagar, Bengaluru 560038',
    lat: 12.9719,
    lng: 77.6412,
    description:
      'Covered multi-level parking two minutes from Indiranagar metro. Wide ramps, 24×7 CCTV and a staffed lift lobby.',
    amenities: ['cctv', 'security', 'covered', 'lift', 'washroom'],
    vehicleTypes: ['2W', '4W', 'EV'],
    openTime: '06:00',
    closeTime: '23:30',
    pricing: { peakStartHour: 9, peakEndHour: 19, peakMultiplier: 1.25, weekendMultiplier: 1.1, dailyMax: 320, minimumCharge: 30, overstayGraceMinutes: 15 },
    floors: [
      {
        name: 'Ground',
        level: 0,
        zones: [
          { key: 'GA', name: 'Zone A · Covered', vehicleType: '4W', slotType: 'standard', pricePerHour: 45, slots: 18 },
          { key: 'GB', name: 'Zone B · Two-wheeler', vehicleType: '2W', slotType: 'compact', pricePerHour: 20, slots: 20 },
          { key: 'GE', name: 'Zone E · EV charging', vehicleType: 'EV', slotType: 'ev', pricePerHour: 65, slots: 8 },
        ],
      },
      {
        name: 'Level 1',
        level: 1,
        zones: [
          { key: 'LA', name: 'Zone A · Rooftop', vehicleType: '4W', slotType: 'premium', pricePerHour: 40, slots: 16 },
          { key: 'LC', name: 'Zone C · Accessible', vehicleType: '4W', slotType: 'accessible', pricePerHour: 40, slots: 4 },
        ],
      },
    ],
  },
  {
    name: 'Koramangala Forum Park',
    city: 'Bengaluru',
    address: 'Hosur Road, Koramangala 5th Block, Bengaluru 560095',
    lat: 12.9345,
    lng: 77.611,
    description:
      'Premium basement parking beside Forum Mall with valet assistance, EV bays and direct lift access to the high street.',
    amenities: ['cctv', 'security', 'covered', 'lift', 'valet', 'ev_charging', 'accessible'],
    vehicleTypes: ['2W', '4W', 'EV'],
    openTime: '07:00',
    closeTime: '23:00',
    pricing: { peakStartHour: 10, peakEndHour: 20, peakMultiplier: 1.3, weekendMultiplier: 1.2, dailyMax: 400, minimumCharge: 40, overstayGraceMinutes: 10 },
    floors: [
      {
        name: 'Basement 1',
        level: -1,
        zones: [
          { key: 'BA', name: 'Zone A · Premium', vehicleType: '4W', slotType: 'premium', pricePerHour: 55, slots: 20 },
          { key: 'BB', name: 'Zone B · Two-wheeler', vehicleType: '2W', slotType: 'compact', pricePerHour: 25, slots: 24 },
        ],
      },
      {
        name: 'Level 2',
        level: 2,
        zones: [
          { key: 'LA', name: 'Zone A · Standard', vehicleType: '4W', slotType: 'standard', pricePerHour: 45, slots: 18 },
          { key: 'LE', name: 'Zone E · EV fast charge', vehicleType: 'EV', slotType: 'ev', pricePerHour: 75, slots: 10 },
        ],
      },
    ],
  },
  {
    name: 'MG Road Central Garage',
    city: 'Bengaluru',
    address: '1 MG Road, Shivajinagar, Bengaluru 560001',
    lat: 12.9756,
    lng: 77.6068,
    description:
      'Round-the-clock garage on MG Road for commuters and shoppers. Attendant on every level and secure bicycle lockers.',
    amenities: ['cctv', 'security', 'covered', 'lift', 'washroom'],
    vehicleTypes: ['2W', '4W'],
    openTime: '00:00',
    closeTime: '23:59',
    open24x7: true,
    pricing: { peakStartHour: 9, peakEndHour: 18, peakMultiplier: 1.2, weekendMultiplier: 1, dailyMax: 280, minimumCharge: 25, overstayGraceMinutes: 15 },
    floors: [
      {
        name: 'Ground',
        level: 0,
        zones: [
          { key: 'GA', name: 'Zone A · Open air', vehicleType: '4W', slotType: 'standard', pricePerHour: 40, slots: 22 },
          { key: 'GB', name: 'Zone B · Two-wheeler', vehicleType: '2W', slotType: 'compact', pricePerHour: 18, slots: 26 },
        ],
      },
      {
        name: 'Basement 1',
        level: -1,
        zones: [
          { key: 'BA', name: 'Zone A · Covered', vehicleType: '4W', slotType: 'standard', pricePerHour: 35, slots: 20 },
        ],
      },
    ],
  },
  {
    name: 'Whitefield Tech Park Parking',
    city: 'Bengaluru',
    address: 'ITPL Main Road, Whitefield, Bengaluru 560066',
    lat: 12.9698,
    lng: 77.75,
    description:
      'Large campus lot for tech-park commuters with monthly-friendly rates, EV charging and guarded pedestrian walkways.',
    amenities: ['cctv', 'security', 'ev_charging', 'covered', 'washroom', 'accessible'],
    vehicleTypes: ['2W', '4W', 'EV'],
    openTime: '00:00',
    closeTime: '23:59',
    open24x7: true,
    pricing: { peakStartHour: 8, peakEndHour: 20, peakMultiplier: 1.15, weekendMultiplier: 1, dailyMax: 240, minimumCharge: 20, overstayGraceMinutes: 20 },
    floors: [
      {
        name: 'Ground',
        level: 0,
        zones: [
          { key: 'GA', name: 'Zone A · Standard', vehicleType: '4W', slotType: 'standard', pricePerHour: 30, slots: 24 },
          { key: 'GB', name: 'Zone B · Two-wheeler', vehicleType: '2W', slotType: 'compact', pricePerHour: 15, slots: 28 },
        ],
      },
      {
        name: 'Level 1',
        level: 1,
        zones: [
          { key: 'LE', name: 'Zone E · EV', vehicleType: 'EV', slotType: 'ev', pricePerHour: 50, slots: 12 },
        ],
      },
    ],
  },
];

const reviewComments = [
  'Clean, well-lit and the lift was right where the app said it would be. Will book again.',
  'Entry ticket scanned in seconds at the gate. Smoothest parking I have used in Bengaluru.',
  'Good covered parking, though the ramp gets busy around 6pm. Still worth it.',
  'EV bay had a working fast charger. The price breakdown in the app matched the final bill.',
  'Staff were helpful and the slot was exactly as described. Five stars.',
];

async function wipe() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

async function main() {
  await connectDb();
  console.log('[seed] connected, clearing existing data');
  await wipe();

  // Drop indexes left over from earlier schema versions so slot inserts never
  // collide with stale unique constraints.
  await Promise.all(
    [User, Vehicle, Facility, Floor, Zone, Slot, SlotLock, Booking, Session, Payment, Refund, Notification, AuditLog, Review, Incident, Settings].map((model) =>
      model.syncIndexes()
    )
  );

  const [admin, staff1, staff2, demoUser, kabir, meera] = await Promise.all([
    User.create({ name: 'Aarav Mehta', email: 'admin@parkease.dev', password: 'Admin@123', phone: '+91 98450 11001', role: 'admin' }),
    User.create({ name: 'Priya Nair', email: 'staff@parkease.dev', password: 'Staff@123', phone: '+91 98450 11002', role: 'staff' }),
    User.create({ name: 'Rohan Das', email: 'staff2@parkease.dev', password: 'Staff@123', phone: '+91 98450 11003', role: 'staff' }),
    User.create({ name: 'Ananya Sharma', email: 'user@parkease.dev', password: 'User@123', phone: '+91 98450 22001', role: 'user' }),
    User.create({ name: 'Kabir Rao', email: 'kabir@example.com', password: 'Demo@123', phone: '+91 98450 22002', role: 'user' }),
    User.create({ name: 'Meera Iyer', email: 'meera@example.com', password: 'Demo@123', phone: '+91 98450 22003', role: 'user' }),
  ]);

  const demoVehicles = await Vehicle.create([
    { user: demoUser._id, plate: 'KA-01-MJ-4821', type: '4W', make: 'Hyundai', model: 'i20', isDefault: true },
    { user: demoUser._id, plate: 'KA-05-EV-2210', type: 'EV', make: 'Tata', model: 'Nexon EV' },
    { user: kabir._id, plate: 'KA-03-HB-9911', type: '4W', make: 'Maruti', model: 'Baleno', isDefault: true },
    { user: meera._id, plate: 'KA-02-AB-7788', type: '2W', make: 'Honda', model: 'Activa', isDefault: true },
  ]);

  await Settings.create({ key: 'app' });

  const facilities = [];
  const zoneMap = new Map();
  const slotsByZone = new Map();
  const slotCursor = new Map();

  for (const def of facilityDefs) {
    const facility = await Facility.create({
      name: def.name,
      slug: `${def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      description: def.description,
      address: def.address,
      city: def.city,
      lat: def.lat,
      lng: def.lng,
      amenities: def.amenities,
      vehicleTypes: def.vehicleTypes,
      openTime: def.openTime,
      closeTime: def.closeTime,
      open24x7: Boolean(def.open24x7),
      pricing: def.pricing,
      phone: '+91 80 4000 1200',
    });
    facilities.push(facility);

    for (const floorDef of def.floors) {
      const floor = await Floor.create({ facility: facility._id, name: floorDef.name, level: floorDef.level });
      for (const zoneDef of floorDef.zones) {
        const zone = await Zone.create({
          facility: facility._id,
          floor: floor._id,
          name: zoneDef.name,
          vehicleType: zoneDef.vehicleType,
          slotType: zoneDef.slotType,
          pricePerHour: zoneDef.pricePerHour,
        });
        const slots = [];
        for (let i = 0; i < zoneDef.slots; i += 1) {
          slots.push({
            facility: facility._id,
            floor: floor._id,
            zone: zone._id,
            code: `${zoneDef.key}-${String(i + 1).padStart(3, '0')}`,
            status: 'available',
            isActive: true,
          });
        }
        const created = await Slot.insertMany(slots);
        zoneMap.set(`${facilities.length - 1}:${zoneDef.key}`, { zone, floor, facility });
        slotsByZone.set(`${facilities.length - 1}:${zoneDef.key}`, created);
        slotCursor.set(`${facilities.length - 1}:${zoneDef.key}`, 0);
      }
    }
  }

  await Promise.all([
    User.findByIdAndUpdate(staff1._id, { staffFacilities: [facilities[0]._id, facilities[1]._id] }),
    User.findByIdAndUpdate(staff2._id, { staffFacilities: [facilities[2]._id, facilities[3]._id] }),
    User.findByIdAndUpdate(admin._id, { staffFacilities: facilities.map((f) => f._id) }),
    User.findByIdAndUpdate(demoUser._id, { favorites: [facilities[0]._id, facilities[2]._id] }),
  ]);

  function takeSlot(facilityIndex, zoneKey) {
    const key = `${facilityIndex}:${zoneKey}`;
    const slots = slotsByZone.get(key);
    const cursor = slotCursor.get(key) || 0;
    slotCursor.set(key, cursor + 1);
    return { slot: slots[cursor % slots.length], zone: zoneMap.get(key).zone, floor: zoneMap.get(key).floor, facility: facilities[facilityIndex] };
  }

  const users = [demoUser, kabir, meera];
  const vehicles = [demoVehicles[0], demoVehicles[2], demoVehicles[3]];

  let bookingRefCounter = 0;
  async function createBooking({
    user,
    vehicle,
    facilityIndex,
    zoneKey,
    start,
    end,
    status,
    checkInOffset = null,
    exitOffset = null,
    overstayMinutes = 0,
    createdAt,
    refundPercent = null,
    cancelReason = '',
  }) {
    const { slot, zone, floor, facility } = takeSlot(facilityIndex, zoneKey);
    const quote = computeQuote({ start, end, zone, facility });
    const created = createdAt || at(start, -40);
    const ref = makeBookingRef();
    bookingRefCounter += 1;

    const paidStatuses = ['confirmed', 'checked_in', 'completed', 'no_show'];
    const paymentStatus = status === 'cancelled' ? (refundPercent ? 'refunded' : 'captured') : status === 'pending' ? 'created' : paidStatuses.includes(status) ? 'captured' : 'failed';

    const payment = await Payment.create({
      user: user._id,
      provider: 'demo',
      mode: 'DEMO',
      orderId: `demo_order_seed${String(bookingRefCounter).padStart(4, '0')}`,
      paymentId: paymentStatus === 'created' ? undefined : `demo_pay_seed${String(bookingRefCounter).padStart(4, '0')}`,
      amount: quote.total,
      currency: 'INR',
      status: paymentStatus,
      method: 'demo',
      capturedAt: paymentStatus === 'created' ? undefined : created,
      createdAt: created,
    });

    const timeline = [{ status: 'pending', note: 'Reservation created · awaiting payment', at: created, by: 'customer' }];
    if (paymentStatus !== 'created') {
      timeline.push({ status: 'confirmed', note: 'Payment captured · DEMO mode', at: at(created, 1), by: 'system' });
    }

    let checkedInAt;
    let checkedOutAt;
    let finalAmount = null;
    let overstayCharge = 0;
    let cancellation;

    if (['checked_in', 'completed'].includes(status)) {
      checkedInAt = at(start, checkInOffset ?? 5);
      timeline.push({ status: 'checked_in', note: 'Vehicle checked in', at: checkedInAt, by: 'Priya Nair' });
    }
    if (status === 'completed') {
      checkedOutAt = at(end, exitOffset ?? -10);
      overstayCharge = overstayMinutes > 0 ? round2(zone.pricePerHour * Math.ceil(overstayMinutes / 60)) : 0;
      finalAmount = round2(quote.total + overstayCharge);
      timeline.push({
        status: 'completed',
        note: overstayCharge ? `Checked out · ${overstayMinutes} min overstay` : 'Checked out',
        at: checkedOutAt,
        by: 'Priya Nair',
      });
    }
    if (status === 'cancelled') {
      cancellation = {
        reason: cancelReason,
        by: 'customer',
        at: created,
        refundPercent: refundPercent || 0,
        refundAmount: refundPercent ? round2((quote.total * refundPercent) / 100) : 0,
      };
      timeline.push({
        status: 'cancelled',
        note: refundPercent ? `Cancelled · ${refundPercent}% refund` : 'Cancelled',
        at: created,
        by: 'customer',
      });
      if (refundPercent) {
        payment.refundedAmount = cancellation.refundAmount;
        await payment.save();
      }
    }

    const booking = await Booking.create({
      ref,
      user: user._id,
      facility: facility._id,
      floor: floor._id,
      zone: zone._id,
      slot: slot._id,
      vehicle: { vehicleId: vehicle?._id, plate: vehicle?.plate || 'KA-01-XX-0001', type: vehicle?.type || zone.vehicleType },
      startTime: start,
      endTime: end,
      status,
      quote,
      amountPaid: paymentStatus === 'created' ? 0 : quote.total,
      payment: payment._id,
      holdExpiresAt: status === 'pending' ? at(new Date(), 10) : null,
      checkedInAt,
      checkedOutAt,
      finalAmount,
      overstayMinutes,
      overstayCharge,
      cancellation,
      timeline,
      createdAt: created,
      updatedAt: created,
    });

    payment.booking = booking._id;
    await payment.save();

    if (status === 'cancelled' && refundPercent) {
      await Refund.create({
        payment: payment._id,
        booking: booking._id,
        user: user._id,
        amount: cancellation.refundAmount,
        percent: refundPercent,
        reason: cancelReason,
        status: 'processed',
        provider: 'demo',
      });
    }

    if (['confirmed', 'checked_in'].includes(status)) {
      await acquireLocks({ slotId: slot._id, facilityId: facility._id, bookingId: booking._id, start, end });
    }

    if (['checked_in', 'completed'].includes(status)) {
      await Session.create({
        booking: booking._id,
        user: user._id,
        facility: facility._id,
        slot: slot._id,
        vehicle: { plate: booking.vehicle.plate, type: booking.vehicle.type },
        entryAt: checkedInAt,
        expectedExitAt: end,
        exitAt: status === 'completed' ? checkedOutAt : undefined,
        status: status === 'completed' ? 'completed' : 'active',
        overstayMinutes: status === 'completed' ? overstayMinutes : 0,
        extraCharge: status === 'completed' ? overstayCharge : 0,
        entryBy: staff1._id,
      });
    }

    return booking;
  }

  const activeBooking = await createBooking({
    user: demoUser,
    vehicle: demoVehicles[0],
    facilityIndex: 0,
    zoneKey: 'GA',
    start: at(new Date(), -30),
    end: at(new Date(), 90),
    status: 'checked_in',
    checkInOffset: 5,
    createdAt: at(new Date(), -45),
  });

  const readyBooking = await createBooking({
    user: demoUser,
    vehicle: demoVehicles[0],
    facilityIndex: 0,
    zoneKey: 'LA',
    start: at(new Date(), 30),
    end: at(new Date(), 150),
    status: 'confirmed',
    createdAt: at(new Date(), -20),
  });

  const laterBooking = await createBooking({
    user: demoUser,
    vehicle: demoVehicles[1],
    facilityIndex: 0,
    zoneKey: 'GE',
    start: at(new Date(), 180),
    end: at(new Date(), 360),
    status: 'confirmed',
    createdAt: at(new Date(), -10),
  });

  await createBooking({
    user: kabir,
    vehicle: demoVehicles[2],
    facilityIndex: 1,
    zoneKey: 'BA',
    start: at(new Date(), 60),
    end: at(new Date(), 240),
    status: 'confirmed',
    createdAt: at(new Date(), -30),
  });

  const pendingBooking = await createBooking({
    user: kabir,
    vehicle: demoVehicles[2],
    facilityIndex: 1,
    zoneKey: 'LA',
    start: at(new Date(), 120),
    end: at(new Date(), 300),
    status: 'pending',
    createdAt: at(new Date(), -5),
  });

  await createBooking({
    user: meera,
    vehicle: demoVehicles[3],
    facilityIndex: 2,
    zoneKey: 'GB',
    start: at(new Date(), 45),
    end: at(new Date(), 165),
    status: 'confirmed',
    createdAt: at(new Date(), -15),
  });

  const completedCombos = [
    { user: demoUser, vehicle: demoVehicles[0], facilityIndex: 0, zoneKey: 'GA' },
    { user: kabir, vehicle: demoVehicles[2], facilityIndex: 1, zoneKey: 'BA' },
    { user: demoUser, vehicle: demoVehicles[1], facilityIndex: 0, zoneKey: 'GE' },
    { user: meera, vehicle: demoVehicles[3], facilityIndex: 2, zoneKey: 'GB' },
    { user: demoUser, vehicle: demoVehicles[0], facilityIndex: 3, zoneKey: 'GA' },
    { user: kabir, vehicle: demoVehicles[2], facilityIndex: 3, zoneKey: 'GA' },
    { user: meera, vehicle: demoVehicles[3], facilityIndex: 3, zoneKey: 'GB' },
    { user: demoUser, vehicle: demoVehicles[1], facilityIndex: 1, zoneKey: 'LE' },
  ];

  for (let i = 0; i < 16; i += 1) {
    const day = -(1 + (i % 6));
    const startHour = 8 + (i % 9);
    const durationMinutes = 60 + (i % 3) * 60;
    const start = istDate(day, startHour, 0);
    const end = at(start, durationMinutes);
    const combo = completedCombos[i % completedCombos.length];
    const completed = await createBooking({
      user: combo.user,
      vehicle: combo.vehicle,
      facilityIndex: combo.facilityIndex,
      zoneKey: combo.zoneKey,
      start,
      end,
      status: 'completed',
      checkInOffset: 4,
      exitOffset: i % 6 === 0 ? 40 : -8,
      overstayMinutes: i % 6 === 0 ? 40 : 0,
      createdAt: at(start, -35),
    });
    if (i % 3 === 0) {
      await Review.create({
        user: combo.user._id,
        facility: completed.facility,
        booking: completed._id,
        rating: i % 2 === 0 ? 5 : 4,
        comment: reviewComments[i % reviewComments.length],
        createdAt: at(end, 30),
      });
    }
  }

  await createBooking({
    user: demoUser,
    vehicle: demoVehicles[0],
    facilityIndex: 2,
    zoneKey: 'GA',
    start: istDate(2, 10, 0),
    end: istDate(2, 13, 0),
    status: 'cancelled',
    createdAt: at(istDate(0, 9, 0), 0),
    refundPercent: 100,
    cancelReason: 'Plans changed',
  });

  await createBooking({
    user: meera,
    vehicle: demoVehicles[3],
    facilityIndex: 3,
    zoneKey: 'GB',
    start: istDate(-1, 9, 0),
    end: istDate(-1, 11, 0),
    status: 'cancelled',
    createdAt: at(istDate(-2, 9, 0), 0),
    refundPercent: 100,
    cancelReason: 'Vehicle in service',
  });

  const maintenanceSlot = (await Slot.findOne({ facility: facilities[0]._id, code: 'GA-018' })) || null;
  if (maintenanceSlot) {
    maintenanceSlot.status = 'maintenance';
    maintenanceSlot.note = 'Fluorescent light replacement';
    await maintenanceSlot.save();
    await Incident.create({
      facility: facilities[0]._id,
      slot: maintenanceSlot._id,
      reportedBy: staff1._id,
      category: 'equipment',
      description: 'Lighting flickering in bay GA-018. Slot taken out of service pending electrician visit.',
      status: 'open',
    });
  }
  await Incident.create({
    facility: facilities[1]._id,
    reportedBy: staff1._id,
    category: 'security',
    description: 'Barrier arm slow to respond during evening peak. Security supervisor notified.',
    status: 'resolved',
    resolvedAt: at(new Date(), -180),
    notes: [{ by: admin._id, text: 'Barrier serviced and tested. Closing.', at: at(new Date(), -170) }],
  });

  await Notification.create([
    {
      user: demoUser._id,
      type: 'booking',
      title: 'Welcome to ParkEase',
      body: 'Your account is ready. Find a facility, pick a slot and park with confidence.',
      link: '/facilities',
      readAt: at(new Date(), -1440),
    },
    {
      user: demoUser._id,
      type: 'session',
      title: 'Parking session started',
      body: `Vehicle ${activeBooking.vehicle.plate} entered Indiranagar Metro Parking.`,
      link: `/bookings/${activeBooking._id}`,
    },
    {
      user: demoUser._id,
      type: 'booking',
      title: 'Booking confirmed',
      body: `Your entry pass for ${readyBooking.ref} is ready.`,
      link: `/bookings/${readyBooking._id}`,
    },
    {
      user: kabir._id,
      type: 'payment',
      title: 'Payment pending',
      body: `Complete payment for ${pendingBooking.ref} to lock your slot.`,
      link: `/bookings/${pendingBooking._id}`,
    },
  ]);

  const auditEntries = [
    { action: 'facility.create', entity: 'Facility', entityId: facilities[0]._id, summary: `Created ${facilities[0].name}` },
    { action: 'facility.update', entity: 'Facility', entityId: facilities[1]._id, summary: 'Updated peak pricing for Koramangala Forum Park' },
    { action: 'zone.update', entity: 'Zone', entityId: zoneMap.get('0:GA').zone._id, summary: 'Zone A · Covered now ₹45/h' },
    { action: 'slot.update', entity: 'Slot', entityId: maintenanceSlot?._id, summary: 'GA-018 marked maintenance' },
    { action: 'user.update', entity: 'User', entityId: staff1._id, summary: 'Priya Nair assigned to 2 facilities' },
    { action: 'report.export', entity: 'Report', summary: 'Revenue CSV · last 30 days' },
    { action: 'session.checkout', entity: 'Session', summary: 'PK-SEED3 · final ₹132 (overstay ₹45)' },
    { action: 'payment.refund', entity: 'Payment', summary: '₹135 refunded for PK-SEED9' },
    { action: 'ticket.rejected', entity: 'Booking', summary: 'Malformed or forged ticket' },
    { action: 'settings.update', entity: 'Settings', summary: 'Updated cancellationPolicy' },
  ];
  await AuditLog.create(
    auditEntries.map((entry, index) => ({
      actor: index % 3 === 0 ? admin._id : staff1._id,
      actorName: index % 3 === 0 ? admin.name : staff1.name,
      actorRole: index % 3 === 0 ? 'admin' : 'staff',
      ip: '127.0.0.1',
      at: at(new Date(), -(index + 1) * 90),
      ...entry,
    }))
  );

  const ratingRows = await Review.aggregate([
    { $match: { status: 'visible' } },
    { $group: { _id: '$facility', average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  for (const row of ratingRows) {
    await Facility.updateOne(
      { _id: row._id },
      { $set: { rating: { average: Math.round(row.average * 10) / 10, count: row.count } } }
    );
  }

  const counts = {
    users: await User.countDocuments(),
    facilities: await Facility.countDocuments(),
    floors: await Floor.countDocuments(),
    zones: await Zone.countDocuments(),
    slots: await Slot.countDocuments(),
    bookings: await Booking.countDocuments(),
    sessions: await Session.countDocuments(),
    payments: await Payment.countDocuments(),
    reviews: await Review.countDocuments(),
  };

  console.log('[seed] done', counts);
  console.log('');
  console.log('Demo accounts');
  console.log('  Admin   admin@parkease.dev  / Admin@123');
  console.log('  Staff   staff@parkease.dev  / Staff@123   (Indiranagar + Koramangala)');
  console.log('  Staff   staff2@parkease.dev / Staff@123   (MG Road + Whitefield)');
  console.log('  Customer user@parkease.dev   / User@123');
  console.log('');

  await disconnectDb();
  process.exit(0);
}

main().catch(async (error) => {
  console.error('[seed] failed', error);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
