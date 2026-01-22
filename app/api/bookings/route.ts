import { NextRequest, NextResponse } from 'next/server';
import { getBookingService } from '@/lib/services/booking.service';
import { syncRoomFromGoogle } from '@/lib/services/google-sync.service';
import { CreateBookingSchema } from '@/lib/types/api.types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = CreateBookingSchema.parse(body);

    const bookingService = getBookingService();

    // Check if this is a recurring booking request
    if (validatedData.is_recurring && validatedData.recurrence_rule && validatedData.recurrence_end_date) {
      // Create recurring booking
      const result = await bookingService.createRecurringBooking({
        ...validatedData,
        is_recurring: true,
        recurrence_rule: validatedData.recurrence_rule,
        recurrence_end_date: validatedData.recurrence_end_date,
      });

      return NextResponse.json({
        success: true,
        data: {
          parent: result.parent,
          occurrences: result.occurrences,
          total_occurrences: result.occurrences.length + 1,
        },
      }, { status: 201 });
    }

    // Create regular single booking
    const booking = await bookingService.createBooking(validatedData);

    return NextResponse.json({ success: true, data: booking }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'BOOKING_ERROR', message: error.message } },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get('room_id');
    const userId = searchParams.get('user_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const forceSync = searchParams.get('force_sync') === 'true';

    const { getServerAdminClient } = await import('@/lib/supabase/server');
    const supabase = getServerAdminClient();

    // Load deleted Google events so they never appear in booking lists
    const { data: deletedEvents, error: deletedError } = await supabase
      .from('deleted_google_events')
      .select('google_event_id');
    if (deletedError) {
      console.log('Failed to load deleted Google events:', deletedError.message);
    }
    const deletedEventIds = (deletedEvents || [])
      .map((d) => d.google_event_id)
      .filter((id): id is string => Boolean(id));

    if (roomId) {
      // Check if there are any recently created tablet bookings that are already
      // in_progress (auto-checked-in). Skip sync to prevent race conditions where
      // Google Calendar sync might interfere with the freshly created booking state.
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recentlyCreatedTablet } = await supabase
        .from('bookings')
        .select('id')
        .eq('room_id', roomId)
        .eq('status', 'in_progress')
        .eq('source', 'tablet')
        .gte('created_at', twoMinutesAgo)
        .limit(1);

      const shouldSkipSync = recentlyCreatedTablet && recentlyCreatedTablet.length > 0;

      // Refresh this room's bookings from Google so calendars and tablets show
      // up-to-date events including meetings created directly in Google.
      // Skip if we just created a tablet booking to prevent race conditions.
      if (!shouldSkipSync) {
        try {
          await syncRoomFromGoogle(roomId, { force: forceSync });
        } catch (e: any) {
          console.error('Failed to sync room from Google (non-fatal)', {
            roomId,
            message: e?.message,
            code: e?.code,
            status: e?.status,
            details: e,
          });
        }
      }
    }

    let query = supabase
      .from('bookings')
      .select('*, room:rooms(*, location:locations(*)), host:users(*)')
      .order('start_time', { ascending: false });

    if (deletedEventIds.length > 0) {
      const inFilter = `(${deletedEventIds
        .map((id) => `"${id.replace(/"/g, '\\"')}"`)
        .join(',')})`;
      query = query.not('google_event_id', 'in', inFilter);
    }

    if (roomId) {
      query = query.eq('room_id', roomId);
    }

    if (userId) {
      query = query.eq('host_user_id', userId);
    }

    // Time filtering semantics:
    // - If both start_date and end_date are provided, return bookings whose
    //   time range OVERLAPS the given window:
    //     booking.end_time   >= start_date
    //     AND booking.start_time <= end_date
    // - If only start_date is provided, return bookings that end at or after it.
    // - If only end_date is provided, return bookings that start at or before it.
    if (startDate && endDate) {
      query = query
        .gte('end_time', startDate)
        .lte('start_time', endDate);
    } else if (startDate) {
      query = query.gte('end_time', startDate);
    } else if (endDate) {
      query = query.lte('start_time', endDate);
    }

    // Allow custom limit via query param, default to 100, use 0 for no limit
    const limitParam = searchParams.get('limit');
    const limit = limitParam === '0' ? null : (parseInt(limitParam || '100', 10) || 100);
    
    const { data, error } = limit ? await query.limit(limit) : await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    // For bookings without a host, try to look up the user by organizer_email
    // to populate host information (useful for GCal-synced events)
    if (data && data.length > 0) {
      const organizerEmails = data
        .filter((b: any) => !b.host && b.organizer_email)
        .map((b: any) => b.organizer_email as string);
      
      if (organizerEmails.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('email, name')
          .in('email', organizerEmails);
        
        if (users && users.length > 0) {
          const emailToUser: Record<string, { name: string }> = {};
          for (const user of users) {
            emailToUser[user.email] = { name: user.name };
          }
          
          // Populate host for bookings that don't have one but have a matching organizer_email
          for (const booking of data) {
            if (!booking.host && booking.organizer_email && emailToUser[booking.organizer_email]) {
              booking.host = emailToUser[booking.organizer_email];
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

