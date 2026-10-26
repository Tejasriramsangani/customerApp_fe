import type { TimeSlotItem } from '../context/PickupBookingContext';

/** Next 7 calendar days for SLOTS-mode date strip when API omits dates. */
export function buildNextSevenDates(from = new Date()) {
  const dates: Array<{
    iso: string;
    label: string;
    dayNum: number;
    monthStr: string;
    weekday: string;
  }> = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(from);
    d.setHours(12, 0, 0, 0);
    d.setDate(from.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    dates.push({
      iso,
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : weekday,
      dayNum: d.getDate(),
      monthStr: d.toLocaleDateString('en-US', { month: 'short' }),
      weekday,
    });
  }
  return dates;
}

export function isValidMongoId(id?: string | null): boolean {
  return !!id && /^[0-9a-fA-F]{24}$/.test(id);
}

export function isCompleteBookingAddress(location: {
  formattedAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}): boolean {
  return Boolean(
    location.formattedAddress &&
      location.city &&
      location.state &&
      /^\d{6}$/.test(location.pincode || '') &&
      location.longitude != null &&
      location.latitude != null,
  );
}

/** Pick a catalog time slot for ROUTE_DAYS windows (backend still requires timeSlotId). */
export function resolveSlotForRouteDay(
  timeSlots: TimeSlotItem[],
  windowStart?: string,
  currentSlotId?: string,
): string {
  if (currentSlotId && timeSlots.some((s) => s.id === currentSlotId)) {
    return currentSlotId;
  }
  if (windowStart) {
    const match = timeSlots.find((s) => s.startTime === windowStart);
    if (match) return match.id;
  }
  return timeSlots[0]?.id || '';
}
