import { NextRequest, NextResponse } from 'next/server';
import { getBookingService } from '@/lib/services/booking.service';
import { CreateBookingSchema } from '@/lib/types/api.types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = CreateBookingSchema.parse(body);

    const bookingService = getBookingService();
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

    if (startDate) {
      query = query.gte('start_time', startDate);
    }

    if (endDate) {
      query = query.lte('end_time', endDate);
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

