import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';
import { RoomStatusResponse } from '@/lib/types/api.types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const supabase = getServerAdminClient();

    // Get room details
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*, location:locations(*)')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { success: false, error: { error: 'NOT_FOUND', message: 'Room not found' } },
        { status: 404 }
      );
    }

    const now = new Date();

    // Prefer any in-progress booking (checked-in) as the current booking,
    // regardless of its original start time.
    const { data: inProgressBooking, error: inProgressError } = await supabase
      .from('bookings')
      .select('*, host:users(name)')
      .eq('room_id', roomId)
      .eq('status', 'in_progress')
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    let currentBooking = inProgressBooking || null;

    // If nothing is in-progress, fall back to time-window based current booking
    if (!currentBooking && !inProgressError) {
      const { data: timedBooking } = await supabase
        .from('bookings')
        .select('*, host:users(name)')
        .eq('room_id', roomId)
        .lte('start_time', now.toISOString())
        .gte('end_time', now.toISOString())
        .in('status', ['scheduled'])
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle();

      currentBooking = timedBooking || null;
    }

    // Get upcoming bookings (next 5) – scheduled only, exclude current
    const { data: upcomingBookings } = await supabase
      .from('bookings')
      .select('*, host:users(name)')
      .eq('room_id', roomId)
      .gt('start_time', now.toISOString())
      .eq('status', 'scheduled')
      .order('start_time', { ascending: true })
      .limit(5);

    const isOccupied = !!currentBooking;
    let availableUntil: string | null = null;

    if (!isOccupied && upcomingBookings && upcomingBookings.length > 0) {
      // Available until the next booking
      availableUntil = upcomingBookings[0].start_time;
    }

    const response: RoomStatusResponse = {
      room_id: room.id,
      room_name: room.name,
      location_name: room.location.name,
      photo_url: room.photo_url,
      capacity: room.capacity,
      features: {
        tv: room.features?.tv ?? false,
        whiteboard: room.features?.whiteboard ?? false,
      },
      is_occupied: isOccupied,
      current_booking: currentBooking
        ? {
            id: currentBooking.id,
            title: currentBooking.title,
            host_name: currentBooking.host?.name || null,
            start_time: currentBooking.start_time,
            end_time: currentBooking.end_time,
          }
        : null,
      next_bookings:
        upcomingBookings?.map((b) => ({
          id: b.id,
          title: b.title,
          host_name: b.host?.name || null,
          start_time: b.start_time,
          end_time: b.end_time,
        })) || [],
      available_until: availableUntil,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

