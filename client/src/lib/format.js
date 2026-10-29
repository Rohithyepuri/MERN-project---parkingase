export const currency = (value) => {
  const number = Number(value || 0);
  const formatted = number.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `₹${formatted}`;
};

export const number = (value) => Number(value || 0).toLocaleString('en-IN');

export const dateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const dateOnly = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const timeOnly = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const dateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

export const timeRange = (start, end) => `${dateTime(start)} → ${timeOnly(end)}`;

export const duration = (minutes) => {
  const value = Number(minutes || 0);
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

export const relative = (value) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(Math.abs(diff) / 60000);
  const suffix = diff >= 0 ? 'ago' : 'from now';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ${suffix}`;
  const days = Math.round(hours / 24);
  return `${days} d ${suffix}`;
};

export const distanceLabel = (km) => {
  if (km === null || km === undefined) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
};

export const slotMinutes = (start, end) => Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000));

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export const isFacilityOpen = (facility) => {
  if (!facility) return false;
  if (facility.open24x7) return true;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const now = hour * 60 + minute;
  const [openH, openM] = String(facility.openTime || '00:00').split(':').map(Number);
  const [closeH, closeM] = String(facility.closeTime || '23:59').split(':').map(Number);
  const open = openH * 60 + openM;
  const close = closeH * 60 + closeM;
  if (close <= open) return true;
  return now >= open && now <= close;
};

export const openHoursLabel = (facility) =>
  facility?.open24x7 ? 'Open 24 hours' : `${facility?.openTime || '06:00'} – ${facility?.closeTime || '23:30'}`;

