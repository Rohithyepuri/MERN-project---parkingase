export const VEHICLE_TYPES = {
  '2W': { label: 'Two-wheeler', short: '2W', icon: 'bike' },
  '4W': { label: 'Four-wheeler', short: '4W', icon: 'car' },
  EV: { label: 'Electric vehicle', short: 'EV', icon: 'zap' },
};

export const SLOT_TYPES = {
  standard: 'Standard',
  compact: 'Compact',
  accessible: 'Accessible',
  ev: 'EV charging',
  premium: 'Premium',
};

export const AMENITIES = {
  cctv: 'CCTV',
  security: 'Security staff',
  ev_charging: 'EV charging',
  covered: 'Covered',
  accessible: 'Accessible',
  washroom: 'Washrooms',
  valet: 'Valet',
  lift: 'Lift access',
};

export const BOOKING_STATUS = {
  pending: { label: 'Awaiting payment', tone: 'amber', description: 'Complete payment to confirm this reservation.' },
  payment_failed: { label: 'Payment failed', tone: 'red', description: 'Payment did not go through. The slot was released.' },
  confirmed: { label: 'Confirmed', tone: 'emerald', description: 'Paid and ready. Your entry pass is active.' },
  checked_in: { label: 'Parked', tone: 'brand', description: 'Your vehicle is inside the facility.' },
  completed: { label: 'Completed', tone: 'slate', description: 'Session finished and billed.' },
  cancelled: { label: 'Cancelled', tone: 'slate', description: 'This reservation was cancelled.' },
  expired: { label: 'Expired', tone: 'slate', description: 'Payment was not completed in time.' },
  no_show: { label: 'No show', tone: 'slate', description: 'No entry was recorded for this booking.' },
};

export const PAYMENT_STATUS = {
  created: { label: 'Created', tone: 'slate' },
  pending: { label: 'Pending', tone: 'amber' },
  captured: { label: 'Captured', tone: 'emerald' },
  failed: { label: 'Failed', tone: 'red' },
  refunded: { label: 'Refunded', tone: 'amber' },
  partially_refunded: { label: 'Partially refunded', tone: 'amber' },
  processed: { label: 'Processed', tone: 'emerald' },
};

export const INCIDENT_STATUS = {
  open: { label: 'Open', tone: 'red' },
  investigating: { label: 'Investigating', tone: 'amber' },
  resolved: { label: 'Resolved', tone: 'emerald' },
  closed: { label: 'Closed', tone: 'slate' },
};

export const INCIDENT_CATEGORIES = {
  vehicle_damage: 'Vehicle damage',
  equipment: 'Equipment',
  safety: 'Safety',
  cleanliness: 'Cleanliness',
  security: 'Security',
  other: 'Other',
};

export const USER_ROLES = {
  user: { label: 'Customer', tone: 'slate' },
  staff: { label: 'Staff', tone: 'brand' },
  admin: { label: 'Admin', tone: 'amber' },
};

export const TICKET_STATUSES = ['confirmed', 'checked_in'];

export const FACILITY_PLACEHOLDER_GRADIENTS = [
  'from-brand-900 via-brand-700 to-emerald-500',
  'from-ink-800 via-brand-800 to-teal-600',
  'from-amber-900 via-amber-700 to-amber-500',
  'from-ink-700 via-emerald-900 to-brand-600',
];
