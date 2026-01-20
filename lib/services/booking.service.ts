import { getServerAdminClient } from '../supabase/server';
import { getGoogleCalendarService } from './google-calendar.service';
import { Booking, Room, User, RecurrenceRule } from '../types/database.types';
import { CreateBookingRequest, QuickBookingRequest } from '../types/api.types';

/**
 * Generate occurrence dates based on recurrence rule
 */
function generateOccurrenceDates(
  startDate: Date,
  endDate: Date,
  rule: RecurrenceRule
): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  // Cap at a reasonable maximum to prevent runaway generation
  const maxOccurrences = 200;
  
  while (current <= endDate && dates.length < maxOccurrences) {
    if (rule.type === 'weekly' && rule.daysOfWeek) {
      // For weekly: check if current day is in daysOfWeek
      if (rule.daysOfWeek.includes(current.getDay())) {
        dates.push(new Date(current));
      }
      // Move to next day
      current.setDate(current.getDate() + 1);
    } else if (rule.type === 'monthly' && rule.dayOfMonth) {
      // For monthly: check if current date matches dayOfMonth
      if (current.getDate() === rule.dayOfMonth) {
        dates.push(new Date(current));
        // Move to next month
        current.setMonth(current.getMonth() + 1);
        current.setDate(rule.dayOfMonth);
      } else {
        // Set to the target day of this month or next
        const targetDay = rule.dayOfMonth;
        const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        
        if (targetDay <= daysInMonth && current.getDate() < targetDay) {
          current.setDate(targetDay);
        } else {
          // Move to next month
          current.setMonth(current.getMonth() + 1);
          const newDaysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
          current.setDate(Math.min(targetDay, newDaysInMonth));
        }
      }
    } else {
      break; // Invalid rule
    }
  }
  
  return dates;
}

/**
 * Convert recurrence rule to Google Calendar RRULE format
 */
