import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = getServerAdminClient();

    // Get counts for each entity
    const [
      companiesResult,
      locationsResult,
      roomsResult,
      usersResult,
      bookingsResult,
      noShowResult,
    ] = await Promise.all([
      supabase.from('companies').select('id', { count: 'exact', head: true }),
      supabase.from('locations').select('id', { count: 'exact', head: true }),
      supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('bookings').select('id', { count: 'exact', head: true }),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'no_show'),
    ]);

    const stats = {
      companies: companiesResult.count || 0,
      locations: locationsResult.count || 0,
      rooms: roomsResult.count || 0,
      users: usersResult.count || 0,
      bookings: bookingsResult.count || 0,
      no_shows: noShowResult.count || 0,
    };

    return NextResponse.json({ success: true, data: stats });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

