import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';
import { getGoogleCalendarService } from '@/lib/services/google-calendar.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    const supabase = getServerAdminClient();

    // Fetch booking with all related information
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        room:rooms(
          *,
          location:locations(*)
        ),
        host:users(*)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { success: false, error: { error: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Fetch activity log for this booking
    const { data: activityLog, error: activityError } = await supabase
      .from('booking_activity_log')
      .select(`
        *,
        performed_by:users(name, email)
      `)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (activityError) {
      console.error('Failed to fetch activity log:', activityError);
    }

    let organizer: { name: string; email: string } | null = null;
    if (!booking.host && booking.organizer_email) {
      const { data: organizerUser } = await supabase
        .from('users')
        .select('name, email')
        .eq('email', booking.organizer_email)
        .single();
      
      if (organizerUser) {
        organizer = organizerUser;
      }
    }

  // Refresh attendee response statuses from Google for the latest RSVP state
  let attendeeResponseStatuses = booking.attendee_response_statuses || {};
  if (booking.google_event_id && booking.google_calendar_id) {
    try {
      const googleCalendar = getGoogleCalendarService();
      const event = await googleCalendar.getEvent(
        booking.google_calendar_id,
        booking.google_event_id
      );
      const attendees = event.attendees || [];
      const responseMap: Record<string, string> = {};
      const attendeeEmails: string[] = [];
      attendees.forEach((a) => {
        if (!a.email || a.resource) return;
        attendeeEmails.push(String(a.email));
        responseMap[String(a.email)] = String(a.responseStatus || 'needsAction');
      });
      attendeeResponseStatuses = responseMap;

      // Persist the latest RSVP data so list views can use it without live fetches.
      await supabase
        .from('bookings')
        .update({
          attendee_emails: attendeeEmails.length ? attendeeEmails : booking.attendee_emails || [],
          attendee_response_statuses: responseMap,
        })
        .eq('id', bookingId);
    } catch (e: any) {
      console.warn('Failed to refresh attendee response statuses:', e?.message || e);
    }
  }

    const response = {
      ...booking,
      activity_log: activityLog || [],
      organizer,
    attendee_response_statuses: attendeeResponseStatuses,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error: any) {
    console.error('Failed to fetch booking details:', error);
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    const supabase = getServerAdminClient();
    const body = await request.json();

    const { data: existingBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('*, room:rooms(*, location:locations(*))')
      .eq('id', bookingId)
      .single();

    if (fetchError || !existingBooking) {
      return NextResponse.json(
        { success: false, error: { error: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    const allowedFields = ['title', 'description', 'start_time', 'end_time', 'status'];
    const updates: Record<string, any> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: { error: 'NO_UPDATES', message: 'No valid fields to update' } },
        { status: 400 }
      );
    }

    if (updates.start_time || updates.end_time) {
      const startTime = new Date(updates.start_time || existingBooking.start_time);
      const endTime = new Date(updates.end_time || existingBooking.end_time);

      if (endTime <= startTime) {
        return NextResponse.json(
          { success: false, error: { error: 'INVALID_TIME', message: 'End time must be after start time' } },
          { status: 400 }
        );
      }
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)
      .select('*, room:rooms(*, location:locations(*)), host:users(*)')
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: { error: 'UPDATE_ERROR', message: updateError.message } },
        { status: 500 }
      );
    }

    if (existingBooking.google_event_id && existingBooking.google_calendar_id) {
      const googleCalendar = getGoogleCalendarService();
      try {
        const eventUpdates: Record<string, any> = {};

        if (updates.title) eventUpdates.summary = updates.title;
        if (updates.description !== undefined) eventUpdates.description = updates.description;
        if (updates.start_time) {
          eventUpdates.start = {
            dateTime: updates.start_time,
            timeZone: existingBooking.room?.location?.timezone || 'UTC',
          };
        }
        if (updates.end_time) {
          eventUpdates.end = {
            dateTime: updates.end_time,
            timeZone: existingBooking.room?.location?.timezone || 'UTC',
          };
        }

        if (Object.keys(eventUpdates).length > 0) {
          await googleCalendar.updateEvent(
            existingBooking.google_calendar_id,
            existingBooking.google_event_id,
            eventUpdates
          );
        }
      } catch (gcalError) {
        console.error('Failed to update Google Calendar event:', gcalError);
      }
    }

    await supabase.from('booking_activity_log').insert({
      booking_id: bookingId,
      action: 'created',
      performed_by_user_id: null,
      metadata: { action_type: 'admin_edit', updates: Object.keys(updates) },
    });

    return NextResponse.json({ success: true, data: updatedBooking });
  } catch (error: any) {
    console.error('Failed to update booking:', error);
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    const supabase = getServerAdminClient();

    const { data: existingBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('google_event_id, google_calendar_id')
      .eq('id', bookingId)
      .single();

    if (fetchError || !existingBooking) {
      return NextResponse.json(
        { success: false, error: { error: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Track this deletion to prevent re-sync from Google Calendar
    // We intentionally do NOT delete from Google Calendar - user requested to just remove
    // from our system without affecting Google Calendar. The event will stay in Google
    // but won't be synced back to our bookings.
    if (existingBooking.google_event_id) {
      try {
        await supabase.from('deleted_google_events').upsert({
          google_event_id: existingBooking.google_event_id,
          google_calendar_id: existingBooking.google_calendar_id,
          deleted_at: new Date().toISOString(),
        }, { onConflict: 'google_event_id,google_calendar_id' });
        console.log('Tracked deleted Google event:', existingBooking.google_event_id);
      } catch (e: any) {
        console.log('Could not track deleted Google event:', e.message);
      }
    }

    await supabase.from('booking_activity_log').delete().eq('booking_id', bookingId);

    const { data: deletedRows, error: deleteError, count } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId)
      .select('id');

    if (deleteError) {
      console.error('DELETE ERROR:', deleteError);
      return NextResponse.json(
        { success: false, error: { error: 'DELETE_ERROR', message: deleteError.message } },
        { status: 500 }
      );
    }
    
    console.log(`DELETED booking ${bookingId}, rows affected:`, deletedRows?.length || 0);

    return NextResponse.json({ success: true, data: null });
  } catch (error: any) {
    console.error('Failed to delete booking:', error);
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