function buildRRule(rule: RecurrenceRule, untilDate: Date): string {
  const until = untilDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  if (rule.type === 'weekly' && rule.daysOfWeek) {
    const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const byDay = rule.daysOfWeek.map(d => dayNames[d]).join(',');
    return `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${until}`;
  } else if (rule.type === 'monthly' && rule.dayOfMonth) {
    return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${rule.dayOfMonth};UNTIL=${until}`;
  }
  
  throw new Error('Invalid recurrence rule');
}

export class BookingService {
  private supabase = getServerAdminClient();
  private googleCalendar = getGoogleCalendarService();

  /**
   * Create a quick booking from tablet (now + duration)
   */
  async createQuickBooking(request: QuickBookingRequest, deviceKey?: string): Promise<Booking> {
    // Get room details
    const { data: room, error: roomError } = await this.supabase
      .from('rooms')
      .select('*, location:locations(*)')
      .eq('id', request.room_id)
      .single();

    if (roomError || !room) {
      throw new Error('Room not found');
    }

    // Verify device key if provided
    if (deviceKey && room.device_key !== deviceKey) {
      throw new Error('Invalid device key');
    }

    if (!room.allow_walk_up_booking) {
      throw new Error('Walk-up bookings not allowed for this room');
    }

    // Calculate time range
    const now = new Date();
    const startTime = now;
    const endTime = new Date(now.getTime() + request.duration_minutes * 60 * 1000);

    // Check if room is available using Google Calendar
    const calendarIdForAvailability =
      room.google_calendar_id || room.google_resource_id;
    const availability = await this.checkRoomAvailability(
      calendarIdForAvailability,
      startTime.toISOString(),
      endTime.toISOString()
    );

    if (!availability.isAvailable) {
      // Find the next conflict and clip the booking
      const nextConflict = availability.conflicts[0];
      if (nextConflict) {
        const conflictStart = new Date(nextConflict.start);
        if (conflictStart <= startTime) {
          throw new Error(`Room is occupied until ${nextConflict.end}`);
        }
        // Clip the booking to end before the conflict
        endTime.setTime(conflictStart.getTime());
      }
    }

    // Create booking in database
    const { data: booking, error: bookingError } = await this.supabase
      .from('bookings')
      .insert({
        room_id: request.room_id,
        host_user_id: null, // Walk-up booking
        title: 'Walk-up Booking',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        source: request.source,
        status: 'in_progress',
      })
      .select()
      .single();

    if (bookingError || !booking) {
      throw new Error('Failed to create booking');
    }

    // Create Google Calendar event (optional - booking works without it)
    // Events are created on the admin's calendar (organizer) with the room as an attendee.
    try {
      const roomCalendarId = room.google_calendar_id || room.google_resource_id;
      const organizerCalendarId = this.googleCalendar.getOrganizerEmail();

      if (organizerCalendarId) {
        // Build attendees list: room as resource
        const attendees: Array<{ email: string; resource?: boolean }> = [];

        // Add the room as a resource attendee so it appears on the room's calendar
        if (roomCalendarId) {
          attendees.push({ email: roomCalendarId, resource: true });
        }

        const event = await this.googleCalendar.createEvent(
          organizerCalendarId,
          {
            summary: 'Walk-up Booking',
            description: `Quick booking from ${room.name}`,
            start: {
              dateTime: startTime.toISOString(),
              timeZone: room.location.timezone,
            },
            end: {
              dateTime: endTime.toISOString(),
              timeZone: room.location.timezone,
            },
            attendees,
          },
          {
            glc_booking_id: booking.id,
          }
        );

        // Update booking with Google event ID
        await this.supabase
          .from('bookings')
          .update({
            google_event_id: event.id,
            google_calendar_id: organizerCalendarId,
          })
          .eq('id', booking.id);
      }
    } catch (error) {
      // Log error but don't fail the booking
      console.error('Google Calendar sync failed (booking still created):', error);
    }

    // Log activity
    await this.logBookingActivity(booking.id, 'created', null, {
      source: request.source,
      duration_minutes: request.duration_minutes,
    });

    return booking;
  }

  /**
   * Mark stale, never-checked-in bookings as no-shows.
   *
   * A booking is considered a no-show when:
   * - status is still 'scheduled'
   * - check_in_time IS NULL
   * - start_time is at least `graceMinutes` minutes in the past
   *
   * Optionally scope the scan to a single room to keep the work small for
   * per-room status checks (e.g. tablet / room-status endpoint).
   */
  async markNoShows(options?: { roomId?: string }): Promise<{
    updatedCount: number;
    graceMinutes: number;
  }> {
    const graceMinutes = await this.getNoShowGraceMinutes();
    const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000).toISOString();

    // Find stale bookings that never checked in
    let query = this.supabase
      .from('bookings')
      .select('id, google_event_id, google_calendar_id')
      .is('check_in_time', null)
      .eq('status', 'scheduled')
      .lte('start_time', cutoff);

    if (options?.roomId) {
      query = query.eq('room_id', options.roomId);
    }

    const { data: staleBookings, error: findError } = await query.limit(500);

    if (findError) {
      throw new Error(`Failed to scan for no-shows: ${findError.message}`);
    }

    if (!staleBookings || staleBookings.length === 0) {
      return { updatedCount: 0, graceMinutes };
    }

    const ids = staleBookings.map((b) => b.id as string);

    // Update bookings to no_show
    const { data: updated, error: updateError } = await this.supabase
      .from('bookings')
      .update({ status: 'no_show' })
      .in('id', ids)
      .select('id');

    if (updateError) {
      throw new Error(`Failed to mark no-shows: ${updateError.message}`);
    }

    // Log booking activity for analytics / audit
    await this.supabase.from('booking_activity_log').insert(
      ids.map((bookingId) => ({
        booking_id: bookingId,
        action: 'no_show',
        performed_by_user_id: null,
        metadata: {
          reason: 'auto_no_checkin',
          grace_minutes: graceMinutes,
        },
      }))
    );

    // Best-effort cleanup of Google Calendar events so the room is truly free
    // for re-booking in Google as well as in our local system.
    for (const stale of staleBookings) {
      if (stale.google_event_id && stale.google_calendar_id) {
        try {
          await this.googleCalendar.deleteEvent(
            stale.google_calendar_id,
            stale.google_event_id
          );
        } catch (e) {
          // Swallow errors here so one bad calendar event does not block the scan
          console.error('Failed to delete Google event for no-show booking', {
            bookingId: stale.id,
            error: e,
          });
        }
      }
    }

    return {
      updatedCount: updated?.length ?? 0,
      graceMinutes,
    };
  }

  /**
   * Create a full booking with all details
   */
  async createBooking(request: CreateBookingRequest): Promise<Booking> {
    // Get room details with location
    const { data: room, error: roomError } = await this.supabase
      .from('rooms')
      .select('*, location:locations(*)')
      .eq('id', request.room_id)
      .single();

    if (roomError || !room) {
      throw new Error('Room not found');
    }

    // Validate time range
    const startTime = new Date(request.start_time);
    const endTime = new Date(request.end_time);
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (60 * 1000);

    // Check max duration
    const maxDuration = room.max_booking_duration_minutes || await this.getMaxBookingDuration();
    if (durationMinutes > maxDuration) {
      throw new Error(`Booking duration exceeds maximum of ${maxDuration} minutes`);
    }

    // Check availability
    const calendarIdForAvailability =
      room.google_calendar_id || room.google_resource_id;
    const availability = await this.checkRoomAvailability(
      calendarIdForAvailability,
      request.start_time,
      request.end_time
    );

    if (!availability.isAvailable) {
      throw new Error('Room is not available for the requested time');
    }

    // If a host is specified, ensure the user exists and is active.
    let host: User | null = null;
    if (request.host_user_id) {
      const { data: hostData, error: hostError } = await this.supabase
        .from('users')
        .select()
        .eq('id', request.host_user_id)
        .single();

      if (hostError || !hostData) {
        throw new Error('Host user not found');
      }

      if (hostData.status !== 'active') {
        throw new Error('Selected host is not active');
      }

      host = hostData as User;
    }

    // For tablet bookings that start now, create directly as in_progress (auto check-in)
    const isTabletBookingStartingNow = request.source === 'tablet' && 
      Math.abs(new Date(request.start_time).getTime() - Date.now()) < 60000; // Within 1 minute of now
    
    // Create booking
    const { data: booking, error: bookingError } = await this.supabase
      .from('bookings')
      .insert({
        room_id: request.room_id,
        host_user_id: request.host_user_id,
        title: request.title || 'Conference Room Booking',
        description: request.description,
        start_time: request.start_time,
        end_time: request.end_time,
        source: request.source,
        status: isTabletBookingStartingNow ? 'in_progress' : 'scheduled',
        check_in_time: isTabletBookingStartingNow ? new Date().toISOString() : null,
        attendee_emails: request.attendee_emails || [],
      })
      .select()
      .single();

    if (bookingError || !booking) {
      throw new Error('Failed to create booking');
    }

    // Log activity for tablet auto-check-in bookings
    if (isTabletBookingStartingNow) {
      await this.logBookingActivity(booking.id, 'checked_in', request.host_user_id || undefined, {
        auto_checkin: true,
        source: 'tablet',
      });
    }

    // Create Google Calendar event (optional - booking works without it)
    // Events are created as the HOST user (they become the organizer).
    // If no host or impersonation fails, falls back to admin email.
    try {
      const roomCalendarId = room.google_calendar_id || room.google_resource_id;
      
      // Determine organizer: prefer host, fall back to admin
      const organizerEmail = host?.email || this.googleCalendar.getOrganizerEmail();

      if (organizerEmail) {
        // Build attendees list: other attendees + room as resource
        // Note: Don't add the organizer (host) as attendee - they're already the organizer
        const attendees: Array<{ email: string; resource?: boolean }> = [];

        // Add other attendees from the request (excluding the host/organizer)
        if (request.attendee_emails) {
          for (const email of request.attendee_emails) {
            // Skip the organizer email - they don't need to be an attendee
            if (email.toLowerCase() !== organizerEmail.toLowerCase()) {
              attendees.push({ email });
            }
          }
        }

        // Add the room as a resource attendee so it appears on the room's calendar
        if (roomCalendarId) {
          attendees.push({ email: roomCalendarId, resource: true });
        }

        // Create event as the host (they become the organizer)
        const { event, organizerUsed } = await this.googleCalendar.createEventAsUser(
          organizerEmail,
          {
            summary: request.title || 'Conference Room Booking',
            description:
              request.description ||
              `Booked via Good Life Room Booking\nRoom: ${room.name}`,
            start: {
              dateTime: request.start_time,
              timeZone: room.location.timezone,
            },
            end: {
              dateTime: request.end_time,
              timeZone: room.location.timezone,
            },
            attendees,
          },
          {
            glc_booking_id: booking.id,
          }
        );

        // Update booking with event ID and organizer calendar
        await this.supabase
          .from('bookings')
          .update({
            google_event_id: event.id,
            google_calendar_id: organizerUsed,
          })
          .eq('id', booking.id);
      }
    } catch (error) {
      // Log error but don't fail the booking
      console.error('Google Calendar sync failed (booking still created):', error);
    }

    // Log activity
    await this.logBookingActivity(booking.id, 'created', request.host_user_id, {
      source: request.source,
    });

    return booking;
  }

  /**
   * Create a recurring booking with all occurrences
   */
  async createRecurringBooking(request: CreateBookingRequest & {
    is_recurring: true;
    recurrence_rule: RecurrenceRule;
    recurrence_end_date: string;
  }): Promise<{ parent: Booking; occurrences: Booking[] }> {
    // Get room details with location
    const { data: room, error: roomError } = await this.supabase
      .from('rooms')
      .select('*, location:locations(*)')
      .eq('id', request.room_id)
      .single();

    if (roomError || !room) {
      throw new Error('Room not found');
    }

    // Calculate duration from the first occurrence
    const firstStart = new Date(request.start_time);
    const firstEnd = new Date(request.end_time);
    const durationMs = firstEnd.getTime() - firstStart.getTime();
    const durationMinutes = durationMs / (60 * 1000);

    // Check max duration
    const maxDuration = room.max_booking_duration_minutes || await this.getMaxBookingDuration();
    if (durationMinutes > maxDuration) {
      throw new Error(`Booking duration exceeds maximum of ${maxDuration} minutes`);
    }

    // Generate all occurrence dates
    const recurrenceEndDate = new Date(request.recurrence_end_date);
    const occurrenceDates = generateOccurrenceDates(
      firstStart,
      recurrenceEndDate,
      request.recurrence_rule
    );

    if (occurrenceDates.length === 0) {
      throw new Error('No occurrences would be created with this recurrence pattern');
    }

    // Check availability for ALL occurrences
    const calendarIdForAvailability = room.google_calendar_id || room.google_resource_id;
    const conflicts: Array<{ date: Date; conflict: { start: string; end: string } }> = [];

    for (const occDate of occurrenceDates) {
      // Apply the time from the original start/end to each occurrence date
      const occStart = new Date(occDate);
      occStart.setHours(firstStart.getHours(), firstStart.getMinutes(), firstStart.getSeconds());
      
      const occEnd = new Date(occStart.getTime() + durationMs);

      const availability = await this.checkRoomAvailability(
        calendarIdForAvailability,
        occStart.toISOString(),
        occEnd.toISOString()
      );

      if (!availability.isAvailable) {
        conflicts.push({
          date: occStart,
          conflict: availability.conflicts[0],
        });
      }
    }

    if (conflicts.length > 0) {
      const conflictDates = conflicts.slice(0, 5).map(c => 
        c.date.toLocaleDateString()
      ).join(', ');
      throw new Error(
        `Room is not available for ${conflicts.length} occurrence(s). ` +
        `Conflicts on: ${conflictDates}${conflicts.length > 5 ? '...' : ''}`
      );
    }

    // If a host is specified, ensure the user exists and is active
    let host: User | null = null;
    if (request.host_user_id) {
      const { data: hostData, error: hostError } = await this.supabase
        .from('users')
        .select()
        .eq('id', request.host_user_id)
        .single();

      if (hostError || !hostData) {
        throw new Error('Host user not found');
      }

      if (hostData.status !== 'active') {
        throw new Error('Selected host is not active');
      }

      host = hostData as User;
    }

    // Create the parent recurring booking (first occurrence)
    const { data: parentBooking, error: parentError } = await this.supabase
      .from('bookings')
      .insert({
        room_id: request.room_id,
        host_user_id: request.host_user_id,
        title: request.title || 'Recurring Meeting',
        description: request.description,
        start_time: request.start_time,
        end_time: request.end_time,
        source: request.source,
        status: 'scheduled',
        attendee_emails: request.attendee_emails || [],
        is_recurring: true,
        recurrence_rule: request.recurrence_rule,
        recurrence_end_date: request.recurrence_end_date,
      })
      .select()
      .single();

    if (parentError || !parentBooking) {
      throw new Error('Failed to create recurring booking');
    }

    // Create occurrence bookings (excluding the first one which is the parent)
    const occurrenceInserts = occurrenceDates.slice(1).map(occDate => {
      const occStart = new Date(occDate);
      occStart.setHours(firstStart.getHours(), firstStart.getMinutes(), firstStart.getSeconds());
      const occEnd = new Date(occStart.getTime() + durationMs);

      return {
        room_id: request.room_id,
        host_user_id: request.host_user_id,
        title: request.title || 'Recurring Meeting',
        description: request.description,
        start_time: occStart.toISOString(),
        end_time: occEnd.toISOString(),
        source: request.source,
        status: 'scheduled',
        attendee_emails: request.attendee_emails || [],
        is_recurring: false,
        recurring_parent_id: parentBooking.id,
      };
    });

    let occurrences: Booking[] = [];
    if (occurrenceInserts.length > 0) {
      const { data: occurrenceData, error: occurrenceError } = await this.supabase
        .from('bookings')
        .insert(occurrenceInserts)
        .select();

      if (occurrenceError) {
        // Rollback parent if occurrences fail
        await this.supabase.from('bookings').delete().eq('id', parentBooking.id);
        throw new Error('Failed to create occurrence bookings');
      }

      occurrences = occurrenceData || [];
    }

    // Create Google Calendar recurring event
    try {
      const roomCalendarId = room.google_calendar_id || room.google_resource_id;
      const organizerEmail = host?.email || this.googleCalendar.getOrganizerEmail();

      if (organizerEmail) {
        const attendees: Array<{ email: string; resource?: boolean }> = [];

        if (request.attendee_emails) {
          for (const email of request.attendee_emails) {
            if (email.toLowerCase() !== organizerEmail.toLowerCase()) {
              attendees.push({ email });
            }
          }
        }

        if (roomCalendarId) {
          attendees.push({ email: roomCalendarId, resource: true });
        }

        const rrule = buildRRule(request.recurrence_rule, recurrenceEndDate);

        const { event, organizerUsed } = await this.googleCalendar.createRecurringEventAsUser(
          organizerEmail,
          {
            summary: request.title || 'Recurring Meeting',
            description:
              request.description ||
              `Recurring booking via Good Life Room Booking\nRoom: ${room.name}`,
            start: {
              dateTime: request.start_time,
              timeZone: room.location.timezone,
            },
            end: {
              dateTime: request.end_time,
              timeZone: room.location.timezone,
            },
            attendees,
            recurrence: [rrule],
          },
          {
            glc_booking_id: parentBooking.id,
            glc_recurring: 'true',
          }
        );

        // Update parent booking with Google event info
        await this.supabase
          .from('bookings')
          .update({
            google_event_id: event.id,
            google_calendar_id: organizerUsed,
          })
          .eq('id', parentBooking.id);
      }
    } catch (error) {
      console.error('Google Calendar sync failed for recurring booking (bookings still created):', error);
    }

    // Log activity
    await this.logBookingActivity(parentBooking.id, 'created', request.host_user_id, {
      source: request.source,
      is_recurring: true,
      recurrence_rule: request.recurrence_rule,
      total_occurrences: occurrenceDates.length,
    });

    return {
      parent: parentBooking,
      occurrences,
    };
  }

  /**
   * Cancel an entire recurring series (admin only)
   */
  async cancelRecurringSeries(parentBookingId: string, userId?: string): Promise<{ cancelledCount: number }> {
    // Get the parent booking
    const { data: parent, error: parentError } = await this.supabase
      .from('bookings')
      .select()
      .eq('id', parentBookingId)
      .single();

    if (parentError || !parent) {
      throw new Error('Parent booking not found');
    }

    if (!parent.is_recurring) {
      throw new Error('This is not a recurring booking');
    }

    // Get all occurrences (including parent)
    const { data: allBookings, error: fetchError } = await this.supabase
      .from('bookings')
      .select('id, status, google_event_id, google_calendar_id')
      .or(`id.eq.${parentBookingId},recurring_parent_id.eq.${parentBookingId}`)
      .in('status', ['scheduled', 'in_progress']);

    if (fetchError) {
      throw new Error('Failed to fetch bookings');
    }

    if (!allBookings || allBookings.length === 0) {
      return { cancelledCount: 0 };
    }

    const ids = allBookings.map(b => b.id);

    // Cancel all bookings
    const { error: updateError } = await this.supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .in('id', ids);

    if (updateError) {
      throw new Error('Failed to cancel bookings');
    }

    // Delete Google Calendar event (the parent event - this cancels all occurrences)
    if (parent.google_event_id && parent.google_calendar_id) {
      try {
        await this.googleCalendar.deleteEvent(
          parent.google_calendar_id,
          parent.google_event_id
        );
      } catch (error) {
        console.error('Failed to delete Google Calendar recurring event:', error);
      }
    }

    // Log activity
    await this.logBookingActivity(parentBookingId, 'cancelled', userId, {
      is_recurring_series: true,
      cancelled_count: ids.length,
    });

    return { cancelledCount: ids.length };
  }

  /**
   * Get all recurring booking series
   */
  async getRecurringSeries(): Promise<Array<Booking & { occurrence_count: number }>> {
    const { data, error } = await this.supabase
      .from('bookings')
      .select('*')
      .eq('is_recurring', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch recurring series');
    }

    // Get occurrence counts for each series
    const seriesWithCounts = await Promise.all(
      (data || []).map(async (parent) => {
        const { count } = await this.supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('recurring_parent_id', parent.id);

        return {
          ...parent,
          occurrence_count: (count || 0) + 1, // +1 for the parent itself
        };
      })
    );

    return seriesWithCounts;
  }

  /**
   * Extend an existing booking
   */
  async extendBooking(
    bookingId: string,
    additionalMinutes: number,
    userId?: string
  ): Promise<Booking> {
    // Get booking with room details
    const { data: booking, error } = await this.supabase
      .from('bookings')
      .select('*, room:rooms(*, location:locations(*))')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'ended' || booking.status === 'cancelled' || booking.status === 'no_show') {
      throw new Error('Cannot extend a completed, cancelled, or no-show booking');
    }

    const newEndTime = new Date(new Date(booking.end_time).getTime() + additionalMinutes * 60 * 1000);

    // Check availability for extended time
    const availability = await this.checkRoomAvailability(
      booking.room.google_calendar_id || booking.room.google_resource_id,
      booking.end_time,
      newEndTime.toISOString()
    );

    if (!availability.isAvailable) {
      throw new Error('Room is not available for the extension');
    }

    // Update booking
    const { data: updatedBooking, error: updateError } = await this.supabase
      .from('bookings')
      .update({
        end_time: newEndTime.toISOString(),
        extended_count: booking.extended_count + 1,
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) {
      throw new Error('Failed to update booking');
    }

    // Update Google Calendar event
    if (booking.google_event_id && booking.google_calendar_id) {
      try {
        await this.googleCalendar.updateEvent(
          booking.google_calendar_id,
          booking.google_event_id,
          {
            end: {
              dateTime: newEndTime.toISOString(),
              timeZone: booking.room.location.timezone,
            },
          }
        );
      } catch (error) {
        // Log error but don't fail the extension - the database is already updated
        console.error('Failed to update Google Calendar event on extension:', error);
      }
    }

    // Log activity
    await this.logBookingActivity(bookingId, 'extended', userId, {
      additional_minutes: additionalMinutes,
      new_end_time: newEndTime.toISOString(),
    });

    return updatedBooking!;
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string, userId?: string): Promise<void> {
    const { data: booking, error } = await this.supabase
      .from('bookings')
      .select()
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'cancelled' || booking.status === 'ended' || booking.status === 'no_show') {
      throw new Error('Cannot cancel a completed or no-show booking');
    }

    // Update booking status in database first and verify it succeeded
    const { data: updatedBooking, error: updateError } = await this.supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError || !updatedBooking) {
      throw new Error(`Failed to update booking status to cancelled: ${updateError?.message || 'Unknown error'}`);
    }

    // Verify the status was actually set to 'cancelled' before proceeding
    if (updatedBooking.status !== 'cancelled') {
      throw new Error('Booking status was not properly updated to cancelled');
    }

    // Delete Google Calendar event to immediately free up the room
    if (booking.google_event_id && booking.google_calendar_id) {
      try {
        await this.googleCalendar.deleteEvent(
          booking.google_calendar_id,
          booking.google_event_id
        );
      } catch (error) {
        console.error('Failed to delete calendar event on cancellation:', error);
        // The database is already updated, so the booking is cancelled even if Google fails
      }
    }

    // Log activity
    await this.logBookingActivity(bookingId, 'cancelled', userId);
  }

  /**
   * Check in to a booking
   */
  async checkInBooking(bookingId: string, userId?: string): Promise<Booking> {
    // Fetch current status first so we can enforce valid transitions
    const { data: existing, error: fetchError } = await this.supabase
      .from('bookings')
      .select()
      .eq('id', bookingId)
      .single();

    if (fetchError || !existing) {
      throw new Error('Booking not found');
    }

    if (existing.status === 'cancelled' || existing.status === 'ended' || existing.status === 'no_show') {
      throw new Error('Cannot check in to a cancelled, ended, or no-show booking');
    }

    const { data: booking, error } = await this.supabase
      .from('bookings')
      .update({
        status: 'in_progress',
        check_in_time: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (error || !booking) {
      throw new Error('Failed to check in');
    }

    await this.logBookingActivity(bookingId, 'checked_in', userId);

    return booking;
  }

  /**
   * End a booking early
   */
  async endBookingEarly(bookingId: string, userId?: string): Promise<void> {
    // Get booking with room details to access timezone
    const { data: booking, error } = await this.supabase
      .from('bookings')
      .select('*, room:rooms(*, location:locations(*))')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'cancelled' || booking.status === 'ended' || booking.status === 'no_show') {
      throw new Error('Cannot end a cancelled, ended, or no-show booking');
    }

    const now = new Date();
    const startTime = new Date(booking.start_time);
    
    // Ensure end_time is always after start_time to satisfy the valid_time_range constraint
    // If ending before the booking started, set end_time to 1 minute after start
    const endTime = now > startTime ? now : new Date(startTime.getTime() + 60 * 1000);

    // Update booking in database first and verify it succeeded
    const { data: updatedBooking, error: updateError } = await this.supabase
      .from('bookings')
      .update({
        end_time: endTime.toISOString(),
        status: 'ended',
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError || !updatedBooking) {
      throw new Error(`Failed to update booking status to ended: ${updateError?.message || 'Unknown error'}`);
    }

    // Verify the status was actually set to 'ended' before proceeding
    if (updatedBooking.status !== 'ended') {
      throw new Error('Booking status was not properly updated to ended');
    }

    // Update Google Calendar event to free up the room immediately
    if (booking.google_event_id && booking.google_calendar_id) {
      try {
        const timezone = booking.room?.location?.timezone || 'UTC';
        await this.googleCalendar.updateEvent(
          booking.google_calendar_id,
          booking.google_event_id,
          {
            end: {
              dateTime: endTime.toISOString(),
              timeZone: timezone,
            },
          }
        );
      } catch (error) {
        // Log error but don't fail the release - the database is already updated
        console.error('Failed to update Google Calendar event on early release:', error);
        // Optionally: try to delete the event as a fallback
        try {
          await this.googleCalendar.deleteEvent(
            booking.google_calendar_id,
            booking.google_event_id
          );
        } catch (deleteError) {
          console.error('Failed to delete Google Calendar event as fallback:', deleteError);
        }
      }
    }

    await this.logBookingActivity(bookingId, 'ended_early', userId);
  }

  /**
   * Check room availability
   */
  private async checkRoomAvailability(
    calendarId: string | null,
    startTime: string,
    endTime: string
  ): Promise<{ isAvailable: boolean; conflicts: Array<{ start: string; end: string }> }> {
    if (!calendarId) {
      return { isAvailable: true, conflicts: [] };
    }

    const freeBusy = await this.googleCalendar.checkFreeBusy(
      [calendarId],
      startTime,
      endTime
    );

    const calendar = freeBusy.calendars?.[calendarId];
    const busyTimes = calendar?.busy || [];

    return {
      isAvailable: busyTimes.length === 0,
      conflicts: busyTimes.map(b => ({
        start: b.start!,
        end: b.end!,
      })),
    };
  }

  /**
   * Get max booking duration from settings
   */
  private async getMaxBookingDuration(): Promise<number> {
    const { data } = await this.supabase
      .from('settings')
      .select()
      .eq('key', 'max_booking_duration_minutes')
      .eq('scope', 'global')
      .single();

    const raw = data?.value;
    const asNumber =
      typeof raw === 'number' ? raw : Number(typeof raw === 'string' ? raw : NaN);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : 240; // Default 4 hours
  }

  /**
   * Get the no-show grace window (in minutes) from settings, defaulting to 10.
   */
  private async getNoShowGraceMinutes(): Promise<number> {
    const { data } = await this.supabase
      .from('settings')
      .select()
      .eq('key', 'no_show_grace_minutes')
      .eq('scope', 'global')
      .maybeSingle();

    const raw = data?.value;
    const asNumber =
      typeof raw === 'number' ? raw : Number(typeof raw === 'string' ? raw : NaN);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : 10;
  }

  /**
   * Log booking activity
   */
  private async logBookingActivity(
    bookingId: string,
    action: string,
    userId?: string | null,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.supabase.from('booking_activity_log').insert({
      booking_id: bookingId,
      action,
      performed_by_user_id: userId,
      metadata: metadata || {},
    });
  }

  /**
   * Find bookings that are 30+ minutes past their end time and haven't received
   * a reminder email yet. Only includes bookings with a host (someone to email).
   */
  async findOverdueBookings(): Promise<Array<{
    id: string;
    room_id: string;
    host_user_id: string;
    title: string;
    start_time: string;
    end_time: string;
    room: { id: string; name: string; google_calendar_id: string | null; google_resource_id: string | null; location: { timezone: string } };
    host: { id: string; name: string; email: string };
  }>> {
    const overdueMinutes = 30;
    const cutoff = new Date(Date.now() - overdueMinutes * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('bookings')
      .select(`
        id,
        room_id,
        host_user_id,
        title,
        start_time,
        end_time,
        room:rooms!inner(
          id,
          name,
          google_calendar_id,
          google_resource_id,
          location:locations!inner(timezone)
        ),
        host:users!inner(id, name, email)
      `)
      .in('status', ['in_progress', 'scheduled'])
      .is('overdue_reminder_sent_at', null)
      .not('host_user_id', 'is', null)
      .lte('end_time', cutoff)
      .limit(50);

    if (error) {
      console.error('Failed to find overdue bookings:', error);
      throw new Error(`Failed to find overdue bookings: ${error.message}`);
    }

    return (data || []) as any;
  }

  /**
   * Mark a booking as having received an overdue reminder and store the action token
   */
  async markOverdueReminderSent(bookingId: string, actionToken: string): Promise<void> {
    const { error } = await this.supabase
      .from('bookings')
      .update({
        overdue_reminder_sent_at: new Date().toISOString(),
        action_token: actionToken,
      })
      .eq('id', bookingId);

    if (error) {
      throw new Error(`Failed to mark reminder sent: ${error.message}`);
    }
  }

  /**
   * Get a booking by its action token (for email action links)
   */
  async getBookingByActionToken(token: string): Promise<{
    booking: Booking & { room: Room & { location: { timezone: string } }; host: User | null };
  } | null> {
    const { data, error } = await this.supabase
      .from('bookings')
      .select(`
        *,
        room:rooms!inner(*, location:locations!inner(timezone)),
        host:users(*)
      `)
      .eq('action_token', token)
      .single();

    if (error || !data) {
      return null;
    }

    return { booking: data as any };
  }

  /**
   * Check if a room can be extended by the given minutes
   * Returns the next conflicting event details if there's a conflict
   */
  async checkExtensionAvailability(
    bookingId: string,
    additionalMinutes: number
  ): Promise<{
    canExtend: boolean;
    conflict?: {
      start: string;
      end: string;
      title?: string;
      organizer?: string;
    };
  }> {
    const { data: booking, error } = await this.supabase
      .from('bookings')
      .select('*, room:rooms!inner(google_calendar_id, google_resource_id)')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new Error('Booking not found');
    }

    const currentEndTime = new Date(booking.end_time);
    const newEndTime = new Date(currentEndTime.getTime() + additionalMinutes * 60 * 1000);
    
    const calendarId = booking.room.google_calendar_id || booking.room.google_resource_id;
    
    if (!calendarId) {
      // No Google calendar linked - allow extension
      return { canExtend: true };
    }

    // Check for conflicts
    const availability = await this.checkRoomAvailability(
      calendarId,
      currentEndTime.toISOString(),
      newEndTime.toISOString()
    );

    if (availability.isAvailable) {
      return { canExtend: true };
    }

    // Get more details about the conflict
    const nextConflict = availability.conflicts[0];
    if (nextConflict) {
      // Try to get event details from the next booking in our system
      const { data: nextBooking } = await this.supabase
        .from('bookings')
        .select('title, host:users(name, email)')
        .eq('room_id', booking.room_id)
        .gt('start_time', booking.end_time)
        .lte('start_time', newEndTime.toISOString())
        .in('status', ['scheduled', 'in_progress'])
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle();

      return {
        canExtend: false,
        conflict: {
          start: nextConflict.start,
          end: nextConflict.end,
          title: nextBooking?.title,
          organizer: (nextBooking?.host as any)?.name || (nextBooking?.host as any)?.email,
        },
      };
    }

    return { canExtend: false };
  }

  /**
   * Invalidate the action token for a booking (after it's been used)
   */
  async invalidateActionToken(bookingId: string): Promise<void> {
    await this.supabase
      .from('bookings')
      .update({ action_token: null })
      .eq('id', bookingId);
  }
}

// Singleton
let bookingService: BookingService;

export function getBookingService(): BookingService {
  if (!bookingService) {
    bookingService = new BookingService();
  }
  return bookingService;
}

