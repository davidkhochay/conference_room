import { getServerAdminClient } from '../supabase/server';
import { getGoogleCalendarService } from './google-calendar.service';
import { Booking, Room, User } from '../types/database.types';
import { CreateBookingRequest, QuickBookingRequest } from '../types/api.types';

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
    const availability = await this.checkRoomAvailability(
      room.google_calendar_id || room.google_resource_id,
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
    try {
      const calendarId = room.google_calendar_id || room.google_resource_id;
      
      if (calendarId) {
        const event = await this.googleCalendar.createEvent(calendarId, {
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
          attendees: room.google_resource_id ? [{ email: room.google_resource_id, resource: true }] : [],
        });

        // Update booking with Google event ID
        await this.supabase
          .from('bookings')
          .update({
            google_event_id: event.id,
            google_calendar_id: calendarId,
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
    const availability = await this.checkRoomAvailability(
      room.google_calendar_id || room.google_resource_id,
      request.start_time,
      request.end_time
    );

    if (!availability.isAvailable) {
      throw new Error('Room is not available for the requested time');
    }

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
        status: 'scheduled',
        attendee_emails: request.attendee_emails || [],
      })
      .select()
      .single();

    if (bookingError || !booking) {
      throw new Error('Failed to create booking');
    }

    // Get host details if available
    let host: User | null = null;
    if (request.host_user_id) {
      const { data: hostData } = await this.supabase
        .from('users')
        .select()
        .eq('id', request.host_user_id)
        .single();
      host = hostData;
    }

    // Create Google Calendar event (optional - booking works without it)
    try {
      const calendarId = room.google_calendar_id || room.google_resource_id;
      
      if (calendarId) {
        const attendees = [
          ...(request.attendee_emails || []).map(email => ({ email })),
        ];

        if (room.google_resource_id) {
          attendees.push({ email: room.google_resource_id, resource: true });
        }

        const event = await this.googleCalendar.createEvent(calendarId, {
          summary: request.title || 'Conference Room Booking',
          description: request.description || `Booked via Good Life Room Booking\nRoom: ${room.name}\nHost: ${host?.name || 'N/A'}`,
          start: {
            dateTime: request.start_time,
            timeZone: room.location.timezone,
          },
          end: {
            dateTime: request.end_time,
            timeZone: room.location.timezone,
          },
          attendees,
        });

        // Update booking with event ID
        await this.supabase
          .from('bookings')
          .update({
            google_event_id: event.id,
            google_calendar_id: calendarId,
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

    if (booking.status === 'ended' || booking.status === 'cancelled') {
      throw new Error('Cannot extend a completed or cancelled booking');
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
    const { data: booking } = await this.supabase
      .from('bookings')
      .select()
      .eq('id', bookingId)
      .single();

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Update booking status
    await this.supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);

    // Delete Google Calendar event
    if (booking.google_event_id && booking.google_calendar_id) {
      try {
        await this.googleCalendar.deleteEvent(
          booking.google_calendar_id,
          booking.google_event_id
        );
      } catch (error) {
        console.error('Failed to delete calendar event:', error);
      }
    }

    // Log activity
    await this.logBookingActivity(bookingId, 'cancelled', userId);
  }

  /**
   * Check in to a booking
   */
  async checkInBooking(bookingId: string, userId?: string): Promise<Booking> {
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
    const { data: booking } = await this.supabase
      .from('bookings')
      .select()
      .eq('id', bookingId)
      .single();

    if (!booking) {
      throw new Error('Booking not found');
    }

    const now = new Date();

    // Update booking
    await this.supabase
      .from('bookings')
      .update({
        end_time: now.toISOString(),
        status: 'ended',
      })
      .eq('id', bookingId);

    // Update Google Calendar event
    if (booking.google_event_id && booking.google_calendar_id) {
      await this.googleCalendar.updateEvent(
        booking.google_calendar_id,
        booking.google_event_id,
        {
          end: {
            dateTime: now.toISOString(),
            timeZone: 'UTC',
          },
        }
      );
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

    return data?.value || 240; // Default 4 hours
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
}

// Singleton
let bookingService: BookingService;

export function getBookingService(): BookingService {
  if (!bookingService) {
    bookingService = new BookingService();
  }
  return bookingService;
}

