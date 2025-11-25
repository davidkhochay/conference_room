import { getServerAdminClient } from '../supabase/server';
import { getGoogleCalendarService } from './google-calendar.service';
import { Booking } from '../types/database.types';

const supabase = getServerAdminClient();
const googleCalendar = getGoogleCalendarService();

// Simple in-memory guard so we don't hammer Google on every request.
const roomSyncTimestamps = new Map<string, number>();
const SYNC_TTL_MS = 60_000; // 1 minute

type SyncOptions = {
  /**
   * How far back in time (in minutes) to look when importing events.
   * Defaults to 24 hours in the past.
   */
  windowPastMinutes?: number;
  /**
   * How far into the future (in days) to look when importing events.
   * Defaults to 30 days into the future.
   */
  windowFutureDays?: number;
};

type EventLike = {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  status?: string | null;
  organizer?: { email?: string | null } | null;
  attendees?: Array<{ email?: string | null; resource?: boolean | null }> | null;
  extendedProperties?: {
    private?: Record<string, string> | null;
  } | null;
};

/**
 * Prefer the explicit `google_calendar_id` for Calendar API calls and only
 * fall back to `google_resource_id` when it already looks like a calendar
 * email. This protects us from accidentally sending the numeric Directory
 * `resourceId` (e.g. `865499229293`) to the Calendar API, which will always
 * return 404.
 */
function resolveRoomCalendarId(room: {
  id?: string;
  name?: string;
  google_calendar_id: string | null;
  google_resource_id: string | null;
}): string | null {
  if (room.google_calendar_id) {
    return room.google_calendar_id;
  }

  if (!room.google_resource_id) {
    return null;
  }

  // If this looks like a bare numeric ID, it's almost certainly the Directory
  // resourceId, not a usable calendarId email.
  if (/^[0-9]+$/.test(room.google_resource_id)) {
    console.warn(
      'Room has numeric google_resource_id but no google_calendar_id; cannot resolve calendarId for sync',
      {
        room_id: room.id,
        room_name: room.name,
        google_resource_id: room.google_resource_id,
      }
    );
    return null;
  }

  return room.google_resource_id;
}

function getEventDateTime(
  edge: 'start' | 'end',
  event: EventLike
): string | null {
  const value = edge === 'start' ? event.start : event.end;
  if (!value) return null;
  if (value.dateTime) return value.dateTime;
  if (value.date) {
    // All‑day events – treat as start of day / end of day in UTC.
    if (edge === 'start') {
      return new Date(`${value.date}T00:00:00.000Z`).toISOString();
    }
    return new Date(`${value.date}T23:59:59.999Z`).toISOString();
  }
  return null;
}

function mapGoogleStatusToBookingStatus(
  event: EventLike,
  now: Date,
  startIso: string,
  endIso: string
): Booking['status'] {
  if (event.status === 'cancelled') {
    return 'cancelled';
  }

  // Let the local lifecycle (check-in, no-show, release, auto-end) drive
  // status transitions. Google is treated as the source of timing and
  // cancellations only; everything else starts as "scheduled".
  return 'scheduled';
}

/**
 * Import and reconcile Google Calendar events for a single room into the
 * local `bookings` table over a rolling time window.
 *
 * This function is idempotent and safe to call frequently. It is designed to
 * be invoked opportunistically from API routes (room status, room calendar)
 * or from a scheduled job.
 */
