import { getServerAdminClient } from '../supabase/server';
import { getGoogleCalendarService } from './google-calendar.service';
import { Booking } from '../types/database.types';

const supabase = getServerAdminClient();
const googleCalendar = getGoogleCalendarService();

// Simple in-memory guard so we don't hammer Google on every request.
const roomSyncTimestamps = new Map<string, number>();
const SYNC_TTL_MS = 15_000; // 15 seconds - reduced for better responsiveness to Google Calendar changes

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
  /**
   * Force sync even if TTL hasn't expired.
   * Use sparingly to avoid rate limiting from Google.
   */
  force?: boolean;
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

  // Skip sync if TTL hasn't expired, unless force is set
  if (!options?.force && lastSync && nowMs - lastSync < SYNC_TTL_MS) {
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

  // Load deleted google events to avoid re-creating them
  const deletedEventIds = new Set<string>();
  let deletedEvents: Array<{ google_event_id: string; google_calendar_id: string | null }> = [];
  try {
    // Query ALL deleted events (simple approach to ensure we don't miss any)
    // The table shouldn't be too large since it only tracks admin deletions
    const { data: deletedEventsData, error: deletedError } = await supabase
      .from('deleted_google_events')
      .select('google_event_id, google_calendar_id');
    
    if (deletedError) {
      console.log('Error loading deleted events:', deletedError.message);
    } else {
      deletedEvents = (deletedEventsData || []) as Array<{
        google_event_id: string;
        google_calendar_id: string | null;
      }>;
      deletedEvents.forEach((d) => {
        // Add the raw event ID for matching
        deletedEventIds.add(d.google_event_id);
        // Also add with calendar prefix for full key matching
        if (d.google_calendar_id) {
          deletedEventIds.add(`${d.google_calendar_id}:${d.google_event_id}`);
        }
      });
      console.log(`Loaded ${deletedEventIds.size} deleted event IDs to skip (from ${deletedEvents.length} records)`);
    }
  } catch (e) {
    // Table might not exist yet - continue without it
    console.log('Could not load deleted events (table may not exist)', e);
  }

  // Hard-delete any locally stored bookings that are marked deleted for this calendar.
  // This guarantees deleted items won't reappear even if a sync is running.
  const deletedEventIdsForCalendar = deletedEvents
    .filter((d) => !d.google_calendar_id || d.google_calendar_id === calendarId)
    .map((d) => d.google_event_id);
  if (deletedEventIdsForCalendar.length > 0) {
    const { error: purgeError } = await supabase
      .from('bookings')
      .delete()
      .eq('room_id', roomId)
      .in('google_event_id', deletedEventIdsForCalendar);
    if (purgeError) {
      console.log('Failed to purge deleted bookings during sync:', purgeError.message);
    }
  }

  const inserts: Array<Partial<Booking>> = [];
  const updates: Array<Partial<Booking>> = [];

  for (const raw of events as EventLike[]) {
    if (!raw.id) {
      continue;
    }

    // Skip events that were explicitly deleted by admin
    // Check both with calendar prefix and without (for backwards compatibility)
    const eventKeyWithCalendar = `${calendarId}:${raw.id}`;
    if (deletedEventIds.has(raw.id) || deletedEventIds.has(eventKeyWithCalendar)) {
      console.log('Skipping deleted event:', raw.id);
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
    const attendeeResponseStatuses = (raw.attendees || [])
      .filter((a) => a.email && !a.resource)
      .reduce<Record<string, string>>((acc, a) => {
        acc[String(a.email)] = String(a.responseStatus || 'needsAction');
        return acc;
      }, {});

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
      // For in-progress bookings, preserve in-progress (cancelled already handled above)
      else if (target.status === 'in_progress') {
        effectiveStatus = 'in_progress';
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

    // For existing bookings (updates), preserve original source and external_source
    // Only mark as 'google_calendar' source and 'google_ui' external_source for truly NEW events
    const isNewEvent = !target;
    
    const baseFields: Partial<Booking> = {
      room_id: roomId,
      title: raw.summary || 'Conference Room Booking',
      description: raw.description || null,
      start_time: startIso,
      end_time: endIso,
      google_event_id: raw.id || null,
      google_calendar_id: calendarId,
      // Preserve source for existing bookings, use 'google_calendar' for new imports
      source: target ? target.source : 'google_calendar',
      status: effectiveStatus,
      attendee_emails: attendeeEmails,
      attendee_response_statuses: attendeeResponseStatuses,
      organizer_email: organizerEmail,
      // Preserve external_source for existing bookings; for new events, check privateId
      external_source: target ? target.external_source : (privateId ? null : 'google_ui'),
      last_synced_at: now.toISOString(),
    };

    if (target) {
      console.log('UPDATE existing booking:', raw.id, 'target id:', target.id);
      updates.push({
        id: target.id,
        ...baseFields,
      });
    } else {
      console.log('INSERT new booking:', raw.id, 'title:', raw.summary);
      inserts.push(baseFields);
    }
  }

  let changed = 0;

  let newlyDeletedIds = new Set<string>();
  if (inserts.length) {
    // Before upserting, check if any of these google_event_ids already exist in the database.
    // This handles the case where a booking was created by our app but wasn't found in the
    // initial lookup (timing issues, different query window, etc.). We must preserve the
    // original source and external_source to avoid incorrectly marking tablet/web bookings
    // as coming from Google Calendar.
    const eventIds = inserts
      .map((b) => b.google_event_id)
      .filter((id): id is string => !!id);

    let existingByEventIdForInserts: Record<string, { source: string; external_source: string | null; status: string }> = {};
    
    if (eventIds.length > 0) {
      const { data: existingForInserts } = await supabase
        .from('bookings')
        .select('google_event_id, source, external_source, status')
        .in('google_event_id', eventIds);
      
      if (existingForInserts) {
        existingByEventIdForInserts = Object.fromEntries(
          existingForInserts.map((b) => [
            b.google_event_id,
            { source: b.source, external_source: b.external_source, status: b.status },
          ])
        );
      }
    }

    // Re-check deleted events RIGHT BEFORE upsert to handle race conditions
    // (events might have been deleted while we were processing)
    // Check BOTH inserts AND updates to prevent recreating deleted bookings
    const allEventIds = [
      ...inserts.map(b => b.google_event_id),
      ...updates.map(b => b.google_event_id)
    ].filter((id): id is string => !!id);
    
    newlyDeletedIds = new Set<string>();
    if (allEventIds.length > 0) {
      const { data: recentDeletes } = await supabase
        .from('deleted_google_events')
        .select('google_event_id')
        .in('google_event_id', allEventIds);
      if (recentDeletes) {
        newlyDeletedIds = new Set(recentDeletes.map(d => d.google_event_id));
        console.log(`Found ${newlyDeletedIds.size} deleted events to filter out from inserts/updates`);
      }
    }
    
    // Filter out any events that were deleted during processing
    const filteredInserts = inserts.filter(b => !b.google_event_id || !newlyDeletedIds.has(b.google_event_id));
    if (filteredInserts.length < inserts.length) {
      console.log(`Filtered out ${inserts.length - filteredInserts.length} deleted events from inserts`);
    }

    const { error: insertError } = await supabase.from('bookings').upsert(
      filteredInserts.map((b) => {
        // Check if this booking already exists (will be an update due to google_event_id conflict)
        const existingRecord = b.google_event_id
          ? existingByEventIdForInserts[b.google_event_id]
          : null;
        
        // Determine effective status: preserve in_progress/ended/no_show/cancelled statuses
        // when a booking already exists, otherwise use the computed status
        let effectiveStatus = b.status;
        if (existingRecord) {
          const preservedStatuses = ['in_progress', 'ended', 'no_show', 'cancelled'];
          if (preservedStatuses.includes(existingRecord.status)) {
            effectiveStatus = existingRecord.status as typeof effectiveStatus;
          }
        }
        
        return {
        // Required fields
        room_id: b.room_id,
        title: b.title,
        description: b.description,
        start_time: b.start_time,
        end_time: b.end_time,
        google_event_id: b.google_event_id,
        google_calendar_id: b.google_calendar_id,
          // Preserve source if this is actually an update (booking exists with this google_event_id)
          source: existingRecord ? existingRecord.source : b.source,
          // CRITICAL: Preserve lifecycle statuses (in_progress, ended, no_show, cancelled)
          // to avoid auto-checked-in tablet bookings reverting to scheduled
          status: effectiveStatus,
        attendee_emails: b.attendee_emails || [],
        attendee_response_statuses: b.attendee_response_statuses || {},
        organizer_email: b.organizer_email,
          // CRITICAL: Preserve external_source if booking already exists to avoid
          // incorrectly marking tablet/web bookings as Google Calendar bookings
          external_source: existingRecord ? existingRecord.external_source : b.external_source,
        last_synced_at: b.last_synced_at,
        };
      }),
      { onConflict: 'google_event_id', ignoreDuplicates: false }
    );

    if (insertError) {
      throw new Error(
        `Failed to upsert Google-synced bookings: ${insertError.message}`
      );
    }
    changed += filteredInserts.length;
  }

  if (updates.length) {
    // Re-fetch deleted events one more time right before UPDATE to catch any deletions
    const updateEventIds = updates.map(b => b.google_event_id).filter((id): id is string => !!id);
    let latestDeletedIds = new Set<string>();
    if (updateEventIds.length > 0) {
      const { data: latestDeletes } = await supabase
        .from('deleted_google_events')
        .select('google_event_id')
        .in('google_event_id', updateEventIds);
      if (latestDeletes) {
        latestDeletedIds = new Set(latestDeletes.map(d => d.google_event_id));
      }
    }

    // Filter out any updates for bookings that were deleted during processing
    const filteredUpdates = updates.filter(b => {
      if (!b.google_event_id) return true;
      const shouldFilter =
        deletedEventIds.has(b.google_event_id) ||
        newlyDeletedIds.has(b.google_event_id) ||
        latestDeletedIds.has(b.google_event_id);
      if (shouldFilter) {
        console.log(`Filtering out deleted event from updates: ${b.google_event_id}`);
      }
      return !shouldFilter;
    });

    if (filteredUpdates.length < updates.length) {
      console.log(`Filtered out ${updates.length - filteredUpdates.length} deleted events from updates`);
    }

    // Use UPDATE instead of upsert to avoid recreating deleted rows.
    for (const b of filteredUpdates) {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
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
          attendee_response_statuses: b.attendee_response_statuses || {},
          organizer_email: b.organizer_email,
          external_source: b.external_source,
          last_synced_at: b.last_synced_at,
        })
        .eq('id', b.id);

      if (updateError) {
        throw new Error(
          `Failed to update Google-synced bookings: ${updateError.message}`
        );
      }
      changed += 1;
    }
  }

  roomSyncTimestamps.set(roomId, nowMs);
  return { synced: changed };
}


