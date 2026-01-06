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

    const { getServerAdminClient } = await import('@/lib/supabase/server');
    const supabase = getServerAdminClient();

    if (roomId) {
      // Refresh this room's bookings from Google so calendars and tablets show
      // up-to-date events including meetings created directly in Google.
      try {
        await syncRoomFromGoogle(roomId);
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

    let query = supabase
      .from('bookings')
      .select('*, room:rooms(*, location:locations(*)), host:users(*)')
      .order('start_time', { ascending: false });

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

    const { data, error } = await query.limit(100);

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

