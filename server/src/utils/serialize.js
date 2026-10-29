const idOf = (value) => {
  if (!value) return null;
  if (value._id) return String(value._id);
  return String(value);
};

const docOf = (value) => (value && value._id ? value : null);

export function facilityBrief(facility) {
  if (!facility) return null;
  const doc = docOf(facility);
  if (!doc) return { id: idOf(facility) };
  return {
    id: idOf(doc),
    name: doc.name,
    slug: doc.slug,
    address: doc.address,
    city: doc.city,
    lat: doc.lat,
    lng: doc.lng,
    openTime: doc.openTime,
    closeTime: doc.closeTime,
    open24x7: doc.open24x7,
    amenities: doc.amenities,
    vehicleTypes: doc.vehicleTypes,
    rating: doc.rating,
    pricing: doc.pricing,
    isActive: doc.isActive,
  };
}

export function zoneBrief(zone) {
  if (!zone) return null;
  const doc = docOf(zone);
  if (!doc) return { id: idOf(zone) };
  return {
    id: idOf(doc),
    name: doc.name,
    vehicleType: doc.vehicleType,
    slotType: doc.slotType,
    pricePerHour: doc.pricePerHour,
    floor: idOf(doc.floor),
  };
}

export function bookingView(booking, { includeUser = false, includePayment = false } = {}) {
  if (!booking) return null;
  const b = booking;
  return {
    id: String(b._id),
    ref: b.ref,
    status: b.status,
    startTime: b.startTime,
    endTime: b.endTime,
    createdAt: b.createdAt,
    holdExpiresAt: b.holdExpiresAt,
    facility: docOf(b.facility) ? facilityBrief(b.facility) : { id: idOf(b.facility) },
    zone: zoneBrief(b.zone),
    floor: docOf(b.floor) ? { id: idOf(b.floor), name: b.floor.name, level: b.floor.level } : { id: idOf(b.floor) },
    slot: docOf(b.slot) ? { id: idOf(b.slot), code: b.slot.code } : { id: idOf(b.slot) },
    vehicle: b.vehicle,
    quote: b.quote,
    amountPaid: b.amountPaid,
    finalAmount: b.finalAmount,
    overstayMinutes: b.overstayMinutes,
    overstayCharge: b.overstayCharge,
    checkedInAt: b.checkedInAt,
    checkedOutAt: b.checkedOutAt,
    cancellation: b.cancellation?.at ? b.cancellation : null,
    timeline: b.timeline,
    payment: includePayment ? docOf(b.payment) : idOf(b.payment),
    user: includeUser && docOf(b.user)
      ? { id: idOf(b.user), name: b.user.name, email: b.user.email, phone: b.user.phone }
      : undefined,
  };
}

export function sessionView(session) {
  if (!session) return null;
  return {
    id: String(session._id),
    entryAt: session.entryAt,
    expectedExitAt: session.expectedExitAt,
    exitAt: session.exitAt,
    status: session.status,
    overstayMinutes: session.overstayMinutes,
    extraCharge: session.extraCharge,
    vehicle: session.vehicle,
    facility: facilityBrief(session.facility),
    slot: docOf(session.slot) ? { id: idOf(session.slot), code: session.slot.code } : { id: idOf(session.slot) },
    booking: docOf(session.booking) ? bookingView(session.booking, { includeUser: true }) : idOf(session.booking),
    overdue:
      session.status === 'active' && new Date(session.expectedExitAt).getTime() < Date.now(),
  };
}

export function paymentView(payment) {
  if (!payment) return null;
  return {
    id: String(payment._id),
    provider: payment.provider,
    mode: payment.mode,
    orderId: payment.orderId,
    paymentId: payment.paymentId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    method: payment.method,
    refundedAmount: payment.refundedAmount,
    failureReason: payment.failureReason,
    capturedAt: payment.capturedAt,
    createdAt: payment.createdAt,
    booking: docOf(payment.booking)
      ? { id: idOf(payment.booking), ref: payment.booking.ref }
      : idOf(payment.booking),
    user: docOf(payment.user)
      ? { id: idOf(payment.user), name: payment.user.name, email: payment.user.email }
      : undefined,
  };
}

export function userView(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    favorites: (user.favorites || []).map(idOf),
    preferences: user.preferences,
    staffFacilities: (user.staffFacilities || []).map((f) => (docOf(f) ? { id: idOf(f), name: f.name } : { id: idOf(f) })),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
