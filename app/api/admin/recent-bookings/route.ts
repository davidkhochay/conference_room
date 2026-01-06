import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';
import { getBookingService } from '@/lib/services/booking.service';

export async function GET(request: NextRequest) {
  try {
    const supabase = getServerAdminClient();

    // Keep recent bookings in sync with tablet / room status by marking any
    // stale, never-checked-in bookings as no-shows before we query.
    const bookingService = getBookingService();
    await bookingService.markNoShows();

    // Focus on bookings around "now" so the dashboard reflects real usage
    // Show bookings from 24h ago to 7 days in the future
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('bookings')
      .select('*, room:rooms(name), host:users(name)')
      .gte('start_time', since)
      .lte('start_time', until)
      .order('start_time', { ascending: true })
      .limit(50);

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

