import { round2 } from '../utils/helpers.js';
import { ApiError } from '../utils/errors.js';

const HOUR_MS = 60 * 60 * 1000;
const MAX_BOOKING_HOURS = 24 * 7;
const TZ = 'Asia/Kolkata';

const hourFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false });
const minuteFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, minute: '2-digit' });
const weekdayFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' });
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedHour(date) {
  return Number(hourFormatter.format(date)) % 24;
}

export function zonedMinuteOfDay(date) {
  return (Number(hourFormatter.format(date)) % 24) * 60 + Number(minuteFormatter.format(date));
}

export function zonedWeekday(date) {
  return WEEKDAYS[weekdayFormatter.format(date)];
}

export function parseClock(value, field = 'time') {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''));
  if (!match) throw new ApiError(400, `${field} must use HH:MM format`, 'validation_error');
  return Number(match[1]) * 60 + Number(match[2]);
}

function hourBand(hour, start, end) {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

/**
 * Server-authoritative price quote. Every confirmed booking stores this
 * snapshot so a later pricing change never alters an agreed price.
 */
export function computeQuote({ start, end, zone, facility }) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new ApiError(400, 'Invalid booking window', 'invalid_window');
  }
  const rawHours = (endMs - startMs) / HOUR_MS;
  if (rawHours <= 0) throw new ApiError(400, 'End time must be after start time', 'invalid_window');
  if (rawHours > MAX_BOOKING_HOURS) {
    throw new ApiError(400, 'Bookings are limited to 7 days', 'invalid_window');
  }

  const hours = Math.max(1, Math.ceil(rawHours));
  const pricing = facility.pricing || {};
  const peakStart = pricing.peakStartHour ?? 9;
  const peakEnd = pricing.peakEndHour ?? 18;
  const peakMultiplier = pricing.peakMultiplier ?? 1;
  const weekendMultiplier = pricing.weekendMultiplier ?? 1;
  const dailyMax = pricing.dailyMax ?? 0;
  const minimumCharge = pricing.minimumCharge ?? 0;
  const rate = zone.pricePerHour;

  const baseAmount = round2(rate * hours);
  let peakSurcharge = 0;
  let weekendSurcharge = 0;
  let peakHours = 0;

  for (let i = 0; i < hours; i += 1) {
    const at = new Date(startMs + i * HOUR_MS);
    const isPeak = hourBand(zonedHour(at), peakStart, peakEnd);
    const isWeekend = zonedWeekday(at) === 0 || zonedWeekday(at) === 6;
    if (isPeak && peakMultiplier > 1) {
      peakSurcharge += rate * (peakMultiplier - 1);
      peakHours += 1;
    }
    if (isWeekend && weekendMultiplier > 1) {
      weekendSurcharge += rate * (weekendMultiplier - 1);
    }
  }

  const lines = [{ label: `Base parking · ${hours} h × ₹${rate}/h`, amount: baseAmount }];
  peakSurcharge = round2(peakSurcharge);
  weekendSurcharge = round2(weekendSurcharge);
  if (peakSurcharge > 0) lines.push({ label: `Peak-hour surcharge · ${peakHours} h`, amount: peakSurcharge });
  if (weekendSurcharge > 0) lines.push({ label: 'Weekend surcharge', amount: weekendSurcharge });

  let total = round2(baseAmount + peakSurcharge + weekendSurcharge);

  if (minimumCharge > total) {
    lines.push({ label: 'Minimum charge adjustment', amount: round2(minimumCharge - total) });
    total = round2(minimumCharge);
  }

  if (dailyMax > 0) {
    const cap = round2(dailyMax * Math.ceil(hours / 24));
    if (total > cap) {
      lines.push({ label: 'Daily maximum applied', amount: round2(cap - total) });
      total = cap;
    }
  }

  return {
    currency: pricing.currency || 'INR',
    hours,
    lines,
    total,
    hourlyRate: rate,
    snapshot: {
      hourlyRate: rate,
      hours,
      peakStartHour: peakStart,
      peakEndHour: peakEnd,
      peakMultiplier,
      weekendMultiplier,
      dailyMax,
      minimumCharge,
      currency: pricing.currency || 'INR',
      computedAt: new Date().toISOString(),
    },
  };
}

export function cancellationRefundPercent(startTime, now = new Date()) {
  const hoursBefore = (new Date(startTime).getTime() - now.getTime()) / HOUR_MS;
  if (hoursBefore >= 24) return 100;
  if (hoursBefore >= 2) return 100;
  if (hoursBefore >= 1) return 75;
  if (hoursBefore >= 0.5) return 50;
  return 0;
}

export function computeOverstay({ endTime, exitTime, zone, facility, graceMinutes }) {
  const expected = new Date(endTime).getTime();
  const actual = new Date(exitTime).getTime();
  const grace = graceMinutes ?? facility?.pricing?.overstayGraceMinutes ?? 15;
  const extraMinutes = Math.max(0, Math.floor((actual - expected) / 60000) - grace);
  if (extraMinutes <= 0) return { overstayMinutes: 0, billedHours: 0, charge: 0, graceMinutes: grace };

  const billedHours = Math.ceil(extraMinutes / 60);
  let charge = round2(zone.pricePerHour * billedHours);
  const dailyMax = facility?.pricing?.dailyMax ?? 0;
  if (dailyMax > 0) charge = Math.min(charge, dailyMax);

  return { overstayMinutes: extraMinutes, billedHours, charge: round2(charge), graceMinutes: grace };
}

export function entryWindow(booking) {
  const start = new Date(booking.startTime).getTime();
  const end = new Date(booking.endTime).getTime();
  return { opensAt: new Date(start - HOUR_MS), closesAt: new Date(end) };
}

export function assertWithinOpeningHours({ facility, start, end }) {
  if (facility.open24x7) return;
  const open = parseClock(facility.openTime, 'Opening time');
  const close = parseClock(facility.closeTime, 'Closing time');
  if (close <= open) return;
  const startMinute = zonedMinuteOfDay(new Date(start));
  const endMinute = zonedMinuteOfDay(new Date(end));
  if (startMinute < open || endMinute > close) {
    throw new ApiError(
      400,
      `${facility.name} operates between ${facility.openTime} and ${facility.closeTime}. Choose a window inside those hours.`,
      'outside_hours'
    );
  }
}
