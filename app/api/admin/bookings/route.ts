import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = getServerAdminClient();
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const search = searchParams.get('search') || '';
    const statusParam = searchParams.get('status') || '';
    const sourceParam = searchParams.get('source') || '';
    const roomIdParam = searchParams.get('room_id') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    // Parse comma-separated filter values into arrays
    const statuses = statusParam ? statusParam.split(',').filter(Boolean) : [];
    const sources = sourceParam ? sourceParam.split(',').filter(Boolean) : [];
    const roomIds = roomIdParam ? roomIdParam.split(',').filter(Boolean) : [];

    // Load deleted Google events so they never appear in the admin list
    const { data: deletedEvents, error: deletedError } = await supabase
      .from('deleted_google_events')
      .select('google_event_id');
    if (deletedError) {
      console.log('Failed to load deleted Google events:', deletedError.message);
    }
    const deletedEventIds = (deletedEvents || [])
      .map((d) => d.google_event_id)
      .filter((id): id is string => Boolean(id));

    // Build query
    let query = supabase
      .from('bookings')
      .select(
        `
        *,
        room:rooms(id, name, location:locations(id, name)),
        host:users(id, name, email)
      `,
        { count: 'exact' }
      )
      .order('start_time', { ascending: false });

    if (deletedEventIds.length > 0) {
      const inFilter = `(${deletedEventIds
        .map((id) => `"${id.replace(/"/g, '\\"')}"`)
        .join(',')})`;
      query = query.not('google_event_id', 'in', inFilter);
    }

    // Apply filters (support multiple values via .in())
    if (statuses.length === 1) {
      query = query.eq('status', statuses[0]);
    } else if (statuses.length > 1) {
      query = query.in('status', statuses);
    }

    if (sources.length === 1) {
      query = query.eq('source', sources[0]);
    } else if (sources.length > 1) {
      query = query.in('source', sources);
    }

    if (roomIds.length === 1) {
      query = query.eq('room_id', roomIds[0]);
    } else if (roomIds.length > 1) {
      query = query.in('room_id', roomIds);
    }

    if (startDate) {
      query = query.gte('start_time', startDate);
    }

    if (endDate) {
      query = query.lte('start_time', endDate);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: bookings, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    // If search term provided, filter in memory (for cross-field search)
    let filteredBookings = bookings || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredBookings = filteredBookings.filter((booking: any) => {
        const titleMatch = booking.title?.toLowerCase().includes(searchLower);
        const hostMatch = booking.host?.name?.toLowerCase().includes(searchLower);
        const hostEmailMatch = booking.host?.email?.toLowerCase().includes(searchLower);
        const roomMatch = booking.room?.name?.toLowerCase().includes(searchLower);
        const organizerMatch = booking.organizer_email?.toLowerCase().includes(searchLower);
        return titleMatch || hostMatch || hostEmailMatch || roomMatch || organizerMatch;
      });
    }

    // For bookings without a host, try to look up the user by organizer_email
    if (filteredBookings.length > 0) {
      const organizerEmails = filteredBookings
        .filter((b: any) => !b.host && b.organizer_email)
        .map((b: any) => b.organizer_email as string);

      if (organizerEmails.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('email, name')
          .in('email', organizerEmails);

        if (users && users.length > 0) {
          const emailToUser: Record<string, { name: string; email: string }> = {};
          for (const user of users) {
            emailToUser[user.email] = { name: user.name, email: user.email };
          }

          // Populate host for bookings that don't have one but have a matching organizer_email
          for (const booking of filteredBookings) {
            if (!booking.host && booking.organizer_email && emailToUser[booking.organizer_email]) {
              booking.host = emailToUser[booking.organizer_email];
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: filteredBookings,
      pagination: {
        page,
        limit,
        total: search ? filteredBookings.length : (count || 0),
        totalPages: Math.ceil((search ? filteredBookings.length : (count || 0)) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