export async function syncRoomFromGoogle(
  roomId: string,
  options?: SyncOptions
): Promise<{ synced: number }> {
  const nowMs = Date.now();
  const lastSync = roomSyncTimestamps.get(roomId);

  if (lastSync && nowMs - lastSync < SYNC_TTL_MS) {
    return { synced: 0 };
  }

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, name, google_calendar_id, google_resource_id')
    .eq('id', roomId)
    .single();

  if (roomError || !room) {
    throw new Error('Room not found for Google sync');
  }

  const calendarId: string | null = resolveRoomCalendarId(room);

  if (!calendarId) {
    // Nothing to sync for rooms not wired to a Google calendar.
    roomSyncTimestamps.set(roomId, nowMs);
    return { synced: 0 };
  }

  const windowPastMinutes = options?.windowPastMinutes ?? 24 * 60; // 1 day
  const windowFutureDays = options?.windowFutureDays ?? 30; // 30 days

  const now = new Date(nowMs);
  const timeMin = new Date(
    nowMs - windowPastMinutes * 60 * 1000
  ).toISOString();
  const timeMax = new Date(
    nowMs + windowFutureDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const events = await googleCalendar.listEvents(calendarId, timeMin, timeMax);

  if (!events.length) {
    roomSyncTimestamps.set(roomId, nowMs);
    return { synced: 0 };
  }

  // Load existing bookings for this room over the same window.
  const { data: existing, error: existingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('room_id', roomId)
    .gte('end_time', timeMin)
    .lte('start_time', timeMax);

  if (existingError) {
    throw new Error(
      `Failed to load existing bookings for sync: ${existingError.message}`
    );
  }

  const existingById = new Map<string, Booking>();
  const existingByEventId = new Map<string, Booking>();

  (existing || []).forEach((b: any) => {
    const typed = b as Booking;
    existingById.set(typed.id, typed);
    if (typed.google_event_id) {
      existingByEventId.set(
        `${typed.google_calendar_id || ''}:${typed.google_event_id}`,
        typed
      );
    }
  });

  const inserts: Array<Partial<Booking>> = [];
  const updates: Array<Partial<Booking>> = [];

  for (const raw of events as EventLike[]) {
    if (!raw.id) {
      continue;
    }

    const startIso = getEventDateTime('start', raw);
    const endIso = getEventDateTime('end', raw);
    if (!startIso || !endIso) {
      continue;
    }

    const computedStatus = mapGoogleStatusToBookingStatus(
      raw,
      now,
      startIso,
      endIso
    );
    const organizerEmail = raw.organizer?.email || null;
    const attendeeEmails =
      raw.attendees
        ?.filter((a) => a.email && !a.resource)
        .map((a) => String(a.email)) || [];

    const privateId =
      raw.extendedProperties?.private?.['glc_booking_id'] || null;

    let target: Booking | undefined;

    if (privateId && existingById.has(privateId)) {
      target = existingById.get(privateId);
    } else {
      const key = `${calendarId}:${raw.id}`;
      target = existingByEventId.get(key);
    }

    // When a booking already exists locally, we MUST preserve lifecycle statuses
    // that were set by our internal flows (release, check-in, no-show). These
    // represent explicit user actions and must never be overwritten by Google sync,
    // even if Google still shows the event (due to propagation delays).
    //
    // The local system is the source of truth for booking lifecycle; Google Calendar
    // is only the source of truth for timing and explicit cancellations.
    let effectiveStatus: Booking['status'] = computedStatus;
    if (target) {
      // NEVER overwrite these final/terminal statuses - they represent completed
      // user actions and must persist even if Google Calendar still shows the event
      if (target.status === 'ended' || target.status === 'no_show') {
        effectiveStatus = target.status;
      }
      // For cancelled bookings, respect both local and Google cancellations
      else if (target.status === 'cancelled' || computedStatus === 'cancelled') {
        effectiveStatus = 'cancelled';
      }
      // For in-progress bookings, only allow Google to cancel, never revert to scheduled
      else if (target.status === 'in_progress') {
        effectiveStatus = computedStatus === 'cancelled' ? 'cancelled' : 'in_progress';
      }
      // For scheduled bookings, allow Google to update (normal sync behavior)
      else if (target.status === 'scheduled') {
        effectiveStatus = computedStatus;
      }
      // For any other status, preserve what we have locally
      else {
        effectiveStatus = target.status;
      }
    }

    const baseFields: Partial<Booking> = {
      room_id: roomId,
      title: raw.summary || 'Conference Room Booking',
      description: raw.description || null,
      start_time: startIso,
      end_time: endIso,
      google_event_id: raw.id || null,
      google_calendar_id: calendarId,
      source: 'api',
      status: effectiveStatus,
      attendee_emails: attendeeEmails,
      organizer_email: organizerEmail,
      external_source: privateId ? null : 'google_ui',
      last_synced_at: now.toISOString(),
    };

    if (target) {
      updates.push({
        id: target.id,
        ...baseFields,
      });
    } else {
      inserts.push(baseFields);
    }
  }

  let changed = 0;

  if (inserts.length) {
    const { error: insertError } = await supabase.from('bookings').insert(
      inserts.map((b) => ({
        // Required fields
        room_id: b.room_id,
        title: b.title,
        description: b.description,
        start_time: b.start_time,
        end_time: b.end_time,
        google_event_id: b.google_event_id,
        google_calendar_id: b.google_calendar_id,
        source: b.source,
        status: b.status,
        attendee_emails: b.attendee_emails || [],
        organizer_email: b.organizer_email,
        external_source: b.external_source,
        last_synced_at: b.last_synced_at,
      }))
    );

    if (insertError) {
      throw new Error(
        `Failed to insert Google-synced bookings: ${insertError.message}`
      );
    }
    changed += inserts.length;
  }

  if (updates.length) {
    const { error: updateError } = await supabase.from('bookings').upsert(
      updates.map((b) => ({
        id: b.id,
        room_id: b.room_id,
        title: b.title,
        description: b.description,
        start_time: b.start_time,
        end_time: b.end_time,
        google_event_id: b.google_event_id,
        google_calendar_id: b.google_calendar_id,
        source: b.source,
        status: b.status,
        attendee_emails: b.attendee_emails || [],
        organizer_email: b.organizer_email,
        external_source: b.external_source,
        last_synced_at: b.last_synced_at,
      })),
      { onConflict: 'id' }
    );

    if (updateError) {
      throw new Error(
        `Failed to update Google-synced bookings: ${updateError.message}`
      );
    }
    changed += updates.length;
  }

  roomSyncTimestamps.set(roomId, nowMs);
  return { synced: changed };
}


