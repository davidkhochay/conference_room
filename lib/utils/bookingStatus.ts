import { Booking } from '@/lib/types/database.types';

// Database-level status values we care about. We keep this loose enough to
// tolerate unexpected strings without crashing.
export type DbBookingStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'ended'
  | 'cancelled'
  | 'no_show'
  | string;

// Normalized status for UI components.
export type NormalizedBookingStatus =
  | 'in_use'
  | 'upcoming'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type BookingBucket = 'in_use' | 'upcoming' | 'completed_cancelled';

// Minimal shape we need from a booking record.
export interface BookingLike {
  status: DbBookingStatus;
  start_time: string;
  end_time: string;
}

/**
 * Normalize a booking's DB status + time window into a single status that
 * downstream UIs can rely on.
 *
 * Rules:
 * - `no_show`  -> `no_show`
 * - `cancelled` -> `cancelled`
 * - `ended` / `completed` OR end_time in the past -> `completed`
 * - `in_progress` OR now within [start_time, end_time) -> `in_use`
 * - Remaining scheduled / confirmed future bookings -> `upcoming`
 */
export function normalizeBookingStatus(
  booking: BookingLike,
  now: Date = new Date()
): NormalizedBookingStatus {
  const raw = String(booking.status || '').toLowerCase();

  if (raw === 'no_show') {
    return 'no_show';
  }

  if (raw === 'cancelled') {
    return 'cancelled';
  }

  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    // If times are malformed, fall back to the raw status where possible.
    if (raw === 'in_progress') return 'in_use';
    if (raw === 'ended' || raw === 'completed') return 'completed';
    return 'upcoming';
  }

  if (end < now || raw === 'ended' || raw === 'completed') {
    return 'completed';
  }

  if (raw === 'in_progress' || (start <= now && now < end)) {
    return 'in_use';
  }

  // Default: any future scheduled / confirmed style status is treated as upcoming.
  return 'upcoming';
}

/**
 * Convenience helper to bucket a list of bookings into lanes for UI:
 * - in_use
 * - upcoming
 * - completed_cancelled (completed, cancelled, no_show)
 */
export function bucketBookings<T extends BookingLike>(
  bookings: T[],
  now: Date = new Date()
): Record<BookingBucket, T[]> {
  const buckets: Record<BookingBucket, T[]> = {
    in_use: [],
    upcoming: [],
    completed_cancelled: [],
  };

  for (const booking of bookings) {
    const normalized = normalizeBookingStatus(booking, now);

    if (normalized === 'in_use') {
      buckets.in_use.push(booking);
    } else if (normalized === 'upcoming') {
      buckets.upcoming.push(booking);
    } else {
      // completed, cancelled, no_show
      buckets.completed_cancelled.push(booking);
    }
  }

  return buckets;
}


