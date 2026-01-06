import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';
import { getBookingService } from '@/lib/services/booking.service';
import { syncRoomFromGoogle } from '@/lib/services/google-sync.service';
import { RoomStatusResponse } from '@/lib/types/api.types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const forceSync = searchParams.get('force_sync') === 'true';
    const supabase = getServerAdminClient();

    // Check if there are any recently ended or cancelled bookings for this room.
    // If so, skip the sync to avoid race conditions where Google Calendar hasn't
    // propagated the deletion yet and would overwrite our local status.
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: recentlyEnded } = await supabase
      .from('bookings')
      .select('id')
      .eq('room_id', roomId)
      .in('status', ['ended', 'cancelled'])
      .gte('updated_at', twoMinutesAgo)
      .limit(1);

    const shouldSkipSync = recentlyEnded && recentlyEnded.length > 0;

    // Opportunistically refresh bookings for this room from Google Calendar so
    // tablets and maps see Google‑originated meetings as well.
    // Skip if we just ended/cancelled a booking to prevent race conditions.
    if (!shouldSkipSync) {
      try {
        await syncRoomFromGoogle(roomId, { force: forceSync });
      } catch (e) {
        console.error('Failed to sync room from Google (non-fatal):', e);
      }
    }

    // Opportunistically mark any stale bookings for this room as no-shows so
    // tablets and other clients see an up-to-date status without waiting for
    // the global job or cron to run.
    const bookingService = getBookingService();
    await bookingService.markNoShows({ roomId });

    // Get room details (including pin_code for checked-in users)
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

    // Get upcoming scheduled bookings, including ones that started within the last
    // 10 minutes. The same 10 minute window is used by the no-show scanner.
    const graceMinutes = 10;
    const windowStart = new Date(now.getTime() - graceMinutes * 60 * 1000).toISOString();

    const { data: scheduledBookings } = await supabase
      .from('bookings')
      .select('*, host:users(name)')
      .eq('room_id', roomId)
      .eq('status', 'scheduled')
      .gte('start_time', windowStart)
      .order('start_time', { ascending: true });

    let upcomingBookings = scheduledBookings || [];

    // Auto-cancel the first scheduled booking as a no-show if it's more than
    // `graceMinutes` past its start time without a check-in.
    if (upcomingBookings.length > 0) {
      const first = upcomingBookings[0];
      const startTime = new Date(first.start_time);
      const diffMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);

      if (diffMinutes > graceMinutes) {
        try {
          // Mark booking as a no-show
          await supabase
            .from('bookings')
            .update({ status: 'no_show' })
            .eq('id', first.id);

          // Log to booking activity for analytics/audit
          await supabase.from('booking_activity_log').insert({
            booking_id: first.id,
            action: 'no_show',
            performed_by_user_id: null,
            metadata: {
              reason: 'auto_no_checkin',
              grace_minutes: graceMinutes,
            },
          });
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

    // Look up user names by organizer_email for bookings without a host
    const allBookings = [currentBooking, ...upcomingBookings].filter(Boolean);
    const organizerEmails = allBookings
      .filter((b) => !b.host?.name && b.organizer_email)
      .map((b) => b.organizer_email as string);
    
    const emailToName: Record<string, string> = {};
    if (organizerEmails.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('email, name')
        .in('email', organizerEmails);
      
      if (users) {
        for (const user of users) {
          emailToName[user.email] = user.name;
        }
      }
    }

    // Helper to resolve the display name for a booking
    const getHostName = (booking: typeof currentBooking) => {
      if (!booking) return null;
      if (booking.host?.name) return booking.host.name;
      if (booking.organizer_email && emailToName[booking.organizer_email]) {
        return emailToName[booking.organizer_email];
      }
      return null;
    };

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
            host_name: getHostName(currentBooking),
            organizer_email: currentBooking.organizer_email || null,
            start_time: currentBooking.start_time,
            end_time: currentBooking.end_time,
            source: currentBooking.source || null,
            external_source: currentBooking.external_source || null,
          }
        : null,
      next_bookings:
        upcomingBookings?.map((b) => ({
          id: b.id,
          title: b.title,
          host_name: getHostName(b),
          organizer_email: b.organizer_email || null,
          start_time: b.start_time,
          end_time: b.end_time,
          source: b.source || null,
          external_source: b.external_source || null,
        })) || [],
      available_until: availableUntil,
      ui_state: uiState,
      // Only include pin_code when there's a current booking (for security)
      pin_code: currentBooking && room.pin_code ? room.pin_code : null,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

