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
    const { data: inProgressBooking } = await supabase
      .from('bookings')
      .select('*, host:users(name)')
      .eq('room_id', roomId)
      .eq('status', 'in_progress')
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    const currentBooking = inProgressBooking || null;

    // Get upcoming scheduled bookings, including ones that started within the last 15 minutes
    const graceMinutes = 15;
    const windowStart = new Date(now.getTime() - graceMinutes * 60 * 1000).toISOString();

    const { data: scheduledBookings } = await supabase
      .from('bookings')
      .select('*, host:users(name)')
      .eq('room_id', roomId)
      .eq('status', 'scheduled')
      .gte('start_time', windowStart)
      .order('start_time', { ascending: true });

    let upcomingBookings = scheduledBookings || [];

    // Auto-cancel the first scheduled booking if it's more than 10 minutes past its start time
    if (upcomingBookings.length > 0) {
      const first = upcomingBookings[0];
      const startTime = new Date(first.start_time);
      const diffMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);

      if (diffMinutes > graceMinutes) {
        try {
          await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', first.id);
        } catch (e) {
          console.error('Failed to auto-cancel stale booking', e);
        }
        // Remove it from upcoming list
        upcomingBookings = upcomingBookings.slice(1);
      }
    }

    const isOccupied = !!currentBooking;
    let availableUntil: string | null = null;

    if (!isOccupied && upcomingBookings && upcomingBookings.length > 0) {
      // Available until the next booking
      availableUntil = upcomingBookings[0].start_time;
    }

    // Unified UI state for all clients (tablet, web, maps)
    let uiState: RoomStatusResponse['ui_state'] = isOccupied ? 'busy' : 'free';

    if (!isOccupied && upcomingBookings && upcomingBookings.length > 0) {
      const next = new Date(upcomingBookings[0].start_time);
      const diffMinutes = (next.getTime() - now.getTime()) / (1000 * 60);

      // Within ±10 minutes of the next booking start => check-in window (yellow)
      if (diffMinutes >= -10 && diffMinutes <= 10) {
        uiState = 'checkin';
      }
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
      ui_state: uiState,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

